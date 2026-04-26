import { api } from '@/shared/lib/axios'
import type { UpdateConversationPersonaResponse } from '@/features/cliente/chat/types'

export interface UpdateConversationPersonaInput {
  conversationId: string
  relationshipType?: string
  currentMood?: string
}

export async function updateConversationPersona(
  input: UpdateConversationPersonaInput,
): Promise<UpdateConversationPersonaResponse> {
  const { conversationId, ...payload } = input
  const { data } = await api.patch<UpdateConversationPersonaResponse>(
    `/chat/conversas/${conversationId}/persona`,
    payload,
  )
  return data
}
