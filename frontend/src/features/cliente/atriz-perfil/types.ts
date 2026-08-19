import type { MediaAvailabilityStatus, MediaStreamKind } from '@/features/cliente/media/api/protectedPlaybackApi'

export interface ClientMediaContract {
  mediaType?: string | null
  clientSupported?: boolean | null
  clientOpenable?: boolean | null
  clientPurchasable?: boolean | null
  protectedRenderer?: 'image' | 'audio' | 'video' | string | null
  reasonCode?: string | null
  severity?: 'OK' | 'REVIEW' | 'BLOCKED' | string | null
  userMessage?: string | null
}

export interface LiveActionItem {
  id: string
  mediaType?: string | null
  nome: string
  titulo?: string
  descricao?: string
  duracao?: string
  priceCredits?: number | null
  nivelRequerido: number
  bloqueado: boolean
  purchased?: boolean
  previewUrl?: string | null
  mediaStatus?: MediaAvailabilityStatus
  streamKind?: MediaStreamKind
  destination?: 'feed' | 'premium' | 'public_storefront' | string | null
  assetId?: string | null
  protectedViewUrl?: string | null
  mediaContract?: ClientMediaContract | null
}

export interface LiveAudioItem {
  id: string
  mediaType?: string | null
  titulo: string
  descricao?: string
  duracao: string
  priceCredits?: number | null
  bloqueado: boolean
  purchased?: boolean
  previewUrl?: string | null
  mediaStatus?: MediaAvailabilityStatus
  streamKind?: MediaStreamKind
  destination?: 'feed' | 'premium' | 'public_storefront' | string | null
  assetId?: string | null
  protectedViewUrl?: string | null
  companionId?: string | null
  outputVariantId?: string | null
  variantId?: string | null
  combinationId?: string | null
  deliveryId?: string | null
  mediaContract?: ClientMediaContract | null
}

export interface HistoricoItem {
  id: string
  tipo: 'foto' | 'video'
  url: string
  criadaEm: string
}

export interface AtrizPerfilPublico {
  id: string
  slug: string
  nome: string
  avatar: string
  banner: string
  videoUrl: string
  descricao: string
  idade: number
  altura: string
  fotos: string[]
  assinaturaAtiva: boolean
  online: boolean
  totalConteudos: number
  totalChats: number
  seguidores: number
  nivelAtual: number
  xpAtual: number
  xpProximoNivel: number
  liveActions: LiveActionItem[]
  liveAudios: LiveAudioItem[]
  historico: HistoricoItem[]
}
