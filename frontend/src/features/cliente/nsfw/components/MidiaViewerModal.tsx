import { X } from 'lucide-react'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

interface MidiaViewerModalProps {
  item: ItemGerado | null
  onClose: () => void
}

function isAudioItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()

  return (
    value.includes('audio') ||
    value.endsWith('.mp3') ||
    value.endsWith('.wav') ||
    value.endsWith('.ogg') ||
    value.endsWith('.m4a')
  )
}

function isVideoItem(tipo?: string, url?: string) {
  const value = `${tipo || ''} ${url || ''}`.toLowerCase()

  return (
    value.includes('video') ||
    value.endsWith('.mp4') ||
    value.endsWith('.webm') ||
    value.endsWith('.mov')
  )
}

export function MidiaViewerModal({ item, onClose }: MidiaViewerModalProps) {
  if (!item?.url) return null

  const isAudio = isAudioItem(item.tipo, item.url)
  const isVideo = isVideoItem(item.tipo, item.url)

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 px-4 py-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Fechar visualização"
      >
        <X size={20} />
      </button>

      <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-zinc-950 p-4 shadow-2xl">
        <div className="mb-3">
          <p className="text-sm font-semibold text-white">{item.atrizNome || 'Mídia'}</p>
        </div>

        {isAudio ? (
          <div className="rounded-2xl bg-zinc-900 p-6">
            <audio controls autoPlay className="w-full">
              <source src={item.url} />
              Seu navegador não suporta reprodução de áudio.
            </audio>
          </div>
        ) : isVideo ? (
          <div className="flex justify-center rounded-2xl bg-black">
            <video
              key={item.id}
              src={item.url}
              controls
              autoPlay
              playsInline
              preload="auto"
              className="max-h-[80vh] w-full rounded-2xl object-contain"
            >
              <source src={item.url} type="video/mp4" />
              Seu navegador não suporta reprodução de vídeo.
            </video>
          </div>
        ) : (
          <div className="flex justify-center">
            <img
              src={item.url}
              alt={item.atrizNome || 'Imagem gerada'}
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
          </div>
        )}
      </div>
    </div>
  )
}
