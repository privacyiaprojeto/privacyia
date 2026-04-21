import { api } from '@/shared/lib/axios'
import type { Notificacao } from '@/features/cliente/notificacoes/types'

export async function getNotificacoes(): Promise<Notificacao[]> {
  const { data } = await api.get<Notificacao[]>('/notificacoes')
  return data
}
