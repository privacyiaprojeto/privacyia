import { useState } from 'react'
import { Images, Video, Image, ShieldCheck, Users, Music } from 'lucide-react'
import { useCreatorProducts } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { creatorMediaTypeLabel, formatCreatorDate } from '@/features/atriz/creator/utils'

type Filtro = 'todos' | 'image' | 'outros'

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'image', label: 'Imagens' },
  { value: 'outros', label: 'Áudios e vídeos' },
]

function productFilter(mediaType: string) {
  return String(mediaType || '').toLowerCase() === 'image' ? 'image' : 'outros'
}

export function Galeria() {
  const { data, isLoading, isError } = useCreatorProducts()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const items = data?.products || []

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <div key={f.value} className="h-8 w-20 animate-pulse rounded-xl bg-zinc-800" />
          ))}
        </div>
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-zinc-900" />
          ))}
        </div>
      </div>
    )
  }

  if (isError || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Images size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Nenhum produto publicado ainda</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Os produtos aprovados e liberados pelo Admin aparecerão aqui para sua conferência.
        </p>
      </div>
    )
  }

  const filtered = filtro === 'todos' ? items : items.filter((item) => productFilter(item.mediaType) === filtro)
  const totalVariants = data?.summary?.totalApprovedVariants || 0
  const totalDeliveries = data?.summary?.totalDeliveries || 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-200">{items.length}</span> produtos ativos
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-pink-400" />
            <span className="font-semibold text-zinc-200">{totalVariants}</span> variações aprovadas
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-blue-400" />
            <span className="font-semibold text-zinc-200">{totalDeliveries}</span> vendas
          </span>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-zinc-900 p-1">
          {FILTROS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFiltro(f.value)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filtro === f.value
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Images size={28} className="text-zinc-700" strokeWidth={1.5} />
          <p className="mt-3 text-sm text-zinc-500">Nenhum produto para este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {filtered.map((item) => {
            const normalizedMediaType = String(item.mediaType || '').toLowerCase()
            const Icon = normalizedMediaType === 'image' ? Image : normalizedMediaType === 'audio' ? Music : Video

            return (
              <div key={item.id} className="group relative overflow-hidden rounded-2xl bg-zinc-900">
                <div className="aspect-square w-full bg-zinc-800">
                  <div className="relative flex h-full w-full items-center justify-center">
                    <div className="rounded-2xl bg-zinc-900/80 p-5">
                      <Icon size={28} className="text-zinc-400" strokeWidth={1.5} />
                    </div>
                  </div>
                </div>

                <div className="absolute left-2 top-2">
                  <span className="flex items-center gap-1 rounded-lg bg-pink-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    <ShieldCheck size={9} /> Publicado
                  </span>
                </div>

                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="flex items-center gap-1 text-xs text-zinc-300">
                    <Icon size={10} />
                    <span>{item.title}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {creatorMediaTypeLabel(item.mediaType)} • {item.priceCredits} créditos • {item.totalDeliveries} venda(s)
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">Atualizado em {formatCreatorDate(item.updatedAt)}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
