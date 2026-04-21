import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, User } from 'lucide-react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { MessageBubble } from '@/features/cliente/chat/components/MessageBubble'
import { ChatInput } from '@/features/cliente/chat/components/ChatInput'
import { useConversas } from '@/features/cliente/chat/hooks/useConversas'
import { useMensagens } from '@/features/cliente/chat/hooks/useMensagens'
import { useEnviarMensagem } from '@/features/cliente/chat/hooks/useEnviarMensagem'

export function ChatDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: conversas } = useConversas()
  const conversa = conversas?.find((c) => c.id === id)

  const { data: mensagens, isPending } = useMensagens(id ?? '')
  const { mutate: enviar, isPending: enviando } = useEnviarMensagem(id ?? '')

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  return (
    <ClienteLayout>
      <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-lg flex-col">

        {/* Sub-header */}
        <div className="sticky top-20 z-20 flex items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3">
          <button
            onClick={() => navigate('/cliente/chat')}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
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

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {conversa?.atriz.nome ?? '...'}
            </p>
            <p className="text-[11px] text-zinc-500">
              {conversa?.atriz.online ? 'Online agora' : 'Offline'}
            </p>
          </div>
        </div>

        {/* Mensagens */}
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {isPending ? (
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
      </div>
    </ClienteLayout>
  )
}
