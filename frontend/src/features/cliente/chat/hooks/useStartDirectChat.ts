import { useState } from 'react'
import { useNavigate } from 'react-router'
import { startConversation } from '@/features/cliente/chat/api/startConversation'
type ChatTarget = { id: string; nome: string; isFallback?: boolean }

export function useStartDirectChat() {
  const navigate = useNavigate()
  const [startingChatId, setStartingChatId] = useState<string | null>(null)

  async function startDirectChat(atriz: ChatTarget) {
    if (startingChatId) return

    if (atriz.isFallback) {
      // Lógica solicitada por Lorenzo: mock é só preenchimento visual; chat real exige atriz da API.
      console.warn('Chat direto ignorado para atriz mock/fallback:', atriz.nome)
      return
    }

    try {
      setStartingChatId(atriz.id)

      // Lógica solicitada por Lorenzo: bypass do modal com dinâmica padrão silenciosa.
      const conversa = await startConversation({
        companionId: atriz.id,
        relationshipType: 'desconhecidos',
        currentMood: 'natural',
      })

      navigate(`/cliente/chat/${conversa.id}`)
    } catch (error) {
      console.error('Erro ao iniciar conversa direta:', error)
    } finally {
      setStartingChatId(null)
    }
  }

  return { startDirectChat, startingChatId }
}
