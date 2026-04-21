import { api } from '@/shared/lib/axios'
import type { Top10Item } from '@/features/cliente/feed/types'

export async function getTop10(): Promise<Top10Item[]> {
  const { data } = await api.get<Top10Item[]>('/feed/top10')
  return data
}
