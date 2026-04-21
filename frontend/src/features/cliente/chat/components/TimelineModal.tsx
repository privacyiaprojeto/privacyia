import { X, Play, Images } from 'lucide-react'
import { useTimeline } from '@/features/cliente/chat/hooks/useTimeline'

interface Props {
  atrizId: string
  atrizNome: string
  onClose: () => void
}

export function TimelineModal({ atrizId, atrizNome, onClose }: Props) {
  const { data: timeline, isPending } = useTimeline(atrizId)

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <Images size={18} className="text-violet-400" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Timeline de <span className="text-violet-400">{atrizNome}</span>
          </h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          <X size={18} />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {isPending ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl bg-zinc-800" />
            ))}
          </div>
        ) : timeline?.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-zinc-600">
            <Images size={40} strokeWidth={1.5} />
            <p className="text-sm">Nenhum conteúdo gerado ainda</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {timeline?.map((media) => (
              <div
                key={media.id}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-zinc-800"
              >
                <img
                  src={media.url}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                {media.tipo === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                      <Play size={16} className="fill-white text-white" />
                    </div>
                  </div>
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  <p className="text-[10px] text-zinc-300">{media.criadaEm}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
