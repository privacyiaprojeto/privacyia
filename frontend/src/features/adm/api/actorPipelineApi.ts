import { api } from '@/shared/lib/axios'
import type { ApiEnvelope, FactoryAsset } from '@/features/adm/types'
import type { ProductSplitsResponse } from '@/features/adm/api/sceneDirectionApi'

export type ActorPipelineProductType = 'image' | 'short_video' | 'live_action_v2v' | 'live_audio'
export type ActorPipelineDestination = 'feed' | 'premium' | 'public_storefront'


export interface ActorIdentityForensicBlocker {
  code: string
  message: string
  severity: string
}

export interface ActorIdentityForensicAudit {
  status: 'not_run' | 'passed' | 'failed' | 'blocked' | string
  verdict: string
  executedAt: string | null
  blockers: ActorIdentityForensicBlocker[]
  adapter: Record<string, unknown>
  sourceLineage: Record<string, unknown>
  similarity: Record<string, unknown>
  safety: Record<string, unknown>
}

export interface ActorPipelineActorContext {
  id: string
  displayName: string
  legalName: string | null
  email: string | null
  status: string | null
  kycStatus: string | null
  productionStatus: string | null
  companion: { id: string; name: string | null; slug: string | null } | null
  authorization: { id: string; status: string; authorizedForContentTypes: string[] } | null
}

export interface ActorIdentityLoraSummary {
  gatekeeperEnabled: boolean
  schemaReady: boolean
  kycApproved: boolean
  requiresIdentityLoraFor: string[]
  requiresIdentityBeforeAnyProduct: boolean
  requiresIdentityFor: string[]
  state: string
  blockReason: string | null
  canPrepareReadiness: boolean
  adapterApproved: boolean
  identityPreparationApproved: boolean
  allProductProductionUnlocked: boolean
  inferenceInjectionReady: boolean
  videoProductionUnlocked: boolean
  previewPolicy: {
    enabled: boolean
    ready: boolean
    contractVersion: string | null
    expiresAt: string | null
    maxJobs: number
    actorMatched: boolean | null
    runMatched: boolean | null
    adapterMatched: boolean | null
    blockers: string[]
  }
  latestRun: {
    id: string
    mode: string
    status: string
    statusLabel: string
    datasetManifestSha256Prefix: string | null
    imageCount: number
    videoCount: number
    audioCount: number
    baseModel: string | null
    baseModelFingerprintPrefix: string | null
    privateTrainingBucket: string | null
    trainingEngine: string | null
    trainingEngineCommit: string | null
    executionPlan: {
      prepared: boolean
      sha256Prefix: string | null
      preparedAt: string | null
      provider: string | null
      mode: string | null
      runtimeExecutionEnabled: boolean
      smokeMode: boolean
      smokeActorMatched: boolean
      smokeRunMatched: boolean
      smokeExpiresAt: string | null
      smokeOneShot: boolean
      smokeOneShotConsumed: boolean
      trainingStarted: boolean
      qaStarted: boolean
      adapterIntegrated: boolean
    }
    trainingJob: {
      dispatchStatus: string
      providerJobIdPrefix: string | null
      submittedAt: string | null
      startedAt: string | null
      completedAt: string | null
      lastCheckedAt: string | null
      progressPercent: number | null
      targetSteps: number | null
      adapterRegistered: boolean
      lastError: string | null
      failureCode: string | null
      failureCategory: string | null
      retryable: boolean
      operatorMessage: string | null
      failedAt: string | null
    }
    createdAt: string | null
    updatedAt: string | null
  } | null
  latestAdapter: {
    id: string
    trainingRunId: string | null
    version: number
    status: string
    qaStatus: string
    baseModel: string
    baseModelFingerprintPrefix: string | null
    sha256Prefix: string | null
    byteSize: number
    recommendedStrengthModel: number
    privateOnly: boolean
    approvedAt: string | null
    revokedAt: string | null
    createdAt: string | null
    updatedAt: string | null
  } | null
  approvedAdapter: {
    id: string
    trainingRunId: string | null
    version: number
    status: string
    qaStatus: string
    baseModel: string
    baseModelFingerprintPrefix: string | null
    sha256Prefix: string | null
    byteSize: number
    recommendedStrengthModel: number
    privateOnly: boolean
    approvedAt: string | null
    revokedAt: string | null
    createdAt: string | null
    updatedAt: string | null
  } | null
  review: {
    status: string
    label: string
    technicalStatus: 'passed' | 'failed' | 'pending' | string
    technicalPassed: boolean
    checks: Array<{ code: string; label: string; passed: boolean; message: string }>
    visualEvidenceRequired: boolean
    visualEvidenceReady: boolean
    preview: {
      status: string
      ready: boolean
      validForApproval: boolean
      reviewable: boolean
      providerJobIdConfigured: boolean
      requestedAt: string | null
      startedAt: string | null
      completedAt: string | null
      lastCheckedAt: string | null
      failedAt: string | null
      invalidatedAt: string | null
      invalidationReason: string | null
      message: string | null
      mediaAvailable: boolean
      protectedMediaUrl: string | null
      assetCount: number
      assets: Array<{ assetKey: string; label: string; kind: string; contentType: string; mediaAvailable: boolean; protectedMediaUrl: string; width: number | null; height: number | null; durationSeconds: number | null }>
      durationSeconds: number | null
      forensicAudit: ActorIdentityForensicAudit
    }
    forensicAudit: ActorIdentityForensicAudit
    trainingTargetAudit: {
      status: string
      verdict: string
      executedAt: string | null
      currentTraining: Record<string, unknown>
      adapter: Record<string, unknown>
      compatibility: Record<string, unknown>
      candidateContract: Record<string, unknown>
      blockers: ActorIdentityForensicBlocker[]
      nextPaidTestAllowed: boolean
      safety: Record<string, unknown>
    }
    videoValidation: {
      profile: string
      targetUseCases: string[]
      currentEvidenceCompatible: boolean
      requiresRandomBaseVideo: boolean
      requiresMotionOnlyControl: boolean
      actorMappingRawRgbControlAllowed: boolean
      requiresSameSeedBaselineWithoutLora: boolean
      nextPaidTestAllowed: boolean
      blockers: ActorIdentityForensicBlocker[]
      nextAction: string
    }
    finalApprovalAllowed: boolean
    finalRejectionAllowed: boolean
    finalDecision: 'approved' | 'rejected' | 'pending' | string
    nextAction: string
    lastUpdatedAt: string | null
  }
  safety: {
    runPodCalled: boolean
    gpuStarted: boolean
    r2ObjectCopied: boolean
    publicUrlCreated: boolean
    automaticRetry: boolean
  }
}


export interface ActorIdentityDatasetAssetDiagnostic {
  assetId: string
  mappingRequirementId: string | null
  systemTag: string | null
  requirementTitle: string | null
  originalFilename: string | null
  mediaType: string
  contentType: string | null
  byteSize: number | null
  mappingStatus: string | null
  datasetStatus: 'included' | 'excluded'
  reasonCode: string
  reasonLabel: string
  reasonMessage: string
  recommendedAction: string
  tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | string
  recoverability: string
  requiresAction: boolean
  noActionRequired: boolean
  checksumState: string
  parentAssetId: string | null
  matchingAssetId: string | null
}

export interface ActorIdentityDatasetDiagnosticReason {
  reasonCode: string
  count: number
  label: string
  message: string
  recommendedAction: string
  tone: string
  recoverability: string
  requiresAction: boolean
  noActionRequired: boolean
}

export interface ActorIdentityDatasetReadiness {
  status: string
  actor: { id: string; displayName: string; status: string | null; mappingStatus: string | null; productionStatus: string | null }
  mappingCase: { id: string; status: string; reviewedAt: string | null } | null
  authorization: {
    source: string | null
    id: string | null
    actorProfileId: string | null
    kycCaseId: string | null
    status: string | null
    scope: string | null
    authorizedAt: string | null
    videoAllowed: boolean
    consentSnapshotSha256Prefix: string | null
  } | null
  readiness: {
    ready: boolean
    blockers: Array<{ code: string; message: string; details?: Record<string, unknown> }>
    warnings: Array<{ code: string; message: string; details?: Record<string, unknown> }>
    nextAction: string
  }
  datasetRegistration: {
    ready: boolean
    blockers: Array<{ code: string; message: string; details?: Record<string, unknown> }>
    nextAction: string
  }
  trainingConfiguration: {
    ready: boolean
    blockers: Array<{ code: string; message: string; details?: Record<string, unknown> }>
    baseModel: string | null
    baseModelRevisionConfigured: boolean
    baseModelRevisionPrefix: string | null
    baseModelFingerprintConfigured: boolean
    baseModelFingerprintPrefix: string | null
    baseModelLockConfigured: boolean
    baseModelLockVerified: boolean
    baseModelLockPath: string | null
    baseModelLockFingerprintPrefix: string | null
    baseModelArtifactCount: number
    baseModelRequiredArtifactCount: number
    privateTrainingBucketConfigured: boolean
    privateTrainingBucketName: string | null
    trainingEngine: string
    trainingEngineCommit: string | null
    trainingEngineCommitConfigured: boolean
    dryRunOnly: boolean
    realTrainingDisabled: boolean
    nextAction: string
  }
  thresholds: {
    minimumImages: number
    minimumVideos: number
    recommendedImages: string
    recommendedShortVideos: string
    requiredImageTags: string[]
    requiredVideoTags: string[]
  }
  summary: {
    totalMappingAssets: number
    approvedMappingAssets: number
    pendingReviewAssets: number
    pendingReviewImages: number
    pendingReviewVideos: number
    rejectedAssets: number
    approvedAudioAssets: number
    includedVisualAssets: number
    validUniqueImages: number
    validUniqueVideos: number
    lineageSupersededAssets: number
    excludedAssets: number
    checksumCoveragePercent: number
    privateTrainingBucketConfigured: boolean
    baseModelFingerprintConfigured: boolean
    baseModelRevisionConfigured: boolean
    baseModelLockVerified: boolean
  }
  coverage: {
    imageTags: string[]
    videoTags: string[]
    missingImageTags: string[]
    missingVideoTags: string[]
  }
  exclusions: {
    total: number
    byReason: Record<string, number>
  }
  diagnostics: {
    schemaVersion: string
    assets: ActorIdentityDatasetAssetDiagnostic[]
    summary: {
      included: number
      excluded: number
      checksumRepairCandidates: number
      actionRequired: number
      historicalOnly: number
      noActionRequired: number
      reasons: ActorIdentityDatasetDiagnosticReason[]
    }
    checksumRepair: {
      candidateCount: number
      automaticMutationExecuted: boolean
      privateObjectVerificationRequired: boolean
      nextAction: string
    }
  }
}

export interface ActorIdentityPreparationAuthorizationPayload {
  confirmation: 'AUTORIZAR USO PARA PREPARAR IDENTIDADE'
  note?: string | null
}

export interface ActorIdentityPreparationAuthorizationResponse {
  status: string
  actor: { id: string; displayName: string; productionStatus: string | null }
  mappingCase: { id: string; status: string; reviewedAt?: string | null }
  authorization: {
    source: string
    actorProfileId: string | null
    kycCaseId: string | null
    status: string | null
    scope: string | null
    authorizedAt: string | null
    authorizedByProfileId: string | null
  }
  dataset: {
    validUniqueImages: number
    validUniqueVideos: number
    includedVisualAssets: number
    actionRequired: number
  }
  message: string
  safety: Record<string, boolean>
}

export interface ActorIdentityDatasetRegistrationPayload {
  confirmation: 'REGISTRAR CONJUNTO APROVADO'
}

export interface ActorIdentityDatasetRegistrationResponse {
  status: string
  run: ActorIdentityLoraSummary['latestRun']
  message: string
  safety: Record<string, boolean>
}


export interface ActorIdentityTrainingExecutionPlanPayload {
  confirmation: 'PREPARAR PREFLIGHT CONTROLADO DA IDENTIDADE D3.5'
}

export interface ActorIdentityTrainingExecutionPlanResponse {
  status: string
  actor: { id: string; displayName: string }
  runId: string
  executionPlan: NonNullable<ActorIdentityLoraSummary['latestRun']>['executionPlan']
  nextAction: string
  message: string
  safety: Record<string, boolean>
}

export interface ActorIdentityTrainingStartPayload {
  confirmation: 'CRIAR IDENTIDADE REAL CONTROLADA D3.6B'
}

export interface ActorIdentityTrainingActionResponse {
  status: string
  runId: string
  runStatus?: string
  providerStatus?: string
  training: NonNullable<ActorIdentityLoraSummary['latestRun']>['trainingJob']
  terminal?: boolean
  message?: string
  safety?: Record<string, boolean>
}

export interface ActorIdentityPreviewStartPayload {
  confirmation: 'PREPARAR PREVIA PRIVADA DA IDENTIDADE'
}

export interface ActorIdentityPreviewActionResponse {
  status: string
  adapterId: string
  providerStatus?: string
  terminal?: boolean
  preview: NonNullable<ActorIdentityLoraSummary['review']>['preview']
  message?: string
  safety?: Record<string, boolean>
}


export interface ActorIdentityForensicAuditPayload {
  confirmation: 'EXECUTAR AUDITORIA FORENSE SEM GPU D3.6H3'
}

export interface ActorIdentityForensicAuditResponse {
  status: string
  actorProfileId: string
  trainingRunId: string
  adapterId: string
  forensicAudit: ActorIdentityForensicAudit & { futureValidation?: Record<string, unknown> }
  nextPaidTestAllowed: boolean
  nextAction: string
  safety: Record<string, boolean | number>
}

export interface ActorIdentityTrainingTargetAuditPayload {
  confirmation: 'EXECUTAR AUDITORIA DO ALVO DE TREINAMENTO D3.6H4'
}

export interface ActorIdentityTrainingTargetAuditResponse {
  status: string
  actorProfileId: string
  trainingRunId: string
  adapterId: string
  trainingTargetAudit: NonNullable<ActorIdentityLoraSummary['review']>['trainingTargetAudit']
  nextPaidTestAllowed: boolean
  nextAction: string
  safety: Record<string, boolean | number>
}

export type ActorIdentityReviewDecisionPayload =
  | { action: 'approve'; confirmation: 'APROVAR IDENTIDADE DE VIDEO DO ATOR'; notes?: string | null }
  | { action: 'reject'; confirmation: 'REJEITAR IDENTIDADE E SOLICITAR NOVO TREINAMENTO'; reason: string; notes?: string | null }

export interface ActorIdentityReviewDecisionResponse {
  status: string
  actorProfileId: string
  trainingRunId: string
  adapterId: string
  decision: 'approved' | 'rejected'
  message: string
  safety: Record<string, boolean>
}

export interface ActorPipelineSummary {
  actor: ActorPipelineActorContext
  identityLora: ActorIdentityLoraSummary
  indicators: {
    totalProducts: number
    pendingReview: number
    approvedWaitingPublication: number
    published: number
  }
  finance: {
    grossCredits: number
    estimatedPayoutCredits: number
    platformEstimatedCredits: number
    payoutStatus: string
    payoutPercent: number
    deliveries: number
  }
}

export interface ActorPipelineProductionPayload {
  productType: ActorPipelineProductType
  dictionarySelections?: Array<{ id: string }>
  variations?: number
  baseSceneId?: string | null
  storylineId?: string | null
  additionalCast?: Array<{
    actorProfileId?: string | null
    participantType: 'actor' | 'virtual_extra'
    extraType?: 'generic_black_man' | 'generic_white_muscular_man' | 'generic_asian_woman' | 'custom'
    customDescription?: string | null
  }>
  notes?: string | null
}

export interface ActorPipelineProductionResponse {
  actor: ActorPipelineActorContext
  productType: ActorPipelineProductType
  production: Record<string, unknown> & { queued?: boolean; mode?: string; batchId?: string; direction?: { id?: string; status?: string } }
  message: string
}

export interface ActorPipelineProduct extends FactoryAsset {
  splits?: ProductSplitsResponse | null
}

export interface ActorPipelineProductsResponse {
  actor: ActorPipelineActorContext
  items: ActorPipelineProduct[]
}

export interface ActorPipelinePublicationPayload {
  destination: ActorPipelineDestination
  priceCredits: number
  description: string
  splits: Array<{
    beneficiaryId: string
    beneficiaryType: 'actor' | 'company'
    splitPercentage: number
    displayOnStorefront: boolean
    sortOrder: number
  }>
}

export async function getActorPipelineSummary(actorId: string): Promise<ActorPipelineSummary> {
  const { data } = await api.get<ApiEnvelope<ActorPipelineSummary>>(`/api/admin/actors/${actorId}/pipeline/summary`)
  return data.data
}

export async function getActorIdentityDatasetReadiness(actorId: string): Promise<ActorIdentityDatasetReadiness> {
  const { data } = await api.get<ApiEnvelope<ActorIdentityDatasetReadiness>>(`/api/admin/actors/${actorId}/pipeline/identity-lora/dataset-readiness`)
  return data.data
}

export async function authorizeActorIdentityPreparation(
  actorId: string,
  payload: ActorIdentityPreparationAuthorizationPayload,
): Promise<ActorIdentityPreparationAuthorizationResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityPreparationAuthorizationResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-preparation/authorize`,
    payload,
  )
  return data.data
}

export async function registerActorIdentityDataset(
  actorId: string,
  payload: ActorIdentityDatasetRegistrationPayload,
): Promise<ActorIdentityDatasetRegistrationResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityDatasetRegistrationResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/dataset-register`,
    payload,
  )
  return data.data
}

export async function prepareActorIdentityTrainingExecutionPlan(
  actorId: string,
  payload: ActorIdentityTrainingExecutionPlanPayload,
): Promise<ActorIdentityTrainingExecutionPlanResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityTrainingExecutionPlanResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/execution-plan`,
    payload,
  )
  return data.data
}

export async function startActorIdentityTraining(
  actorId: string,
  payload: ActorIdentityTrainingStartPayload,
): Promise<ActorIdentityTrainingActionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityTrainingActionResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/train`,
    payload,
  )
  return data.data
}

export async function refreshActorIdentityTrainingStatus(actorId: string): Promise<ActorIdentityTrainingActionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityTrainingActionResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/training-status`,
    {},
  )
  return data.data
}

export async function startActorIdentityPreview(
  actorId: string,
  payload: ActorIdentityPreviewStartPayload,
): Promise<ActorIdentityPreviewActionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityPreviewActionResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/preview`,
    payload,
  )
  return data.data
}

export async function refreshActorIdentityPreviewStatus(actorId: string): Promise<ActorIdentityPreviewActionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityPreviewActionResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/preview-status`,
    {},
  )
  return data.data
}


export async function runActorIdentityVideoForensicAudit(
  actorId: string,
  payload: ActorIdentityForensicAuditPayload,
): Promise<ActorIdentityForensicAuditResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityForensicAuditResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/forensic-audit`,
    payload,
  )
  return data.data
}

export async function runActorIdentityTrainingTargetAudit(
  actorId: string,
  payload: ActorIdentityTrainingTargetAuditPayload,
): Promise<ActorIdentityTrainingTargetAuditResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityTrainingTargetAuditResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/training-target-audit`,
    payload,
  )
  return data.data
}

export async function decideActorIdentityReview(
  actorId: string,
  payload: ActorIdentityReviewDecisionPayload,
): Promise<ActorIdentityReviewDecisionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorIdentityReviewDecisionResponse>>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/review-decision`,
    payload,
  )
  return data.data
}

export async function getActorIdentityPreviewBlob(actorId: string, assetKey = 'baseline_without_lora'): Promise<Blob> {
  const { data } = await api.get<Blob>(
    `/api/admin/actors/${actorId}/pipeline/identity-lora/preview-media`,
    { params: { asset: assetKey }, responseType: 'blob' },
  )
  return data
}

export async function prepareActorIdentityLoraReadiness(actorId: string) {
  const { data } = await api.post<ApiEnvelope<{
    status: string
    message: string
    run: ActorIdentityLoraSummary['latestRun']
    safety: ActorIdentityLoraSummary['safety']
  }>>(`/api/admin/actors/${actorId}/pipeline/identity-lora/readiness`, {
    confirmation: 'PREPARAR READINESS LORA STAGE 2.2A',
  })
  return data.data
}

export async function createActorPipelineProduction(actorId: string, payload: ActorPipelineProductionPayload): Promise<ActorPipelineProductionResponse> {
  const { data } = await api.post<ApiEnvelope<ActorPipelineProductionResponse>>(`/api/admin/actors/${actorId}/pipeline/production`, payload)
  return data.data
}

export async function listActorPipelineReviewProducts(actorId: string): Promise<ActorPipelineProductsResponse> {
  const { data } = await api.get<ApiEnvelope<ActorPipelineProductsResponse>>(`/api/admin/actors/${actorId}/pipeline/review-products`)
  return data.data
}


export async function approveActorPipelineProduct(actorId: string, assetId: string, notes?: string) {
  const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/api/admin/actors/${actorId}/pipeline/products/${assetId}/approve`, { notes })
  return data.data
}

export async function rejectActorPipelineProduct(actorId: string, assetId: string, reason: string) {
  const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/api/admin/actors/${actorId}/pipeline/products/${assetId}/reject`, { reason })
  return data.data
}

export async function listActorPipelinePublicationProducts(actorId: string): Promise<ActorPipelineProductsResponse> {
  const { data } = await api.get<ApiEnvelope<ActorPipelineProductsResponse>>(`/api/admin/actors/${actorId}/pipeline/publication-products`)
  return data.data
}

export async function publishActorPipelineProduct(actorId: string, assetId: string, payload: ActorPipelinePublicationPayload) {
  const { data } = await api.post<ApiEnvelope<Record<string, unknown>>>(`/api/admin/actors/${actorId}/pipeline/products/${assetId}/publish`, payload)
  return data.data
}
