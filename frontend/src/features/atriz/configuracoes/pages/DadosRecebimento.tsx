import { Landmark, QrCode, Wallet } from 'lucide-react'
import { useCreatorFinance } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { creatorStatusLabel, creatorStatusTone } from '@/features/atriz/creator/utils'

export function DadosRecebimento() {
  const financeQuery = useCreatorFinance()
  const method = financeQuery.data?.payoutMethod

  if (financeQuery.isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
  }

  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex items-center gap-3 pb-2">
        <Wallet size={20} className="text-zinc-500" strokeWidth={1.75} />
        <p className="text-sm text-zinc-500">Confira os dados usados para seus futuros repasses</p>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5">{method?.type === 'pix' ? <QrCode size={18} className="text-emerald-400" strokeWidth={1.75} /> : <Landmark size={18} className="text-blue-400" strokeWidth={1.75} />}</div>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{method?.type === 'pix' ? 'Chave PIX' : 'Dados de recebimento'}</p>
              <p className="mt-0.5 text-sm text-zinc-500">{method?.pixKeyMasked || method?.bankName || 'Nenhum método cadastrado.'}</p>
              {method?.accountLast4 && <p className="mt-0.5 text-xs text-zinc-600">Conta final {method.accountLast4}</p>}
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${creatorStatusTone(method?.status)}`}>{creatorStatusLabel(method?.status)}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-sm font-semibold text-zinc-100">Cadastro seguro</p>
        <p className="mt-1 text-sm text-zinc-500">O backend atual permite consultar o método aprovado, mas ainda não possui uma rota segura para cadastrar ou alterar a chave PIX pelo painel. Por isso, nenhum dado financeiro é enviado diretamente do navegador.</p>
        <span className="mt-4 inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">Aguardando integração</span>
      </div>
    </div>
  )
}
