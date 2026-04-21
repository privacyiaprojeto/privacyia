import { api } from '@/shared/lib/axios'
import type { Notificacao } from '@/features/cliente/notificacoes/types'

export async function marcarLida(id: string): Promise<Notificacao> {
  const { data } = await api.patch<Notificacao>(`/notificacoes/${id}/lida`)
  return data
}
