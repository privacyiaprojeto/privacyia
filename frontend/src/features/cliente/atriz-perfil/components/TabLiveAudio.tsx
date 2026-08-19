import { useMemo, useState } from 'react'
import { Play, Crown, Volume2, ShoppingBag, Loader2, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { AudioLivePlayerState } from '@/features/cliente/atriz-perfil/hooks/useAudioLiveClientBridge'
import type { AtrizPerfilPublico, LiveAudioItem } from '@/features/cliente/atriz-perfil/types'
import { ProtectedMedia } from '@/features/cliente/media/components/ProtectedMedia'

type AbaAudio = 'stories' | 'outfits'

interface Props {
  atriz: AtrizPerfilPublico
  onTocar?: (item: LiveAudioItem) => void
  onComprar?: (item: LiveAudioItem) => void
  playingId?: string | null
  purchasingId?: string | null
  player?: AudioLivePlayerState
}

function getPrimeiroNome(nome: string) {
  return String(nome || 'Avatar').split(' ')[0] || 'Avatar'
}

function priceLabel(value?: number | null) {
  const credits = Number(value || 0)
  return credits > 0 ? `${credits} créditos` : 'Premium'
}

function mediaStatusLabel(item: LiveAudioItem) {
  if (item.mediaStatus === 'processing') return 'Em preparação'
  if (item.mediaStatus === 'unavailable') return 'Indisponível'
  if (item.protectedViewUrl && item.mediaContract?.clientOpenable === true) return 'Disponível'
  return item.mediaStatus === 'ready' ? 'Preview disponível' : 'Indisponível'
}

function isExplicitLiveAudioItem(item: LiveAudioItem) {
  const mediaType = String(item.mediaContract?.mediaType || item.mediaType || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')

  return mediaType === 'audio_live' || mediaType === 'live_audio'
}

function AudioRow({
  atrizNome,
  item,
  onTocar,
  onComprar,
  playingId,
  purchasingId,
  player,
}: {
  atrizNome: string
  item: LiveAudioItem
  onTocar?: (item: LiveAudioItem) => void
  onComprar?: (item: LiveAudioItem) => void
  playingId?: string | null
  purchasingId?: string | null
  player?: AudioLivePlayerState
}) {
  const isActive = player?.item?.id === item.id || playingId === item.id
  const isLoading = isActive && player?.status === 'loading'
  const isPurchasing = purchasingId === item.id
  const hasProtectedDelivery = Boolean(item.protectedViewUrl) && item.mediaContract?.clientOpenable === true
  const productionBlocked = item.mediaStatus !== 'ready'
    || (!hasProtectedDelivery && item.mediaContract?.clientPurchasable !== true)
  const contractMessage = item.mediaContract?.userMessage || (productionBlocked ? 'Esta mídia ainda está em preparação.' : 'A entrega protegida depende do acesso comercial.')

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 transition hover:border-pink-500/30 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-zinc-100">{item.titulo}</span>
            {!hasProtectedDelivery && <Crown size={14} className="shrink-0 text-pink-500" />}
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {item.descricao || `Áudio narrativo exclusivo de ${getPrimeiroNome(atrizNome)}.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            <span>{item.duracao}</span>
            <span className="h-1 w-1 rounded-full bg-zinc-700" />
            <span>{mediaStatusLabel(item)}</span>
            {item.mediaStatus === 'ready' && !hasProtectedDelivery && <><span className="h-1 w-1 rounded-full bg-zinc-700" /><span>{priceLabel(item.priceCredits)}</span></>}
          </div>
        </div>

        {hasProtectedDelivery ? (
          <button
            type="button"
            onClick={() => onTocar?.(item)}
            disabled={isLoading}
            aria-label={`Ouvir ${item.titulo}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-600 transition hover:bg-pink-500 disabled:opacity-50"
          >
            {isLoading ? <Loader2 size={13} className="animate-spin text-white" /> : <Play size={13} className="fill-white text-white" />}
          </button>
        ) : productionBlocked ? (
          <button
            type="button"
            disabled
            title={contractMessage}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-400 opacity-80"
          >
            <AlertCircle size={12} />
            {item.mediaStatus === 'processing' ? 'Preparando' : 'Indisponível'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComprar?.(item)}
            disabled={isPurchasing}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 rounded-full bg-pink-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-pink-500 disabled:opacity-50',
              !onComprar && 'cursor-default opacity-80 hover:bg-pink-600',
            )}
          >
            <ShoppingBag size={12} />
            {isPurchasing ? 'Preparando...' : 'Comprar'}
          </button>
        )}
      </div>

      {isActive && player?.status === 'loading' && (
        <div className="mt-3 rounded-xl border border-pink-500/20 bg-pink-500/5 px-3 py-2 text-xs text-pink-100">Abrindo Audio Live protegido...</div>
      )}

      {isActive && player?.status === 'error' && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{player.error || 'Não foi possível abrir o Audio Live agora.'}</span>
        </div>
      )}

    </div>
  )
}

export function TabLiveAudio({ atriz, onTocar, onComprar, playingId, purchasingId, player }: Props) {
  const [aba, setAba] = useState<AbaAudio>('stories')
  const liveAudios = useMemo(() => atriz.liveAudios.filter(isExplicitLiveAudioItem), [atriz.liveAudios])
  const featured = useMemo(() => liveAudios[0] || null, [liveAudios])

  return (
    <div className="flex h-full gap-6">
      <div className="relative flex w-[45%] shrink-0 flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-zinc-950 via-zinc-900 to-pink-950/30 p-5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.2),_transparent_42%)]" />
        <div className="relative flex items-center gap-3">
          <img src={atriz.avatar} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-pink-500" />
          <div>
            <p className="text-sm font-semibold text-white">{getPrimeiroNome(atriz.nome)}</p>
            <p className="text-xs text-zinc-500">Audio Live</p>
          </div>
        </div>

        <div className="relative my-5 flex flex-1 items-center justify-center">
          <div className="w-full rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur-sm">
            <div className="mb-4 flex items-center gap-2 text-pink-300">
              <Volume2 size={18} />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Preview publicado</span>
            </div>
            <p className="text-lg font-semibold text-zinc-100">{featured?.titulo || 'Nenhum áudio publicado'}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{featured?.descricao || 'Quando o Admin publicar um áudio para esta vitrine, ele aparecerá aqui.'}</p>
            <ProtectedMedia
              sourceUrl={featured?.previewUrl}
              mediaType="audio"
              mediaStatus={featured?.mediaStatus || 'unavailable'}
              streamKind={featured?.streamKind || null}
              stateMessage={featured?.mediaContract?.userMessage || 'Nenhum preview de áudio disponível.'}
              controls
              preload="metadata"
              containerClassName="mt-5 rounded-2xl bg-zinc-950/70 p-3"
              className="w-full"
            />
          </div>
        </div>

        <p className="relative text-[11px] text-zinc-600">A reprodução usa token temporário e não faz download integral via Blob.</p>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {(['stories', 'outfits'] as AbaAudio[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={clsx(
                'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-semibold transition',
                aba === tab ? 'border-b-2 border-pink-500 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {tab === 'stories' ? <><Volume2 size={14} /> Audio Live</> : <><span className="text-base leading-none">👗</span> Outfits</>}
            </button>
          ))}
        </div>

        {aba === 'stories' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="px-1 py-3">
              <p className="text-sm font-semibold text-zinc-200">Áudios publicados</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Os cards respeitam o asset aprovado e o estado real da mídia.</p>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {liveAudios.map((item) => (
                <AudioRow key={item.id} atrizNome={atriz.nome} item={item} onTocar={onTocar} onComprar={onComprar} playingId={playingId} purchasingId={purchasingId} player={player} />
              ))}
              {liveAudios.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-zinc-300">Nenhum Audio Live publicado ainda.</p>
                  <p className="mt-1 text-xs text-zinc-500">Quando o Admin publicar uma narração para esta vitrine, ela aparecerá aqui.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {aba === 'outfits' && <div className="flex flex-1 items-center justify-center text-zinc-600"><span className="text-sm">Em breve</span></div>}
      </div>
    </div>
  )
}
