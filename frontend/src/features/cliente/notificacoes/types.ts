export type TipoNotificacao = 'marketing' | 'sistema'

export type CategoriaNotificacao =
  | 'novo_conteudo'
  | 'nova_publicacao'
  | 'geracao_concluida'
  | 'creditos_baixos'
  | 'aviso_geral'

export interface NotificacaoPayload {
  atrizSlug?: string
  atrizId?: string
  mediaId?: string
}

export interface Notificacao {
  id: string
  tipo: TipoNotificacao
  categoria: CategoriaNotificacao
  titulo: string
  descricao: string
  lida: boolean
  criadaEm: string
  payload?: NotificacaoPayload
}

export interface PreferenciasNotificacao {
  marketing: boolean
  sistema: boolean
}

export interface MarcarLidaInput {
  id: string
}
