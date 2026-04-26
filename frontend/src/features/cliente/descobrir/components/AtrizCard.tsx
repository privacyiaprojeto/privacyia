import { useRef } from 'react'
import { useNavigate } from 'react-router'
import type { MockAtriz } from '@/mocks/data/atrizes'

interface AtrizCardProps {
  atriz: MockAtriz & {
    id: string
    slug?: string
    nome: string
    videoUrl?: string
    avatar?: string
  }
}

export function AtrizCard({ atriz }: AtrizCardProps) {
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleMouseEnter() {
    videoRef.current?.play()
  }

  function handleMouseLeave() {
    const video = videoRef.current
    if (!video) return
    video.pause()
    video.currentTime = 0
  }

  function handleOpenProfile() {
    const routeId = atriz.slug || atriz.id
    navigate(`/cliente/atriz/${routeId}`)
  }

  return (
    <button
      type="button"
      onClick={handleOpenProfile}
      className="group relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-zinc-900 text-left"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {atriz.videoUrl ? (
        <video
          ref={videoRef}
          src={atriz.videoUrl}
          loop
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      )}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-6">
        <p className="truncate text-[11px] font-semibold text-white">{atriz.nome}</p>
      </div>
    </button>
  )
}