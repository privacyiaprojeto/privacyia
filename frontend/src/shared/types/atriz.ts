export interface AtrizPerfil {
  id: string
  slug: string
  nome: string
  avatar: string
  banner: string
  videoUrl?: string
  thumbnailUrl?: string | null
  runpodVoiceId?: string | null
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
  runpodVoiceId?: string | null
}
