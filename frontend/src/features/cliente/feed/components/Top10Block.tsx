import { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AtrizCardCompact } from '@/features/cliente/components/AtrizCardCompact'
import type { Top10Item } from '@/features/cliente/feed/types'

interface Top10BlockProps {
  items: Top10Item[]
}

export function Top10Block({ items }: Top10BlockProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'right' ? 220 : -220, behavior: 'smooth' })
  }

  return (
    <div className="space-y-2">
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Top 10
      </h3>

      <div className="relative">
        <button
          type="button"
          onClick={() => scroll('left')}
          className="absolute -left-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg transition hover:bg-zinc-700"
        >
          <ChevronLeft size={16} />
        </button>

        <div
          ref={scrollRef}
          className="w-full overflow-x-auto px-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex w-max items-end gap-3">
            {items.map((item) => (
              <AtrizCardCompact key={item.atriz.id} atriz={item.atriz} posicao={item.posicao} />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scroll('right')}
          className="absolute -right-3 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 shadow-lg transition hover:bg-zinc-700"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}
