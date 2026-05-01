import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useConversas } from '@/features/cliente/chat/hooks/useConversas'
import { useMensagens } from '@/features/cliente/chat/hooks/useMensagens'
import { useEnviarMensagem } from '@/features/cliente/chat/hooks/useEnviarMensagem'
import { useResetarChat } from '@/features/cliente/chat/hooks/useResetarChat'

export function useChatPage() {
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: conversas, isPending: loadingConversas } = useConversas()
  const { data: mensagens, isPending: loadingMensagens } = useMensagens(id ?? '')
  const { mutate: enviar, isPending: enviando } = useEnviarMensagem(id ?? '')
  const { mutate: resetarChat, isPending: resetandoChat } = useResetarChat(id ?? '')

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

  function handleResetarChat() {
    if (!id || resetandoChat) return

    resetarChat(undefined, {
      onSettled: () => setMenuAberto(false),
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
    resetarChat: handleResetarChat,
    resetandoChat,
    navigate,
  }
}