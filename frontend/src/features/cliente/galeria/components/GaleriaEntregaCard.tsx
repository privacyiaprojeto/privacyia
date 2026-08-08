import { CalendarDays, Coins, Eye, Image, Music4, PlayCircle, RotateCcw, Sparkles } from 'lucide-react'
import type { GaleriaEntrega, GaleriaMediaContract } from '@/features/cliente/galeria/types'

interface GaleriaEntregaCardProps {
  entrega: GaleriaEntrega
  onOpen: (entrega: GaleriaEntrega) => void
}

function formatDate(value?: string | null) {
  if (!value) return 'Data não informada'

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function mediaLabel(value?: string | null) {
  const normalized = String(value || '').toLowerCase()
  if (['imagem', 'image', 'foto', 'photo', 'picture'].includes(normalized)) return 'Imagem'
  if (normalized.includes('video') || normalized.includes('vídeo') || normalized.includes('live_action')) return 'Vídeo'
  if (normalized.includes('audio') || normalized.includes('áudio') || normalized.includes('voice') || normalized.includes('live_audio')) return 'Áudio'
  return value || 'Mídia'
}



function MediaIcon({ mediaType }: { mediaType?: string | null }) {
  const normalized = String(mediaType || '').toLowerCase()
  if (normalized.includes('audio') || normalized.includes('áudio') || normalized.includes('voice')) return <Music4 size={22} />
  if (normalized.includes('video') || normalized.includes('vídeo') || normalized.includes('live_action')) return <PlayCircle size={24} />
  return <Image size={22} />
}

export function GaleriaEntregaCard({ entrega, onOpen }: GaleriaEntregaCardProps) {
  const mediaType = entrega.asset?.mediaType || entrega.combination?.mediaType
  const signature = entrega.combination?.signaturePath || []
  const title = entrega.combination?.title || signature.join(' • ') || 'Produto comprado'
  const avatarName = entrega.companion?.name || 'Avatar'
  const credits = Number(entrega.pricing?.totalPriceCredits || 0)
  const playbackStatus = entrega.mediaPlayback?.mediaStatus || (entrega.mediaContract?.clientOpenable === false ? 'unavailable' : 'ready')
  const isBlockedByContract = playbackStatus !== 'ready'
  const statusTitle = playbackStatus === 'processing' ? 'Em preparação' : playbackStatus === 'unavailable' ? 'Indisponível' : 'Abrir protegido'
  const statusSubtitle = playbackStatus === 'processing' ? 'O streaming será liberado quando estiver pronto' : playbackStatus === 'unavailable' ? 'Esta mídia não pode ser aberta agora' : 'Você já comprou este item'


  return (
    <article
      className="group overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950/70 shadow-xl shadow-black/10 transition hover:border-violet-500/40 hover:bg-zinc-900/80"
    >
      <button
        type="button"
        onClick={() => onOpen(entrega)}
        className="relative flex aspect-[4/5] w-full items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-950 via-zinc-900 to-violet-950/30 text-zinc-400"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.18),_transparent_38%)]" />
        <div className="relative flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-300">
            <MediaIcon mediaType={mediaType} />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">{statusTitle}</p>
            <p className="mt-1 text-xs text-zinc-500">{statusSubtitle}</p>
          </div>
        </div>

        <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200 backdrop-blur">
          {mediaLabel(mediaType)}
        </div>

        <div className="absolute bottom-3 right-3 rounded-full border border-emerald-400/20 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200 backdrop-blur">
          Já é seu
        </div>
      </button>

      <div className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <img
            src={entrega.companion?.avatarUrl || entrega.companion?.thumbnailUrl || '/vite.svg'}
            alt={avatarName}
            className="h-9 w-9 rounded-full object-cover ring-1 ring-zinc-700"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">{avatarName}</p>
            <p className="truncate text-xs text-zinc-500">{title}</p>
          </div>
        </div>


        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Coins size={13} />
              Pago
            </div>
            <p className="mt-1 font-semibold text-zinc-100">{credits} créditos</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <CalendarDays size={13} />
              Compra
            </div>
            <p className="mt-1 truncate font-semibold text-zinc-100">{formatDate(entrega.createdAt)}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(entrega)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          <Eye size={15} />
          {isBlockedByContract ? 'Ver aviso' : 'Reabrir sem cobrar'}
        </button>

        <div className="flex items-center gap-2 text-[11px] text-zinc-500">
          <RotateCcw size={12} />
          Reabrir este item não gera nova cobrança.
        </div>
      </div>
    </article>
  )
}
