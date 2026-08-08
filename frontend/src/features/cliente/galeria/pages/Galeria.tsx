import { useState } from 'react'
import { Filter, Images, LibraryBig, Search, Sparkles, WalletCards } from 'lucide-react'
import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { GaleriaEntregaCard } from '@/features/cliente/galeria/components/GaleriaEntregaCard'
import { useGaleriaPage } from '@/features/cliente/galeria/hooks/useGaleriaPage'
import { MidiaViewerModal } from '@/features/cliente/nsfw/components/MidiaViewerModal'
import type { GaleriaEntrega } from '@/features/cliente/galeria/types'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

const filtros = [
  { id: 'todos', label: 'Todos' },
  { id: 'imagem', label: 'Imagens' },
  { id: 'video', label: 'Vídeos' },
  { id: 'audio', label: 'Áudios' },
] as const

function getBlockedMediaMessage(entrega: GaleriaEntrega) {
  const contract = entrega.mediaContract

  if (!contract) return null
  if (contract.clientOpenable !== false) return null

  return contract.userMessage || 'Esta mídia ainda não está disponível para abertura protegida.'
}

function deliveryToItem(entrega: GaleriaEntrega): ItemGerado | null {
  if (getBlockedMediaMessage(entrega)) return null
  if (!entrega.protectedViewUrl) return null

  return {
    id: entrega.id,
    atrizId: entrega.companion?.id || '',
    atrizNome: entrega.companion?.name || 'Avatar',
    tipo: entrega.asset?.mediaType || entrega.combination?.mediaType || 'imagem',
    url: entrega.protectedViewUrl,
    status: entrega.mediaPlayback?.mediaStatus === 'processing' ? 'em_andamento' : entrega.mediaPlayback?.mediaStatus === 'unavailable' ? 'erro' : 'concluido',
    mediaStatus: entrega.mediaPlayback?.mediaStatus || 'ready',
    streamKind: entrega.mediaPlayback?.streamKind || null,
    mediaMessage: entrega.mediaPlayback?.userMessage || null,
    progresso: 100,
    criadaEm: entrega.createdAt || new Date().toISOString(),
    denunciado: true,
  }
}

export function Galeria() {
  const { busca, setBusca, tipo, setTipo, entregas, resumo, isLoading } = useGaleriaPage()
  const [midiaAtiva, setMidiaAtiva] = useState<ItemGerado | null>(null)
  const [mensagemBloqueio, setMensagemBloqueio] = useState<string | null>(null)

  function abrirEntrega(entrega: GaleriaEntrega) {
    const blockedMessage = getBlockedMediaMessage(entrega)

    if (blockedMessage) {
      setMensagemBloqueio(blockedMessage)
      return
    }

    const item = deliveryToItem(entrega)

    if (item) {
      setMidiaAtiva(item)
      return
    }

    setMensagemBloqueio('Esta mídia ainda não está disponível para abertura protegida.')
  }

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-violet-950/30 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-violet-300/80">
                <LibraryBig size={15} />
                Biblioteca do Cliente
              </div>
              <h1 className="text-2xl font-bold text-zinc-100">Minhas compras e gerações</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
                Aqui ficam apenas as mídias já liberadas para sua conta. Elas podem ser diferentes do Histórico da personagem, que também mostra prévias, cenas do perfil e itens em preparação. Reabrir uma mídia comprada não consome créditos novamente.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[420px]">
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                <div className="flex justify-center text-violet-300"><Images size={18} /></div>
                <p className="mt-1 text-lg font-bold text-zinc-100">{resumo.total}</p>
                <p className="text-[11px] text-zinc-500">Itens</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                <div className="flex justify-center text-violet-300"><Sparkles size={18} /></div>
                <p className="mt-1 text-lg font-bold text-zinc-100">{resumo.avatars}</p>
                <p className="text-[11px] text-zinc-500">Avatares</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-black/20 p-3">
                <div className="flex justify-center text-violet-300"><WalletCards size={18} /></div>
                <p className="mt-1 text-lg font-bold text-zinc-100">{resumo.totalCreditos}</p>
                <p className="text-[11px] text-zinc-500">Créditos pagos</p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Buscar por avatar, pose, cenário..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-11 w-full rounded-2xl border border-zinc-700 bg-zinc-900 pl-9 pr-3 text-sm text-zinc-200 placeholder-zinc-500 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500/40"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-950/60 p-1">
            <Filter size={14} className="ml-2 shrink-0 text-zinc-500" />
            {filtros.map((filtro) => (
              <button
                key={filtro.id}
                type="button"
                onClick={() => setTipo(filtro.id)}
                className={clsx(
                  'whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition',
                  tipo === filtro.id
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
                )}
              >
                {filtro.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-96 animate-pulse rounded-3xl bg-zinc-900" />
            ))}
          </div>
        )}

        {!isLoading && entregas.length === 0 && (
          <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/60 px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
              <LibraryBig size={26} />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-zinc-100">Nenhuma mídia comprada ainda</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
              Quando você confirmar uma combinação no Gerar Imagem, a entrega aparecerá aqui para reabrir sem nova cobrança.
            </p>
          </div>
        )}

        {!isLoading && entregas.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {entregas.map((entrega) => (
              <GaleriaEntregaCard key={entrega.id} entrega={entrega} onOpen={abrirEntrega} />
            ))}
          </div>
        )}
      </div>

      {mensagemBloqueio && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-zinc-950 p-6 text-center shadow-2xl">
            <h2 className="text-lg font-semibold text-zinc-100">Mídia em preparação</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{mensagemBloqueio}</p>
            <button
              type="button"
              onClick={() => setMensagemBloqueio(null)}
              className="mt-5 rounded-2xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      <MidiaViewerModal item={midiaAtiva} onClose={() => setMidiaAtiva(null)} />
    </ClienteLayout>
  )
}
