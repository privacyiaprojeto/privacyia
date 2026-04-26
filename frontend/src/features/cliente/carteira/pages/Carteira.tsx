import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { SaldoCard } from '@/features/cliente/carteira/components/SaldoCard'
import { PacotesCreditos } from '@/features/cliente/carteira/components/PacotesCreditos'
import { MetodosPagamento } from '@/features/cliente/carteira/components/MetodosPagamento'
import { HistoricoCreditos } from '@/features/cliente/carteira/components/HistoricoCreditos'
import { HistoricoPagamentos } from '@/features/cliente/carteira/components/HistoricoPagamentos'
import { useCarteiraPage } from '@/features/cliente/carteira/hooks/useCarteiraPage'

type AbaHistorico = 'creditos' | 'pagamentos'

export function Carteira() {
  const {
    resumo,
    transacoes,
    pagamentos,
    metodos,
    pacotes,
    comprando,
    loadingResumo,
    loadingCreditos,
    loadingPagamentos,
    pacoteSelecionado,
    metodoSelecionado,
    abaHistorico,
    setPacoteSelecionado,
    setMetodoSelecionado,
    setAbaHistorico,
    handleComprar,
  } = useCarteiraPage()

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">

        <h1 className="text-xl font-bold text-zinc-100">Carteira</h1>

        {loadingResumo && (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
        )}
        {resumo && <SaldoCard resumo={resumo} />}

        <div className="h-px bg-zinc-800" />

        <PacotesCreditos
          pacotes={pacotes}
          metodos={metodos}
          pacoteSelecionado={pacoteSelecionado}
          metodoSelecionado={metodoSelecionado}
          onSelecionarPacote={setPacoteSelecionado}
          onSelecionarMetodo={setMetodoSelecionado}
          onComprar={handleComprar}
          isLoading={comprando}
        />

        <div className="h-px bg-zinc-800" />

        <MetodosPagamento metodos={metodos} />

        <div className="h-px bg-zinc-800" />

        <div className="space-y-4">
          <div className="flex rounded-xl border border-zinc-700 bg-zinc-800 p-1">
            {(['creditos', 'pagamentos'] as AbaHistorico[]).map((aba) => (
              <button
                key={aba}
                onClick={() => setAbaHistorico(aba)}
                className={
                  abaHistorico === aba
                    ? 'flex-1 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white transition'
                    : 'flex-1 py-2 text-xs text-zinc-500 transition hover:text-zinc-300'
                }
              >
                {aba === 'creditos' ? 'Créditos' : 'Pagamentos'}
              </button>
            ))}
          </div>

          {abaHistorico === 'creditos' && (
            loadingCreditos ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-800" />
                ))}
              </div>
            ) : (
              <HistoricoCreditos transacoes={transacoes} />
            )
          )}

          {abaHistorico === 'pagamentos' && (
            loadingPagamentos ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-zinc-800" />
                ))}
              </div>
            ) : (
              <HistoricoPagamentos pagamentos={pagamentos} />
            )
          )}
        </div>

      </div>
    </ClienteLayout>
  )
}