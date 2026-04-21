import clsx from 'clsx'
import type { AtrizAssinada } from '@/features/cliente/nsfw/types'

interface SeletorAtrizProps {
  atrizes: AtrizAssinada[]
  selecionadaId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
}

export function SeletorAtriz({ atrizes, selecionadaId, onSelect, isLoading }: SeletorAtrizProps) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">Escolha a atriz</h2>

      {isLoading && (
        <div className="flex gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 animate-pulse rounded-full bg-zinc-800" />
              <div className="h-3 w-14 animate-pulse rounded bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && atrizes.length === 0 && (
        <p className="text-sm text-zinc-500">
          Você não possui assinaturas ativas. Assine uma atriz para gerar conteúdo.
        </p>
      )}

      {!isLoading && atrizes.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none]">
          {atrizes.map((atriz) => (
            <button
              key={atriz.id}
              onClick={() => onSelect(atriz.id)}
              className={clsx(
                'flex flex-shrink-0 flex-col items-center gap-1.5 rounded-xl p-2 transition',
                selecionadaId === atriz.id
                  ? 'bg-violet-600/20 ring-2 ring-violet-500'
                  : 'bg-zinc-800/50 hover:bg-zinc-800',
              )}
            >
              <img
                src={atriz.avatarUrl || '/images/avatar-placeholder.png'}
                alt={atriz.nome}
                className="h-16 w-16 rounded-full object-cover"
              />
              <span className="max-w-[4.5rem] truncate text-center text-xs font-medium text-zinc-200">
                {atriz.nome}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
