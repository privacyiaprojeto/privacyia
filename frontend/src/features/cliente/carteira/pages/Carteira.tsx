import { useState } from 'react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { SaldoCard } from '@/features/cliente/carteira/components/SaldoCard'
import { PacotesCreditos } from '@/features/cliente/carteira/components/PacotesCreditos'
import { MetodosPagamento } from '@/features/cliente/carteira/components/MetodosPagamento'
import { HistoricoCreditos } from '@/features/cliente/carteira/components/HistoricoCreditos'
import { HistoricoPagamentos } from '@/features/cliente/carteira/components/HistoricoPagamentos'
import { useCarteira } from '@/features/cliente/carteira/hooks/useCarteira'
import { useHistoricoCreditos } from '@/features/cliente/carteira/hooks/useHistoricoCreditos'
import { useHistoricoPagamentos } from '@/features/cliente/carteira/hooks/useHistoricoPagamentos'
import { useMetodosPagamento } from '@/features/cliente/carteira/hooks/useMetodosPagamento'
import { usePacotes } from '@/features/cliente/carteira/hooks/usePacotes'
import { useComprarCreditos } from '@/features/cliente/carteira/hooks/useComprarCreditos'

type AbaHistorico = 'creditos' | 'pagamentos'

export function Carteira() {
  const [pacoteSelecionado, setPacoteSelecionado] = useState<string | null>(null)
  const [metodoSelecionado, setMetodoSelecionado] = useState<string | null>(null)
  const [abaHistorico, setAbaHistorico] = useState<AbaHistorico>('creditos')

  const { data: resumo, isLoading: loadingResumo } = useCarteira()
  const { data: transacoes = [], isLoading: loadingCreditos } = useHistoricoCreditos()
  const { data: pagamentos = [], isLoading: loadingPagamentos } = useHistoricoPagamentos()
  const { data: metodos = [] } = useMetodosPagamento()
  const { data: pacotes = [] } = usePacotes()
  const { mutate: comprar, isPending: comprando } = useComprarCreditos()

  function handleComprar() {
    if (!pacoteSelecionado || !metodoSelecionado) return
    comprar(
      { pacoteId: pacoteSelecionado, metodoId: metodoSelecionado },
      {
        onSuccess: () => {
          setPacoteSelecionado(null)
          setMetodoSelecionado(null)
        },
      },
    )
  }

  return (
    <ClienteLayout>
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">

        <h1 className="text-xl font-bold text-zinc-100">Carteira</h1>

        {/* Saldo */}
        {loadingResumo && (
          <div className="h-24 animate-pulse rounded-2xl bg-zinc-800" />
        )}
        {resumo && <SaldoCard resumo={resumo} />}

        <div className="h-px bg-zinc-800" />

        {/* Comprar créditos */}
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

        {/* Métodos de pagamento */}
        <MetodosPagamento metodos={metodos} />

        <div className="h-px bg-zinc-800" />

        {/* Abas de histórico */}
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
