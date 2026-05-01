import { api } from '@/shared/lib/axios'
import type { Conversa } from '@/features/cliente/chat/types'
import { getConversationTimestamp, normalizeConversa } from '@/features/cliente/chat/api/chatFormatters'

export async function getConversas(): Promise<Conversa[]> {
  const { data } = await api.get<Conversa[]>('/chat/conversas')

  return [...data]
    .sort((a, b) => getConversationTimestamp(b) - getConversationTimestamp(a))
    .map(normalizeConversa)
}
