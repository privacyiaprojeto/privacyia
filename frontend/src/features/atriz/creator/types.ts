export type CreatorMediaType = 'image' | 'audio' | 'video' | 'liveAction' | string
export type CreatorMaterialType = string
export type CreatorKycAssetType = string

export interface CreatorActor {
  id: string
  profileId: string | null
  displayName: string
  status: string
  kycStatus: string
  productionStatus: string
  updatedAt: string | null
}

export interface CreatorMappingCase {
  id: string
  status: string
  caseType: string
  submittedAt: string | null
  reviewedAt: string | null
  rejectionReason: string | null
  updatedAt: string | null
}

export interface CreatorMappingAsset {
  id: string
  caseId: string | null
  mappingRequirementId: string | null
  assetType: CreatorMaterialType | string | null
  status: string
  rejectionReason: string | null
  reviewedAt: string | null
  originalFilename: string | null
  contentType: string | null
  byteSize: number
  createdAt: string | null
  updatedAt: string | null
}

export interface CreatorPendency {
  code: string
  title: string
  description: string
  severity: 'warning' | 'critical' | string
  target: string | null
}

export interface CreatorSale {
  id: string
  createdAt: string | null
  productTitle: string
  mediaType: CreatorMediaType
  grossCredits: number
  payoutPercent: number
  netPayoutCredits: number
  splitConfigured: boolean
}

export interface CreatorOverviewResponse {
  actor: CreatorActor
  overview: {
    receivableCredits: number
    grossSalesCredits: number
    totalSales: number
    activeProducts: number
    activeAuthorizations: number
    pendingSecurityItems: number
  }
  security: {
    kycStatus: string
    mappingCase: CreatorMappingCase | null
    materialCounts: {
      identityDocuments: number
      facePhotos: number
      voiceAudios: number
    }
    pendencies: CreatorPendency[]
  }
  recentSales: CreatorSale[]
  safety: {
    actorScoped: boolean
    runPodActionsAvailable: boolean
    productionActionsAvailable: boolean
    otherActorDataVisible: boolean
    payoutIsEstimate: boolean
  }
}

export interface CreatorProduct {
  id: string
  title: string
  mediaType: CreatorMediaType
  status: string
  priceCredits: number
  approvedVariants: number
  totalVariants: number
  totalDeliveries: number
  clientVisible: boolean
  updatedAt: string | null
}

export interface CreatorProductsResponse {
  actor: CreatorActor
  summary: {
    activeProducts: number
    totalDeliveries: number
    totalApprovedVariants: number
  }
  products: CreatorProduct[]
  safety: {
    readOnly: boolean
    canEditPrice: boolean
    canPublish: boolean
    canGenerateMedia: boolean
    storagePointersExposed: boolean
  }
}

export interface CreatorSplitRule {
  mediaType: CreatorMediaType
  payoutRateBps: number
  payoutPercent: number
  configured: boolean
}

export interface CreatorPayoutMethod {
  configured: boolean
  status: string
  type: string | null
  pixKeyMasked: string | null
  bankName: string | null
  accountLast4: string | null
  reviewedAt: string | null
}

export interface CreatorFinanceResponse {
  actor: CreatorActor
  summary: {
    totalSales: number
    grossCredits: number
    netPayoutCredits: number
    platformCredits: number
    averageTicketCredits: number
    payoutLedgerAvailable: boolean
    estimated: boolean
  }
  splitRules: CreatorSplitRule[]
  recentSales: CreatorSale[]
  payoutMethod: CreatorPayoutMethod
  guidance: {
    currency: string
    grossDefinition: string
    netDefinition: string
    payoutStatus: string
  }
  safety: {
    actorScoped: boolean
    payoutMutationAvailable: boolean
    walletMutationAvailable: boolean
    clientIdentityExposed: boolean
  }
}


export type CreatorMappingMediaType = 'image' | 'audio' | 'video'
export type CreatorMappingCategory = 'premium' | 'standard'

export interface CreatorMappingRequirement {
  id: string
  title: string
  description: string
  mediaType: CreatorMappingMediaType
  mapping_category?: CreatorMappingCategory
  isRequired: boolean
  isActive: boolean
  acceptedMimeTypes: string[]
  accept: string
  status: string
  rejectionReason: string | null
  uploadedCount: number
  latestAsset: CreatorMappingAsset | null
  createdAt: string | null
  updatedAt: string | null
}

export interface CreatorMappingChecklistGroup {
  requirementId: string
  label: string
  description: string
  mediaType: CreatorMappingMediaType
  required: boolean
  present: boolean
  status: string
  rejectionReason: string | null
  totalAssets: number
  validAssets: number
  dryRunAssets: number
}

export interface CreatorMappingChecklist {
  status: string
  isComplete: boolean
  totalRequired: number
  completedRequired: number
  missingRequired: number
  groups: CreatorMappingChecklistGroup[]
  summary: string
}

export interface CreatorMappingRequirementsResponse {
  actor: CreatorActor
  requirements: CreatorMappingRequirement[]
  message: string
  safety: {
    actorScoped: boolean
    inactiveRequirementsExposed: boolean
    storagePointersExposed: boolean
    publicUrlExposed: boolean
  }
}

export interface CreatorMappingResponse {
  actor: CreatorActor
  mapping: {
    status: string
    pendingMapping: boolean
    latestCase: CreatorMappingCase | null
    cases: CreatorMappingCase[]
    assets: CreatorMappingAsset[]
    requirements: CreatorMappingRequirement[]
    checklist: CreatorMappingChecklist
    uploadEnabled: boolean
    uploadMode: string
    acceptedAssetTypes: CreatorMaterialType[]
    maxUploadBytes: number
    nextStep: string
  }
  warnings: string[]
  message: string
  safety: {
    actorScoped: boolean
    storagePointersExposed: boolean
    publicUrlExposed: boolean
    runPodActionsAvailable: boolean
  }
}

export interface UploadCreatorMaterialInput {
  mappingRequirementId: string
  originalFilename: string
  contentType: string
  base64: string
  byteSize?: number
}

export type UploadCreatorAssetInput = UploadCreatorMaterialInput

export interface UploadCreatorMaterialResponse {
  actor: CreatorActor
  mappingCase: CreatorMappingCase
  asset: CreatorMappingAsset
  duplicate: boolean
  message: string
  safety: {
    privateVaultOnly: boolean
    publicUrlCreated: boolean
    actorScoped: boolean
    runPodCalled: boolean
  }
}

export type UploadCreatorAssetResponse = UploadCreatorMaterialResponse
