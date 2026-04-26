import { api } from '@/shared/lib/axios'

// TIPOS
type StartConversationPayload = {
  companionId: string
  relationshipType?: string
  currentMood?: string
}

type UpdatePersonaPayload = {
  relationshipType?: string
  currentMood?: string
}

// START CONVERSA
export async function startConversation(payload: StartConversationPayload) {
  const { data } = await api.post('/chat/conversas/start', payload)
  return data
}

// UPDATE PERSONA
export async function updateConversationPersona(
  conversationId: string,
  payload: UpdatePersonaPayload
) {
  const { data } = await api.patch(`/chat/conversas/${conversationId}/persona`, payload)
  return data
}