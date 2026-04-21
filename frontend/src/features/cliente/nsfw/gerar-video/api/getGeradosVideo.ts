import { api } from '@/shared/lib/axios'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

export async function getGeradosVideo(): Promise<ItemGerado[]> {
  const { data } = await api.get<ItemGerado[]>('/nsfw/video/gerados')
  return data
}
