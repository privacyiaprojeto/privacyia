import { useState } from 'react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { TopCreators } from '@/features/cliente/descobrir/components/TopCreators'
import { SecaoRow } from '@/features/cliente/descobrir/components/SecaoRow'
import { AtrizCard } from '@/features/cliente/descobrir/components/AtrizCard'
import { mockAtrizes } from '@/mocks/data/atrizes'
import { secoes } from '@/mocks/data/secoes'
import clsx from 'clsx'

type Tab = 'descobrir' | 'buscar'

const topCreators = mockAtrizes.slice(0, 5)

export function Descobrir() {
  const [tab, setTab] = useState<Tab>('descobrir')
  const [busca, setBusca] = useState('')

  const atrizesFiltradas = busca.trim()
    ? mockAtrizes.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()))
    : mockAtrizes

  return (
    <ClienteLayout>
      <div className="flex flex-col">

        {/* Tab bar */}
        <div className="flex items-center justify-center gap-0 border-b border-zinc-800 bg-zinc-950 py-3">
          <button
            onClick={() => setTab('descobrir')}
            className={clsx(
              'px-6 text-sm font-medium transition',
              tab === 'descobrir' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Descobrir
          </button>

          <span className="text-zinc-700">|</span>

          <button
            onClick={() => setTab('buscar')}
            className={clsx(
              'px-6 text-sm font-medium transition',
              tab === 'buscar' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            Buscar
          </button>
        </div>

        {/* Aba Descobrir */}
        {tab === 'descobrir' && (
          <div className="flex flex-col pb-4">
            <TopCreators atrizes={topCreators} />
            {secoes.map((secao) => (
              <SecaoRow key={secao.id} secao={secao} />
            ))}
          </div>
        )}

        {/* Aba Buscar */}
        {tab === 'buscar' && (
          <div className="flex flex-col gap-3 px-3 pt-4">
            <input
              type="text"
              placeholder="Buscar atriz..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500"
            />
            <div className="grid grid-cols-4 gap-1.5">
              {atrizesFiltradas.map((atriz) => (
                <AtrizCard key={atriz.id} atriz={atriz} />
              ))}
            </div>
          </div>
        )}

      </div>
    </ClienteLayout>
  )
}
