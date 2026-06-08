export type TipoOpcaoImagem = 'posicao' | 'ambiente' | 'acessorio' | 'roupa'

export interface OpcaoImagem {
  id: string
  label: string
  categoria: TipoOpcaoImagem
  imageUrl?: string
}

export interface GerarImagemInput {
  atrizId: string
  posicaoId?: string | null
  ambienteId?: string | null
  acessorioId?: string | null
  roupaId?: string | null
}

export interface GerarImagemResponse {
  id: string
  mediaJobId?: string
  status: string
  progresso: number
  eta?: number
  url?: string
  message?: string
}
