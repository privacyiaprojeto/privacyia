export interface LiveActionItem {
  id: string
  nome: string
  nivelRequerido: number
  bloqueado: boolean
}

export interface LiveAudioItem {
  id: string
  titulo: string
  duracao: string
  bloqueado: boolean
}

export interface HistoricoItem {
  id: string
  tipo: 'foto' | 'video'
  url: string
  criadaEm: string
}

export interface AtrizPerfilPublico {
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
  assinaturaAtiva: boolean
  online: boolean
  totalConteudos: number
  totalChats: number
  seguidores: number
  nivelAtual: number
  xpAtual: number
  xpProximoNivel: number
  liveActions: LiveActionItem[]
  liveAudios: LiveAudioItem[]
  historico: HistoricoItem[]
}
