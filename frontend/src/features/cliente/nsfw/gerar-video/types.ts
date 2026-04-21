export type TipoOpcaoVideo = 'acao' | 'roupa' | 'localizacao'

export interface OpcaoVideo {
  id: string
  label: string
  categoria: TipoOpcaoVideo
  imageUrl?: string
  videoUrl?: string
}

export interface GerarVideoInput {
  atrizId: string
  acaoId?: string | null
  roupaId?: string | null
  localizacaoId?: string | null
}

export interface GerarVideoResponse {
  id: string
  status: string
  progresso: number
}
