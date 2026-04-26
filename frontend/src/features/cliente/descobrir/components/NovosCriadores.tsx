import { useRef } from 'react'
import { Link } from 'react-router'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface NovosCriadoresProps {
  atrizes: AtrizPerfil[]
}

export function NovosCriadores({ atrizes }: NovosCriadoresProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const hasDragged = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true
    hasDragged.current = false
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0)
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX.current) * 1.2
    if (Math.abs(walk) > 5) {
      hasDragged.current = true
      e.preventDefault()
      scrollRef.current.scrollLeft = scrollLeft.current - walk
    }
  }

  function stopDrag() {
    isDragging.current = false
  }

  function onClickCapture(e: React.MouseEvent) {
    if (hasDragged.current) {
      e.preventDefault()
      e.stopPropagation()
      hasDragged.current = false
    }
  }

  return (
    <div className="mt-6">
      <div className="flex items-center px-4 pb-3">
        <h2 className="text-sm font-bold text-white">Novos Criadores</h2>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClickCapture={onClickCapture}
        className="flex gap-4 overflow-x-auto px-4 pb-3 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none"
      >
        {atrizes.map((atriz) => {
          const routeId = atriz.id || atriz.slug

          return (
            <Link
              key={atriz.id}
              to={`/cliente/atriz/${routeId}`}
              className="flex flex-none flex-col items-center gap-1.5"
            >
              <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-zinc-700">
                <img
                  src={atriz.avatar}
                  alt={atriz.nome}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </div>
              <span className="w-24 truncate text-center text-[10px] text-zinc-400">
                {atriz.nome}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
