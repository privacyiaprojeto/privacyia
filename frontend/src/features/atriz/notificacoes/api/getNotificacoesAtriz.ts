import { api } from '@/shared/lib/axios'
import type { NotificacaoAtriz } from '@/features/atriz/notificacoes/types'

export async function getNotificacoesAtriz(): Promise<NotificacaoAtriz[]> {
  const { data } = await api.get<NotificacaoAtriz[]>('/atriz/painel/notificacoes')
  return data
}
