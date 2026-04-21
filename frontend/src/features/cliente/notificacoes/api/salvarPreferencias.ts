import { api } from '@/shared/lib/axios'
import type { PreferenciasNotificacao } from '@/features/cliente/notificacoes/types'

export async function salvarPreferencias(
  prefs: Partial<PreferenciasNotificacao>,
): Promise<PreferenciasNotificacao> {
  const { data } = await api.patch<PreferenciasNotificacao>('/notificacoes/preferencias', prefs)
  return data
}
