import { Link } from 'react-router'
import { ChevronRight, Loader2, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { TabsGerarNsfw } from '@/features/cliente/nsfw/components/TabsGerarNsfw'
import { ModalSelecionarAtriz } from '@/features/cliente/nsfw/components/ModalSelecionarAtriz'
import { MidiaViewerModal } from '@/features/cliente/nsfw/components/MidiaViewerModal'
import { ResumoEscolhaDinamica } from '@/features/cliente/nsfw/components/ResumoEscolhaDinamica'
import { PainelGerados } from '@/features/cliente/nsfw/components/PainelGerados'
import { SeletorOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/components/SeletorOpcoesImagem'
import { useGerarImagemPage } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGerarImagemPage'

export function GerarImagem() {
  const {
    atrizes,
    atrizSelecionada,
    opcoes,
    gerados,
    creditosData,
    creditos,
    semCreditos,
    podeLancar,
    custoAtualLabel,
    botaoGerarLabel,
    selecionadas,
    modalAberto,
    feedback,
    midiaAtiva,
    loadingAtrizes,
    loadingOpcoes,
    loadingGerados,
    gerarImagem,
    denunciarImagem,
    avatarSemProdutoPublicado,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    abrirMidia,
    fecharMidia,
    setModalAberto,
  } = useGerarImagemPage()

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <TabsGerarNsfw />

        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className="flex-1 space-y-5 lg:max-w-md">
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">Atriz</p>
              {loadingAtrizes ? (
                <div className="h-24 w-36 animate-pulse rounded-2xl bg-zinc-800" />
              ) : atrizSelecionada ? (
                <button
                  type="button"
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
                  type="button"
                  onClick={() => setModalAberto(true)}
                  className="flex h-36 w-28 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-700 text-zinc-500 transition hover:border-violet-500 hover:text-violet-400"
                >
                  <span className="text-2xl">+</span>
                  <span className="text-xs">Atriz</span>
                </button>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
                Personalize a cena
              </p>
              {!atrizSelecionada ? (
                <button
                  type="button"
                  onClick={() => setModalAberto(true)}
                  className="w-full rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-left transition hover:border-violet-500/70 hover:bg-zinc-900/70"
                >
                  <p className="text-sm font-semibold text-zinc-200">Escolha uma atriz primeiro</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                    As opções de pose, cenário, acessórios e visual serão carregadas conforme os produtos publicados pelo Admin.
                  </p>
                </button>
              ) : loadingOpcoes ? (
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded-xl bg-zinc-800" />
                  <div className="flex gap-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-24 w-20 animate-pulse rounded-2xl bg-zinc-800" />
                    ))}
                  </div>
                </div>
              ) : (
                <SeletorOpcoesImagem
                  opcoes={opcoes}
                  selecionadas={selecionadas}
                  onToggle={toggleOpcao}
                  emptyTitle={avatarSemProdutoPublicado ? 'Nenhum produto liberado para este avatar' : undefined}
                  emptyDescription={avatarSemProdutoPublicado
                    ? 'O Admin ainda não publicou uma combinação pronta para este avatar. Quando houver produto aprovado e publicado, as opções aparecerão aqui em cascata.'
                    : undefined}
                />
              )}
            </div>

            <ResumoEscolhaDinamica selecionadas={selecionadas} opcoes={opcoes} />

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">
                  Custo: <span className="font-medium text-zinc-200">{custoAtualLabel}</span>
                </span>
                {creditosData && (
                  <span className="text-zinc-500">Saldo: {creditos}</span>
                )}
              </div>

              <button
                type="button"
                disabled={!podeLancar}
                onClick={handleGerar}
                className={clsx(
                  'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition',
                  podeLancar
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-purple-500'
                    : 'cursor-not-allowed bg-zinc-700 text-zinc-500',
                )}
              >
                {gerarImagem.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Preparando mídia...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {botaoGerarLabel}
                  </>
                )}
              </button>

              {gerarImagem.isPending && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-3">
                  <p className="text-xs font-medium text-violet-200">
                    Estamos preparando sua solicitação. Aguarde a conclusão...
                  </p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div className="h-full w-2/3 animate-pulse rounded-full bg-gradient-to-r from-violet-500 to-purple-500" />
                  </div>
                </div>
              )}

              {feedback && !gerarImagem.isPending && (
                <div
                  className={clsx(
                    'rounded-xl border p-3 text-xs',
                    feedback.kind === 'success' && 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
                    feedback.kind === 'error' && 'border-amber-500/20 bg-amber-500/10 text-amber-200',
                    feedback.kind === 'processing' && 'border-violet-500/20 bg-violet-500/10 text-violet-200',
                  )}
                >
                  {feedback.message}
                </div>
              )}

              {semCreditos && atrizSelecionada && (
                <p className="text-center text-xs text-amber-400">
                  Créditos insuficientes.{' '}
                  <Link to="/cliente/carteira" className="underline hover:text-amber-300">
                    Recarregar
                  </Link>
                </p>
              )}
            </div>
          </div>

          <div className="flex-1">
            <PainelGerados
              items={gerados}
              isLoading={loadingGerados}
              onDenunciar={(id) => denunciarImagem.mutate(id)}
              onOpenItem={abrirMidia}
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

      <MidiaViewerModal item={midiaAtiva} onClose={fecharMidia} />
    </ClienteLayout>
  )
}
