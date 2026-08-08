import type { MediaAvailabilityStatus, MediaStreamKind } from '@/features/cliente/media/api/protectedPlaybackApi'
import type { AtrizPerfil } from '@/shared/types/atriz'

export interface FeedProduct {
  id: string
  nome: string
  tipo: string
  precoCreditos: number
}

export interface Post {
  id: string
  atriz: AtrizPerfil
  tipo: 'foto' | 'video'
  url: string
  mediaStatus?: MediaAvailabilityStatus
  streamKind?: MediaStreamKind
  mediaMessage?: string | null
  curtidas: number
  comentarios: number
  curtido: boolean
  salvo: boolean
  readOnly?: boolean
  produto?: FeedProduct
}

export interface Top10Item {
  posicao: number
  atriz: AtrizPerfil
}
