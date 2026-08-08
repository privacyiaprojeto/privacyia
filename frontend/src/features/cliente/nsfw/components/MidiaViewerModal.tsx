import { X } from 'lucide-react'
import type { ItemGerado } from '@/features/cliente/nsfw/types'
import { ProtectedMedia } from '@/features/cliente/media/components/ProtectedMedia'
import type { MediaAvailabilityStatus, MediaStreamKind } from '@/features/cliente/media/api/protectedPlaybackApi'

interface MidiaViewerModalProps {
  item: ItemGerado | null
  onClose: () => void
}

function isAudioItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()
  return value.includes('audio') || /\.(mp3|wav|ogg|m4a)(\?|$)/.test(value)
}

function isVideoItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()
  return value.includes('video') || value.includes('live_action') || /\.(mp4|webm|mov|m3u8)(\?|$)/.test(value)
}

function resolveMediaStatus(item: ItemGerado): MediaAvailabilityStatus {
  if (item.mediaStatus) return item.mediaStatus
  if (item.status === 'em_andamento') return 'processing'
  if (item.status === 'erro') return 'unavailable'
  return item.url ? 'ready' : 'unavailable'
}

export function MidiaViewerModal({ item, onClose }: MidiaViewerModalProps) {
  if (!item) return null

  const isAudio = isAudioItem(item.tipo, item.url)
  const isVideo = isVideoItem(item.tipo, item.url)
  const mediaType = isAudio ? 'audio' : isVideo ? 'video' : 'image'
  const mediaStatus = resolveMediaStatus(item)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 px-4 py-6" onContextMenu={(event) => event.preventDefault()}>
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Fechar visualização"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">{item.atrizNome || 'Mídia'}</p>
          <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            {mediaStatus === 'ready' ? 'Disponível' : mediaStatus === 'processing' ? 'Em preparação' : 'Indisponível'}
          </span>
        </div>

        <ProtectedMedia
          sourceUrl={item.url}
          mediaType={mediaType}
          mediaStatus={mediaStatus}
          streamKind={(item.streamKind || null) as MediaStreamKind}
          alt={item.atrizNome || 'Imagem protegida'}
          controls
          autoPlay={mediaStatus === 'ready'}
          muted={false}
          playsInline
          preload="metadata"
          stateMessage={item.mediaMessage || null}
          containerClassName={isAudio ? 'rounded-2xl bg-zinc-900 p-6' : 'flex min-h-[220px] max-h-[80vh] justify-center overflow-hidden rounded-2xl bg-black'}
          className={isAudio ? 'w-full' : 'max-h-[80vh] w-full object-contain'}
        />
      </div>
    </div>
  )
}
