import { api } from '@/shared/lib/axios'
import type {
  ApiEnvelope,
  FactoryAssetsResponse,
  AdminImageCycleResponse,
  FactoryBatchesResponse,
  FactoryBatchItemsResponse,
  FactoryDeliveriesResponse,
  FactoryPublishableProductsResponse,
  CommercialPriceResolution,
  CommercialPricingAuditResponse,
  PriceUpdatePayload,
  FactorySummary,
  SecurePreviewResponse,
  RealProductionPreflightResponse,
  RealProductionStartResponse,
  RealProductionSingleItemPayload,
  FactoryBatchControlledActionPayload,
  FactoryBatchControlledActionResponse,
} from '@/features/adm/types'

interface ListParams {
  status?: string
  mediaType?: string
  companionId?: string
  combinationId?: string
  profileId?: string
  limit?: number
  offset?: number
}


export interface ActorPayoutRuleMediaSplitPayload {
  payoutPercent?: number
  payoutRateBps?: number
  note?: string
  mediaTypeSplits?: Record<string, { payoutPercent: number; payoutRateBps: number }>
}

export interface ActorPayoutRuleResponse {
  actor: {
    id: string
    displayName?: string | null
    email?: string | null
    status?: string | null
    productionStatus?: string | null
    kycStatus?: string | null
  }
  payoutRule: {
    bps: number
    percent: number
    source: string
    configured: boolean
    note?: string | null
    updatedAt?: string | null
    updatedByProfileId?: string | null
    mediaTypePayouts?: Record<string, { payoutRateBps: number; payoutPercent: number }>
  }
}

export async function updateActorPayoutRule(actorId: string, payload: ActorPayoutRuleMediaSplitPayload): Promise<ActorPayoutRuleResponse> {
  const { data } = await api.patch<ApiEnvelope<ActorPayoutRuleResponse>>(`/api/admin/factory/financial/actors/${actorId}/payout-rule`, payload)
  return data.data
}

export async function getFactorySummary(): Promise<FactorySummary> {
  const { data } = await api.get<ApiEnvelope<FactorySummary>>('/api/admin/factory/summary')
  return data.data
}

export async function getFactoryAssets(params: ListParams = {}): Promise<FactoryAssetsResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryAssetsResponse>>('/api/admin/factory/assets', {
    params,
  })

  return data.data
}


// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_START
export async function getAdminImageCycle(params: ListParams = {}): Promise<AdminImageCycleResponse> {
  const { data } = await api.get<ApiEnvelope<AdminImageCycleResponse>>('/api/admin/factory/image-cycle', {
    params,
  })

  return data.data
}
// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_END

export async function getFactoryBatches(params: ListParams = {}): Promise<FactoryBatchesResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryBatchesResponse>>('/api/admin/factory/batches', {
    params,
  })

  return data.data
}

export async function getFactoryBatchItems(batchId: string, params: ListParams = {}): Promise<FactoryBatchItemsResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryBatchItemsResponse>>(`/api/admin/factory/batches/${batchId}/items`, {
    params,
  })

  return data.data
}

export async function getFactoryDeliveries(params: ListParams = {}): Promise<FactoryDeliveriesResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryDeliveriesResponse>>('/api/admin/factory/deliveries', {
    params,
  })

  return data.data
}


export async function getFactoryPublishableProducts(params: ListParams & { companionId?: string; publicationStatus?: string } = {}): Promise<FactoryPublishableProductsResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryPublishableProductsResponse>>('/api/admin/factory/publishable-products', {
    params,
  })

  return data.data
}

export async function updateFactoryProductPublication(assetId: string, payload: { publish: boolean; priceCredits?: number }): Promise<unknown> {
  const { data } = await api.patch<ApiEnvelope<unknown>>(`/api/admin/factory/publishable-products/${assetId}/publication`, payload)
  return data.data
}


export async function getCommercialPricingAudit(params: ListParams & { companionId?: string } = {}): Promise<CommercialPricingAuditResponse> {
  const { data } = await api.get<ApiEnvelope<CommercialPricingAuditResponse>>('/api/admin/factory/commercial-pricing/audit', {
    params,
  })

  return data.data
}

export async function getFactoryAssetCommercialPrice(assetId: string): Promise<CommercialPriceResolution> {
  const { data } = await api.get<ApiEnvelope<CommercialPriceResolution>>(`/api/admin/factory/assets/${assetId}/commercial-price`)
  return data.data
}

export async function updateFactoryAssetCommercialPrice(assetId: string, payload: PriceUpdatePayload): Promise<CommercialPriceResolution> {
  const { data } = await api.patch<ApiEnvelope<CommercialPriceResolution>>(`/api/admin/factory/assets/${assetId}/commercial-price`, payload)
  return data.data
}

export async function updateFactoryCombinationCommercialPrice(combinationId: string, payload: PriceUpdatePayload): Promise<CommercialPriceResolution> {
  const { data } = await api.patch<ApiEnvelope<CommercialPriceResolution>>(`/api/admin/factory/combinations/${combinationId}/commercial-price`, payload)
  return data.data
}

export async function updateFactoryBatchCommercialPrice(batchId: string, payload: PriceUpdatePayload): Promise<unknown> {
  const { data } = await api.patch<ApiEnvelope<unknown>>(`/api/admin/factory/batches/${batchId}/commercial-price`, payload)
  return data.data
}

export async function approveFactoryAsset(assetId: string, notes?: string): Promise<unknown> {
  const { data } = await api.post<ApiEnvelope<unknown>>(`/api/admin/factory/qa/${assetId}/approve`, {
    notes,
  })

  return data.data
}

export async function rejectFactoryAsset(assetId: string, reason: string): Promise<unknown> {
  const { data } = await api.post<ApiEnvelope<unknown>>(`/api/admin/factory/qa/${assetId}/reject`, {
    reason,
  })

  return data.data
}

export async function createFactoryAssetPreview(assetId: string): Promise<SecurePreviewResponse> {
  const { data } = await api.post<ApiEnvelope<SecurePreviewResponse>>(
    `/api/admin/media/assets/${assetId}/secure-preview`,
    { expiresIn: 120 },
  )

  return data.data
}


export async function preflightSingleRealProduction(payload: RealProductionSingleItemPayload): Promise<RealProductionPreflightResponse> {
  const { data } = await api.post<ApiEnvelope<RealProductionPreflightResponse>>('/api/admin/factory/real-production/single-item/preflight', payload)
  return data.data
}

export async function startSingleRealProduction(payload: RealProductionSingleItemPayload): Promise<RealProductionStartResponse> {
  const { data } = await api.post<ApiEnvelope<RealProductionStartResponse>>('/api/admin/factory/real-production/single-item', payload)
  return data.data
}


export async function previewFactoryBatchControlledAction(payload: FactoryBatchControlledActionPayload): Promise<FactoryBatchControlledActionResponse> {
  const { data } = await api.post<FactoryBatchControlledActionResponse>('/api/admin/factory/real-production/execution/preview', {
    companionId: payload.companionId,
    combinationId: payload.combinationId,
    batchId: payload.batchId,
    batchItemId: payload.batchItemId || null,
    requestedQuantity: payload.requestedQuantity,
    quantity: payload.requestedQuantity,
    confirmationPhrase: payload.confirmationPhrase || '',
  })
  return data
}

export async function prepareFactoryBatchControlledAction(payload: FactoryBatchControlledActionPayload): Promise<FactoryBatchControlledActionResponse> {
  const { data } = await api.post<FactoryBatchControlledActionResponse>('/api/admin/factory/real-production/execution/start', {
    companionId: payload.companionId,
    combinationId: payload.combinationId,
    batchId: payload.batchId,
    batchItemId: payload.batchItemId || null,
    requestedQuantity: payload.requestedQuantity,
    quantity: payload.requestedQuantity,
    confirmationPhrase: payload.confirmationPhrase || '',
    executeQueue: payload.executeQueue === true,
  })
  return data
}
