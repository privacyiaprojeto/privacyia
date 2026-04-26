export interface PerfilPublicoAtriz {
  nome: string
  slug: string
  bio: string
  foto: string
  banner: string
  idade?: number
  altura?: string
  caracteristicas?: string[]
}

export interface PersonalidadeIA {
  tomVoz: string
  palavrasFavoritas: string[]
  limites: string[]
  estiloResposta: string
  promptBase: string
}

export interface LiveAction {
  id: string
  titulo: string
  descricao: string
  precoCreditos: number
  ativo: boolean
}

export interface LiveAudio {
  id: string
  titulo: string
  url: string
  duracao: number
  bloqueado: boolean
}

export interface DadosConta {
  nomeArtistico: string
  email: string
}

export interface AlterarSenhaInput {
  senhaAtual: string
  novaSenha: string
}

export interface DadosBancarios {
  tipo: 'pix' | 'conta_bancaria'
  chave?: string
  banco?: string
  agencia?: string
  conta?: string
  titular?: string
}
