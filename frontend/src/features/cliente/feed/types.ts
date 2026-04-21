import type { AtrizPerfil } from '@/shared/types/atriz'

export interface Post {
  id: string
  atriz: AtrizPerfil
  tipo: 'foto' | 'video'
  url: string
  curtidas: number
  comentarios: number
  curtido: boolean
  salvo: boolean
}

export interface Top10Item {
  posicao: number
  atriz: AtrizPerfil
}
