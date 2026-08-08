import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { inspectControlledIdentityTrainingSmokePolicy } from './actor-identity-training-smoke-policy.service.js'
import { inspectControlledIdentityPreviewPolicy } from './actor-identity-preview-policy.service.js'
import { ApiError } from '../utils/apiError.js'
import { auditActorIdentityDatasetReadiness } from './actor-identity-dataset-readiness.service.js'
import { classifyIdentityTrainingFailure } from './actor-identity-training-failure.service.js'

const ACTORS_TABLE = 'actor_profiles'
const KYC_CASES_TABLE = 'actor_kyc_cases'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const REQUIREMENTS_TABLE = 'mapping_requirements'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const TRAINING_RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'

const VIDEO_CONTENT_TYPES = new Set(['video', 'short_video', 'live_action'])
const ACTOR_IDENTITY_GATED_CONTENT_TYPES = new Set(['image', 'video', 'short_video', 'live_action', 'audio', 'live_audio'])
const ACTIVE_TRAINING_STATUSES = new Set([
  'dataset_pending',
  'dataset_ready',
  'dry_run_ready',
  'training_pending',
  'training_in_progress',
  'training_completed',
  'qa_pending',
])

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim()
}

function latestIso(...values) {
  return values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null
}

function normalizeContentType(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, '_')
  if (['video', 'video_short', 'short_video', 'i2v', 'video_i2v'].includes(normalized)) return normalized === 'video' ? 'video' : 'short_video'
  if (['live_action', 'live_action_v2v', 'v2v', 'video_v2v'].includes(normalized)) return 'live_action'
  if (['image', 'imagem', 'photo', 'foto'].includes(normalized)) return 'image'
  if (['audio', 'live_audio', 'voice', 'tts'].includes(normalized)) return normalized === 'live_audio' ? 'live_audio' : 'audio'
  return normalized
}

export function requiresApprovedIdentityLora(contentType) {
  return VIDEO_CONTENT_TYPES.has(normalizeContentType(contentType))
}

export function requiresApprovedActorIdentityBeforeProduction(contentType) {
  return ACTOR_IDENTITY_GATED_CONTENT_TYPES.has(normalizeContentType(contentType))
}

function isMissingRelationError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist')
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(normalizeText(value).toLowerCase())
}

function isPrivateObjectReference(bucket, key) {
  const cleanBucket = normalizeText(bucket)
  const cleanKey = normalizeText(key)
  return Boolean(
    cleanBucket
    && cleanKey
    && !/^https?:\/\//i.test(cleanBucket)
    && !/^https?:\/\//i.test(cleanKey)
    && !cleanKey.startsWith('/')
  )
}

function assetMediaType(asset, requirementById) {
  const requirement = requirementById.get(asset.mapping_requirement_id)
  const fromRequirement = normalizeContentType(requirement?.media_type)
  if (['image', 'video', 'audio'].includes(fromRequirement)) return fromRequirement
  const contentType = normalizeText(asset.content_type).toLowerCase()
  if (contentType.startsWith('video/')) return 'video'
  if (contentType.startsWith('audio/')) return 'audio'
  return 'image'
}

function isTestOrDryRunAsset(asset) {
  const metadata = safeObject(asset.metadata)
  const haystack = [
    asset.r2_key,
    asset.asset_type,
    asset.original_filename,
    metadata.source,
    metadata.testSource,
    metadata.mappingPurpose,
  ].map((value) => normalizeText(value).toLowerCase()).join(' ')

  return Boolean(
    asset.status === 'registered_dry_run'
    || metadata.safeMock === true
    || metadata.fake === true
    || haystack.includes('dry_run')
    || haystack.includes('sprint_5_9')
    || haystack.includes('test-5-9')
    || haystack.includes('quarantine')
  )
}

async function getActor(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, status, kyc_status, production_status, display_name, legal_name, metadata')
    .eq('id', actorProfileId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao carregar a preparação de identidade do ator.', error)
  if (!data) throw new ApiError(404, 'Ator não encontrado.')
  return data
}

function assertActorKycApproved(actor) {
  if (normalizeText(actor.status).toLowerCase() !== 'approved') {
    throw new ApiError(409, 'O ator precisa estar aprovado antes de preparar a identidade para vídeos.')
  }
  if (normalizeText(actor.kyc_status).toLowerCase() !== 'approved') {
    throw new ApiError(409, 'O mapeamento precisa estar aprovado antes de preparar a identidade para vídeos.')
  }
}

async function getLatestApprovedKycCase(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, status, reviewed_at, metadata, created_at')
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao localizar o mapeamento aprovado do ator.', error)
  if (!data) throw new ApiError(409, 'Nenhum caso de mapeamento aprovado foi encontrado para este ator.')
  return data
}

async function loadApprovedDatasetAssets(actorProfileId, kycCaseId) {
  const [requirementsResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from(REQUIREMENTS_TABLE)
      .select('id, title, media_type, system_tag, is_active'),
    supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('id, kyc_case_id, actor_profile_id, mapping_requirement_id, asset_type, r2_bucket, r2_key, original_filename, content_type, byte_size, checksum_sha256, status, metadata, created_at')
      .eq('actor_profile_id', actorProfileId)
      .eq('kyc_case_id', kycCaseId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true }),
  ])

  if (requirementsResult.error) throw new ApiError(500, 'Erro ao carregar requisitos do mapeamento.', requirementsResult.error)
  if (assetsResult.error) throw new ApiError(500, 'Erro ao carregar os materiais aprovados para a preparação de identidade.', assetsResult.error)

  const requirementById = new Map((requirementsResult.data || []).map((row) => [row.id, row]))
  return (assetsResult.data || [])
    .filter((asset) => isPrivateObjectReference(asset.r2_bucket, asset.r2_key))
    .filter((asset) => normalizeText(asset.r2_key).startsWith('vault/actor-mapping/'))
    .filter((asset) => !isTestOrDryRunAsset(asset))
    .filter((asset) => {
      const requirement = requirementById.get(asset.mapping_requirement_id)
      const identity = `${normalizeText(requirement?.system_tag)} ${normalizeText(requirement?.title)} ${normalizeText(asset.asset_type)}`.toLowerCase()
      return !['identity_document', 'identity_card', 'documento', 'document', 'selfie_document'].some((token) => identity.includes(token))
    })
    .map((asset) => {
      const requirement = requirementById.get(asset.mapping_requirement_id)
      return {
        assetId: asset.id,
        mappingRequirementId: asset.mapping_requirement_id || null,
        systemTag: normalizeText(requirement?.system_tag) || null,
        mediaType: assetMediaType(asset, requirementById),
        contentType: asset.content_type || null,
        byteSize: Number(asset.byte_size || 0) || null,
        checksumSha256: isSha256(asset.checksum_sha256) ? normalizeText(asset.checksum_sha256).toLowerCase() : null,
        source: {
          bucket: asset.r2_bucket,
          key: asset.r2_key,
        },
      }
    })
}

function trainingStateLabel(status) {
  const labels = {
    dataset_pending: 'Materiais pendentes',
    dataset_ready: 'Materiais prontos',
    dry_run_ready: 'Materiais conferidos',
    training_pending: 'Preparação pendente',
    training_in_progress: 'Preparação em andamento',
    training_completed: 'Preparação concluída',
    qa_pending: 'Validação pendente',
    approved: 'Identidade aprovada',
    failed: 'Preparação falhou',
    cancelled: 'Preparação cancelada',
    revoked: 'Preparação revogada',
  }
  return labels[status] || status || 'Não iniciado'
}

function adapterPublicSnapshot(adapter) {
  if (!adapter) return null
  return {
    id: adapter.id,
    trainingRunId: adapter.training_run_id || null,
    version: adapter.adapter_version,
    status: adapter.status,
    qaStatus: adapter.qa_status,
    baseModel: adapter.base_model,
    baseModelFingerprintPrefix: normalizeText(adapter.base_model_fingerprint).slice(0, 12) || null,
    sha256Prefix: normalizeText(adapter.sha256).slice(0, 12) || null,
    byteSize: Number(adapter.byte_size || 0),
    recommendedStrengthModel: Number(adapter.recommended_strength_model || 0.65),
    privateOnly: isPrivateObjectReference(adapter.r2_bucket, adapter.r2_key),
    approvedAt: adapter.approved_at || null,
    revokedAt: adapter.revoked_at || null,
    createdAt: adapter.created_at || null,
    updatedAt: adapter.updated_at || null,
  }
}

function buildIdentityReviewSnapshot({ actorProfileId, run = null, adapter = null } = {}) {
  const qaReport = safeObject(adapter?.qa_report)
  const visualEvidence = safeObject(qaReport.visualEvidence || qaReport.visual_evidence)
  const visualQaKitAssets = Array.isArray(safeObject(visualEvidence.qaKit).assets) ? safeObject(visualEvidence.qaKit).assets : []
  const forensicAudit = safeObject(visualEvidence.forensicAudit)
  const trainingTargetAudit = safeObject(qaReport.trainingTargetAudit)
  const trainingTargetBlockers = Array.isArray(trainingTargetAudit.blockers)
    ? trainingTargetAudit.blockers.map((item) => ({ code: normalizeText(item.code), message: normalizeText(item.message), severity: normalizeText(item.severity) || 'critical' }))
    : []
  const trainingTargetCompatibility = safeObject(trainingTargetAudit.compatibility)
  const trainingTargetCandidate = safeObject(trainingTargetAudit.candidateContract)
  const trainingTargetCompatible = Boolean(
    normalizeText(trainingTargetAudit.status) === 'passed'
    && trainingTargetCompatibility.generalGeneratorIdentityBranchPresent === true
    && trainingTargetCandidate.paidExecutionApproved === true,
  )
  const forensicBlockers = Array.isArray(forensicAudit.blockers)
    ? forensicAudit.blockers.map((item) => ({ code: normalizeText(item.code), message: normalizeText(item.message), severity: normalizeText(item.severity) || 'critical' }))
    : []
  const futureValidation = safeObject(forensicAudit.futureValidation)
  const qaKitMediaAvailable = visualQaKitAssets.length > 0 && visualQaKitAssets.every((item) => isPrivateObjectReference(item.r2Bucket, item.r2Key))
  const videoValidationPassed = Boolean(
    normalizeText(forensicAudit.status) === 'passed'
    && normalizeText(futureValidation.profile) === 'video_random_base_ab_v1'
    && futureValidation.randomBaseVideoUsed === true
    && futureValidation.motionOnlyControlUsed === true
    && futureValidation.actorMappingRawRgbControlUsed !== true
    && futureValidation.baselineWithoutLoraAvailable === true
    && futureValidation.candidateWithLoraAvailable === true,
  )
  const visualEvidenceReady = Boolean(
    visualEvidence.ready === true
    && visualEvidence.reviewable === true
    && visualEvidence.status === 'ready'
    && qaKitMediaAvailable
    && videoValidationPassed,
  )
  const checks = [
    {
      code: 'training_completed',
      label: 'Treinamento concluído',
      passed: Boolean(run && ['training_completed', 'qa_pending', 'approved'].includes(run.status)),
      message: run ? trainingStateLabel(run.status) : 'Nenhum treinamento encontrado.',
    },
    {
      code: 'adapter_registered',
      label: 'Adapter registrado',
      passed: Boolean(adapter),
      message: adapter ? `Versão ${Number(adapter.adapter_version || 1)} recebida.` : 'O adapter ainda não foi registrado.',
    },
    {
      code: 'actor_isolation',
      label: 'Isolamento do ator',
      passed: Boolean(adapter && adapter.actor_profile_id === actorProfileId),
      message: adapter?.actor_profile_id === actorProfileId ? 'O adapter pertence ao ator selecionado.' : 'O vínculo do adapter com o ator não foi confirmado.',
    },
    {
      code: 'run_isolation',
      label: 'Isolamento da execução',
      passed: Boolean(adapter && run && adapter.training_run_id === run.id),
      message: adapter && run && adapter.training_run_id === run.id ? 'O adapter pertence ao run mais recente.' : 'O vínculo entre adapter e run não foi confirmado.',
    },
    {
      code: 'private_storage',
      label: 'Armazenamento privado',
      passed: Boolean(adapter && isPrivateObjectReference(adapter.r2_bucket, adapter.r2_key)),
      message: adapter && isPrivateObjectReference(adapter.r2_bucket, adapter.r2_key) ? 'O resultado usa referência privada, sem URL pública.' : 'A referência privada do resultado não foi confirmada.',
    },
    {
      code: 'adapter_integrity',
      label: 'Integridade do arquivo',
      passed: Boolean(adapter && isSha256(adapter.sha256) && Number(adapter.byte_size || 0) > 0),
      message: adapter && isSha256(adapter.sha256) && Number(adapter.byte_size || 0) > 0 ? 'Checksum e tamanho do adapter são válidos.' : 'Checksum ou tamanho do adapter está incompleto.',
    },
    {
      code: 'base_model_binding',
      label: 'Modelo-base correto',
      passed: Boolean(adapter && run && adapter.base_model === run.base_model && adapter.base_model_fingerprint === run.base_model_fingerprint),
      message: adapter && run && adapter.base_model === run.base_model && adapter.base_model_fingerprint === run.base_model_fingerprint ? 'Modelo e fingerprint correspondem ao run.' : 'O vínculo com o modelo-base não foi confirmado.',
    },
  ]
  const previewStatus = normalizeText(visualEvidence.status) || 'not_started'
  const preview = {
    status: previewStatus,
    ready: visualEvidence.ready === true && previewStatus === 'ready',
    validForApproval: visualEvidenceReady,
    providerJobIdConfigured: Boolean(normalizeText(visualEvidence.providerJobId)),
    requestedAt: visualEvidence.requestedAt || null,
    startedAt: visualEvidence.startedAt || null,
    completedAt: visualEvidence.completedAt || null,
    lastCheckedAt: visualEvidence.lastCheckedAt || null,
    failedAt: visualEvidence.failedAt || null,
    invalidatedAt: visualEvidence.invalidatedAt || null,
    invalidationReason: normalizeText(visualEvidence.invalidationReason) || null,
    message: normalizeText(visualEvidence.operatorMessage) || null,
    reviewable: visualEvidence.reviewable === true,
    mediaAvailable: qaKitMediaAvailable,
    protectedMediaUrl: qaKitMediaAvailable ? `/api/admin/actors/${actorProfileId}/pipeline/identity-lora/preview-media?asset=video_walk_turn_smile` : null,
    assetCount: visualQaKitAssets.length,
    assets: visualQaKitAssets.map((item) => ({ assetKey: normalizeText(item.assetKey), label: normalizeText(item.label), kind: normalizeText(item.kind), contentType: normalizeText(item.contentType), mediaAvailable: isPrivateObjectReference(item.r2Bucket, item.r2Key), protectedMediaUrl: `/api/admin/actors/${actorProfileId}/pipeline/identity-lora/preview-media?asset=${encodeURIComponent(normalizeText(item.assetKey))}`, width: Number(item.width || 0) || null, height: Number(item.height || 0) || null, durationSeconds: Number(item.durationSeconds || 0) || null })),
    durationSeconds: Number(visualEvidence.durationSeconds || 0) || null,
    forensicAudit: {
      status: normalizeText(forensicAudit.status) || 'not_run',
      verdict: normalizeText(forensicAudit.verdict) || 'not_evaluated',
      executedAt: forensicAudit.executedAt || null,
      blockers: forensicBlockers,
      adapter: safeObject(forensicAudit.adapter),
      sourceLineage: safeObject(forensicAudit.sourceLineage),
      similarity: safeObject(forensicAudit.similarity),
      safety: safeObject(forensicAudit.safety),
    },
  }
  const technicalPassed = checks.every((item) => item.passed)
  const adapterApproved = Boolean(adapter && adapter.status === 'approved' && adapter.qa_status === 'approved' && !adapter.revoked_at)
  const adapterRejected = Boolean(adapter && (adapter.status === 'rejected' || adapter.qa_status === 'rejected'))
  const status = adapterApproved
    ? 'approved'
    : adapterRejected
      ? 'changes_required'
      : adapter
        ? 'review_required'
        : run && ['training_completed', 'qa_pending'].includes(run.status)
          ? 'adapter_pending'
          : 'not_ready'
  const label = status === 'approved'
    ? 'Identidade aprovada'
    : status === 'changes_required'
      ? 'Ajustes necessários'
      : status === 'review_required'
        ? 'Revisão necessária'
        : status === 'adapter_pending'
          ? 'Finalizando registro'
          : 'Revisão indisponível'

  return {
    status,
    label,
    technicalStatus: technicalPassed ? 'passed' : adapter ? 'failed' : 'pending',
    technicalPassed,
    checks,
    visualEvidenceRequired: true,
    visualEvidenceReady,
    preview,
    forensicAudit: preview.forensicAudit,
    trainingTargetAudit: {
      status: normalizeText(trainingTargetAudit.status) || 'not_run',
      verdict: normalizeText(trainingTargetAudit.verdict) || 'not_evaluated',
      executedAt: trainingTargetAudit.executedAt || null,
      currentTraining: safeObject(trainingTargetAudit.currentTraining),
      adapter: safeObject(trainingTargetAudit.adapter),
      compatibility: trainingTargetCompatibility,
      candidateContract: trainingTargetCandidate,
      blockers: trainingTargetBlockers,
      nextPaidTestAllowed: trainingTargetAudit.nextPaidTestAllowed === true && trainingTargetCompatible,
      safety: safeObject(trainingTargetAudit.safety),
    },
    videoValidation: {
      profile: normalizeText(futureValidation.profile) || 'video_random_base_ab_v1',
      targetUseCases: Array.isArray(futureValidation.targetUseCases) ? futureValidation.targetUseCases : ['prompt_to_video', 'random_base_video_v2v'],
      currentEvidenceCompatible: videoValidationPassed,
      requiresRandomBaseVideo: true,
      requiresMotionOnlyControl: true,
      actorMappingRawRgbControlAllowed: false,
      requiresSameSeedBaselineWithoutLora: true,
      nextPaidTestAllowed: futureValidation.nextPaidTestAllowed === true && videoValidationPassed && trainingTargetCompatible,
      blockers: forensicBlockers,
      nextAction: normalizeText(futureValidation.reason) || 'Executar primeiro a auditoria sem GPU. O próximo teste pago permanece bloqueado até o contrato de vídeo A/B estar completo.',
    },
    finalApprovalAllowed: Boolean(technicalPassed && visualEvidenceReady && trainingTargetCompatible && adapter && !adapterRejected),
    finalRejectionAllowed: Boolean(adapter && !adapterApproved && !adapterRejected),
    finalDecision: adapterApproved ? 'approved' : adapterRejected ? 'rejected' : 'pending',
    nextAction: adapterApproved
      ? 'Integrar a identidade ao runtime de produção de vídeo.'
      : adapterRejected
        ? 'Revisar o motivo e preparar novo treinamento controlado.'
        : normalizeText(trainingTargetAudit.status) === 'not_run'
          ? 'Auditar o alvo real do treinamento sem GPU antes de qualquer novo treino ou teste pago.'
          : normalizeText(trainingTargetAudit.status) === 'failed'
            ? 'O adapter atual está restrito ao ramo VACE e permanece sem comprovação como identidade geral de vídeo.'
            : normalizeText(forensicAudit.status) === 'not_run'
              ? 'Executar a auditoria forense sem GPU antes de qualquer novo teste pago.'
              : normalizeText(forensicAudit.status) === 'failed'
                ? 'Corrigir o contrato de vídeo com base aleatória. O adapter continua sem comprovação funcional.'
            : technicalPassed && !visualEvidenceReady
              ? 'Preparar uma evidência de vídeo A/B com base aleatória antes da aprovação final.'
              : adapter
                ? 'Corrigir as pendências técnicas indicadas.'
                : 'Aguardar o registro do adapter.',
    lastUpdatedAt: latestIso(adapter?.updated_at, adapter?.created_at, run?.updated_at, run?.completed_at),
  }
}

function runPublicSnapshot(run) {
  if (!run) return null
  const manifest = safeObject(run.dataset_manifest)
  const metadata = safeObject(run.metadata)
  const executionStage = safeObject(metadata.stage_2_2d3_5)
  const executionPlan = safeObject(executionStage.plan)
  const trainingStage = safeObject(metadata.stage_2_2d3_6a)
  const smokeStage = safeObject(metadata.stage_2_2d3_6b)
  const storedFailure = ['failed', 'cancelled'].includes(run.status)
    ? classifyIdentityTrainingFailure({
      providerStatus: normalizeText(trainingStage.providerStatus || run.status).toUpperCase(),
      storedError: normalizeText(trainingStage.lastError || run.failure_reason),
    })
    : null
  const failureWasExplicitlyClassified = Boolean(normalizeText(trainingStage.failureCode))
  const smokePolicy = inspectControlledIdentityTrainingSmokePolicy({ actorProfileId: run.actor_profile_id, trainingRunId: run.id })
  return {
    id: run.id,
    mode: run.mode,
    status: run.status,
    statusLabel: trainingStateLabel(run.status),
    datasetManifestSha256Prefix: normalizeText(run.dataset_manifest_sha256).slice(0, 12) || null,
    imageCount: Number(manifest.summary?.imageCount || 0),
    videoCount: Number(manifest.summary?.videoCount || 0),
    audioCount: Number(manifest.summary?.audioCount || 0),
    baseModel: run.base_model || null,
    baseModelFingerprintPrefix: normalizeText(run.base_model_fingerprint).slice(0, 12) || null,
    privateTrainingBucket: run.dataset_r2_bucket || null,
    trainingEngine: run.training_engine || null,
    trainingEngineCommit: run.training_engine_commit || null,
    executionPlan: {
      prepared: executionStage.executionPlanPrepared === true,
      sha256Prefix: normalizeText(executionStage.executionPlanSha256).slice(0, 12) || null,
      preparedAt: executionStage.preparedAt || null,
      provider: normalizeText(safeObject(executionPlan.provider).name) || null,
      mode: normalizeText(executionPlan.mode) || null,
      runtimeExecutionEnabled: smokePolicy.ready,
      smokeMode: smokePolicy.enabled,
      smokeActorMatched: smokePolicy.actorMatched === true,
      smokeRunMatched: smokePolicy.runMatched === true,
      smokeExpiresAt: smokePolicy.expiresAt,
      smokeOneShot: Number(smokePolicy.maxJobs) === 1,
      smokeOneShotConsumed: smokeStage.oneShotConsumed === true,
      trainingStarted: ['training_pending', 'training_in_progress', 'training_completed', 'qa_pending', 'approved'].includes(run.status),
      qaStarted: ['qa_pending', 'approved'].includes(run.status),
      adapterIntegrated: false,
    },
    trainingJob: {
      dispatchStatus: normalizeText(trainingStage.dispatchStatus) || 'not_started',
      providerJobIdPrefix: normalizeText(trainingStage.providerJobId).slice(0, 12) || null,
      submittedAt: trainingStage.submittedAt || null,
      startedAt: trainingStage.startedAt || run.started_at || null,
      completedAt: trainingStage.completedAt || run.completed_at || null,
      lastCheckedAt: trainingStage.lastCheckedAt || null,
      progressPercent: Number.isFinite(Number(trainingStage.progressPercent)) ? Number(trainingStage.progressPercent) : (['training_completed', 'qa_pending', 'approved'].includes(run.status) ? 100 : null),
      targetSteps: Number(manifest.summary?.imageCount || 0) > 0 ? Number(manifest.summary.imageCount) * 60 : null,
      adapterRegistered: trainingStage.adapterRegistered === true,
      lastError: storedFailure
        ? (failureWasExplicitlyClassified ? normalizeText(trainingStage.lastError) : storedFailure.message)
        : normalizeText(trainingStage.lastError) || null,
      failureCode: normalizeText(trainingStage.failureCode) || storedFailure?.failureCode || null,
      failureCategory: normalizeText(trainingStage.failureCategory) || storedFailure?.failureCategory || null,
      retryable: failureWasExplicitlyClassified ? trainingStage.retryable === true : storedFailure?.retryable === true,
      operatorMessage: normalizeText(trainingStage.operatorMessage) || storedFailure?.operatorMessage || null,
      failedAt: trainingStage.failedAt || run.failed_at || null,
    },
    createdAt: run.created_at || null,
    updatedAt: run.updated_at || null,
  }
}

async function loadLatestRun(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function loadAdapterForRun(actorProfileId, trainingRunId) {
  if (!trainingRunId) return null
  const { data, error } = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('training_run_id', trainingRunId)
    .order('adapter_version', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

async function loadLatestApprovedAdapter(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'approved')
    .eq('qa_status', 'approved')
    .is('revoked_at', null)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data || null
}

export async function getActorIdentityLoraSummary(actorProfileId) {
  const actor = await getActor(actorProfileId)
  let latestRun = null
  let latestAdapter = null
  let adapter = null
  let schemaReady = true

  try {
    ;[latestRun, adapter] = await Promise.all([
      loadLatestRun(actorProfileId),
      loadLatestApprovedAdapter(actorProfileId),
    ])
    latestAdapter = await loadAdapterForRun(actorProfileId, latestRun?.id)
  } catch (error) {
    if (!isMissingRelationError(error)) throw new ApiError(500, 'Erro ao carregar o estado da identidade para vídeos.', error)
    schemaReady = false
  }

  const kycApproved = normalizeText(actor.status).toLowerCase() === 'approved'
    && normalizeText(actor.kyc_status).toLowerCase() === 'approved'
  const adapterApproved = Boolean(adapter)
  const inferenceInjectionReady = env.IDENTITY_LORA_INFERENCE_INJECTION_READY === true
  const videoProductionUnlocked = Boolean(schemaReady && kycApproved && adapterApproved && inferenceInjectionReady)
  const previewPolicy = inspectControlledIdentityPreviewPolicy({
    actorProfileId,
    trainingRunId: latestRun?.id || null,
    adapterId: latestAdapter?.id || null,
  })

  let state = 'kyc_pending'
  let blockReason = 'O mapeamento do ator ainda não foi aprovado.'
  if (!schemaReady) {
    state = 'schema_pending'
    blockReason = 'A preparação de identidade para vídeos ainda não está disponível.'
  } else if (kycApproved && !latestRun && !adapter) {
    state = 'readiness_required'
    blockReason = 'A identidade para vídeos ainda precisa ser preparada e aprovada.'
  } else if (kycApproved && latestRun && latestAdapter && !adapterApproved) {
    const latestAdapterStatus = normalizeText(latestAdapter.status).toLowerCase()
    const latestQaStatus = normalizeText(latestAdapter.qa_status).toLowerCase()
    state = latestAdapterStatus === 'rejected' || latestQaStatus === 'rejected' ? 'qa_rejected' : 'qa_pending'
    blockReason = state === 'qa_rejected'
      ? 'A identidade precisa de ajustes antes de ser integrada.'
      : 'A identidade foi criada e aguarda revisão técnica e visual.'
  } else if (kycApproved && latestRun && !latestAdapter) {
    state = latestRun.status || 'readiness_required'
    blockReason = latestRun.status === 'dry_run_ready'
      ? 'Os materiais foram conferidos. O treinamento e a validação ainda estão pendentes.'
      : `Identidade para vídeos ainda não aprovada: ${trainingStateLabel(latestRun.status)}.`
  } else if (adapterApproved && !inferenceInjectionReady) {
    state = 'adapter_approved_injection_pending'
    blockReason = 'A identidade foi aprovada, mas a produção de vídeo ainda não está liberada.'
  } else if (videoProductionUnlocked) {
    state = 'production_ready'
    blockReason = null
  }

  return {
    gatekeeperEnabled: true,
    schemaReady,
    kycApproved,
    requiresIdentityLoraFor: ['video', 'short_video', 'live_action'],
    requiresIdentityBeforeAnyProduct: true,
    requiresIdentityFor: ['image', 'video', 'short_video', 'live_action', 'audio', 'live_audio'],
    state,
    blockReason,
    canPrepareReadiness: Boolean(schemaReady && kycApproved && (!latestRun || !ACTIVE_TRAINING_STATUSES.has(latestRun.status))),
    adapterApproved,
    inferenceInjectionReady,
    identityPreparationApproved: adapterApproved,
    allProductProductionUnlocked: videoProductionUnlocked,
    videoProductionUnlocked,
    latestRun: runPublicSnapshot(latestRun),
    latestAdapter: adapterPublicSnapshot(latestAdapter),
    approvedAdapter: adapterPublicSnapshot(adapter),
    previewPolicy: {
      enabled: previewPolicy.enabled,
      ready: previewPolicy.ready,
      contractVersion: previewPolicy.contractVersion || null,
      expiresAt: previewPolicy.expiresAt,
      maxJobs: previewPolicy.maxJobs,
      actorMatched: previewPolicy.actorMatched,
      runMatched: previewPolicy.runMatched,
      adapterMatched: previewPolicy.adapterMatched,
      blockers: previewPolicy.blockers,
    },
    review: buildIdentityReviewSnapshot({ actorProfileId, run: latestRun, adapter: latestAdapter }),
    safety: {
      runPodCalled: false,
      gpuStarted: false,
      r2ObjectCopied: false,
      publicUrlCreated: false,
      automaticRetry: false,
    },
  }
}

export async function createActorIdentityLoraReadiness(actorProfileId, { requestedByProfileId = null } = {}) {
  if (!requestedByProfileId) {
    throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela validação da configuração.')
  }
  if (!env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY) {
    throw new ApiError(409, 'A preparação segura não está configurada corretamente.')
  }
  if (env.IDENTITY_LORA_TRAINING_ENABLED) {
    throw new ApiError(409, 'O treinamento real deve permanecer desativado durante esta conferência.')
  }

  const actor = await getActor(actorProfileId)
  assertActorKycApproved(actor)
  const datasetAudit = await auditActorIdentityDatasetReadiness(actorProfileId, { includePrivateManifest: true })
  if (!datasetAudit.readiness.ready || !datasetAudit.privateManifest) {
    throw new ApiError(409, 'O conjunto de identidade ainda não está pronto para a preparação controlada.', {
      status: datasetAudit.status,
      blockers: datasetAudit.readiness.blockers,
      warnings: datasetAudit.readiness.warnings,
      summary: datasetAudit.summary,
      coverage: datasetAudit.coverage,
      inventoryFingerprintSha256Prefix: datasetAudit.inventory.fingerprintSha256Prefix,
      publicUrlRequired: false,
    })
  }

  const kycCase = { id: datasetAudit.mappingCase.id }
  const assets = datasetAudit.privateManifest.assets
  const imageCount = assets.filter((item) => item.mediaType === 'image').length
  const videoCount = assets.filter((item) => item.mediaType === 'video').length
  const audioCount = assets.filter((item) => item.mediaType === 'audio').length
  const privateBucket = normalizeText(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME)
  if (!privateBucket || /^https?:\/\//i.test(privateBucket)) {
    throw new ApiError(409, 'O espaço privado da preparação da identidade ainda não está configurado.')
  }

  const activeRunResult = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .in('status', [...ACTIVE_TRAINING_STATUSES])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (activeRunResult.error) {
    if (isMissingRelationError(activeRunResult.error)) throw new ApiError(409, 'A preparação de identidade para vídeos ainda não está disponível.')
    throw new ApiError(500, 'Erro ao verificar uma preparação de identidade já existente.', activeRunResult.error)
  }
  if (activeRunResult.data) {
    if (activeRunResult.data.status === 'dataset_ready') {
      const frozenManifest = safeObject(activeRunResult.data.dataset_manifest)
      if (normalizeText(frozenManifest.inventoryFingerprintSha256) !== normalizeText(datasetAudit.privateManifest.fingerprintSha256)) {
        throw new ApiError(409, 'O conjunto registrado não corresponde mais aos materiais aprovados atuais. A divergência foi bloqueada para revisão.')
      }
      const datasetPrefix = `identity-training/${actorProfileId}/${activeRunResult.data.id}`
      const now = new Date().toISOString()
      const currentMetadata = safeObject(activeRunResult.data.metadata)
      const { data: updatedRun, error: updateError } = await supabaseAdmin
        .from(TRAINING_RUNS_TABLE)
        .update({
          status: 'dry_run_ready',
          dataset_r2_bucket: privateBucket,
          dataset_r2_prefix: datasetPrefix,
          base_model: env.IDENTITY_LORA_BASE_MODEL,
          base_model_fingerprint: normalizeText(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT),
          training_engine: 'DiffSynth-Studio',
          training_engine_commit: env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT,
          metadata: {
            ...currentMetadata,
            modelConfigurationPending: false,
            source: 'stage_2_2d3_4_base_model_revision_fingerprint_lock',
            baseModelRevision: normalizeText(env.IDENTITY_LORA_BASE_MODEL_REVISION),
            baseModelLockPath: normalizeText(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH),
            baseModelLockVerified: true,
            trainingConfigurationPrepared: true,
            trainingConfigurationPreparedAt: now,
            trainingConfigurationPreparedByProfileId: requestedByProfileId,
            noRunPod: true,
            noR2Copy: true,
            noTrainingStarted: true,
          },
          updated_at: now,
        })
        .eq('id', activeRunResult.data.id)
        .select('*')
        .single()
      if (updateError) throw new ApiError(500, 'Erro ao registrar a configuração controlada do treinamento.', updateError)
      return {
        status: 'IDENTITY_LORA_READINESS_DRY_RUN_READY',
        run: runPublicSnapshot(updatedRun),
        message: 'Configuração do treinamento validada com segurança. O treinamento real continua bloqueado. Nenhum treinamento, GPU ou cópia de arquivos foi iniciado.',
        safety: { databaseMutationExecuted: true, runPodCalled: false, gpuStarted: false, trainingStarted: false, queueJobCreated: false, productCreated: false, r2ObjectCopied: false, publicUrlCreated: false, automaticRetry: false },
      }
    }
    return {
      status: 'IDENTITY_LORA_READINESS_ALREADY_ACTIVE',
      run: runPublicSnapshot(activeRunResult.data),
      message: 'Já existe uma preparação/execução ativa para este ator. Nenhum novo run foi criado.',
      safety: { runPodCalled: false, gpuStarted: false, r2ObjectCopied: false, publicUrlCreated: false, automaticRetry: false },
    }
  }

  const runId = randomUUID()
  const triggerToken = `prv_actor_${actorProfileId.replaceAll('-', '').slice(0, 8)}_v1`
  const datasetPrefix = `identity-training/${actorProfileId}/${runId}`
  const manifest = {
    schemaVersion: 'privacy-identity-dataset-manifest-v1',
    actorProfileId,
    kycCaseId: kycCase.id,
    triggerToken,
    consentSource: 'actor_identity_preparation_authorization',
    consentSnapshotSha256: datasetAudit.privateManifest.consentSnapshotSha256,
    identityPreparationAuthorization: datasetAudit.privateManifest.identityPreparationAuthorization || null,
    authorizationId: datasetAudit.privateManifest.authorizationId || null,
    inventoryFingerprintSha256: datasetAudit.privateManifest.fingerprintSha256,
    baseModel: env.IDENTITY_LORA_BASE_MODEL,
    baseModelRevision: normalizeText(env.IDENTITY_LORA_BASE_MODEL_REVISION),
    baseModelFingerprint: normalizeText(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT),
    baseModelLockPath: normalizeText(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH),
    trainingEngine: 'DiffSynth-Studio',
    trainingEngineCommit: env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT,
    target: {
      width: 832,
      height: 480,
      frames: 17,
      precision: 'bf16',
      rank: 32,
      alpha: 32,
      learningRate: 0.00005,
      targetModules: ['q', 'k', 'v', 'o', 'ffn.0', 'ffn.2'],
    },
    destination: {
      bucket: privateBucket,
      prefix: datasetPrefix,
      public: false,
    },
    summary: {
      imageCount,
      videoCount,
      audioCount,
      totalAssets: assets.length,
      recommendedImages: '15-20',
      recommendedShortVideos: '6-10',
    },
    assets,
    safety: {
      signedUrlsPersisted: false,
      publicUrlsAllowed: false,
      identityDocumentsExcludedByDatasetBuilder: true,
      embeddingsPersisted: false,
      noTrainingStarted: true,
    },
  }
  const manifestSha256 = sha256(stableStringify(manifest))

  const existingResult = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('mode', 'readiness_dry_run')
    .eq('dataset_manifest_sha256', manifestSha256)
    .in('status', ['dry_run_ready', 'dataset_ready'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingResult.error && !isMissingRelationError(existingResult.error)) {
    throw new ApiError(500, 'Erro ao verificar os materiais já conferidos.', existingResult.error)
  }
  if (isMissingRelationError(existingResult.error)) {
    throw new ApiError(409, 'A preparação de identidade para vídeos ainda não está disponível.')
  }
  if (existingResult.data) {
    return {
      status: 'IDENTITY_LORA_READINESS_ALREADY_READY',
      run: runPublicSnapshot(existingResult.data),
      message: 'Os mesmos materiais já foram conferidos e estão prontos para a próxima etapa.',
      safety: { runPodCalled: false, gpuStarted: false, r2ObjectCopied: false, publicUrlCreated: false, automaticRetry: false },
    }
  }

  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .insert({
      id: runId,
      actor_profile_id: actorProfileId,
      kyc_case_id: kycCase.id,
      mode: 'readiness_dry_run',
      status: 'dry_run_ready',
      dataset_manifest: manifest,
      dataset_manifest_sha256: manifestSha256,
      dataset_r2_bucket: privateBucket,
      dataset_r2_prefix: datasetPrefix,
      base_model: env.IDENTITY_LORA_BASE_MODEL,
      base_model_fingerprint: normalizeText(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT) || null,
      training_engine: 'DiffSynth-Studio',
      training_engine_commit: env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT,
      trigger_token: triggerToken,
      requested_by_profile_id: requestedByProfileId,
      metadata: {
        source: 'stage_2_2d3_4_base_model_revision_fingerprint_lock',
        baseModelRevision: normalizeText(env.IDENTITY_LORA_BASE_MODEL_REVISION),
        baseModelLockPath: normalizeText(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH),
        baseModelLockVerified: true,
        dryRunOnly: true,
        noRunPod: true,
        noR2Copy: true,
        recommendation: { images: '15-20', shortVideos: '6-10' },
        inventoryFingerprintSha256: datasetAudit.privateManifest.fingerprintSha256,
        consentSnapshotSha256: datasetAudit.privateManifest.consentSnapshotSha256,
      },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new ApiError(409, 'A preparação de identidade para vídeos ainda não está disponível.')
    throw new ApiError(500, 'Erro ao registrar a preparação da identidade para vídeos.', error)
  }

  return {
    status: 'IDENTITY_LORA_READINESS_DRY_RUN_READY',
    run: runPublicSnapshot(data),
    message: 'Materiais conferidos e preparação registrada. Nenhum vídeo foi gerado.',
    safety: { runPodCalled: false, gpuStarted: false, r2ObjectCopied: false, publicUrlCreated: false, automaticRetry: false },
  }
}

async function getValidAuthorization({ actorProfileId, companionId = null, authorizationId = null, contentType }) {
  let query = supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('id, actor_profile_id, companion_id, kyc_case_id, status, authorized_for_content_types, starts_at, ends_at, revoked_at')
    .eq('actor_profile_id', actorProfileId)

  if (authorizationId) query = query.eq('id', authorizationId)
  if (companionId) query = query.eq('companion_id', companionId)
  query = query.order('created_at', { ascending: false }).limit(20)

  const { data, error } = await query
  if (error) throw new ApiError(500, 'Erro ao validar a autorização de uso em produção.', error)
  const now = Date.now()
  const normalizedContentType = normalizeContentType(contentType)
  const authorization = (data || []).find((row) => {
    if (normalizeText(row.status).toLowerCase() !== 'active' || row.revoked_at) return false
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false
    const allowed = (row.authorized_for_content_types || []).map(normalizeContentType)
    return allowed.includes(normalizedContentType)
      || (normalizedContentType === 'short_video' && allowed.includes('video'))
      || (normalizedContentType === 'live_action' && allowed.includes('video'))
  })
  if (!authorization) throw new ApiError(409, 'A autorização ativa não permite este tipo de produção.')
  return authorization
}

export async function assertApprovedIdentityAdapterForCompanionVideoProduction({ companionId, contentType = 'video' } = {}) {
  if (!requiresApprovedIdentityLora(contentType)) return null
  if (!companionId) throw new ApiError(409, 'Não foi possível identificar o avatar vinculado à produção.')

  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('id, actor_profile_id, companion_id, status, authorized_for_content_types, starts_at, ends_at, revoked_at, created_at')
    .eq('companion_id', companionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw new ApiError(500, 'Erro ao localizar o ator autorizado para esta produção de vídeo.', error)

  const now = Date.now()
  const normalizedContentType = normalizeContentType(contentType)
  const authorization = (data || []).find((row) => {
    if (!row.actor_profile_id || row.revoked_at) return false
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false
    const allowed = (row.authorized_for_content_types || []).map(normalizeContentType)
    return allowed.includes(normalizedContentType)
      || (normalizedContentType === 'short_video' && allowed.includes('video'))
      || (normalizedContentType === 'live_action' && allowed.includes('video'))
  })
  if (!authorization) throw new ApiError(409, 'O avatar não possui ator autorizado para esta produção de vídeo.')

  return assertApprovedIdentityAdapterForVideoProduction({
    actorProfileId: authorization.actor_profile_id,
    companionId,
    authorizationId: authorization.id,
    contentType,
  })
}

function assertAdapterIntegrity(adapter, actorProfileId) {
  const expectedBucket = normalizeText(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME)
  const expectedFingerprint = normalizeText(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)
  const expectedPrefix = `identity-loras/${actorProfileId}/`

  if (!adapter) throw new ApiError(409, 'A identidade do ator ainda não foi aprovada.')
  if (adapter.actor_profile_id !== actorProfileId) throw new ApiError(409, 'A identidade aprovada não pertence ao ator selecionado.')
  if (adapter.status !== 'approved' || adapter.qa_status !== 'approved' || adapter.revoked_at) {
    throw new ApiError(409, 'A identidade do ator ainda não passou pela validação.')
  }
  if (!isSha256(adapter.sha256) || Number(adapter.byte_size || 0) <= 0) {
    throw new ApiError(409, 'O arquivo de identidade aprovado está incompleto ou inválido.')
  }
  if (!expectedBucket || adapter.r2_bucket !== expectedBucket || !normalizeText(adapter.r2_key).startsWith(expectedPrefix)) {
    throw new ApiError(409, 'O arquivo de identidade não está no armazenamento privado esperado.')
  }
  if (adapter.base_model !== env.IDENTITY_LORA_BASE_MODEL) {
    throw new ApiError(409, 'O arquivo de identidade não é compatível com o gerador atual.')
  }
  if (!expectedFingerprint || adapter.base_model_fingerprint !== expectedFingerprint) {
    throw new ApiError(409, 'O arquivo de identidade não é compatível com o gerador atual.')
  }
  if (!normalizeText(adapter.consent_version)) {
    throw new ApiError(409, 'O arquivo de identidade não possui consentimento válido.')
  }
  return adapter
}

export async function assertApprovedActorIdentityForProduction({
  actorProfileId,
  companionId = null,
  authorizationId = null,
  contentType = 'image',
} = {}) {
  if (!requiresApprovedActorIdentityBeforeProduction(contentType)) return null
  if (!actorProfileId) throw new ApiError(409, 'Não foi possível identificar o ator vinculado à produção.')

  const actor = await getActor(actorProfileId)
  assertActorKycApproved(actor)
  const authorization = await getValidAuthorization({ actorProfileId, companionId, authorizationId, contentType })

  const { data: adapter, error } = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'approved')
    .eq('qa_status', 'approved')
    .is('revoked_at', null)
    .order('approved_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    if (isMissingRelationError(error)) throw new ApiError(409, 'A preparação da identidade do ator ainda não está disponível.')
    throw new ApiError(500, 'Erro ao validar a identidade aprovada do ator.', error)
  }

  assertAdapterIntegrity(adapter, actorProfileId)

  const { data: trainingRun, error: trainingRunError } = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('id, actor_profile_id, status, base_model, base_model_fingerprint')
    .eq('id', adapter.training_run_id)
    .eq('actor_profile_id', actorProfileId)
    .maybeSingle()
  if (trainingRunError) throw new ApiError(500, 'Erro ao validar a preparação da identidade aprovada.', trainingRunError)
  if (!trainingRun || trainingRun.status !== 'approved') {
    throw new ApiError(409, 'A identidade personalizada do ator ainda não foi aprovada.')
  }
  if (trainingRun.base_model !== adapter.base_model || trainingRun.base_model_fingerprint !== adapter.base_model_fingerprint) {
    throw new ApiError(409, 'Os dados da identidade aprovada estão inconsistentes.')
  }

  if (!env.IDENTITY_LORA_INFERENCE_INJECTION_READY) {
    throw new ApiError(409, 'A identidade personalizada foi aprovada, mas ainda não está integrada à produção.')
  }

  return {
    actorProfileId,
    authorizationId: authorization.id,
    adapterId: adapter.id,
    adapterVersion: adapter.adapter_version,
    baseModel: adapter.base_model,
    baseModelFingerprint: adapter.base_model_fingerprint,
    bucket: adapter.r2_bucket,
    key: adapter.r2_key,
    sha256: adapter.sha256,
    byteSize: Number(adapter.byte_size),
    triggerToken: adapter.trigger_token,
    strengthModel: Number(adapter.recommended_strength_model || 0.65),
    consentVersion: adapter.consent_version,
  }
}

export async function assertApprovedIdentityAdapterForVideoProduction({
  actorProfileId,
  companionId = null,
  authorizationId = null,
  contentType = 'video',
} = {}) {
  if (!requiresApprovedIdentityLora(contentType)) return null
  return assertApprovedActorIdentityForProduction({ actorProfileId, companionId, authorizationId, contentType })
}

export async function assertIdentityAdaptersForCastSlots(castSlots = [], contentType = 'video') {
  const actorSlots = castSlots.filter((slot) => slot.participantType === 'actor')
  const adapters = await Promise.all(actorSlots.map(async (slot) => ({
    slotIndex: slot.slotIndex,
    adapter: await assertApprovedIdentityAdapterForVideoProduction({
      actorProfileId: slot.actorProfileId,
      companionId: slot.companionId,
      authorizationId: slot.authorizationId,
      contentType,
    }),
  })))
  return new Map(adapters.map((item) => [item.slotIndex, item.adapter]))
}
