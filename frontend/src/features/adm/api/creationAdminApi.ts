import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export interface CreationItemDto {
  id: string
  titleId?: string | null
  name: string
  description?: string
  contentTypes: string[]
  visibleToClient: boolean
  adminOnly: boolean
  isActive: boolean
  technicalSnippet?: string
  negativePrompt?: string
  sortOrder?: number
  metadata?: Record<string, unknown>
}

export interface CreationTitleDto {
  id: string
  name: string
  description: string
  contentTypes: string[]
  contentTypeLabels?: string[]
  visibleToClient: boolean
  adminOnly: boolean
  isActive: boolean
  sortOrder?: number
  metadata?: Record<string, unknown>
  items: CreationItemDto[]
}

export interface CreationTitlesResponse {
  contentTypes: Array<{ value: string; label: string }>
  items: CreationTitleDto[]
}

export interface CreationAvatarDto {
  id: string
  name: string
  slug?: string | null
  avatarUrl?: string | null
  thumbnailUrl?: string | null
  isActive?: boolean
}

export interface CreationAvatarsResponse {
  items: CreationAvatarDto[]
}

export interface PreviewCombinationsPayload {
  companionId: string
  contentType: string
  selections: Record<string, string[]>
}

export interface PreviewCombinationsResponse {
  companionId: string
  contentType: string
  contentTypeLabel: string
  total: number
  preview: Array<{ index: number; label: string; selections: Array<Record<string, string>> }>
  limited: boolean
}



export interface ClientModelVisibilityPayload {
  visibleToClient: boolean
  priceCredits?: number
  isActive?: boolean
}
export interface GuidedProductionBatchResponse {
  batch: {
    id: string
    status: string
    companionId: string
    companionName: string
    contentType: string
    contentTypeLabel: string
    workerLabel: string
    totalItems: number
    requestedVariants?: number
    realImageWorker: boolean
    queueJobsCreated?: number
    safePlanningOnly?: boolean
    productionAuthorizationId?: string | null
    compliance?: {
      status?: string
      productionAllowed?: boolean
      summary?: string | null
      reasons?: Array<{ code?: string; message?: string; severity?: string }>
      checks?: Record<string, unknown>
    } | null
  }
  items: Array<{ id: string; status: string; combinationId: string; label: string }>
  queueJobs: Array<{ id: string | null; name: string | null; batchItemId: string }>
  safety?: Record<string, unknown>
  operation?: {
    status?: string
    confirmationRequiredForQueue?: string
    generatedMediaNow?: boolean
    publishNow?: boolean
    chargeNow?: boolean
  }
  message: string
}

export async function getCreationTitles(): Promise<CreationTitlesResponse> {
  const { data } = await api.get<ApiEnvelope<CreationTitlesResponse>>('/api/admin/creation/titles')
  return data.data
}

export async function createCreationTitle(payload: {
  name: string
  description?: string
  contentTypes: string[]
  visibleToClient?: boolean
  adminOnly?: boolean
}): Promise<CreationTitleDto> {
  const { data } = await api.post<ApiEnvelope<CreationTitleDto>>('/api/admin/creation/titles', payload)
  return data.data
}

export async function createCreationItems(titleId: string, items: Array<{ name: string; description?: string }>): Promise<{ items: CreationItemDto[] }> {
  const { data } = await api.post<ApiEnvelope<{ items: CreationItemDto[] }>>(`/api/admin/creation/titles/${titleId}/items`, { items })
  return data.data
}

export async function getCreationAvatars(): Promise<CreationAvatarsResponse> {
  const { data } = await api.get<ApiEnvelope<CreationAvatarsResponse>>('/api/admin/creation/avatars')
  return data.data
}

export async function previewCreationCombinations(payload: PreviewCombinationsPayload): Promise<PreviewCombinationsResponse> {
  const { data } = await api.post<ApiEnvelope<PreviewCombinationsResponse>>('/api/admin/creation/combinations/preview', payload)
  return data.data
}

export async function createGuidedCombinationDraft(payload: PreviewCombinationsPayload): Promise<unknown> {
  const { data } = await api.post<ApiEnvelope<unknown>>('/api/admin/creation/combinations', payload)
  return data.data
}

export type GuidedProductionBatchPayload = PreviewCombinationsPayload & {
  requestedVariants?: number
  generateRealMedia?: boolean
  dryRunOnly?: boolean
  enqueueJobs?: boolean
  confirmationPhrase?: string
}

export type SafeGuidedProductionBatchPayload = PreviewCombinationsPayload & {
  requestedVariants?: number
}

export async function createGuidedProductionBatch(payload: GuidedProductionBatchPayload): Promise<GuidedProductionBatchResponse> {
  const { data } = await api.post<ApiEnvelope<GuidedProductionBatchResponse>>('/api/admin/creation/production-batches', payload)
  return data.data
}

export async function createSafeGuidedProductionBatch(payload: SafeGuidedProductionBatchPayload): Promise<GuidedProductionBatchResponse> {
  return createGuidedProductionBatch({
    ...payload,
    generateRealMedia: false,
    dryRunOnly: true,
    enqueueJobs: false,
    confirmationPhrase: '',
  })
}


export async function updateClientModelVisibility(combinationId: string, payload: ClientModelVisibilityPayload): Promise<unknown> {
  const { data } = await api.patch<ApiEnvelope<unknown>>(`/api/admin/creation/client-models/${combinationId}/visibility`, payload)
  return data.data
}
