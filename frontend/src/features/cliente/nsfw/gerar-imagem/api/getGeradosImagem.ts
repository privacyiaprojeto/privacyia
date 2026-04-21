import { api } from '@/shared/lib/axios'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

export async function getGeradosImagem(): Promise<ItemGerado[]> {
  const { data } = await api.get<ItemGerado[]>('/nsfw/imagem/gerados')
  return data
}
