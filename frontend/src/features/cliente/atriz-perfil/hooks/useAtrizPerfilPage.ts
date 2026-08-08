import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useAtrizPerfilPublico } from '@/features/cliente/atriz-perfil/hooks/useAtrizPerfilPublico'
import { useAudioLiveClientBridge } from '@/features/cliente/atriz-perfil/hooks/useAudioLiveClientBridge'
import { useFeedPosts } from '@/features/cliente/feed/hooks/useFeedPosts'
import { getConversas } from '@/features/cliente/chat/api/getConversas'
import { startConversation } from '@/features/cliente/chat/api/startConversation'
import type { Conversa } from '@/features/cliente/chat/types'

type AbaEsq = 'sobre' | 'personalidade' | 'interesses'
type AbaDir = 'posts' | 'live_action' | 'live_audio' | 'historico'

function getConversaAtrizId(conversa: Conversa) {
  const raw = conversa as Conversa & {
    companion_id?: string | null
    companionId?: string | null
    atrizId?: string | null
    companion?: {
      id?: string | null
    } | null
  }

  return (
    raw.atriz?.id ||
    raw.companion?.id ||
    raw.companion_id ||
    raw.companionId ||
    raw.atrizId ||
    ''
  )
}
function normalizarConversaParaChat(conversa: Conversa, atriz: any): Conversa {
  return {
    ...conversa,
    id: conversa.id,
    atriz: conversa.atriz || {
      id: atriz.id,
      nome: atriz.nome,
      avatar: atriz.avatar || atriz.foto || atriz.fotoPerfil || null,
      online: Boolean(atriz.online),
    },
    ultimaMensagem: conversa.ultimaMensagem || '',
    ultimaHora: conversa.ultimaHora || new Date().toISOString(),
    naoLidas: conversa.naoLidas || 0,
  }
}
export function useAtrizPerfilPage() {
  const params = useParams<{
    slug?: string
    id?: string
    atrizId?: string
  }>()

  const atrizParam = params.id || params.atrizId || params.slug || ''

  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: atriz, isLoading, isError } = useAtrizPerfilPublico(atrizParam)
  const audioLiveBridge = useAudioLiveClientBridge(atriz)
  const { data: feedPosts = [] } = useFeedPosts()

  const [abaEsq, setAbaEsq] = useState<AbaEsq>('sobre')
  const [abaDir, setAbaDir] = useState<AbaDir>('posts')
  const [startingChat, setStartingChat] = useState(false)
  const [checkingConversation, setCheckingConversation] = useState(false)
  const [conversaAtivaId, setConversaAtivaId] = useState<string | null>(null)

  const tabsDir: { id: AbaDir; label: string }[] = [
    { id: 'posts', label: 'Post' },
    { id: 'live_action', label: 'Live Action' },
    { id: 'live_audio', label: 'Live Audio' },
    { id: 'historico', label: 'Histórico' },
  ]

  const postsDaAtriz = atriz
    ? feedPosts.filter((post) => post.atriz.slug === atriz.slug)
    : []

  useEffect(() => {
  const atrizId = atriz?.id

  if (!atrizId) {
    setConversaAtivaId(null)
    return
  }

  let isMounted = true

  async function carregarConversaAtiva() {
    try {
      setCheckingConversation(true)

      const conversas = await getConversas()

      const conversaExistente = conversas.find((conversa) => {
        const conversaAtrizId = getConversaAtrizId(conversa)
        return conversaAtrizId === atrizId
      })

      if (!isMounted) return

      setConversaAtivaId(conversaExistente?.id || null)
    } catch (error) {
      console.error('Erro ao verificar conversa ativa da atriz:', error)

      if (isMounted) {
        setConversaAtivaId(null)
      }
    } finally {
      if (isMounted) {
        setCheckingConversation(false)
      }
    }
  }

  carregarConversaAtiva()

  return () => {
    isMounted = false
  }
}, [atriz?.id])

  async function handleConversar() {
    if (!atriz || startingChat) return

    try {
      setStartingChat(true)

      if (conversaAtivaId) {
        navigate(`/cliente/chat/${conversaAtivaId}`)
        return
      }

      const conversa = await startConversation({
        companionId: atriz.id,
        relationshipType: 'desconhecidos',
        currentMood: 'natural',
      })

      if (!conversa?.id) {
        throw new Error('API não retornou o ID da conversa criada.')
      }

      const conversaNormalizada = normalizarConversaParaChat(conversa, atriz)

queryClient.setQueryData<Conversa[]>(['chat', 'conversas'], (old = []) => {
  const semDuplicar = old.filter((item) => item.id !== conversaNormalizada.id)
  return [conversaNormalizada, ...semDuplicar]
})

await queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })

navigate(`/cliente/chat/${conversaNormalizada.id}`, {
  state: {
    conversa: conversaNormalizada,
  },
})
    } catch (error) {
      console.error('Erro ao iniciar experiência real com a atriz:', error)
    } finally {
      setStartingChat(false)
    }
  }

  return {
    atriz: audioLiveBridge.atriz,
    isLoading,
    isError,
    abaEsq,
    setAbaEsq,
    abaDir,
    setAbaDir,
    tabsDir,
    postsDaAtriz,
    startingChat,
    checkingConversation,
    conversaAtivaId,
    temConversaAtiva: Boolean(conversaAtivaId),
    handleConversar,
    audioLiveBridge,
    navigate,
  }
}