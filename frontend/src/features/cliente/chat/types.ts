export interface Atriz {
  id: string
  nome: string
  avatar: string | null
  online: boolean
}

export interface Conversa {
  id: string
  atriz: Atriz
  ultimaMensagem: string
  ultimaHora: string
  naoLidas: number
  updatedAt?: string | null
  updated_at?: string | null
  createdAt?: string | null
  created_at?: string | null
}

export interface Mensagem {
  id: string
  conversaId: string
  conteudo: string
  de: 'cliente' | 'atriz'
  criadaEm: string
}

export interface AtrizPerfil {
  id: string
  nome: string
  avatar: string | null
  online: boolean
  descricao: string
  idade: number
  altura: string
  fotos: string[]
}

export interface MediaGerada {
  id: string
  atrizId: string
  tipo: 'foto' | 'video'
  url: string
  criadaEm: string
}
