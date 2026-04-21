import { ArrowDownLeft, ArrowUpRight, TrendingDown } from 'lucide-react'
import { clsx } from 'clsx'
import type { TransacaoCredito } from '@/features/cliente/carteira/types'

interface HistoricoCreditosProps {
  transacoes: TransacaoCredito[]
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoricoCreditos({ transacoes }: HistoricoCreditosProps) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <TrendingDown size={15} className="text-violet-400" />
        Histórico de créditos
      </h2>

      {transacoes.length === 0 && (
        <p className="text-xs text-zinc-600">Nenhuma movimentação encontrada.</p>
      )}

      <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-700">
        {transacoes.map((t) => (
          <div key={t.id} className="flex items-center gap-3 bg-zinc-800/40 px-4 py-3">
            <div
              className={clsx(
                'flex size-8 shrink-0 items-center justify-center rounded-full',
                t.tipo === 'entrada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400',
              )}
            >
              {t.tipo === 'entrada' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">{t.descricao}</p>
              <p className="text-xs text-zinc-500">{formatarData(t.criadaEm)}</p>
            </div>
            <span
              className={clsx(
                'shrink-0 text-sm font-semibold',
                t.tipo === 'entrada' ? 'text-emerald-400' : 'text-rose-400',
              )}
            >
              {t.tipo === 'entrada' ? '+' : '-'}{t.valor}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
