export interface AtrizAssinada {
  id: string
  nome: string
  avatarUrl: string
}

export type StatusGeracao = 'em_andamento' | 'concluido' | 'erro'

export interface ItemGerado {
  id: string
  atrizId: string
  atrizNome: string
  tipo: 'imagem' | 'video'
  url?: string
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
