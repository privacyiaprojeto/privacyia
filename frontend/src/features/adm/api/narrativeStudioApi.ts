import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export type NarrativeContentType = 'live_audio' | 'live_action'
export type NarrativePublishDestination = 'chat_side_store' | 'avatar_feed' | 'both' | 'admin_only'

export interface NarrativeStudioPayload {
  companionId: string
  contentType: NarrativeContentType
  publicTitle: string
  publicDescription?: string
  event?: string
  mood?: string
  location?: string
  narrativeIntent?: string
  manualPrompt?: string
  voiceStyle?: string
  visualStyle?: string
  durationSeconds: number
  priceCredits: number
  publishDestination: NarrativePublishDestination
  isFreePreview?: boolean
  isExclusiveForSale?: boolean
  qaRequired?: boolean
  safeModeOnly?: boolean
  dryRunOnly?: boolean
}

export interface NarrativeStudioSpec {
  sprint: string
  status: string
  name: string
  purpose: string
  contentTypes: Array<{ value: NarrativeContentType; label: string; description: string; clientCard: string }>
  adminFields: string[]
  rules: Record<string, boolean>
  safety: Record<string, boolean>
}

export interface NarrativeProductPreview {
  sprint: string
  status: string
  dryRun: boolean
  companion: { id: string; name?: string | null; slug?: string | null; lookupWarning?: string | null }
  product: {
    contentType: NarrativeContentType
    contentTypeLabel: string
    publicTitle: string
    publicDescription: string
    durationSeconds: number
    priceCredits: number
    publishDestination: NarrativePublishDestination
    isFreePreview: boolean
    isExclusiveForSale: boolean
    qaRequired: boolean
    clientCard: {
      title: string
      description: string
      durationSeconds: number
      priceCredits: number
      placement: NarrativePublishDestination
      lockedBeforePurchase: boolean
      mediaVisibleBeforePurchase: boolean
      showGenerateButtonBeforePurchase: boolean
      ctaLabel: string
      friendlyProcessingMessage: string
    }
  }
  narrative: {
    event: string
    mood: string
    location: string
    narrativeIntent: string
    manualPromptPresent: boolean
    voiceStyle: string
    visualStyle: string
    internalPromptPreview: string
    internalPromptVisibleToClient: boolean
  }
  nextSteps: string[]
  safety: Record<string, boolean>
}


export interface NarrativeDraftItem {
  id: string
  title: string
  publicTitle: string
  publicDescription: string
  contentType: NarrativeContentType
  contentTypeLabel: string
  companionId: string | null
  actressId: string | null
  status: string
  publicationStatus: string
  priceCredits: number
  durationSeconds: number
  publishDestination: NarrativePublishDestination
  visibleToClient: boolean
  adminOnly: boolean
  isActive: boolean
  actorVisible: boolean
  clientCardVisible: boolean
  clientMediaVisibleBeforePurchase: boolean
  internalPromptVisibleToClient: boolean
  createdAt: string | null
  updatedAt: string | null
}

export interface NarrativeDraftsResponse {
  sprint: string
  status: string
  generatedAt: string
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  items: NarrativeDraftItem[]
  warnings: string[]
  safety: Record<string, boolean>
}

export interface NarrativeDraftResult {
  sprint: string
  status: string
  dryRun: boolean
  requestedApply?: boolean
  blockers?: string[]
  preview?: NarrativeProductPreview
  draft?: {
    id: string | null
    title: string
    contentType: NarrativeContentType
    acceptedMediaType: string | null
    priceCredits: number
    visibleToClient: boolean
    adminOnly: boolean
    status: string
    removedColumns: string[]
  }
  audit?: { ok: boolean; removedColumns?: string[]; error?: string | null; code?: string | null }
  safety: Record<string, boolean>
}

export async function getNarrativeStudioSpec(): Promise<NarrativeStudioSpec> {
  const { data } = await api.get<ApiEnvelope<NarrativeStudioSpec>>('/api/admin/narrative-studio/spec')
  return data.data
}

export async function previewNarrativeProduct(payload: NarrativeStudioPayload): Promise<NarrativeProductPreview> {
  const { data } = await api.post<ApiEnvelope<NarrativeProductPreview>>('/api/admin/narrative-studio/preview', payload)
  return data.data
}

export async function createNarrativeDraft(payload: NarrativeStudioPayload): Promise<NarrativeDraftResult> {
  const { data } = await api.post<ApiEnvelope<NarrativeDraftResult>>('/api/admin/narrative-studio/drafts', payload)
  return data.data
}

export async function listNarrativeDrafts(params?: { limit?: number; companionId?: string; contentType?: NarrativeContentType; status?: string }): Promise<NarrativeDraftsResponse> {
  const { data } = await api.get<ApiEnvelope<NarrativeDraftsResponse>>('/api/admin/narrative-studio/drafts', { params })
  return data.data
}


export interface NarrativeProductionPreview {
  sprint: string
  status: string
  canRequestProduction?: boolean
  draft?: unknown
  productionPackage?: unknown
  blockers?: string[]
  warnings?: string[]
  safety?: unknown
}

export interface NarrativeProductionRequestPayload {
  draftId: string
  confirmationPhrase?: string
  adminProfileId?: string
  dryRunOnly?: boolean
}

export async function getNarrativeProductionConfig() {
  const { data } = await api.get('/api/admin/narrative-studio/production/config')
  return data?.data ?? data
}

export async function inspectNarrativeProduction(draftId?: string) {
  const { data } = await api.get('/api/admin/narrative-studio/production/inspect', { params: { draftId } })
  return data?.data ?? data
}

export async function previewNarrativeProduction(draftId: string): Promise<NarrativeProductionPreview> {
  const { data } = await api.post('/api/admin/narrative-studio/production/preview', { draftId })
  return data?.data ?? data
}

export async function requestNarrativeProduction(payload: NarrativeProductionRequestPayload) {
  const { data } = await api.post('/api/admin/narrative-studio/production/request', payload)
  return data?.data ?? data
}
