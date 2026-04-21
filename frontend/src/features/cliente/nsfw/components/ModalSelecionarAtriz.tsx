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
        className="w-full max-w-sm rounded-2xl bg-zinc-900 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Escolher atriz</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {atrizes.map((atriz) => {
            const selecionada = atriz.id === selecionadaId
            return (
              <button
                key={atriz.id}
                onClick={() => {
                  onSelect(atriz.id)
                  onClose()
                }}
                className={clsx(
                  'flex flex-col items-center gap-2 rounded-2xl p-2 transition',
                  selecionada
                    ? 'ring-2 ring-violet-500 bg-violet-500/10'
                    : 'hover:bg-zinc-800',
                )}
              >
                <img
                  src={atriz.avatarUrl}
                  alt={atriz.nome}
                  className="h-20 w-20 rounded-xl object-cover"
                />
                <span className="text-xs font-medium text-zinc-200 text-center leading-tight">
                  {atriz.nome}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
