
import { useNavigate } from 'react-router'
import { startConversation } from '@/features/cliente/chat/api/startConversation'

export function useAtrizPerfilPage(atriz) {
  const navigate = useNavigate()

  async function handleConversar(relationshipType, currentMood) {
    const conversa = await startConversation({
      companionId: atriz.id,
      relationshipType,
      currentMood
    })

    navigate(`/cliente/chat/${conversa.id}`)
  }

  return { handleConversar }
}
