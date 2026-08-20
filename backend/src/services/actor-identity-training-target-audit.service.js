import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, open, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { downloadPrivateObjectToFile } from './storage.service.js'

const RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const AUDIT_SCHEMA_VERSION = 'privacy-identity-training-target-audit-v2'
const AUDIT_CONFIRMATION = 'EXECUTAR AUDITORIA DO ALVO DE TREINAMENTO D3.6H4'
const LEGACY_PROFILE = 'wan_vace_identity_poc_v1'
const CANDIDATE_PROFILE = 'wan_dit_identity_video_v1'
const DIT_LORA_BASE_MODEL = 'dit'
const DIT_REMOVE_PREFIX = 'pipe.dit.'
const REQUIRED_DIT_TARGET_MODULES = Object.freeze([
  'cross_attn.q',
  'cross_attn.k',
  'cross_attn.v',
  'cross_attn.o',
  'ffn.0',
  'ffn.2',
])
const FORBIDDEN_TARGET_MARKERS = Object.freeze([
  'vace',
  'vace_blocks',
  'self_attn',
])

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function isPrivateReference(bucket, key) {
  return Boolean(text(bucket) && text(key) && !/^https?:\/\//i.test(text(bucket)) && !/^https?:\/\//i.test(text(key)) && !text(key).startsWith('/'))
}
function blocker(code, message, severity = 'critical') { return { code, message, severity } }

function normalizedModuleSet(values) {
  return new Set((Array.isArray(values) ? values : []).map((item) => text(item).toLowerCase()).filter(Boolean))
}

function exactModuleSetMatch(actualValues, expectedValues = REQUIRED_DIT_TARGET_MODULES) {
  const actual = normalizedModuleSet(actualValues)
  const expected = normalizedModuleSet(expectedValues)
  return actual.size === expected.size && [...expected].every((item) => actual.has(item))
}

function keyContainsModule(normalizedKey, moduleName) {
  const needle = text(moduleName).toLowerCase()
  return normalizedKey.includes(`.${needle}.`)
    || normalizedKey.startsWith(`${needle}.`)
    || normalizedKey.endsWith(`.${needle}`)
    || normalizedKey === needle
}

function classifyLoraTargetKeys(keys = []) {
  const loraKeys = (Array.isArray(keys) ? keys : []).filter((key) => /(?:lora|adapter)/i.test(String(key || '')))
  const moduleCoverage = Object.fromEntries(
    REQUIRED_DIT_TARGET_MODULES.map((moduleName) => [moduleName, { present: false, tensorCount: 0 }]),
  )
  const forbiddenTargetCounts = Object.fromEntries(
    FORBIDDEN_TARGET_MARKERS.map((marker) => [marker, 0]),
  )

  let approvedScopeTensorCount = 0
  let unknownLoraTensorCount = 0

  for (const rawKey of loraKeys) {
    const normalized = String(rawKey || '').toLowerCase()
    const matchedModules = REQUIRED_DIT_TARGET_MODULES.filter((moduleName) => keyContainsModule(normalized, moduleName))
    const matchedForbidden = FORBIDDEN_TARGET_MARKERS.filter((marker) => normalized.includes(marker))

    for (const moduleName of matchedModules) {
      moduleCoverage[moduleName].present = true
      moduleCoverage[moduleName].tensorCount += 1
    }
    for (const marker of matchedForbidden) {
      forbiddenTargetCounts[marker] += 1
    }

    if (matchedModules.length > 0 && matchedForbidden.length === 0) {
      approvedScopeTensorCount += 1
    } else if (matchedModules.length === 0 && matchedForbidden.length === 0) {
      unknownLoraTensorCount += 1
    }
  }

  const missingRequiredModules = REQUIRED_DIT_TARGET_MODULES.filter((moduleName) => moduleCoverage[moduleName].present !== true)
  const forbiddenTargetPresent = Object.values(forbiddenTargetCounts).some((count) => Number(count) > 0)
  const generalGeneratorIdentityBranchPresent =
    loraKeys.length > 0
    && missingRequiredModules.length === 0
    && forbiddenTargetPresent === false
    && unknownLoraTensorCount === 0
    && approvedScopeTensorCount === loraKeys.length

  const targetFamilies = []
  if (approvedScopeTensorCount > 0) targetFamilies.push('dit')
  if (forbiddenTargetCounts.vace > 0 || forbiddenTargetCounts.vace_blocks > 0) targetFamilies.push('vace')
  if (loraKeys.some((key) => String(key || '').toLowerCase().includes('transformer'))) targetFamilies.push('transformer')

  return {
    loraTensorCount: loraKeys.length,
    targetFamilies: [...new Set(targetFamilies)],
    moduleCoverage,
    missingRequiredModules,
    forbiddenTargetCounts,
    forbiddenTargetPresent,
    approvedScopeTensorCount,
    unknownLoraTensorCount,
    generalGeneratorIdentityBranchPresent,
  }
}

async function loadLatestIdentity(actorProfileId) {
  const runResult = await supabaseAdmin.from(RUNS_TABLE).select('*').eq('actor_profile_id', actorProfileId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (runResult.error) throw new ApiError(500, 'Erro ao carregar o treinamento da identidade.', runResult.error)
  if (!runResult.data) throw new ApiError(409, 'Nenhum treinamento de identidade foi encontrado para este ator.')
  const adapterResult = await supabaseAdmin.from(ADAPTERS_TABLE).select('*').eq('actor_profile_id', actorProfileId).eq('training_run_id', runResult.data.id).order('adapter_version', { ascending: false }).limit(1).maybeSingle()
  if (adapterResult.error) throw new ApiError(500, 'Erro ao carregar o adapter da identidade.', adapterResult.error)
  if (!adapterResult.data) throw new ApiError(409, 'Nenhum adapter foi registrado para o treinamento mais recente.')
  return { run: runResult.data, adapter: adapterResult.data }
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filePath)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function parseSafetensorsHeader(filePath) {
  const handle = await open(filePath, 'r')
  try {
    const lengthBuffer = Buffer.alloc(8)
    const lengthRead = await handle.read(lengthBuffer, 0, 8, 0)
    if (lengthRead.bytesRead !== 8) throw new Error('header_length_missing')
    const length = Number(lengthBuffer.readBigUInt64LE(0))
    if (!Number.isSafeInteger(length) || length <= 0 || length > 64 * 1024 * 1024) throw new Error('header_length_invalid')
    const headerBuffer = Buffer.alloc(length)
    const headerRead = await handle.read(headerBuffer, 0, length, 8)
    if (headerRead.bytesRead !== length) throw new Error('header_incomplete')
    const parsed = JSON.parse(headerBuffer.toString('utf8'))
    const keys = Object.keys(parsed).filter((key) => key !== '__metadata__')
    const targetAnalysis = classifyLoraTargetKeys(keys)
    return {
      valid: keys.length > 0 && targetAnalysis.loraTensorCount > 0,
      tensorCount: keys.length,
      loraTensorCount: targetAnalysis.loraTensorCount,
      targetFamilies: targetAnalysis.targetFamilies,
      keySamples: keys.slice(0, 8),
      metadataKeys: Object.keys(safeObject(parsed.__metadata__)),
      moduleCoverage: targetAnalysis.moduleCoverage,
      missingRequiredModules: targetAnalysis.missingRequiredModules,
      forbiddenTargetCounts: targetAnalysis.forbiddenTargetCounts,
      forbiddenTargetPresent: targetAnalysis.forbiddenTargetPresent,
      approvedScopeTensorCount: targetAnalysis.approvedScopeTensorCount,
      unknownLoraTensorCount: targetAnalysis.unknownLoraTensorCount,
      generalGeneratorIdentityBranchPresent: targetAnalysis.generalGeneratorIdentityBranchPresent,
    }
  } finally { await handle.close() }
}

function publicAuditSnapshot(value) {
  const audit = safeObject(value)
  return {
    schemaVersion: text(audit.schemaVersion) || AUDIT_SCHEMA_VERSION,
    status: text(audit.status) || 'not_run',
    verdict: text(audit.verdict) || 'not_evaluated',
    executedAt: audit.executedAt || null,
    executedByProfileId: audit.executedByProfileId || null,
    currentTraining: safeObject(audit.currentTraining),
    adapter: safeObject(audit.adapter),
    compatibility: safeObject(audit.compatibility),
    candidateContract: safeObject(audit.candidateContract),
    blockers: Array.isArray(audit.blockers) ? audit.blockers : [],
    nextPaidTestAllowed: audit.nextPaidTestAllowed === true,
    safety: safeObject(audit.safety),
  }
}

export async function inspectActorIdentityTrainingTargetAudit(actorProfileId) {
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const qaReport = safeObject(adapter.qa_report)
  return {
    status: 'STAGE_2_2D3_6H4_TRAINING_TARGET_AUDIT_READINESS',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    trainingTargetAudit: publicAuditSnapshot(qaReport.trainingTargetAudit),
    currentTrainingProfile: text(env.IDENTITY_LORA_TRAINING_PROFILE) || LEGACY_PROFILE,
    paidTrainingGate: {
      auditApproved: env.IDENTITY_LORA_TRAINING_TARGET_AUDIT_APPROVED === true,
      paidTrainingAllowed: env.IDENTITY_LORA_PAID_TRAINING_AFTER_TARGET_AUDIT === true,
      configuredTargetProfile: text(env.IDENTITY_LORA_TRAINING_TARGET_PROFILE),
      ready: false,
    },
    nextPaidTestAllowed: false,
    mode: 'database_plan_read_only',
    safety: { databaseReadExecuted: true, databaseMutationExecuted: false, r2ReadExecuted: false, runPodCalled: false, gpuStarted: false, trainingStarted: false },
  }
}

export async function runActorIdentityTrainingTargetAudit(actorProfileId, { requestedByProfileId = null, confirmation = '', persist = true, verifyPrivate = true } = {}) {
  if (text(confirmation) !== AUDIT_CONFIRMATION) throw new ApiError(422, 'A frase de confirmação da auditoria do alvo de treinamento é inválida.')
  if (persist && !requestedByProfileId) throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela auditoria.')

  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  if (!isPrivateReference(adapter.r2_bucket, adapter.r2_key)) throw new ApiError(409, 'O adapter não possui referência privada válida para auditoria.')

  const qaReport = safeObject(adapter.qa_report)
  const forensicAdapter = safeObject(safeObject(safeObject(qaReport.visualEvidence).forensicAudit).adapter)
  let adapterAudit = {
    verified: forensicAdapter.verified === true,
    sha256Matched: forensicAdapter.sha256Matched === true,
    byteSizeMatched: forensicAdapter.byteSizeMatched === true,
    safetensorsHeaderValid: forensicAdapter.safetensorsHeaderValid === true,
    tensorCount: Number(forensicAdapter.tensorCount || 0),
    loraTensorCount: Number(forensicAdapter.loraTensorCount || 0),
    targetFamilies: Array.isArray(forensicAdapter.targetFamilies) ? forensicAdapter.targetFamilies : [],
    keySamples: Array.isArray(forensicAdapter.keySamples) ? forensicAdapter.keySamples : [],
    moduleCoverage: safeObject(forensicAdapter.moduleCoverage),
    missingRequiredModules: Array.isArray(forensicAdapter.missingRequiredModules) ? forensicAdapter.missingRequiredModules : [],
    forbiddenTargetCounts: safeObject(forensicAdapter.forbiddenTargetCounts),
    forbiddenTargetPresent: forensicAdapter.forbiddenTargetPresent === true,
    approvedScopeTensorCount: Number(forensicAdapter.approvedScopeTensorCount || 0),
    unknownLoraTensorCount: Number(forensicAdapter.unknownLoraTensorCount || 0),
    generalGeneratorIdentityBranchPresent: forensicAdapter.generalGeneratorIdentityBranchPresent === true,
    sha256Prefix: text(forensicAdapter.sha256Prefix) || text(adapter.sha256).slice(0, 12),
    byteSize: Number(forensicAdapter.byteSize || adapter.byte_size || 0),
  }

  let r2ReadCount = 0
  let tempRemoved = true

  if (verifyPrivate) {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'privacy-identity-target-audit-'))
    try {
      const adapterPath = path.join(tempRoot, 'adapter.safetensors')
      await downloadPrivateObjectToFile({ bucket: adapter.r2_bucket, key: adapter.r2_key, filePath: adapterPath })
      r2ReadCount += 1
      const [actualSha256, fileStat, header] = await Promise.all([sha256File(adapterPath), stat(adapterPath), parseSafetensorsHeader(adapterPath)])
      adapterAudit = {
        verified: true,
        sha256Matched: actualSha256 === text(adapter.sha256).toLowerCase(),
        byteSizeMatched: Number(fileStat.size) === Number(adapter.byte_size),
        safetensorsHeaderValid: header.valid === true,
        tensorCount: header.tensorCount,
        loraTensorCount: header.loraTensorCount,
        targetFamilies: header.targetFamilies,
        keySamples: header.keySamples,
        metadataKeys: header.metadataKeys,
        moduleCoverage: header.moduleCoverage,
        missingRequiredModules: header.missingRequiredModules,
        forbiddenTargetCounts: header.forbiddenTargetCounts,
        forbiddenTargetPresent: header.forbiddenTargetPresent,
        approvedScopeTensorCount: header.approvedScopeTensorCount,
        unknownLoraTensorCount: header.unknownLoraTensorCount,
        generalGeneratorIdentityBranchPresent: header.generalGeneratorIdentityBranchPresent,
        sha256Prefix: actualSha256.slice(0, 12),
        byteSize: Number(fileStat.size),
      }
    } finally {
      try { await rm(tempRoot, { recursive: true, force: true }) } catch { tempRemoved = false }
    }
  }

  const currentProfile = text(env.IDENTITY_LORA_TRAINING_PROFILE) || LEGACY_PROFILE
  const runMetadata = safeObject(run.metadata)
  const targetMetadata = safeObject(runMetadata.stage_2_2d3_6h7)
  const runTargetProfile = text(targetMetadata.targetProfile) || currentProfile
  const runTargetModules = Array.isArray(targetMetadata.targetModules) ? targetMetadata.targetModules.map(text).filter(Boolean) : []
  const vaceFrozen = targetMetadata.vaceFrozen === true
  const targetModulesMatch = exactModuleSetMatch(runTargetModules)

  const blockers = []

  if (!adapterAudit.sha256Matched) blockers.push(blocker('ADAPTER_SHA256_MISMATCH', 'O checksum privado do adapter não corresponde ao registro do banco.'))
  if (!adapterAudit.byteSizeMatched) blockers.push(blocker('ADAPTER_BYTE_SIZE_MISMATCH', 'O tamanho privado do adapter não corresponde ao registro do banco.'))
  if (!adapterAudit.safetensorsHeaderValid) blockers.push(blocker('ADAPTER_STRUCTURE_NOT_VERIFIED', 'O cabeçalho safetensors não comprovou tensores LoRA válidos.'))
  if (currentProfile === LEGACY_PROFILE) blockers.push(blocker('LEGACY_VACE_IDENTITY_PROFILE', 'O ambiente ainda aponta para o perfil legado wan_vace_identity_poc_v1.'))
  if (currentProfile !== CANDIDATE_PROFILE) blockers.push(blocker('TRAINING_PROFILE_NOT_APPROVED', `O perfil configurado não é ${CANDIDATE_PROFILE}.`))
  if (runTargetProfile !== CANDIDATE_PROFILE) blockers.push(blocker('RUN_TARGET_PROFILE_MISMATCH', `O run não comprova o perfil ${CANDIDATE_PROFILE}.`))
  if (vaceFrozen !== true) blockers.push(blocker('VACE_CONTROL_BRANCH_NOT_FROZEN', 'O metadata do run não comprova VACE congelado durante o treinamento DiT.'))
  if (!targetModulesMatch) blockers.push(blocker('DIT_TARGET_MODULE_CONTRACT_MISMATCH', 'Os módulos-alvo registrados no run não correspondem ao conjunto DiT homologado.'))
  if (adapterAudit.forbiddenTargetPresent === true) blockers.push(blocker('FORBIDDEN_LORA_TARGET_PRESENT', 'O adapter contém tensores LoRA em ramo proibido (VACE/VACE blocks/self-attention).'))
  if (Number(adapterAudit.unknownLoraTensorCount || 0) > 0) blockers.push(blocker('UNEXPECTED_LORA_TARGET_PRESENT', 'O adapter contém tensores LoRA fora dos módulos DiT homologados.'))
  if (Array.isArray(adapterAudit.missingRequiredModules) && adapterAudit.missingRequiredModules.length > 0) {
    blockers.push(blocker('GENERAL_VIDEO_IDENTITY_TARGET_MISSING', `Faltam módulos DiT obrigatórios: ${adapterAudit.missingRequiredModules.join(', ')}.`))
  }
  if (adapterAudit.generalGeneratorIdentityBranchPresent !== true) {
    blockers.push(blocker('GENERAL_VIDEO_IDENTITY_TARGET_NOT_VERIFIED', 'O arquivo não comprovou cobertura integral e exclusiva dos módulos DiT homologados.'))
  }

  const dedupedBlockers = [...new Map(blockers.map((item) => [item.code, item])).values()]
  const technicalPassed = dedupedBlockers.length === 0
  const now = new Date().toISOString()
  const candidateContract = {
    profile: CANDIDATE_PROFILE,
    status: technicalPassed ? 'preflight_passed' : 'preflight_failed',
    identityTargetComponentCandidate: DIT_LORA_BASE_MODEL,
    controlTargetComponent: 'vace',
    componentsMustRemainSeparated: true,
    requiresRandomBaseVideo: true,
    requiresMotionOnlyControl: true,
    requiresSameSeedBaselineWithoutLora: true,
    requiresCandidateWithLora: true,
    requiresStaticContractPreflight: true,
    requiresRuntimeDryRunPreflight: true,
    paidExecutionApproved: technicalPassed,
  }

  const adapterContentRequiresNewTraining = dedupedBlockers.some((item) => [
    'ADAPTER_SHA256_MISMATCH',
    'ADAPTER_BYTE_SIZE_MISMATCH',
    'ADAPTER_STRUCTURE_NOT_VERIFIED',
    'FORBIDDEN_LORA_TARGET_PRESENT',
    'UNEXPECTED_LORA_TARGET_PRESENT',
    'GENERAL_VIDEO_IDENTITY_TARGET_MISSING',
    'GENERAL_VIDEO_IDENTITY_TARGET_NOT_VERIFIED',
  ].includes(item.code))

  const audit = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: technicalPassed ? 'passed' : 'failed',
    verdict: technicalPassed ? 'wan_dit_identity_target_verified' : 'wan_dit_identity_target_not_verified',
    executedAt: now,
    executedByProfileId: requestedByProfileId || null,
    currentTraining: {
      contractVersion: text(env.IDENTITY_LORA_TRAINER_CONTRACT_VERSION),
      profile: currentProfile,
      runTargetProfile,
      modelRepository: text(run.base_model || adapter.base_model || env.IDENTITY_LORA_BASE_MODEL),
      modelFingerprintPrefix: text(run.base_model_fingerprint || adapter.base_model_fingerprint).slice(0, 12) || null,
      sourceAuditedCommand: {
        loraBaseModel: DIT_LORA_BASE_MODEL,
        removePrefixInCheckpoint: DIT_REMOVE_PREFIX,
        vaceFrozen,
        targetModules: runTargetModules,
        dataFileKeys: ['video', 'vace_video', 'vace_reference_image'],
        extraInputs: ['vace_video', 'vace_reference_image'],
      },
    },
    adapter: adapterAudit,
    compatibility: {
      promptToVideoIdentityProven: false,
      randomBaseVideoV2vIdentityProven: false,
      vaceControlBranchPresent: adapterAudit.forbiddenTargetPresent === true,
      generalGeneratorIdentityBranchPresent: technicalPassed && adapterAudit.generalGeneratorIdentityBranchPresent === true,
      actorMappingRawRgbControlAllowed: false,
      currentAdapterReusableForProduction: false,
      newTrainingRequired: technicalPassed ? false : adapterContentRequiresNewTraining,
      newTrainingStarted: false,
    },
    candidateContract,
    blockers: dedupedBlockers,
    nextPaidTestAllowed: false,
    safety: {
      databaseReadExecuted: true,
      databaseMutationExecuted: Boolean(persist),
      r2ReadExecuted: r2ReadCount > 0,
      r2ReadCount,
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      previewGenerated: false,
      adapterApproved: false,
      adapterRejected: false,
      productReleased: false,
      automaticRetryCreated: false,
      destructiveDelete: false,
      localTemporaryFilesRemoved: tempRemoved,
    },
  }

  if (persist) {
    const update = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .update({ qa_report: { ...qaReport, trainingTargetAudit: audit }, updated_at: now })
      .eq('id', adapter.id)
      .eq('actor_profile_id', actorProfileId)
      .eq('training_run_id', run.id)
      .select('id, status, qa_status')
      .single()

    if (update.error) throw new ApiError(500, 'Erro ao registrar a auditoria do alvo de treinamento.', update.error)
    if (text(update.data?.status) !== 'qa_pending' || text(update.data?.qa_status) !== 'pending') {
      throw new ApiError(409, 'A auditoria foi registrada, mas o adapter não permaneceu em qa_pending. Não execute treino nem aprovação antes de revisar o banco.')
    }
  }

  return {
    status: technicalPassed
      ? 'STAGE_2_2D3_6H4_TRAINING_TARGET_AUDIT_PASSED'
      : 'STAGE_2_2D3_6H4_TRAINING_TARGET_AUDIT_FAILED_SAFE',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    trainingTargetAudit: publicAuditSnapshot(audit),
    nextPaidTestAllowed: false,
    nextAction: technicalPassed
      ? 'Alvo DiT comprovado. Manter o adapter em qa_pending e executar a auditoria forense/evidência visual antes de qualquer aprovação ou teste pago.'
      : 'Manter o adapter em qa_pending. Corrigir apenas os bloqueios técnicos comprovados antes de qualquer novo treino.',
    safety: audit.safety,
  }
}

export {
  AUDIT_CONFIRMATION as IDENTITY_TRAINING_TARGET_AUDIT_CONFIRMATION,
  LEGACY_PROFILE as LEGACY_IDENTITY_TRAINING_PROFILE,
  CANDIDATE_PROFILE as CANDIDATE_IDENTITY_TRAINING_PROFILE,
  REQUIRED_DIT_TARGET_MODULES,
  FORBIDDEN_TARGET_MARKERS,
  classifyLoraTargetKeys as classifyIdentityLoraTargetKeysForAudit,
}
