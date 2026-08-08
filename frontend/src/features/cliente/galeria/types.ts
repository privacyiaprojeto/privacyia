export type MidiaTipo = 'imagem' | 'video' | 'audio' | 'foto' | 'live_audio' | 'live_action' | string

export type GaleriaProtectedRenderer = 'image' | 'audio' | 'video' | null

export interface GaleriaMediaContract {
  mediaType?: string | null
  clientSupported?: boolean
  clientOpenable?: boolean
  clientPurchasable?: boolean
  protectedRenderer?: GaleriaProtectedRenderer
  reasonCode?: string | null
  severity?: 'OK' | 'REVIEW' | 'BLOCKED' | string | null
  userMessage?: string | null
}

export interface GaleriaMediaPlayback {
  mediaStatus?: 'processing' | 'ready' | 'unavailable'
  streamKind?: 'hls' | 'progressive' | 'audio' | 'image' | null
  userMessage?: string | null
}

export interface GaleriaSignatureItem {
  titleId?: string | null
  titleName?: string | null
  itemId?: string | null
  itemName?: string | null
}

export interface GaleriaEntrega {
  id: string
  createdAt?: string | null
  deliverySource?: string | null
  protectedViewUrl?: string | null
  pricing: {
    totalPriceCredits: number
    companionCreditsUsed?: number
    universalCreditsUsed?: number
  }
  asset: {
    mediaType?: MidiaTipo | null
    status?: string | null
    variantNumber?: number | null
    publishedAt?: string | null
  }
  companion: {
    id: string
    name?: string | null
    slug?: string | null
    avatarUrl?: string | null
    thumbnailUrl?: string | null
  }
  combination: {
    id?: string | null
    key?: string | null
    title?: string | null
    mediaType?: MidiaTipo | null
    priceCredits?: number
    signature?: GaleriaSignatureItem[]
    signaturePath?: string[]
  }
  galleryItem?: {
    id?: string | null
    source?: string | null
    createdAt?: string | null
  } | null
  mediaPlayback?: GaleriaMediaPlayback | null
  mediaContract?: GaleriaMediaContract | null
}

export interface GaleriaPagination {
  limit: number
  offset: number
  returned: number
  hasMore: boolean
}

export interface GaleriaEntregasResponse {
  items: GaleriaEntrega[]
  pagination: GaleriaPagination
}

// Tipos antigos preservados para compatibilidade com imports que ainda existam.
export type MidiaGaleria = {
  id: string
  atrizId: string
  tipo: MidiaTipo
  url: string
  criadaEm: string
  salvaDoFeed: boolean
}

export interface GaleriaAtriz {
  id: string
  slug: string
  nome: string
  avatar: string
  banner: string
  assinaturaAtiva: boolean
  totalMidias: number
  previewUrl: string
}
