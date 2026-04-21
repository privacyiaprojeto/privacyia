import { useState } from 'react'
import { Settings } from 'lucide-react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { NotificacaoItem } from '@/features/cliente/notificacoes/components/NotificacaoItem'
import { ModalPreferencias } from '@/features/cliente/notificacoes/components/ModalPreferencias'
import { useNotificacoes } from '@/features/cliente/notificacoes/hooks/useNotificacoes'
import { useMarcarTodasLidas } from '@/features/cliente/notificacoes/hooks/useMarcarTodasLidas'
import { usePreferencias } from '@/features/cliente/notificacoes/hooks/usePreferencias'
import { parseApiError } from '@/shared/utils/parseApiError'

export function Notificacoes() {
  const [modalAberto, setModalAberto] = useState(false)

  const { data: todas = [], isLoading, isError, error } = useNotificacoes()
  const { data: preferencias } = usePreferencias()
  const { mutate: lerTudo, isPending: lendoTudo } = useMarcarTodasLidas()

  const visiveis = todas.filter((n) => {
    if (!preferencias) return true
    if (n.tipo === 'marketing' && !preferencias.marketing) return false
    if (n.tipo === 'sistema' && !preferencias.sistema) return false
    return true
  })

  const temNaoLida = visiveis.some((n) => !n.lida)

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-lg">

        {/* Header da página */}
        <div className="flex items-center justify-between px-4 py-5">
          <h1 className="text-xl font-bold text-zinc-100">Notificações</h1>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalAberto(true)}
              className="flex size-9 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Preferências"
            >
              <Settings size={18} />
            </button>

            <button
              onClick={() => lerTudo()}
              disabled={!temNaoLida || lendoTudo || visiveis.length === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-violet-400 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Ler tudo
            </button>
          </div>
        </div>

        <div className="border-t border-zinc-800">

          {/* Loading */}
          {isLoading && (
            <div className="space-y-px">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-4">
                  <div className="size-9 shrink-0 animate-pulse rounded-full bg-zinc-800" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
                    <div className="h-2.5 w-1/2 animate-pulse rounded bg-zinc-800" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Erro */}
          {isError && (
            <div className="flex flex-col items-center gap-1 py-20 text-center">
              <p className="text-sm text-red-400">Erro ao carregar notificações</p>
              <p className="text-xs text-zinc-600">{parseApiError(error)}</p>
            </div>
          )}

          {/* Vazio */}
          {!isLoading && !isError && visiveis.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-24 text-center">
              <p className="text-sm text-zinc-500">Nenhuma notificação</p>
            </div>
          )}

          {/* Lista */}
          {!isLoading && !isError && visiveis.length > 0 && (
            <div className="divide-y divide-zinc-800/60">
              {visiveis.map((n) => (
                <NotificacaoItem key={n.id} notificacao={n} />
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Modal de preferências */}
      {modalAberto && preferencias && (
        <ModalPreferencias
          preferencias={preferencias}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </ClienteLayout>
  )
}
