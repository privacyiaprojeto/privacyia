export interface AtrizPerfil {
  id: string
  slug: string
  nome: string
  avatar: string
  banner: string
  videoUrl?: string
  thumbnailUrl?: string | null
  /**
   * true apenas para registros de preenchimento visual/mock.
   * Atrizes vindas da API/Supabase devem manter isFallback=false para habilitar chat.
   */
  isFallback?: boolean
}

export interface Atriz {
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
  thumbnailUrl?: string | null
  /**
   * true apenas para registros de preenchimento visual/mock.
   * Atrizes vindas da API/Supabase devem manter isFallback=false para habilitar chat.
   */
  isFallback?: boolean
}
