import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  MessageCircle,
  MessageCircleHeart,
  MoreVertical,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react'
import clsx from 'clsx'

import { api } from '@/shared/lib/axios'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { ConversationCard } from '@/features/cliente/chat/components/ConversationCard'
import { MessageBubble } from '@/features/cliente/chat/components/MessageBubble'
import { ChatInput } from '@/features/cliente/chat/components/ChatInput'
import { AtrizProfilePanel } from '@/features/cliente/chat/components/AtrizProfilePanel'
import type { Conversa as BaseConversa, Mensagem } from '@/features/cliente/chat/types'
import { getRelationshipLabel, getMoodLabel } from '@/features/cliente/chat/personaOptions'

type Conversa = BaseConversa & {
  relationshipType?: string
  currentMood?: string
}

type PersonaForm = {
  relationshipType: string
  currentMood: string
}

function parseSseEvent(rawEvent: string) {
  const lines = rawEvent.split('\n')
  const eventLine = lines.find((line) => line.startsWith('event:'))
  const dataLines = lines.filter((line) => line.startsWith('data:'))

  if (!eventLine || dataLines.length === 0) {
    return null
  }

  const event = eventLine.replace('event:', '').trim()
  const dataText = dataLines
    .map((line) => line.replace('data:', '').trim())
    .join('\n')

  return {
    event,
    data: JSON.parse(dataText),
  }
}

export function ChatPage() {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  const [menuAberto, setMenuAberto] = useState(false)
  const [salvandoDinamica, setSalvandoDinamica] = useState(false)
  const [resetandoChat, setResetandoChat] = useState(false)
  const [persona, setPersona] = useState<PersonaForm>({
    relationshipType: 'desconhecidos',
    currentMood: 'natural',
  })
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [loadingConversas, setLoadingConversas] = useState(true)
  const [loadingMensagens, setLoadingMensagens] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversa = useMemo(
    () => conversas.find((item) => item.id === id),
    [conversas, id],
  )

  async function carregarConversas() {
    try {
      setLoadingConversas(true)
      const { data } = await api.get<Conversa[]>('/chat/conversas')
      setConversas(data || [])
    } catch (error) {
      console.error('Erro ao carregar conversas:', error)
      setConversas([])
    } finally {
      setLoadingConversas(false)
    }
  }

  async function carregarMensagens(conversationId: string) {
    try {
      setLoadingMensagens(true)
      const { data } = await api.get<Mensagem[]>(`/chat/conversas/${conversationId}/mensagens`)
      setMensagens(data || [])
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error)
      setMensagens([])
    } finally {
      setLoadingMensagens(false)
    }
  }

  useEffect(() => {
    carregarConversas()
  }, [])

  useEffect(() => {
    if (!id) {
      setMensagens([])
      return
    }

    carregarMensagens(id)
  }, [id])

  useEffect(() => {
    if (!conversa) return

    setPersona({
      relationshipType: conversa.relationshipType || 'desconhecidos',
      currentMood: conversa.currentMood || 'natural',
    })
  }, [conversa?.id, conversa?.relationshipType, conversa?.currentMood])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuAberto(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])


  async function resetarChat() {
    if (!id || resetandoChat) return

    const confirmou = window.confirm('Deseja resetar esta conversa? As mensagens serão apagadas.')
    if (!confirmou) return

    try {
      setResetandoChat(true)
      setMenuAberto(false)

      await api.delete(`/chat/conversas/${id}/mensagens`)

      setMensagens([])

      setConversas((atuais) =>
        atuais.map((item) =>
          item.id === id
            ? {
                ...item,
                ultimaMensagem: 'Conversa reiniciada',
                ultimaHora: 'agora',
                naoLidas: 0,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error('Erro ao resetar chat:', error)
    } finally {
      setResetandoChat(false)
    }
  }

  async function atualizarPersona(proximaPersona: Partial<PersonaForm>) {
    if (!id || salvandoDinamica) return

    const personaAnterior = persona
    const personaAtualizada = {
      ...personaAnterior,
      ...proximaPersona,
    }

    setPersona(personaAtualizada)
    setConversas((atuais) =>
      atuais.map((item) =>
        item.id === id
          ? {
              ...item,
              relationshipType: personaAtualizada.relationshipType,
              currentMood: personaAtualizada.currentMood,
            }
          : item,
      ),
    )

    try {
      setSalvandoDinamica(true)

      const { data } = await api.patch(`/chat/conversas/${id}/persona`, proximaPersona)

      const personaConfirmada = {
        relationshipType: data.relationshipType || personaAtualizada.relationshipType,
        currentMood: data.currentMood || personaAtualizada.currentMood,
      }

      setPersona(personaConfirmada)
      setConversas((atuais) =>
        atuais.map((item) =>
          item.id === id
            ? {
                ...item,
                relationshipType: personaConfirmada.relationshipType,
                currentMood: personaConfirmada.currentMood,
              }
            : item,
        ),
      )
    } catch (error) {
      console.error('Erro ao atualizar relacionamento/humor:', error)

      setPersona(personaAnterior)
      setConversas((atuais) =>
        atuais.map((item) =>
          item.id === id
            ? {
                ...item,
                relationshipType: personaAnterior.relationshipType,
                currentMood: personaAnterior.currentMood,
              }
            : item,
        ),
      )
    } finally {
      setSalvandoDinamica(false)
    }
  }


  async function enviar(conteudo: string) {
    if (!id || !conteudo.trim()) return

    const tempUserId = crypto.randomUUID()
    const tempAssistantId = crypto.randomUUID()

    const userMsg: Mensagem = {
      id: tempUserId,
      conversaId: id,
      conteudo,
      de: 'cliente',
      criadaEm: 'agora',
    }

    const assistantMsg: Mensagem = {
      id: tempAssistantId,
      conversaId: id,
      conteudo: '',
      de: 'atriz',
      criadaEm: 'digitando...',
    }

    setMensagens((atual) => [...atual, userMsg, assistantMsg])
    setEnviando(true)

    try {
      const token = useAuthStore.getState().token

      const response = await fetch(`${import.meta.env.VITE_API_URL}/chat/conversas/${id}/mensagens/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conteudo }),
      })

      if (!response.ok) {
        throw new Error(`Erro HTTP ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Resposta sem stream.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const rawEvent of events) {
          const parsed = parseSseEvent(rawEvent)

          if (!parsed) continue

          const { event, data } = parsed

          if (event === 'token') {
            setMensagens((atual) =>
              atual.map((msg) =>
                msg.id === tempAssistantId
                  ? { ...msg, conteudo: msg.conteudo + data.token }
                  : msg,
              ),
            )
          }

          if (event === 'done') {
            setMensagens((atual) =>
              atual.map((msg) => {
                if (msg.id === tempUserId) return data.userMessage
                if (msg.id === tempAssistantId) return data.assistantMessage
                return msg
              }),
            )

            setConversas((atuais) =>
              atuais.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      ultimaMensagem: data.assistantMessage?.conteudo || conteudo,
                      ultimaHora: data.assistantMessage?.criadaEm || 'agora',
                    }
                  : item,
              ),
            )
          }

          if (event === 'error') {
            throw new Error(data.message || 'Erro ao gerar resposta.')
          }
        }
      }

      carregarConversas()
    } catch (error) {
      console.error('Erro no streaming:', error)

      setMensagens((atual) =>
        atual.map((msg) =>
          msg.id === tempAssistantId
            ? {
                ...msg,
                conteudo: 'Não consegui responder agora. Tente novamente em alguns segundos.',
                criadaEm: 'agora',
              }
            : msg,
        ),
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <ClienteLayout>
      <div className="flex h-[calc(100vh-9rem)] overflow-hidden border-t border-zinc-800">
        <div
          className={clsx(
            'flex w-full flex-col border-r border-zinc-800 md:w-72 md:shrink-0',
            id ? 'hidden md:flex' : 'flex',
          )}
        >
          <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
            <h1 className="text-lg font-bold text-zinc-100">Chat</h1>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingConversas ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="flex items-center gap-3 rounded-2xl px-4 py-3">
                    <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-40 animate-pulse rounded bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversas.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-zinc-600">
                <MessageCircle size={32} strokeWidth={1.5} />
                <p className="text-xs">Nenhuma conversa</p>
              </div>
            ) : (
              <div className="space-y-0.5 px-2">
                {conversas.map((item) => (
                  <ConversationCard key={item.id} conversa={item} isActive={item.id === id} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          className={clsx(
            'min-w-0 flex-1 flex-col',
            id ? 'flex' : 'hidden md:flex',
          )}
        >
          {id ? (
            <>
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
                <button
                  onClick={() => navigate('/cliente/chat')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="relative shrink-0">
                  {conversa?.atriz.avatar ? (
                    <img
                      src={conversa.atriz.avatar}
                      alt={conversa.atriz.nome}
                      className="h-9 w-9 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/20">
                      <User size={16} className="text-violet-400" />
                    </div>
                  )}

                  {conversa?.atriz.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {conversa?.atriz.nome ?? '...'}
                  </p>

                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-zinc-500">
                      {conversa?.atriz.online ? 'Online agora' : 'Offline'}
                    </span>

                    {conversa?.relationshipType && (
                      <span className="rounded-full border border-violet-500/30 bg-violet-600/10 px-2 py-0.5 text-[10px] font-medium text-violet-300">
                        {getRelationshipLabel(conversa.relationshipType)}
                      </span>
                    )}

                    {conversa?.currentMood && (
                      <span className="rounded-full border border-pink-500/30 bg-pink-600/10 px-2 py-0.5 text-[10px] font-medium text-pink-300">
                        {getMoodLabel(conversa.currentMood)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    onClick={() => setMenuAberto((prev) => !prev)}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full transition',
                      menuAberto
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                    )}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {menuAberto && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
                      <button
                        onClick={resetarChat}
                        disabled={resetandoChat}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <RotateCcw size={15} className="text-zinc-400" />
                        {resetandoChat ? 'Resetando...' : 'Resetar chat'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {loadingMensagens ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  </div>
                ) : mensagens.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-zinc-600">
                    <Sparkles size={38} strokeWidth={1.5} />
                    <p className="text-sm text-zinc-400">Comece a conversa.</p>
                    <p className="max-w-xs text-xs leading-relaxed text-zinc-600">
                      Envie uma mensagem para ativar a memória, a persona e o contexto da IA.
                    </p>
                  </div>
                ) : (
                  mensagens.map((mensagem) => (
                    mensagem.de === 'atriz' && mensagem.conteudo === '' ? (
                      <div key={mensagem.id} className="flex w-full justify-start">
                        <div className="max-w-[78%] rounded-2xl rounded-bl-sm bg-zinc-800 px-4 py-2.5 text-sm text-zinc-400">
                          digitando<span className="animate-pulse">...</span>
                        </div>
                      </div>
                    ) : (
                      <MessageBubble key={mensagem.id} mensagem={mensagem} />
                    )
                  ))
                )}

                <div ref={bottomRef} />
              </div>

              <ChatInput
                onEnviar={enviar}
                disabled={enviando}
                relationshipType={persona.relationshipType}
                currentMood={persona.currentMood}
                onRelationshipTypeChange={(relationshipType) =>
                  atualizarPersona({ relationshipType })
                }
                onCurrentMoodChange={(currentMood) =>
                  atualizarPersona({ currentMood })
                }
                savingPersona={salvandoDinamica}
              />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center px-6">
              <div className="flex max-w-md flex-col items-center text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-500 shadow-lg shadow-purple-900/40">
                  <MessageCircleHeart size={36} className="text-white" />
                </div>

                <h2 className="text-2xl font-semibold text-white">
                  Pronto para uma nova experiência?
                </h2>

                <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                  Sua caixa de mensagens ainda está vazia. Descubra novas companions
                  e comece conversas únicas e envolventes.
                </p>

                <button
                  onClick={() => navigate('/cliente/descobrir')}
                  className="mt-6 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-6 py-3 text-sm font-medium text-white shadow-lg transition-all duration-200 hover:scale-105 hover:shadow-purple-800/40"
                >
                  Explorar Companions
                </button>
              </div>
            </div>
          )}
        </div>

        {id && conversa && <AtrizProfilePanel atrizId={conversa.atriz.id} />}
      </div>

    </ClienteLayout>
  )
}
