import { useMemo, useState } from 'react'
import { Play, Volume2, VolumeX, ShoppingBag, AlertCircle } from 'lucide-react'
import clsx from 'clsx'
import type { AtrizPerfilPublico, LiveActionItem } from '@/features/cliente/atriz-perfil/types'
import { ProtectedMedia } from '@/features/cliente/media/components/ProtectedMedia'

interface Props {
  atriz: AtrizPerfilPublico
  onExecutar?: (item: LiveActionItem) => void
  onComprar?: (item: LiveActionItem) => void
  executingId?: string | null
  purchasingId?: string | null
}

function getPrimeiroNome(nome: string) {
  return String(nome || 'Avatar').split(' ')[0] || 'Avatar'
}

function priceLabel(value?: number | null) {
  const credits = Number(value || 0)
  return credits > 0 ? `${credits} créditos` : 'Premium'
}

function statusLabel(item: LiveActionItem) {
  if (item.mediaStatus === 'processing') return 'Em preparação'
  if (item.mediaStatus === 'unavailable') return 'Indisponível'
  if (item.purchased && item.protectedViewUrl) return 'Disponível'
  return item.mediaStatus === 'ready' ? 'Preview disponível' : 'Indisponível'
}

function isLiveActionOpenableByContract(item: LiveActionItem) {
  const renderer = String(item.mediaContract?.protectedRenderer || '').toLowerCase()
  return Boolean(
    item.protectedViewUrl &&
    item.mediaContract?.clientOpenable === true &&
    (renderer === 'video' || renderer === 'live_action')
  )
}

function AcaoRow({
  atrizNome,
  item,
  onExecutar,
  onComprar,
  executingId,
  purchasingId,
}: {
  atrizNome: string
  item: LiveActionItem
  onExecutar?: (item: LiveActionItem) => void
  onComprar?: (item: LiveActionItem) => void
  executingId?: string | null
  purchasingId?: string | null
}) {
  const isExecuting = executingId === item.id
  const isPurchasing = purchasingId === item.id
  const contractOpenable = isLiveActionOpenableByContract(item)
  const productionBlocked = item.mediaStatus !== 'ready'
  const locked = !contractOpenable
  const title = item.titulo || item.nome
  const contractMessage = item.mediaContract?.userMessage || (productionBlocked ? 'Esta mídia ainda está em preparação.' : 'A entrega protegida depende do acesso comercial.')

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3 transition hover:border-violet-500/30 hover:bg-zinc-900">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-100">{title}</span>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">
            {item.descricao || `Cena narrativa exclusiva de ${getPrimeiroNome(atrizNome)}.`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
            {item.duracao && <span>{item.duracao}</span>}
            {item.duracao && <span className="h-1 w-1 rounded-full bg-zinc-700" />}
            <span>{statusLabel(item)}</span>
            {item.mediaStatus === 'ready' && locked && <><span className="h-1 w-1 rounded-full bg-zinc-700" /><span>{priceLabel(item.priceCredits)}</span></>}
          </div>
        </div>

        {contractOpenable ? (
          <button
            type="button"
            onClick={() => onExecutar?.(item)}
            disabled={isExecuting}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-600 transition hover:bg-pink-500 disabled:opacity-50"
          >
            <Play size={13} className="fill-white text-white" />
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
              'flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-violet-500 disabled:opacity-50',
              !onComprar && 'cursor-default opacity-80 hover:bg-violet-600',
            )}
          >
            <ShoppingBag size={12} />
            {isPurchasing ? 'Preparando...' : 'Comprar'}
          </button>
        )}
      </div>

      {!contractOpenable && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs text-violet-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>{contractMessage}</span>
        </div>
      )}
    </div>
  )
}

export function TabLiveAction({ atriz, onExecutar, onComprar, executingId, purchasingId }: Props) {
  const [muted, setMuted] = useState(true)
  const featured = useMemo(() => atriz.liveActions[0] || null, [atriz.liveActions])

  return (
    <div className="flex h-full gap-4">
      <div className="relative w-[45%] shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
        <ProtectedMedia
          sourceUrl={featured?.previewUrl}
          mediaType="video"
          mediaStatus={featured?.mediaStatus || 'unavailable'}
          streamKind={featured?.streamKind || null}
          stateMessage={featured?.mediaContract?.userMessage || 'Nenhum preview de Live Action disponível.'}
          autoPlay
          loop
          muted={muted}
          controls={false}
          playsInline
          poster={atriz.avatar}
          containerClassName="h-full w-full overflow-hidden bg-zinc-950"
          className="h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-3">
          <div className="flex items-center gap-2">
            <img src={atriz.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-violet-500" />
            <span className="text-sm font-semibold text-white">{getPrimeiroNome(atriz.nome)}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">{atriz.nivelAtual}</span>
          </div>
          {featured?.mediaStatus === 'ready' && (
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              aria-label={muted ? 'Ativar som' : 'Silenciar'}
            >
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-100">Live Action</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">Vitrine narrativa</span>
        </div>

        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-sm font-semibold text-zinc-200">Cenas publicadas</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">Cada card usa exclusivamente o asset aprovado e seu preview. Enquanto a rendition não existir, a mídia permanece em preparação.</p>
        </div>

        <div className="flex-1 overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            {atriz.liveActions.map((item) => (
              <AcaoRow key={item.id} atrizNome={atriz.nome} item={item} onExecutar={onExecutar} onComprar={onComprar} executingId={executingId} purchasingId={purchasingId} />
            ))}
            {atriz.liveActions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-zinc-300">Nenhum Live Action publicado ainda.</p>
                <p className="mt-1 text-xs text-zinc-500">Quando o Admin publicar um produto para esta vitrine, ele aparecerá aqui.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
