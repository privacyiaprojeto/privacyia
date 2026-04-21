import { api } from '@/shared/lib/axios'
import type { AtrizPerfil } from '@/shared/types/atriz'

export async function getSugestoes(): Promise<AtrizPerfil[]> {
  const { data } = await api.get<AtrizPerfil[]>('/feed/sugestoes')
  return data
}
