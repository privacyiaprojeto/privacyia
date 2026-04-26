import { X, Wallet, Coins, ArrowDownCircle, Loader2, CheckCircle, Landmark, QrCode } from 'lucide-react'
import type { SaldoAtriz, MetodoRecebimento } from '@/features/atriz/financeiro/types'

interface Props {
  saldo: SaldoAtriz
  metodo: MetodoRecebimento | undefined
  isPending: boolean
  onConfirmar: () => void
  onFechar: () => void
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function MetodoInfo({ metodo }: { metodo: MetodoRecebimento }) {
  if (metodo.tipo === 'pix') {
    return (
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-emerald-500/10 p-2.5">
          <QrCode size={18} className="text-emerald-400" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-300">PIX</p>
          <p className="mt-0.5 text-sm text-zinc-500">{metodo.chave}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3">
      <div className="shrink-0 rounded-xl bg-blue-500/10 p-2.5">
        <Landmark size={18} className="text-blue-400" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-sm font-medium text-zinc-300">{metodo.banco}</p>
        <p className="mt-0.5 text-sm text-zinc-500">
          Ag. {metodo.agencia} · Conta {metodo.conta}
        </p>
      </div>
    </div>
  )
}

export function ModalSolicitarSaque({ saldo, metodo, isPending, onConfirmar, onFechar }: Props) {
  const total = saldo.disponivel + saldo.ganhoCreditos

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onFechar}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-5">
          <h2 className="text-base font-semibold text-zinc-100">Solicitar saque</h2>
          <button
            onClick={onFechar}
            className="rounded-xl p-1.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Composição do saque */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Composição do saque
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Wallet size={15} className="text-emerald-400" strokeWidth={1.75} />
                  <span className="text-sm text-zinc-300">Saldo disponível</span>
                </div>
                <span className="text-sm font-semibold text-zinc-200">
                  {formatCurrency(saldo.disponivel)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-zinc-900 px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Coins size={15} className="text-amber-400" strokeWidth={1.75} />
                  <div>
                    <span className="text-sm text-zinc-300">Ganho por créditos</span>
                    <p className="text-xs text-zinc-600">
                      {saldo.creditosGastos.toLocaleString('pt-BR')} créditos × R$0,10
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-zinc-200">
                  {formatCurrency(saldo.ganhoCreditos)}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                <span className="text-sm font-semibold text-zinc-200">Total</span>
                <span className="text-lg font-bold text-emerald-400">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Dados de recebimento */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Dados de recebimento
            </p>
            <div className="rounded-xl bg-zinc-900 px-4 py-3">
              {metodo ? (
                <MetodoInfo metodo={metodo} />
              ) : (
                <p className="text-sm text-zinc-500">Nenhum método cadastrado.</p>
              )}
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              Para alterar os dados de recebimento, acesse Configurações → Dados bancários.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-zinc-800 px-6 py-5">
          <button
            onClick={onFechar}
            disabled={isPending}
            className="flex-1 rounded-2xl border border-zinc-700 py-3 text-sm font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200 disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={isPending || !metodo || total <= 0}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <CheckCircle size={16} strokeWidth={2} />
            )}
            {isPending ? 'Solicitando…' : 'Confirmar saque'}
          </button>
        </div>
      </div>
    </div>
  )
}
