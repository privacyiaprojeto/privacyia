import { api } from '@/shared/lib/axios'
import type { AtrizPerfilPublico } from '@/features/cliente/atriz-perfil/types'

export async function getAtrizPerfilPublico(slug: string): Promise<AtrizPerfilPublico> {
  const { data } = await api.get<AtrizPerfilPublico>(`/atrizes/${slug}`)
  return data
}
