import { api } from '@/shared/lib/axios'
import type { PreferenciasNotificacao } from '@/features/cliente/notificacoes/types'

export async function getPreferencias(): Promise<PreferenciasNotificacao> {
  const { data } = await api.get<PreferenciasNotificacao>('/notificacoes/preferencias')
  return data
}
