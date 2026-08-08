import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveFactoryAsset,
  createFactoryAssetPreview,
  getFactoryAssets,
  getAdminImageCycle,
  getFactoryBatches,
  getFactoryBatchItems,
  getFactoryDeliveries,
  getFactoryPublishableProducts,
  getCommercialPricingAudit,
  getFactorySummary,
  rejectFactoryAsset,
  updateFactoryProductPublication,
  updateFactoryAssetCommercialPrice,
  updateFactoryCombinationCommercialPrice,
  updateFactoryBatchCommercialPrice,
  updateActorPayoutRule,
  preflightSingleRealProduction,
  startSingleRealProduction,
  previewFactoryBatchControlledAction,
  prepareFactoryBatchControlledAction,
} from '@/features/adm/api/factoryAdminApi'

export function useFactorySummary() {
  return useQuery({
    queryKey: ['admin-factory-summary'],
    queryFn: getFactorySummary,
  })
}

export function useFactoryAssets(status: string, mediaType?: string) {
  return useQuery({
    queryKey: ['admin-factory-assets', status, mediaType || 'all-media'],
    queryFn: () => getFactoryAssets({
      status: status === 'all' ? undefined : status,
      mediaType: mediaType === 'all' ? undefined : mediaType,
      limit: 80,
    }),
  })
}

export function useFactoryAssetsByCombination(combinationId?: string | null) {
  return useQuery({
    queryKey: ['admin-factory-assets-by-combination', combinationId || 'none'],
    queryFn: () => getFactoryAssets({
      combinationId: combinationId || undefined,
      limit: 100,
    }),
    enabled: Boolean(combinationId),
  })
}


// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_START
export function useAdminImageCycle(status = 'all') {
  return useQuery({
    queryKey: ['admin-image-cycle', status || 'all'],
    queryFn: () => getAdminImageCycle({
      status: status === 'all' ? undefined : status,
      limit: 24,
    }),
  })
}
// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_END

export function useFactoryBatches() {
  return useQuery({
    queryKey: ['admin-factory-batches'],
    queryFn: () => getFactoryBatches({ limit: 30 }),
  })
}

export function useFactoryBatchItems(batchId?: string | null) {
  return useQuery({
    queryKey: ['admin-factory-batch-items', batchId || 'none'],
    queryFn: () => getFactoryBatchItems(batchId || '', { limit: 200 }),
    enabled: Boolean(batchId),
  })
}

export function useFactoryDeliveries() {
  return useQuery({
    queryKey: ['admin-factory-deliveries'],
    queryFn: () => getFactoryDeliveries({ limit: 30 }),
  })
}

export function useFactoryDeliveriesByCombination(combinationId?: string | null) {
  return useQuery({
    queryKey: ['admin-factory-deliveries-by-combination', combinationId || 'none'],
    queryFn: () => getFactoryDeliveries({
      combinationId: combinationId || undefined,
      limit: 100,
    }),
    enabled: Boolean(combinationId),
  })
}


export function useFactoryPublishableProducts(companionId?: string | null, mediaType?: string, publicationStatus = 'all') {
  return useQuery({
    queryKey: ['admin-factory-publishable-products', companionId || 'all-companions', mediaType || 'all-media', publicationStatus],
    queryFn: () => getFactoryPublishableProducts({
      companionId: companionId || undefined,
      mediaType: mediaType === 'all' ? undefined : mediaType,
      publicationStatus,
      status: 'available',
      limit: 100,
    }),
    enabled: companionId !== null,
  })
}


export function useCommercialPricingAudit(companionId?: string | null, mediaType?: string) {
  return useQuery({
    queryKey: ['admin-commercial-pricing-audit', companionId || 'all-companions', mediaType || 'all-media'],
    queryFn: () => getCommercialPricingAudit({
      companionId: companionId || undefined,
      mediaType: mediaType === 'all' ? undefined : mediaType,
      status: 'all',
      limit: 120,
    }),
    enabled: companionId !== null,
  })
}

function invalidateCommercialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-factory-publishable-products'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-commercial-pricing-audit'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
  ])
}


export function useUpdateActorPayoutRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ actorId, payoutPercent, mediaTypeSplits, note }: { actorId: string; payoutPercent?: number; mediaTypeSplits?: Record<string, { payoutPercent: number; payoutRateBps: number }>; note?: string }) => updateActorPayoutRule(actorId, { payoutPercent, mediaTypeSplits, note }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
      ])
    },
  })
}

export function useUpdateAssetCommercialPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, priceCredits, note }: { assetId: string; priceCredits: number; note?: string }) => updateFactoryAssetCommercialPrice(assetId, { priceCredits, note }),
    onSuccess: async () => invalidateCommercialQueries(queryClient),
  })
}

export function useUpdateCombinationCommercialPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ combinationId, priceCredits, note }: { combinationId: string; priceCredits: number; note?: string }) => updateFactoryCombinationCommercialPrice(combinationId, { priceCredits, note }),
    onSuccess: async () => invalidateCommercialQueries(queryClient),
  })
}

export function useUpdateBatchCommercialPrice() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ batchId, priceCredits, note }: { batchId: string; priceCredits: number; note?: string }) => updateFactoryBatchCommercialPrice(batchId, { priceCredits, note }),
    onSuccess: async () => invalidateCommercialQueries(queryClient),
  })
}

export function useUpdateFactoryProductPublication() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, publish, priceCredits }: { assetId: string; publish: boolean; priceCredits?: number }) => updateFactoryProductPublication(assetId, { publish, priceCredits }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-publishable-products'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-creation-client-models'] }),
      ])
    },
  })
}

export function useApproveFactoryAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, notes }: { assetId: string; notes?: string }) => approveFactoryAsset(assetId, notes),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
      ])
    },
  })
}

export function useRejectFactoryAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, reason }: { assetId: string; reason: string }) => rejectFactoryAsset(assetId, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
      ])
    },
  })
}

export function useCreateFactoryAssetPreview() {
  return useMutation({
    mutationFn: createFactoryAssetPreview,
  })
}


export function usePreflightSingleRealProduction() {
  return useMutation({
    mutationFn: preflightSingleRealProduction,
  })
}

export function useStartSingleRealProduction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: startSingleRealProduction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
      ])
    },
  })
}


export function usePreviewFactoryBatchControlledAction() {
  return useMutation({
    mutationFn: previewFactoryBatchControlledAction,
  })
}

export function usePrepareFactoryBatchControlledAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: prepareFactoryBatchControlledAction,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
      ])
    },
  })
}
