import { useState } from 'react'
import { Images, Video, Image, ShieldCheck, Users } from 'lucide-react'
import { useGaleria } from '@/features/atriz/galeria/hooks/useGaleria'
import type { OrigemGaleria } from '@/features/atriz/galeria/types'

type Filtro = 'todos' | OrigemGaleria

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const FILTROS: { value: Filtro; label: string }[] = [
  { value: 'todos',   label: 'Todos' },
  { value: 'admin',   label: 'Admin' },
  { value: 'cliente', label: 'Clientes' },
]

export function Galeria() {
  const { data: items, isLoading } = useGaleria()
  const [filtro, setFiltro] = useState<Filtro>('todos')

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

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Images size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Galeria vazia</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          As imagens e vídeos gerados pela IA aparecerão aqui.
        </p>
      </div>
    )
  }

  const filtered = filtro === 'todos' ? items : items.filter((i) => i.origem === filtro)
  const totalAdmin   = items.filter((i) => i.origem === 'admin').length
  const totalCliente = items.filter((i) => i.origem === 'cliente').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-zinc-500">
          <span>
            <span className="font-semibold text-zinc-200">{items.length}</span> itens no total
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-pink-400" />
            <span className="font-semibold text-zinc-200">{totalAdmin}</span> admin
          </span>
          <span className="flex items-center gap-1.5">
            <Users size={13} className="text-blue-400" />
            <span className="font-semibold text-zinc-200">{totalCliente}</span> clientes
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
          <p className="mt-3 text-sm text-zinc-500">Nenhum item para este filtro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {filtered.map((item) => (
            <div key={item.id} className="group relative overflow-hidden rounded-2xl bg-zinc-900">
              <div className="aspect-square w-full bg-zinc-800">
                {item.tipo === 'imagem' ? (
                  <img
                    src={item.url}
                    alt="Imagem gerada por IA"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="relative h-full w-full">
                    <video src={item.url} className="h-full w-full object-cover" muted />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video size={20} className="text-white/80" />
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute left-2 top-2">
                {item.origem === 'admin' ? (
                  <span className="flex items-center gap-1 rounded-lg bg-pink-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    <ShieldCheck size={9} /> Admin
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-lg bg-blue-500/80 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    <Users size={9} /> Cliente
                  </span>
                )}
              </div>

              <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 to-transparent p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-center gap-1 text-xs text-zinc-300">
                  {item.tipo === 'video' ? <Video size={10} /> : <Image size={10} />}
                  <span>{item.tipo === 'video' ? 'Vídeo' : 'Imagem'} gerado por IA</span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">{formatDate(item.criadaEm)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
