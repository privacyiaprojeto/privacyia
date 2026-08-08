export type FactoryAssetStatus = 'qa_pending' | 'available' | 'sold' | 'rejected' | string
export type FactoryBatchStatus = 'queued' | 'running' | 'qa_pending' | 'completed' | 'failed' | 'cancelled' | string

export interface ApiEnvelope<T> {
  success: boolean
  data: T
}

export interface FactorySummary {
  assets: {
    total: number
    qaPending: number
    available: number
    sold: number
    rejected: number
    unpricedAvailable: number
  }
  batches: {
    total: number
    running: number
    completed: number
  }
  deliveries: {
    total: number
  }
  health: {
    hasQaBacklog: boolean
    hasAvailableStock: boolean
    hasUnpricedAvailableStock: boolean
  }
}

export interface FactoryPagination {
  limit: number
  offset: number
  returned: number
  hasMore: boolean
}

export interface FactoryAssetMediaPreview {
  url: string | null
  thumbnailUrl: string | null
  previewUrl: string | null
  sourceKey?: string | null
  expiresAt?: string | null
  error?: string | null
}

export interface FactoryAsset {
  id: string
  status: FactoryAssetStatus
  mediaType: string
  variantNumber: number
  r2Bucket: string | null
  r2Key: string | null
  thumbnailR2Key: string | null
  previewR2Key: string | null
  qualityScore: number | null
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  cleanupAfter: string | null
  rejectionReason: string | null
  mediaPreview?: FactoryAssetMediaPreview | null
  assignments: {
    current: number
    max: number
    remaining: number
    stockAvailable: boolean
    soldOut: boolean
  }
  price: {
    credits: number
    isConfigured: boolean
    purchaseReady: boolean
  }
  batch: {
    id: string | null
    itemId: string | null
  }
  companion: {
    id: string
    name?: string | null
    slug?: string | null
    avatarUrl?: string | null
    thumbnailUrl?: string | null
  }
  combination: {
    id: string
    key?: string | null
    title?: string | null
    mediaType?: string | null
    priceCredits?: number
    visibleToClient?: boolean
    adminOnly?: boolean
    isActive?: boolean
    guidedSelections?: Array<{
      titleId?: string
      titleName?: string
      itemId?: string
      itemName?: string
      technicalSnippet?: string
      negativePrompt?: string
    }> | Record<string, unknown>
  }
}

export interface FactoryAssetsResponse {
  items: FactoryAsset[]
  pagination: FactoryPagination
}

export interface FactoryBatch {
  id: string
  companionId: string | null
  triggeredByProfileId: string | null
  batchType: string | null
  status: FactoryBatchStatus
  title: string | null
  requestedCount: number
  requestedVariants?: number
  totalPlannedVariants?: number
  safePlanningOnly?: boolean
  queueJobsCreated?: number
  generatedCount: number
  approvedCount: number
  rejectedCount: number
  estimatedCostUsd: number | null
  actualCostUsd: number | null
  engine: string | null
  modelVersion: string | null
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
  metadata: Record<string, unknown>
}

export interface FactoryBatchesResponse {
  items: FactoryBatch[]
  pagination: FactoryPagination
}

export interface FactoryBatchItemProductionAuthorization {
  id: string | null
  companionId?: string | null
  actorProfileId?: string | null
  status?: string | null
  authorized: boolean
  contentType?: string | null
  contentTypeAllowed?: boolean
  startsAt?: string | null
  endsAt?: string | null
  revokedAt?: string | null
  checkedAt?: string | null
  label?: string | null
  helper?: string | null
}

export interface FactoryBatchItem {
  id: string
  batchId: string
  combinationId: string | null
  status: string
  requestedVariants: number
  generatedVariants: number
  approvedVariants: number
  rejectedVariants: number
  createdAt: string | null
  updatedAt: string | null
  metadata: Record<string, unknown>
  productionAuthorization?: FactoryBatchItemProductionAuthorization | null
}

export interface FactoryBatchItemsResponse {
  items: FactoryBatchItem[]
  pagination: FactoryPagination
}

export interface FactoryDelivery {
  id: string
  profileId: string
  createdAt: string | null
  deliverySource: string | null
  idempotencyKey: string | null
  protectedViewUrl: string
  pricing: {
    totalPriceCredits: number
    companionCreditsUsed: number
    universalCreditsUsed: number
    companionCreditLedgerId: string | null
    universalCreditLedgerId: string | null
  }
  profile: {
    id: string
    email?: string | null
    name?: string | null
    role?: string | null
  }
  asset: {
    id: string
    status?: string
    mediaType?: string
    variantNumber?: number
  }
  companion: {
    id: string
    name?: string | null
    slug?: string | null
  }
  combination: {
    id: string
    key?: string | null
    title?: string | null
    mediaType?: string | null
    priceCredits?: number
    visibleToClient?: boolean
    adminOnly?: boolean
    isActive?: boolean
    guidedSelections?: Array<{
      titleId?: string
      titleName?: string
      itemId?: string
      itemName?: string
      technicalSnippet?: string
      negativePrompt?: string
    }> | Record<string, unknown>
  }
}

export interface FactoryDeliveriesResponse {
  items: FactoryDelivery[]
  pagination: FactoryPagination
}


export interface PublishableProductSignatureChip {
  titleId?: string | null
  titleName?: string | null
  itemId?: string | null
  itemName?: string | null
}

export interface FactoryPublishableProduct {
  id: string
  assetId: string
  status: string
  mediaType: string
  variantNumber?: number | null
  createdAt?: string | null
  publishedAt?: string | null
  updatedAt?: string | null
  readiness: {
    approved: boolean
    stockAvailable: boolean
    priceConfigured: boolean
    publishable: boolean
  }
  publication: {
    published: boolean
    status: 'published' | 'hidden' | string
    visibleToClient: boolean
    adminOnly: boolean
    isActive: boolean
    reason?: string | null
  }
  price: {
    credits: number
    isConfigured: boolean
    sellable?: boolean
    source?: string | null
    sourceLabel?: string | null
    note?: string | null
    configuredAt?: string | null
    configuredByProfileId?: string | null
  }
  commercialPrice?: CommercialPriceResolution | null
  assignments: {
    current: number
    max: number
    remaining: number
  }
  companion: {
    id: string
    name?: string | null
    slug?: string | null
    avatarUrl?: string | null
    thumbnailUrl?: string | null
  }
  combination: {
    id: string
    key?: string | null
    title?: string | null
    mediaType?: string | null
    guidedSelections?: Array<Record<string, unknown>>
  }
  signature: {
    companionId?: string | null
    companionName?: string | null
    mediaType?: string | null
    combinationId?: string | null
    combinationKey?: string | null
    assetId: string
    title?: string | null
    chips: PublishableProductSignatureChip[]
    path: string[]
  }
}

// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_START
export interface AdminImageCycleSummary {
  totalImages: number
  availableImages: number
  qaPendingImages: number
  soldImages: number
  rejectedImages: number
  unpricedAvailableImages: number
  deliveredImageRows: number
}

export interface AdminImageCycleCard {
  id: string
  label: string
  value: number
  tone: string
  helper: string
}

export interface AdminImageCycleAsset {
  id: string
  status: string
  mediaType: string
  variantNumber?: number | null
  createdAt?: string | null
  publishedAt?: string | null
  companion?: FactoryAsset['companion'] | null
  combination?: {
    id: string
    key?: string | null
    title?: string | null
    mediaType?: string | null
    visibleToClient: boolean
    adminOnly: boolean
    isActive: boolean
  } | null
  price: FactoryAsset['price']
  assignments: FactoryAsset['assignments']
  storage: {
    privateStorageReady: boolean
    publicPointerPresent: boolean
    exposedStorageKey: boolean
  }
  state: {
    label: string
    actionLabel: string
    clientVisible: boolean
  }
}

export interface AdminImageCycleDelivery {
  id: string
  createdAt?: string | null
  deliverySource?: string | null
  protectedViewAvailable: boolean
  profile?: FactoryDelivery['profile'] | null
  companion?: FactoryDelivery['companion'] | null
  asset?: FactoryDelivery['asset'] | null
  combination?: Pick<FactoryDelivery['combination'], 'id' | 'title' | 'mediaType' | 'priceCredits'> | null
  pricing: FactoryDelivery['pricing']
}

export interface AdminImageCycleResponse {
  readOnly: true
  safety: Record<string, boolean>
  filters: {
    status: string
    mediaType: string
    limit: number
    offset: number
  }
  summary: AdminImageCycleSummary
  operationalCards: AdminImageCycleCard[]
  assets: AdminImageCycleAsset[]
  deliveries: AdminImageCycleDelivery[]
  pagination: FactoryPagination
  operationalGuards: Record<string, boolean>
  nextActions: string[]
}
// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_END


export interface FactoryPublishableProductsResponse {
  items: FactoryPublishableProduct[]
  summary: {
    total: number
    published: number
    hidden: number
    approved: number
    missingPrice: number
  }
  pagination: FactoryPagination
}


export interface CommercialPriceResolution {
  assetId?: string | null
  companion?: {
    id?: string | null
    name?: string | null
    slug?: string | null
  } | null
  combination?: {
    id?: string | null
    key?: string | null
    title?: string | null
    mediaType?: string | null
  } | null
  batch?: {
    id?: string | null
    title?: string | null
  } | null
  price: {
    credits: number
    isConfigured: boolean
    sellable: boolean
    source: string
    sourceLabel: string
    note?: string | null
    configuredAt?: string | null
    configuredByProfileId?: string | null
  }
}

export interface CommercialPricingAuditResponse {
  items: CommercialPriceResolution[]
  summary: {
    total: number
    configured: number
    missingPrice: number
    bySource: Record<string, number>
  }
  pagination: FactoryPagination
}

export interface PriceUpdatePayload {
  priceCredits: number
  note?: string
  isActive?: boolean
}

export interface SecurePreviewResponse {
  ok: boolean
  asset: {
    id: string
    status: string
    mediaType: string
    r2Bucket: string
    r2Key: string
  }
  access: {
    type: string
    url: string
    expiresIn: number
    expiresAt: string
  }
  protection: {
    ttlSeconds: number
    expiresAt: string
    cacheControl: string
    contentSecurityPolicy: string
    notes: string[]
  }
}

export interface RealProductionReason {
  code: string | null
  message: string | null
  severity: string
  details?: Record<string, unknown> | null
}

export interface RealProductionSelectionPreview {
  companionId: string | null
  contentType: string
  contentTypeLabel: string
  total: number
  limited: boolean
  groups: Array<{
    title: { id: string; name: string }
    items: Array<{ id: string; name: string }>
  }>
  preview: Array<{
    index: number
    label: string
    selections?: Array<{
      titleId?: string | null
      titleName?: string | null
      itemId?: string | null
      itemName?: string | null
    }>
  }>
}

export interface RealProductionComplianceSummary {
  status: string
  productionAllowed: boolean
  summary: string | null
  avatar?: Record<string, unknown> | null
  actor?: Record<string, unknown> | null
  authorization?: Record<string, unknown> | null
  mapping?: {
    id?: string | null
    status?: string | null
    checklist?: {
      isComplete: boolean
      missingRequired: unknown[]
    } | null
  } | null
  reasons: RealProductionReason[]
  checks: Record<string, unknown>
}

export interface RealProductionSafetyFlags {
  requestedRealProduction: boolean
  confirmationRequired: boolean
  confirmationOk: boolean
  envAllowed: boolean
  runPodWillBeCalledByThisRequest: boolean
  runPodMayBeCalledByWorkerAfterQueue: boolean
  r2UploadMayHappenByWorkerAfterQueue: boolean
  destructiveDelete: boolean
  paymentExecuted: boolean
  walletChanged: boolean
  batchCreated?: boolean
  queued?: boolean
  runPodCalledByApiRequest?: boolean
  runPodWillRunOnlyInWorker?: boolean
}

export interface RealProductionPreflightResponse {
  mode: string
  canStart: boolean
  reasons: RealProductionReason[]
  requiredConfirmationPhrase: string | null
  preview: RealProductionSelectionPreview
  compliance: RealProductionComplianceSummary | null
  safety: RealProductionSafetyFlags
}

export interface RealProductionStartResponse {
  mode: string
  realMode: boolean
  preflight: RealProductionPreflightResponse
  production: {
    batch: {
      id: string | null
      status: string | null
      companionId: string | null
      companionName: string | null
      contentType: string
      workerLabel: string | null
      totalItems: number
      realImageWorker: boolean
      productionAuthorizationId: string | null
      compliance: unknown
    } | null
    items: Array<{
      id: string | null
      status: string | null
      combinationId: string | null
      label: string | null
    }>
    queueJobs: Array<{
      id: string | null
      name: string | null
      batchItemId: string | null
    }>
    message: string | null
  }
  safety: RealProductionSafetyFlags
}

export interface RealProductionSingleItemPayload {
  companionId: string
  selections: Record<string, string[]>
  dryRunOnly: boolean
  generateRealMedia: boolean
  confirmPhrase?: string
}


export interface FactoryBatchControlledActionPayload {
  batchId: string
  batchItemId?: string | null
  companionId: string
  combinationId: string
  requestedQuantity: number
  confirmationPhrase?: string
  executeQueue?: boolean
}

export interface FactoryBatchControlledActionResponse {
  sprint?: string
  name?: string
  status: string
  queued: boolean
  canQueueRealJob?: boolean
  reason?: string | null
  requiredConfirmationPhrase?: string | null
  selected?: Record<string, unknown> | null
  readiness?: Record<string, unknown> | null
  hardEnvLocks?: Record<string, unknown> | null
  batch?: Record<string, unknown> | null
  batchItem?: Record<string, unknown> | null
  queueJob?: Record<string, unknown> | null
  safety?: {
    runPodCalledByThisService?: boolean
    r2RealUploadByThisService?: boolean
    destructiveDelete?: boolean
    paymentExecuted?: boolean
    walletChanged?: boolean
    publicClientUrlCreated?: boolean
    realQueueJobCreated?: boolean
    runPodMayBeCalledByWorkerAfterQueue?: boolean
  } | Record<string, unknown> | null
}
