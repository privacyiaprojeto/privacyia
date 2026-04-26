export type TipoNotificacaoAtriz =
  | 'novo_assinante'
  | 'pagamento_recebido'
  | 'saque_processado'
  | 'saque_recusado'
  | 'plataforma'

export interface NotificacaoAtriz {
  id: string
  tipo: TipoNotificacaoAtriz
  titulo: string
  descricao: string
  lida: boolean
  criadaEm: string
}

export interface PreferenciasNotificacaoAtriz {
  financeiro: boolean
  assinantes: boolean
  plataforma: boolean
}
