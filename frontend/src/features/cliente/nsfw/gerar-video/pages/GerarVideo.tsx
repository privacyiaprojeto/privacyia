import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { TabsGerarNsfw } from '@/features/cliente/nsfw/components/TabsGerarNsfw'
import { ModalSelecionarAtriz } from '@/features/cliente/nsfw/components/ModalSelecionarAtriz'
import { PromptAuto } from '@/features/cliente/nsfw/components/PromptAuto'
import { PainelGerados } from '@/features/cliente/nsfw/components/PainelGerados'
import { SeletorOpcoesVideo } from '@/features/cliente/nsfw/gerar-video/components/SeletorOpcoesVideo'
import { useGerarVideoPage } from '@/features/cliente/nsfw/gerar-video/hooks/useGerarVideoPage'
import { CUSTO_VIDEO } from '@/features/cliente/nsfw/types'

export function GerarVideo() {
  const {
    atrizes,
    atrizSelecionada,
    opcoes,
    gerados,
    creditosData,
    creditos,
    semCreditos,
    podeLancar,
    prompt,
    selecionadas,
    modalAberto,
    loadingAtrizes,
    loadingOpcoes,
    loadingGerados,
    gerarVideo,
    denunciarVideo,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    setModalAberto,
  } = useGerarVideoPage()

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <TabsGerarNsfw />

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* Painel de geração */}
          <div className="flex-1 space-y-5 lg:max-w-md">
            {/* Seletor de atriz */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">Atriz</p>
              {loadingAtrizes ? (
                <div className="h-36 w-28 animate-pulse rounded-2xl bg-zinc-800" />
              ) : atrizSelecionada ? (
                <button
                  onClick={() => setModalAberto(true)}
                  className="group relative overflow-hidden rounded-2xl ring-1 ring-zinc-700 transition hover:ring-violet-500"
                >
                  <img
                    src={atrizSelecionada.avatar}
                    alt={atrizSelecionada.nome}
                    className="h-36 w-28 object-cover"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-end bg-gradient-to-t from-black/80 to-transparent pb-2">
                    <span className="text-xs font-semibold text-white">{atrizSelecionada.nome}</span>
                    <span className="flex items-center gap-0.5 text-[10px] text-zinc-300">
                      Trocar <ChevronRight size={10} />
                    </span>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => setModalAberto(true)}
                  className="flex h-36 w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 hover:border-violet-500 hover:text-violet-400 transition"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">Atriz</span>
                </button>
              )}
            </div>

            {/* Personalize o vídeo */}
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wide">
                Personalize o vídeo
              </p>
              {loadingOpcoes ? (
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded-xl bg-zinc-800" />
                  <div className="flex gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 w-20 animate-pulse rounded-2xl bg-zinc-800" />
                    ))}
                  </div>
                </div>
              ) : (
                <SeletorOpcoesVideo
                  opcoes={opcoes}
                  selecionadas={selecionadas}
                  onToggle={toggleOpcao}
                />
              )}
            </div>

            {prompt && <PromptAuto prompt={prompt} />}

            {/* Footer de ação */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  Custo: <span className="font-medium text-zinc-200">{CUSTO_VIDEO} créditos</span>
                </span>
                {creditosData && (
                  <span className="text-zinc-500">Saldo: {creditos}</span>
                )}
              </div>

              <button
                disabled={!podeLancar}
                onClick={handleGerar}
                className={clsx(
                  'w-full rounded-xl py-3 text-sm font-semibold transition',
                  podeLancar
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'
                    : 'cursor-not-allowed bg-zinc-700 text-zinc-500',
                )}
              >
                {gerarVideo.isPending ? 'Gerando…' : 'Gerar vídeo'}
              </button>

              {semCreditos && atrizSelecionada && (
                <p className="text-center text-xs text-amber-400">
                  Créditos insuficientes.{' '}
                  <Link to="/cliente/carteira" className="underline hover:text-amber-300">
                    Recarregar
                  </Link>
                </p>
              )}

              {gerarVideo.isError && (
                <p className="text-center text-xs text-red-400">Erro ao gerar. Tente novamente.</p>
              )}
            </div>
          </div>

          {/* Painel de gerados */}
          <div className="flex-1">
            <PainelGerados
              items={gerados}
              isLoading={loadingGerados}
              onDenunciar={(id) => denunciarVideo.mutate(id)}
              variant="grid"
            />
          </div>
        </div>
      </div>

      {modalAberto && (
        <ModalSelecionarAtriz
          atrizes={atrizes}
          selecionadaId={atrizSelecionada?.id ?? null}
          onSelect={selecionarAtriz}
          onClose={() => setModalAberto(false)}
        />
      )}
    </ClienteLayout>
  )
}