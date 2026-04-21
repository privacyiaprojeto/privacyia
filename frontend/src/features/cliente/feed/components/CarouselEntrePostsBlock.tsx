import { useRef } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AtrizCardCompact } from '@/features/cliente/components/AtrizCardCompact'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface CarouselEntrePostsBlockProps {
  atrizes: AtrizPerfil[]
}

export function CarouselEntrePostsBlock({ atrizes }: CarouselEntrePostsBlockProps) {
  const quatro = atrizes.slice(0, 4)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 220 : -220, behavior: 'smooth' })
  }

  return (
    <div className="relative">
      {/* Botão esquerda */}
      <button
        type="button"
        onClick={() => scroll('left')}
        className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg transition hover:bg-zinc-700"
      >
        <ChevronLeft size={16} />
      </button>

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto px-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex w-max items-end gap-3">
          {quatro.map((atriz) => (
            <AtrizCardCompact key={atriz.id} atriz={atriz} />
          ))}

          {/* 5º slot — "ver mais" */}
          <Link
            to="/cliente/descobrir"
            className="group flex w-52 flex-col items-center gap-2"
          >
            <div className="flex aspect-[4/5] w-full items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800 transition group-hover:border-violet-500">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 ring-1 ring-violet-500 transition group-hover:bg-violet-600">
                  <ChevronRight size={20} className="text-violet-400 transition group-hover:text-white" />
                </div>
                <span className="text-xs font-semibold text-zinc-400 transition group-hover:text-violet-300">
                  Ver mais
                </span>
              </div>
            </div>
            <span className="w-52 select-none text-center text-xs text-transparent">·</span>
          </Link>
        </div>
      </div>

      {/* Botão direita */}
      <button
        type="button"
        onClick={() => scroll('right')}
        className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg transition hover:bg-zinc-700"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}
