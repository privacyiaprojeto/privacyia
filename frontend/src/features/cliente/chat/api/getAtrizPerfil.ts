import { api } from '@/shared/lib/axios'
import type { AtrizPerfil } from '@/features/cliente/chat/types'

export async function getAtrizPerfil(atrizId: string): Promise<AtrizPerfil> {
  const { data } = await api.get<AtrizPerfil>(`/atrizes/${atrizId}/perfil`)
  return data
}
