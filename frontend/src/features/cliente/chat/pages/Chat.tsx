import { MessageCircle } from 'lucide-react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { ConversationCard } from '@/features/cliente/chat/components/ConversationCard'
import { useConversas } from '@/features/cliente/chat/hooks/useConversas'

export function Chat() {
  const { data: conversas, isPending } = useConversas()

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="mb-6 text-xl font-bold text-zinc-100">Chat</h1>

        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3">
                <div className="h-12 w-12 animate-pulse rounded-full bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-32 animate-pulse rounded bg-zinc-800" />
                  <div className="h-3 w-48 animate-pulse rounded bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : conversas?.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
            <MessageCircle size={40} strokeWidth={1.5} />
            <p className="text-sm">Nenhuma conversa ainda</p>
          </div>
        ) : (
          <div className="space-y-1">
            {conversas?.map((conversa) => (
              <ConversationCard key={conversa.id} conversa={conversa} />
            ))}
          </div>
        )}
      </div>
    </ClienteLayout>
  )
}
