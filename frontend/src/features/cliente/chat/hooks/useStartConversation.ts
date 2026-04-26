
import { startConversation } from '../api/chat.api'

export async function handleStartConversation({ companionId, relationshipType, currentMood, navigate }) {
  const conversa = await startConversation({ companionId, relationshipType, currentMood })
  navigate(`/cliente/chat/${conversa.id}`)
}
