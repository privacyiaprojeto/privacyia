import { api } from '@/shared/lib/axios'
import type { AtrizAssinada } from '@/features/cliente/nsfw/types'

export async function getAtrizesAssinadas(): Promise<AtrizAssinada[]> {
  const { data } = await api.get<AtrizAssinada[]>('/nsfw/atrizes-assinadas')
  return data
}
