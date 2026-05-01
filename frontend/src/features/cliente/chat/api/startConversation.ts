import { api } from '@/shared/lib/axios'
import type { Conversa } from '@/features/cliente/chat/types'
import { normalizeConversa } from '@/features/cliente/chat/api/chatFormatters'

export interface StartConversationInput {
  companionId: string
  relationshipType?: string
  currentMood?: string
}

export async function startConversation(input: StartConversationInput): Promise<Conversa> {
  const { data } = await api.post<Conversa>('/chat/conversas/start', input)
  return normalizeConversa(data)
}
