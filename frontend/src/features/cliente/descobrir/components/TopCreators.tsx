import { useRef } from 'react'
import { Link } from 'react-router'
import type { Atriz } from '@/shared/types/atriz'

interface TopCreatorsProps {
  atrizes: Atriz[]
}

function shouldRenderVideo(atriz: Atriz) {
  return Boolean(
    atriz.videoUrl &&
    atriz.videoUrl !== atriz.avatar &&
    atriz.videoUrl !== atriz.banner &&
    atriz.videoUrl !== atriz.thumbnailUrl
  )
}

export function TopCreators({ atrizes }: TopCreatorsProps) {
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
        onClickCapture={onClickCapture}
        className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none">
        {atrizes.map((atriz, index) => {
          const routeId = atriz.id || atriz.slug

          return (
            <Link key={atriz.id} to={`/cliente/atriz/${routeId}`} className="relative flex-none w-46 cursor-pointer">
              {/* Número grande */}
              <span className="absolute left-3 bottom-6 z-10 text-5xl font-black leading-none text-white select-none">
                {index + 1}
              </span>

              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-zinc-900">
                {shouldRenderVideo(atriz) ? (
                  <video
                    src={atriz.videoUrl}
                    muted
                    autoPlay
                    loop
                    playsInline
                    poster={atriz.thumbnailUrl ?? atriz.avatar}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={atriz.thumbnailUrl ?? atriz.avatar}
                    alt={atriz.nome}
                    draggable={false}
                    className="h-full w-full object-cover"
                  />
                )}
                {/* Gradiente + nome */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
                  <p className="truncate text-[10px] font-semibold text-white">{atriz.nome}</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
