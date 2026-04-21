import { Coins, Wallet } from 'lucide-react'
import type { CarteiraResumo } from '@/features/cliente/carteira/types'

interface SaldoCardProps {
  resumo: CarteiraResumo
}

export function SaldoCard({ resumo }: SaldoCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1 rounded-2xl bg-zinc-800 p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <Wallet size={15} />
          <span className="text-xs font-medium uppercase tracking-wide">Saldo</span>
        </div>
        <span className="mt-1 text-2xl font-bold text-zinc-100">
          R$ {resumo.saldo.toFixed(2).replace('.', ',')}
        </span>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl bg-violet-600/20 p-4 ring-1 ring-violet-500/30">
        <div className="flex items-center gap-2 text-violet-400">
          <Coins size={15} />
          <span className="text-xs font-medium uppercase tracking-wide">Créditos</span>
        </div>
        <span className="mt-1 text-2xl font-bold text-violet-300">{resumo.creditos}</span>
      </div>
    </div>
  )
}
