import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export type ActorStatus = 'draft' | 'invited' | 'onboarding' | 'kyc_pending' | 'approved' | 'rejected' | 'blocked' | string
export type ActorKycStatus = 'not_started' | 'pending_review' | 'approved' | 'rejected' | string
export type ActorProductionStatus = 'not_authorized' | 'authorized' | string
export type KycCaseStatus = 'pending_review' | 'approved' | 'rejected' | string
export type AvatarAuthorizationStatus = 'active' | 'revoked' | 'expired' | string

export interface ActorIdentityOperationalSnapshot {
  status: 'schema_pending' | 'not_started' | 'preparing' | 'ready_to_train' | 'queued' | 'training' | 'review_required' | 'approved' | 'changes_required' | 'failed' | 'cancelled' | string
  label: string
  nextAction: string
  progressPercent: number | null
  runId: string | null
  adapterId: string | null
  qaStatus: string | null
  lastUpdatedAt: string | null
}

export interface ActorProfile {
  id: string
  profileId: string | null
  displayName: string
  legalName: string | null
  email: string | null
  phone: string | null
  countryCode: string
  status: ActorStatus
  kycStatus: ActorKycStatus
  productionStatus: ActorProductionStatus
  latestMappingCaseId?: string | null
  latestMappingCaseStatus?: string | null
  mappingOperationalStatus?: string | null
  identity?: ActorIdentityOperationalSnapshot | null
  notes: string | null
  blockedAt: string | null
  blockedByProfileId: string | null
  metadata: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
}

export interface ActorProfilesResponse {
  items: ActorProfile[]
}

export interface ActorInvite {
  id: string
  actorProfileId: string | null
  email: string | null
  status: string
  expiresAt: string | null
  acceptedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
  inviteToken?: string
}

export interface ActorInviteResponse {
  invite: ActorInvite
  message: string
}

export interface KycAsset {
  id: string
  kycCaseId: string | null
  actorProfileId: string | null
  mappingRequirementId: string | null
  assetType: string | null
  bucket: string | null
  key: string | null
  originalFilename: string | null
  contentType: string | null
  byteSize: number | null
  checksumSha256: string | null
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  reviewerProfileId: string | null
  metadata: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
}


export interface AdminSafeImageTransform {
  cropAspect: 'original' | 'square' | 'portrait'
  zoom: number
  offsetX: number
  offsetY: number
  rotation: number
  brightness: number
  contrast: number
  saturation: number
  grayscale: number
  outputWidth: number
  outputHeight: number
  preset: 'none' | 'light_cleanup'
}

export interface CreateKycAssetEditedCopyPayload {
  base64: string
  contentType: 'image/jpeg' | 'image/png' | 'image/webp'
  originalFilename: string
  byteSize: number
  note?: string
  transform: AdminSafeImageTransform
}

export interface MappingChecklistAssetSummary {
  id: string | null
  mappingRequirementId: string | null
  assetType: string | null
  originalFilename: string | null
  status: string | null
  createdAt: string | null
}

export interface MappingChecklistGroup {
  key: string
  requirementId: string
  label: string
  description: string
  mediaType: 'image' | 'audio' | 'video'
  required: boolean
  present: boolean
  totalAssets: number
  validAssets: number
  dryRunAssets: number
  status: string
  rejectionReason: string | null
  assets: MappingChecklistAssetSummary[]
}

export interface MappingChecklistMissingGroup {
  key: string
  requirementId: string
  label: string
  description: string
}

export interface MappingChecklist {
  status: 'incomplete' | 'ready_for_review' | 'approved' | string
  isComplete: boolean
  totalRequired: number
  completedRequired: number
  missingRequired: number
  missingGroups: MappingChecklistMissingGroup[]
  groups: MappingChecklistGroup[]
  summary: string
}

export interface KycCase {
  id: string
  actorProfileId: string | null
  caseType: string
  status: KycCaseStatus
  submittedAt: string | null
  reviewedAt: string | null
  reviewerProfileId: string | null
  rejectionReason: string | null
  notes: string | null
  metadata: Record<string, unknown>
  assets?: KycAsset[]
  mappingChecklist?: MappingChecklist | null
  createdAt: string | null
  updatedAt: string | null
}

export interface KycCasesResponse {
  items: KycCase[]
}


export interface PrivateAssetBlobResponse {
  blob: Blob
  filename: string
  contentType: string
}

function filenameFromContentDisposition(value?: string | null) {
  const header = String(value || '')
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1])

  const match = header.match(/filename="?([^";]+)"?/i)
  return match?.[1] || 'material-mapeamento'
}

export interface KycAssetResponse {
  item: KycAsset
  message: string
}


export interface MappingVaultTestArtifact {
  id: string
  kycCaseId: string | null
  actorProfileId: string | null
  assetType: string | null
  bucket: string | null
  key: string | null
  status: string | null
  originalFilename: string | null
  contentType: string | null
  byteSize: number | null
  source: string | null
  dryRun: boolean
  realR2Candidate: boolean
  quarantined: boolean
  r2Checked: boolean
  r2ObjectExists: boolean | null
  createdAt: string | null
  updatedAt: string | null
  publicAccess: false
}

export interface MappingVaultTestArtifactsAudit {
  status: string
  checkR2: boolean
  includeQuarantined: boolean
  limit: number
  summary: {
    total: number
    dryRun: number
    realR2Candidates: number
    quarantined: number
    r2Checked: number
    r2ObjectExists: number
    destructiveDelete: false
    publicAccess: false
  }
  artifacts: MappingVaultTestArtifact[]
  message: string
}

export interface MappingVaultTestArtifactsQuarantinePayload {
  assetIds?: string[]
  dryRunOnly?: boolean
  copyR2?: boolean
  limit?: number
  reason?: string
  confirmationPhrase?: string
}

export interface MappingVaultTestArtifactsQuarantineResult {
  status: 'dry_run' | 'executed' | string
  dryRunOnly: boolean
  copyR2: boolean
  destructiveDelete: false
  confirmationRequired: boolean
  confirmationPhrase: string
  summary: {
    planned: number
    executed: number
    skipped: number
    copiedObjects: number
    deleteExecuted: false
  }
  planned: Array<Record<string, unknown>>
  executed: Array<Record<string, unknown>>
  skipped: Array<Record<string, unknown>>
  message: string
}

export interface AvatarProductionAuthorization {
  id: string
  companionId: string | null
  actorProfileId: string | null
  kycCaseId: string | null
  status: AvatarAuthorizationStatus
  authorizedForContentTypes: string[]
  startsAt: string | null
  endsAt: string | null
  revokedAt: string | null
  revokedByProfileId: string | null
  authorizedByProfileId: string | null
  note: string | null
  financeSnapshot: Record<string, unknown>
  termsSnapshot: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string | null
  updatedAt: string | null
}



export interface AvatarComplianceReason {
  code: string
  message: string
  severity: string
}

export interface AvatarComplianceReport {
  status: 'liberado' | 'bloqueado' | string
  productionAllowed: boolean
  summary: string
  avatar: {
    id: string
    name: string
    slug: string | null
    isActive: boolean | null
  }
  actor: {
    id: string
    displayName: string
    email: string | null
    status: string
    mappingStatus: string
    productionStatus: string
  } | null
  mapping: {
    id: string
    status: string | null
    caseType: string
    reviewedAt: string | null
    checklist: MappingChecklist | null
  } | null
  vault: {
    total: number
    real: number
    dryRun: number
    archivedOrQuarantined: number
    rejected: number
    privateVault: number
    realR2Candidates: number
    r2Checked: number
    r2ObjectExists: number
    r2Missing: number
    publicAccess: false
  }
  authorization: AvatarProductionAuthorization | null
  latestAuthorization: AvatarProductionAuthorization | null
  authorizations: AvatarProductionAuthorization[]
  reasons: AvatarComplianceReason[]
  checks: {
    hasActiveAuthorization: boolean
    requestedContentType?: string | null
    contentTypeAllowed?: boolean
    actorAllowed: boolean
    mappingApproved: boolean
    mappingComplete: boolean
    vaultChecked: boolean
    publicAccess: false
    runPodCalled: false
    destructiveDelete: false
  }
  message: string
}

export interface AvatarProductionAuthorizationsResponse {
  items: AvatarProductionAuthorization[]
}

export interface AvatarProductionAuthorizationActionResponse {
  item: AvatarProductionAuthorization
  message: string
}

export interface CreateActorPayload {
  displayName: string
  legalName?: string
  email?: string
  phone?: string
  countryCode?: string
  notes?: string
}

export interface CreateKycCasePayload {
  caseType?: string
  notes?: string
}

export interface RegisterKycAssetPayload {
  mappingRequirementId: string
  base64?: string
  contentType?: string
  originalFilename?: string
  byteSize?: number
  dryRunOnly: boolean
  metadata?: Record<string, unknown>
}

export interface AuthorizeAvatarProductionPayload {
  actorProfileId: string
  kycCaseId: string
  authorizedForContentTypes: string[]
  note?: string
  financeSnapshot?: Record<string, unknown>
  termsSnapshot?: Record<string, unknown>
}

export async function getActorProfiles(params: { includeBlocked?: boolean; search?: string } = {}): Promise<ActorProfilesResponse> {
  const { data } = await api.get<ApiEnvelope<ActorProfilesResponse>>('/api/admin/actors', {
    params: {
      includeBlocked: params.includeBlocked ?? true,
      search: params.search || undefined,
    },
  })

  return data.data
}

export async function createActorProfile(payload: CreateActorPayload): Promise<ActorProfile> {
  const { data } = await api.post<ApiEnvelope<ActorProfile>>('/api/admin/actors', payload)
  return data.data
}

export async function blockActorProfile(actorId: string, reason: string): Promise<ActorProfile> {
  const { data } = await api.patch<ApiEnvelope<ActorProfile>>(`/api/admin/actors/${actorId}/block`, { reason })
  return data.data
}

export async function unblockActorProfile(actorId: string, reason: string): Promise<ActorProfile> {
  const { data } = await api.patch<ApiEnvelope<ActorProfile>>(`/api/admin/actors/${actorId}/unblock`, { reason })
  return data.data
}

export async function generateActorInvite(actorId: string, payload: { email?: string; expiresInDays?: number }): Promise<ActorInviteResponse> {
  const { data } = await api.post<ApiEnvelope<ActorInviteResponse>>(`/api/admin/actors/${actorId}/invites`, payload)
  return data.data
}

export async function getActorKycCases(actorId: string): Promise<KycCasesResponse> {
  const { data } = await api.get<ApiEnvelope<KycCasesResponse>>(`/api/admin/actors/${actorId}/kyc-cases`)
  return data.data
}

export async function createActorKycCase(actorId: string, payload: CreateKycCasePayload): Promise<KycCase> {
  const { data } = await api.post<ApiEnvelope<KycCase>>(`/api/admin/actors/${actorId}/kyc-cases`, payload)
  return data.data
}

export async function getKycCase(kycCaseId: string): Promise<KycCase> {
  const { data } = await api.get<ApiEnvelope<KycCase>>(`/api/admin/kyc-cases/${kycCaseId}`)
  return data.data
}


export async function getKycCaseMappingChecklist(kycCaseId: string): Promise<MappingChecklist> {
  const { data } = await api.get<ApiEnvelope<MappingChecklist>>(`/api/admin/kyc-cases/${kycCaseId}/mapping-checklist`)
  return data.data
}

export async function registerKycAsset(kycCaseId: string, payload: RegisterKycAssetPayload): Promise<KycAssetResponse> {
  const { data } = await api.post<ApiEnvelope<KycAssetResponse>>(`/api/admin/kyc-cases/${kycCaseId}/assets`, payload)
  return data.data
}


export async function fetchKycAssetPrivateBlob(assetId: string, download = false): Promise<PrivateAssetBlobResponse> {
  const response = await api.get<Blob>(`/api/admin/kyc-assets/${assetId}/private-view`, {
    params: { download: download ? 'true' : 'false' },
    responseType: 'blob',
  })

  return {
    blob: response.data,
    filename: filenameFromContentDisposition(response.headers['content-disposition']),
    contentType: response.headers['content-type'] || response.data.type || 'application/octet-stream',
  }
}

export async function createKycAssetEditedCopy(assetId: string, payload: CreateKycAssetEditedCopyPayload): Promise<KycAssetResponse> {
  const { data } = await api.post<ApiEnvelope<KycAssetResponse>>(`/api/admin/kyc-assets/${assetId}/edited-copy`, payload)
  return data.data
}

export async function reclassifyKycAsset(assetId: string, mappingRequirementId: string, note?: string): Promise<KycAssetResponse> {
  const { data } = await api.post<ApiEnvelope<KycAssetResponse>>(`/api/admin/kyc-assets/${assetId}/reclassify`, { mappingRequirementId, note })
  return data.data
}

export async function approveKycAsset(assetId: string, note?: string): Promise<KycAssetResponse> {
  const { data } = await api.post<ApiEnvelope<KycAssetResponse>>(`/api/admin/kyc-assets/${assetId}/approve`, { note })
  return data.data
}

export async function rejectKycAsset(assetId: string, reason: string): Promise<KycAssetResponse> {
  const { data } = await api.post<ApiEnvelope<KycAssetResponse>>(`/api/admin/kyc-assets/${assetId}/reject`, { reason })
  return data.data
}

export async function approveKycCase(kycCaseId: string, note?: string): Promise<KycCase> {
  const { data } = await api.post<ApiEnvelope<KycCase>>(`/api/admin/kyc-cases/${kycCaseId}/approve`, { note })
  return data.data
}

export async function rejectKycCase(kycCaseId: string, reason: string): Promise<KycCase> {
  const { data } = await api.post<ApiEnvelope<KycCase>>(`/api/admin/kyc-cases/${kycCaseId}/reject`, { reason })
  return data.data
}



export async function getAvatarComplianceReport(avatarId: string, params: { checkR2?: boolean; contentType?: string | null } = {}): Promise<AvatarComplianceReport> {
  const { data } = await api.get<ApiEnvelope<AvatarComplianceReport>>(`/api/admin/avatars/${avatarId}/compliance-report`, {
    params: {
      checkR2: params.checkR2 ? 'true' : 'false',
      ...(params.contentType ? { contentType: params.contentType } : {}),
    },
  })
  return data.data
}

export async function getAvatarProductionAuthorizations(avatarId: string): Promise<AvatarProductionAuthorizationsResponse> {
  const { data } = await api.get<ApiEnvelope<AvatarProductionAuthorizationsResponse>>(`/api/admin/avatars/${avatarId}/production-authorizations`)
  return data.data
}

export async function authorizeAvatarProduction(avatarId: string, payload: AuthorizeAvatarProductionPayload): Promise<AvatarProductionAuthorizationActionResponse> {
  const { data } = await api.post<ApiEnvelope<AvatarProductionAuthorizationActionResponse>>(`/api/admin/avatars/${avatarId}/production-authorizations`, payload)
  return data.data
}

export async function revokeAvatarProductionAuthorization(authorizationId: string, reason: string): Promise<AvatarProductionAuthorizationActionResponse> {
  const { data } = await api.post<ApiEnvelope<AvatarProductionAuthorizationActionResponse>>(`/api/admin/avatar-production-authorizations/${authorizationId}/revoke`, { reason })
  return data.data
}


export async function getMappingVaultTestArtifactsAudit(params: { checkR2?: boolean; includeQuarantined?: boolean; limit?: number } = {}): Promise<MappingVaultTestArtifactsAudit> {
  const { data } = await api.get<ApiEnvelope<MappingVaultTestArtifactsAudit>>('/api/admin/actor-mapping/vault-test-artifacts', {
    params: {
      checkR2: params.checkR2 ? 'true' : 'false',
      includeQuarantined: params.includeQuarantined ? 'true' : 'false',
      limit: params.limit || 100,
    },
  })
  return data.data
}

export async function quarantineMappingVaultTestArtifacts(payload: MappingVaultTestArtifactsQuarantinePayload): Promise<MappingVaultTestArtifactsQuarantineResult> {
  const { data } = await api.post<ApiEnvelope<MappingVaultTestArtifactsQuarantineResult>>('/api/admin/actor-mapping/vault-test-artifacts/quarantine', payload)
  return data.data
}
