import type { MockAtriz } from '@/mocks/data/atrizes'

interface TopCreatorsProps {
  atrizes: MockAtriz[]
}

export function TopCreators({ atrizes }: TopCreatorsProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-bold text-white">Top Creators</h2>
        <button className="text-xs text-zinc-500 hover:text-zinc-300 transition">Ver mais &rsaquo;</button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
        {atrizes.slice(0, 5).map((atriz, index) => (
          <div key={atriz.id} className="relative flex-none w-28 cursor-pointer">
            {/* Número grande */}
            <span className="absolute -left-1 bottom-6 z-10 text-5xl font-black leading-none text-white/20 select-none">
              {index + 1}
            </span>

            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900">
              <video
                src={atriz.videoUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              {/* Gradiente + nome */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                <p className="truncate text-[10px] font-semibold text-white">{atriz.nome}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
