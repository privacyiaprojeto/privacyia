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
const AUDIT_SCHEMA_VERSION = 'privacy-identity-training-target-audit-v1'
const AUDIT_CONFIRMATION = 'EXECUTAR AUDITORIA DO ALVO DE TREINAMENTO D3.6H4'
const LEGACY_PROFILE = 'wan_vace_identity_poc_v1'
const CANDIDATE_PROFILE = 'wan_dit_identity_video_v1'

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function isPrivateReference(bucket, key) {
  return Boolean(text(bucket) && text(key) && !/^https?:\/\//i.test(text(bucket)) && !/^https?:\/\//i.test(text(key)) && !text(key).startsWith('/'))
}
function blocker(code, message, severity = 'critical') { return { code, message, severity } }

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
    const loraKeys = keys.filter((key) => /(?:lora|adapter)/i.test(key))
    const families = [...new Set(keys.map((key) => {
      const normalized = key.toLowerCase()
      if (normalized.includes('vace')) return 'vace'
      if (normalized.includes('dit')) return 'dit'
      if (normalized.includes('transformer')) return 'transformer'
      return null
    }).filter(Boolean))]
    return { valid: keys.length > 0 && loraKeys.length > 0, tensorCount: keys.length, loraTensorCount: loraKeys.length, targetFamilies: families, keySamples: keys.slice(0, 8), metadataKeys: Object.keys(safeObject(parsed.__metadata__)) }
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
        sha256Prefix: actualSha256.slice(0, 12),
        byteSize: Number(fileStat.size),
      }
    } finally {
      try { await rm(tempRoot, { recursive: true, force: true }) } catch { tempRemoved = false }
    }
  }

  const families = new Set((adapterAudit.targetFamilies || []).map((item) => text(item).toLowerCase()))
  const currentProfile = text(env.IDENTITY_LORA_TRAINING_PROFILE) || LEGACY_PROFILE
  const vaceOnly = families.has('vace') && !families.has('dit') && !families.has('transformer')
  const blockers = []
  if (!adapterAudit.sha256Matched) blockers.push(blocker('ADAPTER_SHA256_MISMATCH', 'O checksum privado do adapter não corresponde ao registro do banco.'))
  if (!adapterAudit.byteSizeMatched) blockers.push(blocker('ADAPTER_BYTE_SIZE_MISMATCH', 'O tamanho privado do adapter não corresponde ao registro do banco.'))
  if (!adapterAudit.safetensorsHeaderValid) blockers.push(blocker('ADAPTER_STRUCTURE_NOT_VERIFIED', 'O cabeçalho safetensors não comprovou tensores LoRA válidos.'))
  if (currentProfile === LEGACY_PROFILE) blockers.push(blocker('LEGACY_VACE_IDENTITY_PROFILE', 'O treinamento atual usa o perfil legado wan_vace_identity_poc_v1.'))
  if (vaceOnly) blockers.push(blocker('ADAPTER_TARGETS_VACE_CONTROL_BRANCH_ONLY', 'Os tensores encontrados estão restritos ao ramo de controle VACE; isso não comprova uma identidade geral no gerador de vídeo.'))
  if (!families.has('dit') && !families.has('transformer')) blockers.push(blocker('GENERAL_VIDEO_IDENTITY_TARGET_MISSING', 'O adapter não contém evidência de tensores de identidade no componente principal de geração de vídeo.'))
  blockers.push(blocker('CANDIDATE_TRAINING_CONTRACT_NOT_PREFLIGHTED', 'O contrato candidato para identidade de vídeo ainda não passou por preflight estático completo e permanece proibido para execução paga.'))

  const now = new Date().toISOString()
  const audit = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: 'failed',
    verdict: 'current_vace_control_adapter_not_general_video_identity_proven',
    executedAt: now,
    executedByProfileId: requestedByProfileId || null,
    currentTraining: {
      contractVersion: text(env.IDENTITY_LORA_TRAINER_CONTRACT_VERSION),
      profile: currentProfile,
      modelRepository: text(run.base_model || adapter.base_model || env.IDENTITY_LORA_BASE_MODEL),
      modelFingerprintPrefix: text(run.base_model_fingerprint || adapter.base_model_fingerprint).slice(0, 12) || null,
      sourceAuditedCommand: {
        loraBaseModel: 'vace',
        removePrefixInCheckpoint: 'pipe.vace.',
        dataFileKeys: ['video', 'vace_video', 'vace_reference_image'],
        extraInputs: ['vace_video', 'vace_reference_image'],
      },
    },
    adapter: adapterAudit,
    compatibility: {
      promptToVideoIdentityProven: false,
      randomBaseVideoV2vIdentityProven: false,
      vaceControlBranchPresent: families.has('vace'),
      generalGeneratorIdentityBranchPresent: families.has('dit') || families.has('transformer'),
      actorMappingRawRgbControlAllowed: false,
      currentAdapterReusableForProduction: false,
      newTrainingRequired: true,
      newTrainingStarted: false,
    },
    candidateContract: {
      profile: CANDIDATE_PROFILE,
      status: 'design_candidate_only',
      identityTargetComponentCandidate: 'dit',
      controlTargetComponent: 'vace',
      componentsMustRemainSeparated: true,
      requiresRandomBaseVideo: true,
      requiresMotionOnlyControl: true,
      requiresSameSeedBaselineWithoutLora: true,
      requiresCandidateWithLora: true,
      requiresStaticContractPreflight: true,
      requiresRuntimeDryRunPreflight: true,
      paidExecutionApproved: false,
    },
    blockers: [...new Map(blockers.map((item) => [item.code, item])).values()],
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
    const update = await supabaseAdmin.from(ADAPTERS_TABLE).update({ qa_report: { ...qaReport, trainingTargetAudit: audit }, updated_at: now }).eq('id', adapter.id).eq('actor_profile_id', actorProfileId).eq('training_run_id', run.id).select('id, status, qa_status').single()
    if (update.error) throw new ApiError(500, 'Erro ao registrar a auditoria do alvo de treinamento.', update.error)
    if (text(update.data?.status) !== 'qa_pending' || text(update.data?.qa_status) !== 'pending') throw new ApiError(409, 'A auditoria foi registrada, mas o adapter não permaneceu em qa_pending. Não execute treino nem aprovação antes de revisar o banco.')
  }

  return {
    status: 'STAGE_2_2D3_6H4_TRAINING_TARGET_AUDIT_FAILED_SAFE',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    trainingTargetAudit: publicAuditSnapshot(audit),
    nextPaidTestAllowed: false,
    nextAction: 'Manter o adapter em qa_pending. Preparar o contrato candidato de identidade de vídeo em uma etapa separada, ainda sem GPU.',
    safety: audit.safety,
  }
}

export {
  AUDIT_CONFIRMATION as IDENTITY_TRAINING_TARGET_AUDIT_CONFIRMATION,
  LEGACY_PROFILE as LEGACY_IDENTITY_TRAINING_PROFILE,
  CANDIDATE_PROFILE as CANDIDATE_IDENTITY_TRAINING_PROFILE,
}
