import { api } from '@/shared/lib/axios'
import type { MediaGerada } from '@/features/cliente/chat/types'

export async function getTimeline(atrizId: string): Promise<MediaGerada[]> {
  const { data } = await api.get<MediaGerada[]>(`/atrizes/${atrizId}/timeline`)
  return data
}
