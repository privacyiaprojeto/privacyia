import { X } from 'lucide-react'
import type { PreferenciasNotificacao } from '@/features/cliente/notificacoes/types'
import { useModalPreferencias } from '@/features/cliente/notificacoes/hooks/useModalPreferencias'

interface ModalPreferenciasProps {
  preferencias: PreferenciasNotificacao
  onFechar: () => void
}

export function ModalPreferencias({ preferencias, onFechar }: ModalPreferenciasProps) {
  const { local, handleToggle } = useModalPreferencias(preferencias)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onFechar} />

      <div className="relative z-10 w-full max-w-sm rounded-t-2xl border border-zinc-700 bg-zinc-900 p-6 sm:rounded-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-zinc-100">Preferências de notificação</h2>
          <button
            onClick={onFechar}
            className="flex size-8 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Marketing</p>
              <p className="text-xs text-zinc-500">Novos conteúdos, publicações e promoções</p>
            </div>
            <button
              onClick={() => handleToggle('marketing')}
              className={`relative h-6 w-11 rounded-full transition-colors ${local.marketing ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${local.marketing ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="h-px bg-zinc-800" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Sistema</p>
              <p className="text-xs text-zinc-500">Gerações prontas, créditos e avisos da plataforma</p>
            </div>
            <button
              onClick={() => handleToggle('sistema')}
              className={`relative h-6 w-11 rounded-full transition-colors ${local.sistema ? 'bg-violet-600' : 'bg-zinc-700'}`}
            >
              <span className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${local.sistema ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}