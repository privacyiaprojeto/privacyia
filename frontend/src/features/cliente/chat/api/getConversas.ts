import { api } from '@/shared/lib/axios'
import type { Conversa } from '@/features/cliente/chat/types'

export async function getConversas(): Promise<Conversa[]> {
  const { data } = await api.get<Conversa[]>('/chat/conversas')
  return data
}
