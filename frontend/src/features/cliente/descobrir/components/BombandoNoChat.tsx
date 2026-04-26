import { useRef } from 'react'
import type { AtrizPerfil } from '@/shared/types/atriz'
import { AtrizCardHorizontal } from '@/features/cliente/components/AtrizCardHorizontal'

interface BombandoNoChatProps {
  atrizes: AtrizPerfil[]
}

export function BombandoNoChat({ atrizes }: BombandoNoChatProps) {
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
    <div className="mt-4">
      <div className="flex items-center px-4 pb-2">
        <h2 className="text-sm font-bold text-white">Bombando no chat</h2>
      </div>

      <div
        ref={scrollRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
        onClickCapture={onClickCapture}
        className="grid grid-rows-2 grid-flow-col gap-x-3 gap-y-6 overflow-x-auto px-4 pb-4 scrollbar-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing select-none"
      >
        {atrizes.map((atriz) => (
          <div key={atriz.id} className="w-64 flex-none">
            <AtrizCardHorizontal atriz={atriz} />
          </div>
        ))}
      </div>
    </div>
  )
}
