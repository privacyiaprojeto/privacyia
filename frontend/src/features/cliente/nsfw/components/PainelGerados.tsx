import { Flag, ImageIcon, Video } from 'lucide-react'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

interface PainelGeradosProps {
  items: ItemGerado[]
  isLoading: boolean
  onDenunciar: (id: string) => void
  variant?: 'list' | 'grid'
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function ItemAndamento({ item }: { item: ItemGerado }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-violet-600/10">
        {item.tipo === 'imagem' ? (
          <ImageIcon size={18} className="text-violet-400" />
        ) : (
          <Video size={18} className="text-violet-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-200">{item.atrizNome}</span>
          <span className="text-xs text-violet-400">{item.progresso}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full rounded-full bg-violet-600 transition-all"
            style={{ width: `${item.progresso}%` }}
          />
        </div>
        {item.eta != null && (
          <p className="mt-1 text-xs text-zinc-500">~{item.eta}s restantes</p>
        )}
      </div>
    </div>
  )
}

export function PainelGerados({ items, isLoading, onDenunciar, variant = 'list' }: PainelGeradosProps) {
  const emAndamento = items.filter((i) => i.status === 'em_andamento')
  const concluidos = items.filter((i) => i.status === 'concluido')
  const comErro = items.filter((i) => i.status === 'erro')

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-zinc-300">Gerados</h2>

      {isLoading && (
        <div className="flex justify-center py-6 text-sm text-zinc-500">Carregando…</div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 py-8 text-center text-sm text-zinc-500">
          Nenhuma geração ainda.
        </div>
      )}

      {emAndamento.length > 0 && (
        <div className="space-y-2">
          {emAndamento.map((item) => (
            <div key={item.id} className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
              <ItemAndamento item={item} />
            </div>
          ))}
        </div>
      )}

      {comErro.map((item) => (
        <div key={item.id} className="overflow-hidden rounded-xl border border-red-900/40 bg-zinc-900 px-4 py-3">
          <span className="text-sm font-medium text-zinc-300">{item.atrizNome}</span>
          <p className="text-xs text-red-400">Erro na geração.</p>
        </div>
      ))}

      {concluidos.length > 0 && (
        variant === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {concluidos.map((item) => (
              <div key={item.id} className="relative overflow-hidden rounded-xl bg-zinc-900">
                {item.tipo === 'imagem' && item.url && (
                  <img src={item.url} alt="Gerado" className="aspect-[3/4] w-full object-cover" />
                )}
                {item.tipo === 'video' && item.url && (
                  <video
                    src={item.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="aspect-[3/4] w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs font-medium text-zinc-200">{item.atrizNome}</p>
                  <p className="text-[10px] text-zinc-400">{formatarData(item.criadaEm)}</p>
                </div>
                {!item.denunciado && (
                  <button
                    onClick={() => onDenunciar(item.id)}
                    className="absolute right-1.5 top-1.5 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-zinc-300 hover:bg-red-500/30 hover:text-red-400 transition"
                  >
                    <Flag size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {concluidos.map((item) => (
              <div key={item.id} className="flex gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                {item.tipo === 'imagem' && item.url && (
                  <img src={item.url} alt="Gerado" className="h-24 w-20 flex-shrink-0 rounded-lg object-cover" />
                )}
                {item.tipo === 'video' && item.url && (
                  <video src={item.url} autoPlay muted loop playsInline className="h-24 w-20 flex-shrink-0 rounded-lg object-cover" />
                )}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{item.atrizNome}</p>
                    <p className="text-xs text-zinc-500">{formatarData(item.criadaEm)}</p>
                  </div>
                  {!item.denunciado ? (
                    <button
                      onClick={() => onDenunciar(item.id)}
                      className="flex items-center gap-1 self-start rounded-lg px-2.5 py-1.5 text-xs text-zinc-500 transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Flag size={12} />
                      Denunciar
                    </button>
                  ) : (
                    <span className="self-start text-xs text-zinc-600">Denunciado</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
