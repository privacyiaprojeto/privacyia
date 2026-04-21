import { useState } from 'react'
import { Search } from 'lucide-react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { GaleriaAtrizCard } from '@/features/cliente/galeria/components/GaleriaAtrizCard'
import { useGaleria } from '@/features/cliente/galeria/hooks/useGaleria'
import { useDebounce } from '@/shared/hooks/useDebounce'

export function Galeria() {
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 300)
  const { data: atrizes = [], isLoading } = useGaleria(buscaDebounced || undefined)

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-zinc-100">Galeria</h1>

          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar atriz..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-9 w-48 rounded-full border border-zinc-700 bg-zinc-800 pl-8 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-16 text-sm text-zinc-500">
            Carregando galeria…
          </div>
        )}

        {/* Vazio */}
        {!isLoading && atrizes.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-20 text-zinc-500">
            <span className="text-sm">Nenhuma atriz encontrada.</span>
          </div>
        )}

        {/* Grid */}
        {atrizes.length > 0 && (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {atrizes.map((atriz) => (
              <GaleriaAtrizCard key={atriz.id} atriz={atriz} />
            ))}
          </div>
        )}

      </div>
    </ClienteLayout>
  )
}
