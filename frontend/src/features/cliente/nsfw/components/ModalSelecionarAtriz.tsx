import { X } from 'lucide-react'
import clsx from 'clsx'
import type { AtrizAssinada } from '@/features/cliente/nsfw/types'

interface ModalSelecionarAtrizProps {
  atrizes: AtrizAssinada[]
  selecionadaId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function ModalSelecionarAtriz({
  atrizes,
  selecionadaId,
  onSelect,
  onClose,
}: ModalSelecionarAtrizProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950/95 p-5 shadow-2xl shadow-black/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Escolher atriz</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Selecione um avatar para carregar as opções disponíveis.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-500 transition hover:text-zinc-300">
            <X size={18} />
          </button>
        </div>

        {atrizes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-6 text-center">
            <p className="text-sm font-medium text-zinc-300">Nenhuma atriz disponível agora.</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Quando o Admin publicar produtos para um avatar, ele aparecerá aqui para seleção.
            </p>
          </div>
        ) : (
          <div className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
            {atrizes.map((atriz) => {
              const selecionada = atriz.id === selecionadaId
              const avatarSrc = atriz.avatar || atriz.avatarUrl || '/images/avatar-placeholder.png'

              return (
                <button
                  key={atriz.id}
                  onClick={() => {
                    onSelect(atriz.id)
                    onClose()
                  }}
                  className={clsx(
                    'group flex flex-col items-center gap-2 rounded-2xl border p-2 transition',
                    selecionada
                      ? 'border-violet-500 bg-violet-500/10 ring-2 ring-violet-500/40'
                      : 'border-zinc-800 bg-zinc-900/60 hover:border-violet-500/60 hover:bg-zinc-900',
                  )}
                >
                  <img
                    src={avatarSrc}
                    alt={atriz.nome}
                    className="h-24 w-full rounded-xl object-cover transition group-hover:scale-[1.02]"
                  />
                  <span className="line-clamp-2 min-h-[2rem] text-center text-xs font-medium leading-tight text-zinc-200">
                    {atriz.nome}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
