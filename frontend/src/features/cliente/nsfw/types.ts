export interface AtrizAssinada {
  id: string
  nome: string
  avatar: string
  avatarUrl?: string
}

import type { MediaAvailabilityStatus, MediaStreamKind } from '@/features/cliente/media/api/protectedPlaybackApi'

export type StatusGeracao = 'em_andamento' | 'concluido' | 'erro'

export interface ItemGerado {
  id: string
  atrizId: string
  atrizNome: string
  tipo: 'imagem' | 'video' | 'audio' | 'foto' | 'live_audio' | 'live_action' | string
  url?: string
  mediaStatus?: MediaAvailabilityStatus
  streamKind?: MediaStreamKind
  mediaMessage?: string | null
  status: StatusGeracao
  progresso: number
  eta?: number
  criadaEm: string
  denunciado?: boolean
}

export interface DenunciarInput {
  itemId: string
  motivo: string
}

export const CUSTO_IMAGEM = 30
export const CUSTO_VIDEO = 80
