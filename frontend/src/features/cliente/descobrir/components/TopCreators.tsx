import { useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Atriz } from '@/shared/types/atriz'

interface TopCreatorsProps {
  atrizes: Atriz[]
}

export function TopCreators({ atrizes }: TopCreatorsProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)
  const navigate = useNavigate()

  function onMouseDown(e: React.MouseEvent) {
    isDragging.current = true
    startX.current = e.pageX - (scrollRef.current?.offsetLeft ?? 0)
    scrollLeft.current = scrollRef.current?.scrollLeft ?? 0
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!isDragging.current || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    const walk = (x - startX.current) * 1.2
    scrollRef.current.scrollLeft = scrollLeft.current - walk
  }

  function stopDrag() {
    isDragging.current = false
  }

  return (
    <div>
      <div className="flex items-center px-4 pb-2 pt-4">
        <h2 className="text-sm font-bold text-white">Top Creators</h2>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none">
        {atrizes.map((atriz, index) => (
          <div
            key={atriz.id}
            // Lógica solicitada por Lorenzo: card preserva a div original e abre o perfil da atriz.
            onClick={() => navigate(`/cliente/atriz/${atriz.id}`)}
            className="relative flex-none w-46 cursor-pointer"
          >
            {/* Número grande */}
            <span className="absolute left-3 bottom-6 z-10 text-5xl font-black leading-none text-white select-none">
              {index + 1}
            </span>

            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900">
              <video
                src={atriz.videoUrl}
                muted
                autoPlay
                loop
                playsInline
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
