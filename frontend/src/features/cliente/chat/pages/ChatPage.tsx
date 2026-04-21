import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, User, MessageCircle, MoreVertical, RotateCcw } from 'lucide-react'
import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { ConversationCard } from '@/features/cliente/chat/components/ConversationCard'
import { MessageBubble } from '@/features/cliente/chat/components/MessageBubble'
import { ChatInput } from '@/features/cliente/chat/components/ChatInput'
import { AtrizProfilePanel } from '@/features/cliente/chat/components/AtrizProfilePanel'
import { useConversas } from '@/features/cliente/chat/hooks/useConversas'
import { useMensagens } from '@/features/cliente/chat/hooks/useMensagens'
import { useEnviarMensagem } from '@/features/cliente/chat/hooks/useEnviarMensagem'

export function ChatPage() {
  const [menuAberto, setMenuAberto] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: conversas, isPending: loadingConversas } = useConversas()
  const { data: mensagens, isPending: loadingMensagens } = useMensagens(id ?? '')
  const { mutate: enviar, isPending: enviando } = useEnviarMensagem(id ?? '')

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

  return (
    <ClienteLayout>
      <div className="flex h-[calc(100vh-9rem)] overflow-hidden border-t border-zinc-800">

        {/* ── Painel esquerdo: lista de conversas ─────── */}
        <div
          className={clsx(
            'flex w-full flex-col border-r border-zinc-800 md:w-72 md:shrink-0',
            id ? 'hidden md:flex' : 'flex'
          )}
        >
          <div className="shrink-0 border-b border-zinc-800 px-4 py-4">
            <h1 className="text-lg font-bold text-zinc-100">Chat</h1>
          </div>

          <div className="flex-1 overflow-y-auto py-2">
            {loadingConversas ? (
              <div className="space-y-1 px-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3">
                    <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-800" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-28 animate-pulse rounded bg-zinc-800" />
                      <div className="h-3 w-40 animate-pulse rounded bg-zinc-800" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversas?.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-zinc-600">
                <MessageCircle size={32} strokeWidth={1.5} />
                <p className="text-xs">Nenhuma conversa</p>
              </div>
            ) : (
              <div className="space-y-0.5 px-2">
                {conversas?.map((c) => (
                  <ConversationCard key={c.id} conversa={c} isActive={c.id === id} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Painel central: mensagens ────────────────── */}
        <div
          className={clsx(
            'min-w-0 flex-1 flex-col',
            id ? 'flex' : 'hidden md:flex'
          )}
        >
          {id ? (
            <>
              {/* Sub-header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
                <button
                  onClick={() => navigate('/cliente/chat')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-600/20">
                    <User size={16} className="text-violet-400" />
                  </div>
                  {conversa?.atriz.online && (
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-100">
                    {conversa?.atriz.nome ?? '...'}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {conversa?.atriz.online ? 'Online agora' : 'Offline'}
                  </p>
                </div>

                <div className="relative shrink-0" ref={menuRef}>
                  <button
                    onClick={() => setMenuAberto((p) => !p)}
                    className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full transition',
                      menuAberto
                        ? 'bg-zinc-800 text-zinc-100'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                    )}
                  >
                    <MoreVertical size={18} />
                  </button>

                  {menuAberto && (
                    <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
                      <button
                        onClick={() => setMenuAberto(false)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-zinc-300 transition hover:bg-zinc-800"
                      >
                        <RotateCcw size={15} className="text-zinc-400" />
                        Resetar chat
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Mensagens */}
              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {loadingMensagens ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
                  </div>
                ) : (
                  mensagens?.map((mensagem) => (
                    <MessageBubble key={mensagem.id} mensagem={mensagem} />
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <ChatInput onEnviar={(conteudo) => enviar(conteudo)} disabled={enviando} />
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-600">
              <MessageCircle size={44} strokeWidth={1.5} />
              <p className="text-sm">Selecione uma conversa</p>
            </div>
          )}
        </div>

        {/* ── Painel direito: perfil da atriz ─────────── */}
        {id && conversa && (
          <AtrizProfilePanel atrizId={conversa.atriz.id} />
        )}

      </div>
    </ClienteLayout>
  )
}
