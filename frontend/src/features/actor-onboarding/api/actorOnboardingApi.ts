import { api } from '@/shared/lib/axios'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface PublicActorSummary {
  id: string
  displayName: string
  email: string | null
  phone: string | null
  status: string
  mappingStatus: string
  productionStatus: string
}

export interface PublicInviteSummary {
  id: string
  status: string
  email: string | null
  expiresAt: string | null
  acceptedAt: string | null
}


export interface PublicMappingRequirement {
  id: string
  title: string
  description: string
  guidance: string
  mediaType: 'image' | 'audio' | 'video'
  isRequired: boolean
  isActive: boolean
  acceptedMimeTypes: string[]
  accept: string
  createdAt: string | null
  updatedAt: string | null
}

export interface PublicMappingAsset {
  id: string
  kycCaseId: string | null
  actorProfileId: string | null
  mappingRequirementId: string | null
  assetType: string | null
  originalFilename: string | null
  contentType: string | null
  byteSize: number | null
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface PublicMappingChecklistGroup {
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
}


export interface PublicMappingChecklistMissingGroup {
  requirementId: string
  label: string
  description: string
}

export interface PublicMappingChecklist {
  status: string
  isComplete: boolean
  totalRequired: number
  completedRequired: number
  missingRequired: number
  missingGroups: PublicMappingChecklistMissingGroup[]
  groups: PublicMappingChecklistGroup[]
  summary: string
}

export interface PublicIdentityCompletionTask {
  id: string
  origin: 'system_identity_plan' | 'admin_requirement' | string
  requirementId: string
  title: string
  description: string
  guidance: string
  mediaType: 'image' | 'audio' | 'video' | string
  targetIndex: number
  targetCount: number
  replacementAssetId: string | null
}

export interface PublicIdentityCompletionPlan {
  schemaVersion: string
  ready: boolean
  remainingTotal: number
  remainingImages: number
  remainingVideos: number
  remainingAudio: number
  tasks: PublicIdentityCompletionTask[]
}

export interface PublicIdentityDatasetSummary {
  materialsReady: boolean
  totalMappingAssets: number
  approvedMappingAssets: number
  pendingReviewAssets: number
  pendingReviewImages: number
  pendingReviewVideos: number
  approvedAudioAssets: number
  includedVisualAssets: number
  validUniqueImages: number
  validUniqueVideos: number
  excludedAssets: number
  minimumImages: number
  minimumVideos: number
  missingImageTags: string[]
  missingVideoTags: string[]
  completionPlan: PublicIdentityCompletionPlan
}

export interface PublicMappingCase {
  id: string
  actorProfileId: string | null
  caseType: string
  status: string
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  notes: string | null
  actorSubmittedForReview: boolean
  sentForReviewAt: string | null
  reviewStatus: string | null
  changesRequestedAt: string | null
  reviewCycle: number
  generalMappingApproved: boolean
  supplementalReview: {
    status: string | null
    cycle: number
    sentForReviewAt: string | null
    completedAt: string | null
    pendingReviewAssets: number
  pendingReviewImages: number
  pendingReviewVideos: number
  }
  canAddSupplementalMaterials: boolean
  assets: PublicMappingAsset[]
  mappingChecklist: PublicMappingChecklist | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ActorOnboardingPortal {
  invite: PublicInviteSummary
  actor: PublicActorSummary
  requirements: PublicMappingRequirement[]
  mappingCase: PublicMappingCase | null
  identityDataset: PublicIdentityDatasetSummary | null
  message: string
}

export interface RegisterActorAuthByInvitePayload {
  displayName?: string
  email?: string
  phone?: string
  password: string
}

export interface ActorInviteAuthUser {
  id: string
  name: string | null
  email: string | null
  role: 'atriz'
  credits?: number
}

export interface RegisterActorAuthByInviteResponse {
  token: string | null
  requiresLogin: boolean
  authUserCreated: boolean
  reusedExistingAuthUser: boolean
  user: ActorInviteAuthUser
  actor: PublicActorSummary
  invite: PublicInviteSummary
  message: string
}

export interface AcceptActorInvitePayload {
  displayName?: string
  legalName?: string
  email?: string
  phone?: string
  metadata?: Record<string, unknown>
}

export interface PublicMappingCaseResponse {
  item: PublicMappingCase
  message: string
}

export interface PublicMappingAssetResponse {
  item: PublicMappingAsset
  message: string
}

export interface UploadPublicMappingAssetPayload {
  mappingRequirementId: string
  replacementAssetId?: string
  base64: string
  contentType: string
  originalFilename: string
  byteSize: number
  dryRunOnly?: boolean
  metadata?: Record<string, unknown>
}

export async function getActorOnboardingPortal(inviteToken: string): Promise<ActorOnboardingPortal> {
  const { data } = await api.get<ApiEnvelope<ActorOnboardingPortal>>(`/api/actors/onboarding/invites/${inviteToken}`)
  return data.data
}


export async function registerActorAuthByInvite(inviteToken: string, payload: RegisterActorAuthByInvitePayload): Promise<RegisterActorAuthByInviteResponse> {
  const { data } = await api.post<ApiEnvelope<RegisterActorAuthByInviteResponse>>(`/api/actors/onboarding/invites/${inviteToken}/register-auth`, payload)
  return data.data
}

export async function acceptActorInvite(inviteToken: string, payload: AcceptActorInvitePayload): Promise<ActorOnboardingPortal> {
  await api.post(`/api/actors/onboarding/invites/${inviteToken}/accept`, payload)
  return getActorOnboardingPortal(inviteToken)
}

export async function createPublicMappingCase(inviteToken: string): Promise<PublicMappingCaseResponse> {
  const { data } = await api.post<ApiEnvelope<PublicMappingCaseResponse>>(`/api/actors/onboarding/invites/${inviteToken}/mapping-cases`, {
    caseType: 'avatar_mapping',
    notes: 'Mapeamento aberto pelo portal da pessoa participante.',
    metadata: { source: 'public_actor_onboarding_page' },
  })

  return data.data
}

export async function submitPublicMappingForReview(inviteToken: string): Promise<PublicMappingCaseResponse> {
  const { data } = await api.post<ApiEnvelope<PublicMappingCaseResponse>>(`/api/actors/onboarding/invites/${inviteToken}/mapping-cases`, {
    caseType: 'avatar_mapping',
    notes: 'Mapeamento enviado pela pessoa participante para análise do Admin.',
    submitForReview: true,
    metadata: { source: 'public_actor_onboarding_submit_review' },
  })

  return data.data
}

export async function uploadPublicMappingAsset(inviteToken: string, payload: UploadPublicMappingAssetPayload): Promise<PublicMappingAssetResponse> {
  const { data } = await api.post<ApiEnvelope<PublicMappingAssetResponse>>(`/api/actors/onboarding/invites/${inviteToken}/mapping-assets`, payload)
  return data.data
}
