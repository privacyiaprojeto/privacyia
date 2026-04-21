import { Link } from 'react-router'
import { User } from 'lucide-react'
import clsx from 'clsx'
import type { Conversa } from '@/features/cliente/chat/types'

interface Props {
  conversa: Conversa
  isActive?: boolean
}

export function ConversationCard({ conversa, isActive }: Props) {
  return (
    <Link
      to={`/cliente/chat/${conversa.id}`}
      className={clsx(
        'flex items-center gap-3 rounded-2xl px-4 py-3 transition active:bg-zinc-800',
        isActive
          ? 'bg-violet-600/15 hover:bg-violet-600/20'
          : 'hover:bg-zinc-800/60'
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600/20">
          <User size={20} className="text-violet-400" />
        </div>
        {conversa.atriz.online && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-500" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-semibold text-zinc-100">
            {conversa.atriz.nome}
          </span>
          <span className="shrink-0 text-[11px] text-zinc-500">{conversa.ultimaHora}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className={clsx('truncate text-xs', conversa.naoLidas > 0 ? 'text-zinc-300' : 'text-zinc-500')}>
            {conversa.ultimaMensagem}
          </p>
          {conversa.naoLidas > 0 && (
            <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
              {conversa.naoLidas}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
