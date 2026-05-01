import { useRef } from 'react'
import { useNavigate } from 'react-router'
import type { Atriz } from '@/shared/types/atriz'

interface AtrizCardProps {
  atriz: Atriz
}

export function AtrizCard({ atriz }: AtrizCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const navigate = useNavigate()

  function handleMouseEnter() {
    videoRef.current?.play()
  }

  function handleMouseLeave() {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }

  return (
    <div
      className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-zinc-900"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      // Lógica solicitada por Lorenzo: card preserva o layout original e abre o perfil da atriz.
      onClick={() => navigate(`/cliente/atriz/${atriz.id}`)}
    >
      <video
        ref={videoRef}
        src={atriz.videoUrl}
        loop
        muted
        playsInline
        preload="metadata"
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
      />

      {/* Nome */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
        <p className="truncate text-[11px] font-semibold text-white">{atriz.nome}</p>
      </div>
    </div>
  )
}
