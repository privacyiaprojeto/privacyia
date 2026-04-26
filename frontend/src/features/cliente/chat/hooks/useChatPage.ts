import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useConversas } from '@/features/cliente/chat/hooks/useConversas'
import { useMensagens } from '@/features/cliente/chat/hooks/useMensagens'
import { useEnviarMensagem } from '@/features/cliente/chat/hooks/useEnviarMensagem'
import { useUpdateConversationPersona } from '@/features/cliente/chat/hooks/useUpdateConversationPersona'

export function useChatPage() {
  const [menuAberto, setMenuAberto] = useState(false)
  const [draftRelationshipType, setDraftRelationshipType] = useState<string | null>(null)
  const [draftCurrentMood, setDraftCurrentMood] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: conversas, isPending: loadingConversas } = useConversas()
  const { data: mensagens, isPending: loadingMensagens } = useMensagens(id ?? '')
  const { mutate: enviar, isPending: enviando } = useEnviarMensagem(id ?? '')
  const { mutate: salvarPersona, isPending: salvandoPersona } = useUpdateConversationPersona()

  const conversa = conversas?.find((c) => c.id === id)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!id && conversas && conversas.length > 0) {
      navigate(`/cliente/chat/${conversas[0].id}`, { replace: true })
    }
  }, [id, conversas, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  useEffect(() => {
    if (conversa) {
      setDraftRelationshipType(conversa.relationshipType)
      setDraftCurrentMood(conversa.currentMood)
    } else {
      setDraftRelationshipType(null)
      setDraftCurrentMood(null)
    }
  }, [conversa?.id, conversa?.relationshipType, conversa?.currentMood, conversa])

  function handleSalvarPersona() {
    if (!id || !conversa) return

    const relationshipType = draftRelationshipType ?? conversa.relationshipType
    const currentMood = draftCurrentMood ?? conversa.currentMood

    if (
      relationshipType === conversa.relationshipType &&
      currentMood === conversa.currentMood
    ) {
      return
    }

    salvarPersona({
      conversationId: id,
      relationshipType,
      currentMood,
    })
  }

  return {
    id,
    menuAberto,
    setMenuAberto,
    menuRef,
    bottomRef,
    conversas,
    mensagens,
    conversa,
    loadingConversas,
    loadingMensagens,
    enviar,
    enviando,
    navigate,
    draftRelationshipType,
    setDraftRelationshipType,
    draftCurrentMood,
    setDraftCurrentMood,
    handleSalvarPersona,
    salvandoPersona,
  }
}
