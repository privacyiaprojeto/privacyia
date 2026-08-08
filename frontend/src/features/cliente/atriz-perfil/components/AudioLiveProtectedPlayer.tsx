import { X, Volume2, AlertCircle, Loader2 } from 'lucide-react'
import type { AudioLivePlayerState } from '@/features/cliente/atriz-perfil/hooks/useAudioLiveClientBridge'
import { ProtectedMedia } from '@/features/cliente/media/components/ProtectedMedia'

interface Props {
  player: AudioLivePlayerState
  onClose: () => void
}

export function AudioLiveProtectedPlayer({ player, onClose }: Props) {
  if (player.status === 'idle' || !player.item) return null

  const title = player.item.titulo || 'Audio Live'

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto w-[min(92vw,560px)] rounded-2xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-600/15 text-pink-400">
          {player.status === 'loading' ? <Loader2 size={18} className="animate-spin" /> : player.status === 'error' ? <AlertCircle size={18} /> : <Volume2 size={18} />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-100">{title}</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {player.status === 'loading' ? 'Abrindo áudio protegido...' : player.status === 'error' ? player.error || 'Não foi possível abrir agora.' : 'Audio Live liberado para este perfil.'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100" aria-label="Fechar Audio Live">
              <X size={15} />
            </button>
          </div>

          {player.status === 'playing' && player.audioUrl && (
            <ProtectedMedia
              sourceUrl={player.audioUrl}
              mediaType="audio"
              mediaStatus="ready"
              controls
              autoPlay
              containerClassName="mt-3 rounded-xl bg-zinc-900 p-2"
              className="w-full"
            />
          )}
        </div>
      </div>
    </div>
  )
}
