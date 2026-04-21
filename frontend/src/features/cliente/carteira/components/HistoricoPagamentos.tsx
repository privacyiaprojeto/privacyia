import { Receipt } from 'lucide-react'
import { clsx } from 'clsx'
import type { HistoricoPagamento, StatusPagamento } from '@/features/cliente/carteira/types'

interface HistoricoPagamentosProps {
  pagamentos: HistoricoPagamento[]
}

const statusLabel: Record<StatusPagamento, string> = {
  aprovado: 'Aprovado',
  pendente: 'Pendente',
  recusado: 'Recusado',
}

const statusClass: Record<StatusPagamento, string> = {
  aprovado: 'bg-emerald-500/10 text-emerald-400',
  pendente: 'bg-amber-500/10 text-amber-400',
  recusado: 'bg-rose-500/10 text-rose-400',
}

function formatarData(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function HistoricoPagamentos({ pagamentos }: HistoricoPagamentosProps) {
  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <Receipt size={15} className="text-violet-400" />
        Histórico de pagamentos
      </h2>

      {pagamentos.length === 0 && (
        <p className="text-xs text-zinc-600">Nenhum pagamento encontrado.</p>
      )}

      <div className="divide-y divide-zinc-800 overflow-hidden rounded-xl border border-zinc-700">
        {pagamentos.map((p) => (
          <div key={p.id} className="flex items-center gap-3 bg-zinc-800/40 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-zinc-200">{p.descricao}</p>
              <p className="text-xs text-zinc-500">{formatarData(p.criadaEm)}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {p.valor > 0 && (
                <span className="text-sm font-semibold text-zinc-200">
                  R$ {p.valor.toFixed(2).replace('.', ',')}
                </span>
              )}
              <span className={clsx('rounded-full px-2 py-0.5 text-[10px] font-medium', statusClass[p.status])}>
                {statusLabel[p.status]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
