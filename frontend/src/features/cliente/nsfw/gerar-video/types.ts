export type TipoOpcaoVideo = string

export interface OpcaoVideo {
  id: string
  label: string
  categoria: TipoOpcaoVideo
  categoriaLabel?: string
  titleId?: string
  titleName?: string
  source?: 'legacy' | 'guided_factory' | string
  imageUrl?: string
  videoUrl?: string
}

export interface GuidedSelectionInput {
  titleId?: string | null
  category?: string | null
  itemId: string
}

export interface GerarVideoInput {
  atrizId: string
  acaoId?: string | null
  roupaId?: string | null
  localizacaoId?: string | null
  guidedSelections?: GuidedSelectionInput[]
}

export interface GerarVideoResponse {
  id: string
  status: string
  progresso: number
}
