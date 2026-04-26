import type { Secao } from '@/features/cliente/descobrir/types'

interface SecaoRowProps {
  secao: Secao
}

export function SecaoRow({ secao }: SecaoRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-sm font-bold text-white">{secao.titulo}</h2>
        <button className="text-xs text-zinc-500 hover:text-zinc-300 transition">Ver mais &rsaquo;</button>
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
        {secao.atrizes.map((atriz) => (
          <div key={atriz.id} className="flex-none w-24 cursor-pointer">
            <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-zinc-900">
              <video
                src={atriz.videoUrl}
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-4">
                <p className="truncate text-[9px] font-semibold text-white">{atriz.nome}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
