import { ProtectedMedia } from '@/features/cliente/media/components/ProtectedMedia'
import type { MediaAvailabilityStatus, MediaStreamKind } from '@/features/cliente/media/api/protectedPlaybackApi'

interface PostMediaProps {
  tipo: 'foto' | 'video'
  url: string
  nome: string
  mediaStatus?: MediaAvailabilityStatus
  streamKind?: MediaStreamKind
  mediaMessage?: string | null
}

export function PostMedia({ tipo, url, nome, mediaStatus = 'ready', streamKind = null, mediaMessage }: PostMediaProps) {
  return (
    <div className="aspect-[4/5] w-full overflow-hidden bg-zinc-950">
      <ProtectedMedia
        sourceUrl={url}
        mediaType={tipo === 'video' ? 'video' : 'image'}
        mediaStatus={mediaStatus}
        streamKind={streamKind}
        stateMessage={mediaMessage}
        alt={`Post de ${nome}`}
        controls={tipo === 'video'}
        autoPlay={tipo === 'video'}
        muted
        loop={tipo === 'video'}
        playsInline
        preload="metadata"
        containerClassName="h-full w-full overflow-hidden bg-zinc-950"
        className="h-full w-full object-cover"
      />
    </div>
  )
}
