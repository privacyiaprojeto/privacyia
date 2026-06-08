import { Flag, ImageIcon, Loader2, Music4, PlayCircle, Video } from 'lucide-react'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

interface PainelGeradosProps {
  items: ItemGerado[]
  isLoading: boolean
  onDenunciar: (id: string) => void
  onOpenItem?: (item: ItemGerado) => void
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

function isAudioItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()

  return (
    value.includes('audio') ||
    value.endsWith('.mp3') ||
    value.endsWith('.wav') ||
    value.endsWith('.ogg') ||
    value.endsWith('.m4a')
  )
}

function isVideoItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()

  return (
    value.includes('video') ||
    value.endsWith('.mp4') ||
    value.endsWith('.webm') ||
    value.endsWith('.mov')
  )
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

function GridMidia({ item, onOpenItem }: { item: ItemGerado; onOpenItem?: (item: ItemGerado) => void }) {
  const audio = isAudioItem(item.tipo, item.url)
  const video = isVideoItem(item.tipo, item.url)

  return (
    <button
      type="button"
      onClick={() => onOpenItem?.(item)}
      className="group relative block w-full overflow-hidden rounded-xl bg-zinc-900 text-left transition hover:ring-1 hover:ring-violet-500/70"
      disabled={!item.url}
      aria-label={video ? 'Abrir vídeo gerado' : audio ? 'Abrir áudio gerado' : 'Abrir mídia gerada'}
    >
      {audio && (
        <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 bg-zinc-950 text-zinc-300">
          <Music4 size={30} />
          <span className="text-xs font-medium">Reproduzir áudio</span>
        </div>
      )}

      {video && item.url && (
        <div className="relative aspect-[3/4] w-full bg-black">
          <video
            src={item.url}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/10">
            <PlayCircle className="h-11 w-11 text-white/90 drop-shadow" />
          </div>
        </div>
      )}

      {!audio && !video && item.url && (
        <img
          src={item.url}
          alt="Gerado"
          className="aspect-[3/4] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
      )}

      {!item.url && (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-zinc-950 text-zinc-600">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
        <p className="text-xs font-medium text-zinc-200">{item.atrizNome}</p>
        <p className="text-[10px] text-zinc-400">{formatarData(item.criadaEm)}</p>
      </div>
    </button>
  )
}

export function PainelGerados({ items, isLoading, onDenunciar, onOpenItem, variant = 'list' }: PainelGeradosProps) {
  const emAndamento = items.filter((i) => i.status === 'em_andamento')
  const concluidos = items.filter((i) => i.status === 'concluido')

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

      {concluidos.length > 0 && (
        variant === 'grid' ? (
          <div className="grid grid-cols-2 gap-2">
            {concluidos.map((item) => (
              <div key={item.id} className="relative">
                <GridMidia item={item} onOpenItem={onOpenItem} />

                {!item.denunciado && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDenunciar(item.id)
                    }}
                    className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 rounded-lg bg-black/50 px-2 py-1 text-[10px] text-zinc-300 transition hover:bg-red-500/30 hover:text-red-400"
                  >
                    <Flag size={10} />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {concluidos.map((item) => {
              const audio = isAudioItem(item.tipo, item.url)
              const video = isVideoItem(item.tipo, item.url)

              return (
                <div key={item.id} className="flex gap-3 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-3">
                  <button
                    type="button"
                    onClick={() => onOpenItem?.(item)}
                    className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-950"
                    disabled={!item.url}
                    aria-label={video ? 'Abrir vídeo gerado' : audio ? 'Abrir áudio gerado' : 'Abrir mídia gerada'}
                  >
                    {audio && (
                      <div className="flex h-full w-full items-center justify-center text-zinc-400">
                        <Music4 size={22} />
                      </div>
                    )}
                    {video && item.url && (
                      <>
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                          <PlayCircle className="h-7 w-7 text-white/90" />
                        </div>
                      </>
                    )}
                    {!audio && !video && item.url && (
                      <img src={item.url} alt="Gerado" className="h-full w-full object-cover" />
                    )}
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.atrizNome}</p>
                      <p className="text-xs text-zinc-500">{formatarData(item.criadaEm)}</p>
                    </div>
                    {!item.denunciado ? (
                      <button
                        type="button"
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
              )
            })}
          </div>
        )
      )}
    </div>
  )
}
