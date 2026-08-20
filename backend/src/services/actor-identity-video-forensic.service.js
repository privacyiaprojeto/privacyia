import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { downloadPrivateObjectToFile } from './storage.service.js'

const RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const FORENSIC_CONFIRMATION = 'EXECUTAR AUDITORIA FORENSE SEM GPU D3.6H3'
const AUDIT_SCHEMA_VERSION = 'privacy-identity-video-forensic-audit-v2'
const FUTURE_VALIDATION_PROFILE = 'video_softedge_abc_v1'
const PREVIEW_CONTRACT_VERSION = 'privacy-identity-motion-abc-v1'
const QA_KIT_SCHEMA_VERSION = 'privacy-identity-motion-abc-kit-v1'
const CONTROL_REPRESENTATION = 'softedge_ffmpeg_edgedetect_v1'
const EXPECTED_ASSET_KEYS = [
  'baseline_without_identity',
  'identity_reference_without_lora',
  'candidate_with_lora',
]

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function isSha256(value) { return /^[0-9a-f]{64}$/i.test(text(value)) }
function isPrivateReference(bucket, key) {
  return Boolean(text(bucket) && text(key) && !/^https?:\/\//i.test(text(bucket)) && !/^https?:\/\//i.test(text(key)) && !text(key).startsWith('/'))
}
function blocker(code, message, severity = 'critical') { return { code, message, severity } }

async function loadLatestIdentity(actorProfileId) {
  const runResult = await supabaseAdmin
    .from(RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runResult.error) throw new ApiError(500, 'Erro ao carregar o treinamento da identidade.', runResult.error)
  if (!runResult.data) throw new ApiError(409, 'Nenhum treinamento de identidade foi encontrado para este ator.')

  const adapterResult = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('training_run_id', runResult.data.id)
    .order('adapter_version', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (adapterResult.error) throw new ApiError(500, 'Erro ao carregar o adapter da identidade.', adapterResult.error)
  if (!adapterResult.data) throw new ApiError(409, 'Nenhum adapter foi registrado para o treinamento mais recente.')
  return { run: runResult.data, adapter: adapterResult.data }
}

function visualEvidence(adapter) {
  const qaReport = safeObject(adapter.qa_report)
  return safeObject(qaReport.visualEvidence || qaReport.visual_evidence)
}

function publicAuditSnapshot(audit) {
  const value = safeObject(audit)
  return {
    schemaVersion: text(value.schemaVersion) || AUDIT_SCHEMA_VERSION,
    status: text(value.status) || 'not_run',
    verdict: text(value.verdict) || 'not_evaluated',
    executedAt: value.executedAt || null,
    executedByProfileId: value.executedByProfileId || null,
    blockers: Array.isArray(value.blockers) ? value.blockers.map((item) => ({
      code: text(item.code),
      message: text(item.message),
      severity: text(item.severity) || 'critical',
    })) : [],
    adapter: safeObject(value.adapter),
    sourceLineage: safeObject(value.sourceLineage),
    similarity: safeObject(value.similarity),
    futureValidation: safeObject(value.futureValidation),
    safety: safeObject(value.safety),
  }
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

function validateProvenance({ run, adapter, evidence, blockers }) {
  const qaReport = safeObject(adapter.qa_report)
  const targetAudit = safeObject(qaReport.trainingTargetAudit)
  const targetAdapter = safeObject(targetAudit.adapter)
  const targetCompatibility = safeObject(targetAudit.compatibility)
  const targetCandidate = safeObject(targetAudit.candidateContract)

  if (text(targetAudit.status) !== 'passed') blockers.push(blocker('TRAINING_TARGET_AUDIT_NOT_PASSED', 'O alvo técnico DiT ainda não está homologado.'))
  if (targetCompatibility.generalGeneratorIdentityBranchPresent !== true || targetCandidate.paidExecutionApproved !== true) blockers.push(blocker('DIT_TARGET_COMPONENT_NOT_APPROVED', 'O target audit não comprovou o componente geral DiT.'))
  if (targetCompatibility.newTrainingRequired === true) blockers.push(blocker('TARGET_AUDIT_REQUIRES_NEW_TRAINING', 'O target audit ainda solicita novo treinamento.'))
  if (targetAdapter.verified !== true || targetAdapter.sha256Matched !== true || targetAdapter.safetensorsHeaderValid !== true) blockers.push(blocker('ADAPTER_TARGET_AUDIT_INTEGRITY_MISSING', 'O target audit não comprova integridade estrutural do adapter.'))
  if (!Array.isArray(targetAdapter.targetFamilies) || !targetAdapter.targetFamilies.includes('dit')) blockers.push(blocker('ADAPTER_DIT_FAMILY_NOT_PROVEN', 'O target audit não comprova família DiT.'))
  if (targetAdapter.forbiddenTargetPresent === true || Number(targetAdapter.unknownLoraTensorCount || 0) > 0) blockers.push(blocker('ADAPTER_TARGET_SCOPE_UNSAFE', 'O target audit detectou target proibido ou desconhecido.'))

  if (text(evidence.status) !== 'ready' || evidence.ready !== true || evidence.reviewable !== true) blockers.push(blocker('VISUAL_EVIDENCE_NOT_READY', 'O kit A/B/C ainda não está pronto para auditoria.'))
  if (text(evidence.contractVersion) !== PREVIEW_CONTRACT_VERSION) blockers.push(blocker('PREVIEW_CONTRACT_MISMATCH', 'A evidência não usa o contrato motion A/B/C homologado.'))

  const qaKit = safeObject(evidence.qaKit)
  if (text(qaKit.schemaVersion) !== QA_KIT_SCHEMA_VERSION) blockers.push(blocker('QA_KIT_SCHEMA_MISMATCH', 'O kit A/B/C retornou schema incompatível.'))

  const assets = Array.isArray(qaKit.assets) ? qaKit.assets : []
  const keys = assets.map((item) => text(item.assetKey))
  if (assets.length !== 3 || EXPECTED_ASSET_KEYS.some((key) => !keys.includes(key))) blockers.push(blocker('QA_KIT_ASSET_SET_INCOMPLETE', 'O kit A/B/C precisa conter exatamente A, B e C.'))
  for (const item of assets) {
    if (!isPrivateReference(item.r2Bucket, item.r2Key) || !isSha256(item.sha256) || Number(item.byteSize || 0) <= 0) {
      blockers.push(blocker('QA_ASSET_PRIVATE_REFERENCE_INVALID', `O asset ${text(item.assetKey) || 'desconhecido'} não possui referência privada íntegra.`))
    }
  }

  const provenance = safeObject(qaKit.provenance)
  const branchA = safeObject(provenance.branch_a)
  const branchB = safeObject(provenance.branch_b)
  const branchC = safeObject(provenance.branch_c)

  if (text(provenance.validation_profile) !== FUTURE_VALIDATION_PROFILE) blockers.push(blocker('VALIDATION_PROFILE_MISMATCH', 'A proveniência não usa o perfil soft-edge A/B/C homologado.'))
  if (text(provenance.control_representation) !== CONTROL_REPRESENTATION) blockers.push(blocker('CONTROL_REPRESENTATION_NOT_APPROVED', 'O controle não foi comprovado como soft-edge derivado.'))
  if (provenance.raw_rgb_control_used !== false) blockers.push(blocker('RAW_RGB_CONTROL_FORBIDDEN', 'O contrato atual proíbe controle RGB bruto.'))
  if (provenance.appearance_reduced_structural_control_used !== true) blockers.push(blocker('APPEARANCE_REDUCED_CONTROL_NOT_PROVEN', 'O uso de controle estrutural com aparência reduzida não foi comprovado.'))
  if (provenance.same_control_across_branches !== true) blockers.push(blocker('CONTROL_NOT_PAIRED_ACROSS_ABC', 'A/B/C não compartilharam exatamente o mesmo controle estrutural.'))
  if (provenance.same_seed_across_branches !== true) blockers.push(blocker('SEED_NOT_PAIRED_ACROSS_ABC', 'A/B/C não compartilharam exatamente a mesma seed.'))
  if (provenance.same_sampler_across_branches !== true) blockers.push(blocker('SAMPLER_NOT_PAIRED_ACROSS_ABC', 'A/B/C não compartilharam o mesmo sampler.'))
  if (text(provenance.source_motion_sha256).toLowerCase() !== text(env.IDENTITY_LORA_NEUTRAL_QA_SHA256).toLowerCase()) blockers.push(blocker('NEUTRAL_SOURCE_SHA_MISMATCH', 'A origem neutra do controle não corresponde ao SHA homologado.'))
  if (!isSha256(provenance.derived_control_sha256)) blockers.push(blocker('DERIVED_CONTROL_SHA_MISSING', 'O soft-edge derivado não possui SHA-256 auditável.'))
  if (text(provenance.derived_control_sha256).toLowerCase() === text(provenance.source_motion_sha256).toLowerCase()) blockers.push(blocker('CONTROL_DERIVATION_NOT_DISTINCT', 'O controle derivado não pode ter o mesmo SHA do vídeo RGB de origem.'))
  if (text(provenance.workflow_revision) !== 'M4-identity-motion-abc-softedge-v1') blockers.push(blocker('WORKFLOW_REVISION_NOT_APPROVED', 'A proveniência não comprova a revisão motion A/B/C homologada.'))

  if (!(branchA.kyc === false && branchA.trigger === false && branchA.lora === false)) blockers.push(blocker('BRANCH_A_NOT_CLEAN_BASELINE', 'O ramo A precisa permanecer sem KYC, trigger e LoRA.'))
  if (!(branchB.kyc === true && branchB.trigger === true && branchB.lora === false)) blockers.push(blocker('BRANCH_B_NOT_IDENTITY_REFERENCE', 'O ramo B precisa usar KYC + trigger e manter LoRA desligada.'))
  if (!(branchC.kyc === true && branchC.trigger === true && branchC.lora === true)) blockers.push(blocker('BRANCH_C_NOT_LORA_CANDIDATE', 'O ramo C precisa ser idêntico ao B, com LoRA ligada.'))
  if (text(branchB.reference_asset_id) !== text(branchC.reference_asset_id) || text(branchB.reference_sha256).toLowerCase() !== text(branchC.reference_sha256).toLowerCase()) blockers.push(blocker('IDENTITY_REFERENCE_NOT_PAIRED_BC', 'B e C não comprovam a mesma referência KYC.'))
  if (text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_ASSET_ID) && text(branchC.reference_asset_id) !== text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_ASSET_ID)) blockers.push(blocker('REFERENCE_ASSET_NOT_ARMED_ONE', 'A referência KYC não corresponde ao asset explicitamente armado.'))
  if (text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_SHA256) && text(branchC.reference_sha256).toLowerCase() !== text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_SHA256).toLowerCase()) blockers.push(blocker('REFERENCE_SHA_NOT_ARMED_ONE', 'A referência KYC não corresponde ao SHA explicitamente armado.'))
  if (text(branchB.trigger_token) !== text(branchC.trigger_token) || text(branchC.trigger_token) !== text(run.trigger_token)) blockers.push(blocker('TRIGGER_TOKEN_NOT_PAIRED_BC', 'B e C não comprovam o mesmo trigger token do run.'))
  if (text(branchC.adapter_sha256).toLowerCase() !== text(adapter.sha256).toLowerCase()) blockers.push(blocker('CANDIDATE_ADAPTER_SHA_MISMATCH', 'O ramo C não comprova o adapter registrado.'))
  if (Number(branchC.lora_strength) !== 0.65) blockers.push(blocker('LORA_STRENGTH_NOT_APPROVED', 'O ramo C não comprova strength 0.65.'))

  return { qaKit, assets, provenance, targetAdapter }
}

export async function inspectActorIdentityVideoForensicReadiness(actorProfileId) {
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const evidence = visualEvidence(adapter)
  const audit = publicAuditSnapshot(evidence.forensicAudit)
  return {
    status: 'M4_IDENTITY_MOTION_ABC_FORENSIC_READINESS',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    previewStatus: text(evidence.status) || 'not_started',
    assetCount: Array.isArray(safeObject(evidence.qaKit).assets) ? safeObject(evidence.qaKit).assets.length : 0,
    forensicAudit: audit,
    nextPaidTestAllowed: false,
    safety: { databaseReadExecuted: true, databaseMutationExecuted: false, r2ReadExecuted: false, runPodCalled: false, gpuStarted: false, destructiveDelete: false },
  }
}

export async function runActorIdentityVideoForensicAudit(actorProfileId, { requestedByProfileId = null, confirmation, persist = true } = {}) {
  if (text(confirmation) !== FORENSIC_CONFIRMATION) throw new ApiError(400, 'Confirmação inválida para executar a auditoria forense sem GPU.')
  if (!requestedByProfileId && persist) throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela auditoria.')

  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const evidence = visualEvidence(adapter)
  const blockers = []
  const { qaKit, assets, provenance, targetAdapter } = validateProvenance({ run, adapter, evidence, blockers })

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'privacy-identity-motion-abc-forensic-'))
  const assetIntegrity = []
  let r2ReadCount = 0
  try {
    for (const item of assets) {
      if (!isPrivateReference(item.r2Bucket, item.r2Key) || !isSha256(item.sha256) || Number(item.byteSize || 0) <= 0) continue
      const filePath = path.join(tempRoot, `${text(item.assetKey) || 'asset'}.mp4`)
      await downloadPrivateObjectToFile({ bucket: item.r2Bucket, key: item.r2Key, filePath })
      r2ReadCount += 1
      const [actualSha256, fileStat] = await Promise.all([sha256File(filePath), stat(filePath)])
      const sha256Matched = actualSha256 === text(item.sha256).toLowerCase()
      const byteSizeMatched = Number(fileStat.size) === Number(item.byteSize)
      assetIntegrity.push({ assetKey: text(item.assetKey), sha256Matched, byteSizeMatched, sha256Prefix: actualSha256.slice(0, 12), byteSize: Number(fileStat.size) })
      if (!sha256Matched) blockers.push(blocker('QA_ASSET_SHA256_MISMATCH', `Checksum divergente no asset ${text(item.assetKey)}.`))
      if (!byteSizeMatched) blockers.push(blocker('QA_ASSET_BYTE_SIZE_MISMATCH', `Tamanho divergente no asset ${text(item.assetKey)}.`))
    }
  } finally {
    await rm(tempRoot, { recursive: true, force: true })
  }

  const uniqueBlockers = [...new Map(blockers.map((item) => [item.code, item])).values()]
  const auditStatus = uniqueBlockers.some((item) => item.severity === 'critical') ? 'failed' : 'passed'
  const now = new Date().toISOString()
  const adapterSnapshot = {
    verified: targetAdapter.verified === true,
    sha256Matched: targetAdapter.sha256Matched === true,
    byteSizeMatched: targetAdapter.byteSizeMatched === true,
    safetensorsHeaderValid: targetAdapter.safetensorsHeaderValid === true,
    loraTensorCount: Number(targetAdapter.loraTensorCount || 0),
    targetFamilies: Array.isArray(targetAdapter.targetFamilies) ? targetAdapter.targetFamilies : [],
    approvedScopeTensorCount: Number(targetAdapter.approvedScopeTensorCount || 0),
    unknownLoraTensorCount: Number(targetAdapter.unknownLoraTensorCount || 0),
    forbiddenTargetPresent: targetAdapter.forbiddenTargetPresent === true,
    sha256Prefix: text(targetAdapter.sha256Prefix) || text(adapter.sha256).slice(0, 12),
  }

  const futureValidation = {
    profile: FUTURE_VALIDATION_PROFILE,
    targetUseCases: ['identity_video_validation', 'video_v2v'],
    independentNeutralMotionSourceUsed: text(provenance.source_motion_sha256).toLowerCase() === text(env.IDENTITY_LORA_NEUTRAL_QA_SHA256).toLowerCase(),
    controlRepresentation: text(provenance.control_representation),
    appearanceReducedStructuralControlUsed: provenance.appearance_reduced_structural_control_used === true,
    rawRgbControlUsed: provenance.raw_rgb_control_used === true,
    sameControlAcrossBranches: provenance.same_control_across_branches === true,
    sameSeedAcrossBranches: provenance.same_seed_across_branches === true,
    sameSamplerAcrossBranches: provenance.same_sampler_across_branches === true,
    baselineWithoutIdentityAvailable: assets.some((item) => text(item.assetKey) === 'baseline_without_identity'),
    identityReferenceWithoutLoraAvailable: assets.some((item) => text(item.assetKey) === 'identity_reference_without_lora'),
    candidateWithLoraAvailable: assets.some((item) => text(item.assetKey) === 'candidate_with_lora'),
    loraIsolationComparisonAvailable: assets.some((item) => text(item.assetKey) === 'identity_reference_without_lora') && assets.some((item) => text(item.assetKey) === 'candidate_with_lora'),
    visualReviewAllowed: auditStatus === 'passed',
    nextPaidTestAllowed: false,
    reason: auditStatus === 'passed'
      ? 'Proveniência A/B/C validada. A aprovação continua dependente de revisão visual humana de B versus C.'
      : 'A evidência A/B/C falhou na auditoria de proveniência e permanece bloqueada.',
  }

  const audit = {
    schemaVersion: AUDIT_SCHEMA_VERSION,
    status: auditStatus,
    verdict: auditStatus === 'passed' ? 'softedge_abc_provenance_verified' : 'softedge_abc_provenance_not_verified',
    executedAt: now,
    executedByProfileId: requestedByProfileId || null,
    mode: 'private_cpu_no_gpu',
    adapter: adapterSnapshot,
    sourceLineage: {
      previewContractVersion: text(evidence.contractVersion),
      qaKitSchemaVersion: text(qaKit.schemaVersion),
      validationProfile: text(provenance.validation_profile),
      controlRepresentation: text(provenance.control_representation),
      sourceMotionSha256Prefix: text(provenance.source_motion_sha256).slice(0, 12) || null,
      derivedControlSha256Prefix: text(provenance.derived_control_sha256).slice(0, 12) || null,
      referenceAssetId: text(safeObject(provenance.branch_c).reference_asset_id) || null,
      referenceSha256Prefix: text(safeObject(provenance.branch_c).reference_sha256).slice(0, 12) || null,
      adapterSha256Prefix: text(safeObject(provenance.branch_c).adapter_sha256).slice(0, 12) || null,
    },
    similarity: {
      automatedIdentitySimilarityDecision: false,
      humanVisualReviewRequired: true,
      comparisonPriority: 'B_vs_C',
      assetIntegrity,
    },
    blockers: uniqueBlockers,
    futureValidation,
    safety: {
      databaseReadExecuted: true,
      databaseMutationExecuted: Boolean(persist),
      r2ReadExecuted: r2ReadCount > 0,
      r2ReadCount,
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      automaticRetryCreated: false,
      adapterApproved: false,
      productReleased: false,
      publicUrlCreated: false,
      destructiveDelete: false,
      localTemporaryFilesRemoved: true,
    },
  }

  if (persist) {
    const qaReport = safeObject(adapter.qa_report)
    const nextEvidence = {
      ...evidence,
      forensicAudit: audit,
      ...(auditStatus === 'failed' ? {
        status: 'invalid',
        ready: false,
        reviewable: false,
        failureCode: 'MOTION_ABC_FORENSIC_FAILED',
        operatorMessage: 'Kit A/B/C invalidado pela auditoria de proveniência. Nenhuma aprovação foi realizada.',
        invalidatedAt: now,
        invalidationReason: 'MOTION_ABC_FORENSIC_FAILED',
      } : {
        operatorMessage: 'Kit A/B/C com proveniência validada. Compare B versus C antes da decisão humana.',
      }),
    }
    const update = await supabaseAdmin
      .from(ADAPTERS_TABLE)
      .update({ qa_report: { ...qaReport, visualEvidence: nextEvidence }, updated_at: now })
      .eq('id', adapter.id)
      .eq('actor_profile_id', actorProfileId)
      .eq('training_run_id', run.id)
      .select('id, status, qa_status')
      .single()
    if (update.error) throw new ApiError(500, 'Erro ao registrar a auditoria forense da identidade.', update.error)
    if (text(update.data?.status) !== 'qa_pending' || text(update.data?.qa_status) !== 'pending') throw new ApiError(409, 'A auditoria foi registrada, mas o adapter deixou de permanecer em qa_pending.')
  }

  return {
    status: auditStatus === 'passed' ? 'M4_IDENTITY_MOTION_ABC_FORENSIC_PASSED' : 'M4_IDENTITY_MOTION_ABC_FORENSIC_FAILED_SAFE',
    actorProfileId,
    trainingRunId: run.id,
    adapterId: adapter.id,
    forensicAudit: publicAuditSnapshot(audit),
    nextPaidTestAllowed: false,
    nextAction: auditStatus === 'passed'
      ? 'Comparar visualmente B versus C. A aprovação continua manual e não libera produção automaticamente.'
      : 'Preservar o adapter em qa_pending e corrigir apenas a evidência/proveniência comprovadamente inválida.',
    safety: audit.safety,
  }
}

export {
  FORENSIC_CONFIRMATION as IDENTITY_VIDEO_FORENSIC_CONFIRMATION,
  FUTURE_VALIDATION_PROFILE,
  CONTROL_REPRESENTATION,
}
