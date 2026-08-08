import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { TopCreators } from '@/features/cliente/descobrir/components/TopCreators'
import { BombandoNoChat } from '@/features/cliente/descobrir/components/BombandoNoChat'
import { NovosCriadores } from '@/features/cliente/descobrir/components/NovosCriadores'
import { RumoAoTopo } from '@/features/cliente/descobrir/components/RumoAoTopo'
import { AtrizCardHorizontal } from '@/features/cliente/components/AtrizCardHorizontal'
import { useDescobrir } from '@/features/cliente/descobrir/hooks/useDescobrir'

export function Descobrir() {
  const {
    tab,
    setTab,
    busca,
    setBusca,
    atrizesFiltradas,
    topCreators,
    bombandoNoChat,
    novosCriadores,
    rumoAoTopo,
    recentes,
    isLoading,
    isError,
  } = useDescobrir()

  const hasCreators = topCreators.length > 0

  return (
    <ClienteLayout>
      <div className="mx-auto w-full max-w-4xl flex flex-col">

        <div className="flex items-center justify-center gap-0 border-b border-zinc-800 bg-zinc-950 py-3">
          <button
            onClick={() => setTab('descobrir')}
            className={clsx('px-6 text-sm font-medium transition', tab === 'descobrir' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
          >
            Descobrir
          </button>
          <span className="text-zinc-700">|</span>
          <button
            onClick={() => setTab('buscar')}
            className={clsx('px-6 text-sm font-medium transition', tab === 'buscar' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300')}
          >
            Buscar
          </button>
        </div>

        {tab === 'descobrir' && (
          <div className="flex flex-col pb-4">
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 px-4 py-6 md:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="aspect-[3/4] animate-pulse rounded-xl bg-zinc-900" />
                ))}
              </div>
            ) : !hasCreators ? (
              <div className="mx-4 mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-10 text-center">
                <p className="text-sm font-semibold text-zinc-300">Nenhuma criadora disponível agora.</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {isError ? 'Não foi possível atualizar a vitrine neste momento.' : 'Novos perfis aparecerão quando tiverem produtos publicados.'}
                </p>
              </div>
            ) : (
              <>
                <TopCreators atrizes={topCreators} />
                <BombandoNoChat atrizes={bombandoNoChat} />
                <NovosCriadores atrizes={novosCriadores} />
                <RumoAoTopo atrizes={rumoAoTopo} />
              </>
            )}
          </div>
        )}

        {tab === 'buscar' && (
          <div className="flex flex-col gap-4 px-4 pt-4">
            <input
              type="text"
              placeholder="Buscar atriz..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            {isLoading ? (
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-xl bg-zinc-900" />
                ))}
              </div>
            ) : busca.trim() ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-zinc-400">Resultados</p>
                <div className="grid grid-cols-3 gap-2">
                  {atrizesFiltradas.map((atriz) => (
                    <AtrizCardHorizontal key={atriz.id} atriz={atriz} />
                  ))}
                </div>
                {atrizesFiltradas.length === 0 && (
                  <p className="py-8 text-center text-xs text-zinc-500">Nenhuma criadora encontrada.</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-zinc-400">Atrizes recentes</p>
                <div className="grid grid-cols-3 gap-2">
                  {recentes.map((atriz) => (
                    <AtrizCardHorizontal key={atriz.id} atriz={atriz} />
                  ))}
                </div>
                {recentes.length === 0 && (
                  <p className="py-8 text-center text-xs text-zinc-500">Nenhuma criadora disponível agora.</p>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </ClienteLayout>
  )
}
