import { api } from '@/shared/lib/axios'
import type { Conversa } from '@/features/cliente/chat/types'

export interface StartConversationInput {
  companionId: string
  relationshipType?: string
  currentMood?: string
}

export async function startConversation(input: StartConversationInput): Promise<Conversa> {
  const { data } = await api.post<Conversa>('/chat/conversas/start', input)
  return data
}
