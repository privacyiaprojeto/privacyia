import { useNavigate } from 'react-router'
import { Wallet, TrendingUp, ArrowDownCircle, Clock, CheckCircle, Coins } from 'lucide-react'
import { useCreatorFinance } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { creatorMediaTypeLabel, creatorStatusLabel, creatorStatusTone, formatCreatorCredits, formatCreatorDate } from '@/features/atriz/creator/utils'

export function Financeiro() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useCreatorFinance()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
      </div>
    )
  }

  if (!data || isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Wallet size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Nenhuma venda ainda</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Seus repasses e vendas aparecerão aqui quando os clientes comprarem seus produtos.
        </p>
      </div>
    )
  }

  const payoutMethod = data.payoutMethod
  const payoutMethodDescription = payoutMethod.type === 'pix'
    ? payoutMethod.pixKeyMasked || 'Chave PIX não informada'
    : payoutMethod.bankName
      ? `${payoutMethod.bankName}${payoutMethod.accountLast4 ? ` • final ${payoutMethod.accountLast4}` : ''}`
      : 'Dados de recebimento ainda não cadastrados'

  return (
    <div className="space-y-6">
      {/* Cards de saldo — mesma composição visual do layout original */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <Wallet size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCreatorCredits(data.summary.netPayoutCredits)}</p>
          <p className="mt-1 text-sm text-zinc-500">Repasse estimado</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-amber-500/10 p-2.5">
            <Coins size={18} className="text-amber-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">
            {formatCreatorCredits(data.summary.grossCredits)}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Receita bruta</p>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            {data.summary.estimated ? 'Valor calculado com seu percentual atual' : 'Valor confirmado'}
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-zinc-700/60 p-2.5">
            <Clock size={18} className="text-zinc-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{data.summary.totalSales.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-sm text-zinc-500">Vendas registradas</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-blue-500/10 p-2.5">
            <TrendingUp size={18} className="text-blue-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCreatorCredits(data.summary.averageTicketCredits)}</p>
          <p className="mt-1 text-sm text-zinc-500">Média por venda</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-medium text-zinc-400">Vendas recentes</p>
          <div className="space-y-3">
            {data.recentSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <TrendingUp size={28} className="text-zinc-700" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-zinc-500">Nenhuma venda ainda.</p>
              </div>
            ) : data.recentSales.slice(0, 6).map((sale) => (
              <div key={sale.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">{sale.productTitle}</p>
                  <p className="text-xs text-zinc-500">{creatorMediaTypeLabel(sale.mediaType)} · {formatCreatorDate(sale.createdAt)}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-400">
                  +{formatCreatorCredits(sale.netPayoutCredits)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-medium text-zinc-400">Dados de recebimento</p>
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300">{payoutMethod.type === 'pix' ? 'PIX' : 'Método de repasse'}</p>
                <p className="text-xs text-zinc-500">{payoutMethodDescription}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${creatorStatusTone(payoutMethod.status)}`}>
                <CheckCircle size={11} /> {creatorStatusLabel(payoutMethod.status)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-300">Fechamento financeiro</p>
                <p className="text-xs text-zinc-500">O pagamento real depende da integração do histórico de repasses.</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
                <Clock size={11} /> Em preparação
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/atriz/configuracoes?section=pagamentos')}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 active:bg-emerald-600"
          >
            <ArrowDownCircle size={20} strokeWidth={2} />
            Ver dados de recebimento
          </button>
        </div>
      </div>
    </div>
  )
}
