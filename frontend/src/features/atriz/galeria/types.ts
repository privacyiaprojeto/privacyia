export type TipoGeracaoIA = 'imagem' | 'video'
export type OrigemGaleria = 'admin' | 'cliente'

export interface GaleriaItem {
  id: string
  tipo: TipoGeracaoIA
  url: string
  origem: OrigemGaleria
  criadaEm: string
}
