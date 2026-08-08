export type TipoOpcaoImagem = string

export interface OpcaoImagem {
  id: string
  label: string
  categoria: TipoOpcaoImagem
  categoriaLabel?: string
  titleId?: string
  titleName?: string
  source?: 'legacy' | 'guided_factory' | string
  imageUrl?: string
}


export interface DynamicPromptSelection {
  titleId?: string | null
  titleName?: string | null
  itemId?: string | null
  itemName?: string | null
}

export interface DynamicPromptOption {
  itemId: string
  itemName: string
  titleId?: string | null
  titleName: string
  availableCombinations?: number
  availableVariations?: number
}

export interface DynamicPromptStep {
  titleId?: string | null
  titleName: string
  stepIndex?: number
  options: DynamicPromptOption[]
}

export interface DynamicPromptOptionsInput {
  companionId: string
  mediaType?: string
  selections?: DynamicPromptSelection[]
}

export interface DynamicPromptOptionsResult {
  companion?: unknown
  mediaType?: string | null
  selected: DynamicPromptSelection[]
  progress: {
    selectedSteps: number
    totalSteps: number
    isComplete: boolean
  }
  currentStep: DynamicPromptStep | null
  selectionComplete: boolean
  available: {
    combinations: number
    variations: number
  }
  completedCombinations: Array<{
    combinationId: string
    mediaType?: string | null
    priceCredits?: number
    signature: DynamicPromptSelection[]
    availableVariations?: number
  }>
  guidance?: string
}

export interface DynamicPromptPrepareInput extends DynamicPromptOptionsInput {
  combinationId?: string | null
}

export interface DynamicPromptPrepareResult {
  readyToContinue: boolean
  readyToBuy: boolean
  reason: string
  companionId?: string | null
  mediaType?: string | null
  combinationId?: string | null
  alreadyDeliveredToClient?: boolean
  previousDelivery?: {
    id: string
    createdAt?: string | null
    totalPriceCredits?: number
  } | null
  price?: {
    credits: number
    isConfigured?: boolean
    sellable?: boolean
    source?: string
    sourceLabel?: string
  }
  signature?: DynamicPromptSelection[]
  variationPool?: {
    availableVariations?: number
    selectedVariationNumber?: number | null
    selectionMode?: string
    note?: string
  }
  guidance?: string
}

export interface DynamicPromptClaimInput extends DynamicPromptOptionsInput {
  combinationId?: string | null
}

export interface DynamicPromptClaimResult {
  ok: boolean
  charged: boolean
  alreadyDelivered: boolean
  deliveryId: string
  protectedViewUrl?: string | null
  companionId?: string | null
  mediaType?: string | null
  combinationId?: string | null
  price?: {
    credits: number
    source?: string
    sourceLabel?: string | null
  }
  balance?: {
    before?: number | null
    after?: number | null
  }
  signature?: DynamicPromptSelection[]
  guidance?: string
}

export interface GuidedSelectionInput {
  titleId?: string | null
  category?: string | null
  itemId: string
}

export interface GerarImagemInput {
  atrizId: string
  posicaoId?: string | null
  ambienteId?: string | null
  acessorioId?: string | null
  roupaId?: string | null
  guidedSelections?: GuidedSelectionInput[]
  dynamicClaim?: boolean
  dynamicSelections?: DynamicPromptSelection[]
  combinationId?: string | null
}

export interface GerarImagemResponse {
  id: string
  mediaJobId?: string
  status: string
  progresso: number
  eta?: number
  url?: string
  message?: string
  charged?: boolean
  alreadyDelivered?: boolean
  deliveryId?: string
  protectedViewUrl?: string | null
  price?: DynamicPromptClaimResult['price']
  balance?: DynamicPromptClaimResult['balance']
  signature?: DynamicPromptSelection[]
}
