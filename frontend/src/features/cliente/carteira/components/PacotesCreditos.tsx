import { ShoppingCart, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import type { PacoteCreditos, MetodoPagamento } from '@/features/cliente/carteira/types'

interface PacotesCreditosProps {
  pacotes: PacoteCreditos[]
  metodos: MetodoPagamento[]
  pacoteSelecionado: string | null
  metodoSelecionado: string | null
  onSelecionarPacote: (id: string) => void
  onSelecionarMetodo: (id: string) => void
  onComprar: () => void
  isLoading: boolean
}

export function PacotesCreditos({
  pacotes,
  metodos,
  pacoteSelecionado,
  metodoSelecionado,
  onSelecionarPacote,
  onSelecionarMetodo,
  onComprar,
  isLoading,
}: PacotesCreditosProps) {
  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <ShoppingCart size={15} className="text-violet-400" />
        Comprar créditos
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
        {pacotes.map((pacote) => (
          <button
            key={pacote.id}
            onClick={() => onSelecionarPacote(pacote.id)}
            className={clsx(
              'relative flex flex-col items-center rounded-xl border p-3 text-center transition',
              pacote.id === pacoteSelecionado
                ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-500',
            )}
          >
            {pacote.destaque && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white">
                Popular
              </span>
            )}
            <Zap
              size={18}
              className={clsx('mb-1', pacote.id === pacoteSelecionado ? 'text-violet-400' : 'text-zinc-500')}
            />
            <span className="text-lg font-bold">{pacote.creditos}</span>
            <span className="text-[10px] text-zinc-500">créditos</span>
            <span className="mt-1 text-xs font-medium text-zinc-400">
              R$ {pacote.preco.toFixed(2).replace('.', ',')}
            </span>
          </button>
        ))}
      </div>

      {metodos.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs text-zinc-500">Pagar com</span>
          <div className="flex flex-wrap gap-2">
            {metodos.map((metodo) => (
              <button
                key={metodo.id}
                onClick={() => onSelecionarMetodo(metodo.id)}
                className={clsx(
                  'rounded-lg border px-3 py-1.5 text-xs transition',
                  metodo.id === metodoSelecionado
                    ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500',
                )}
              >
                {metodo.tipo === 'cartao'
                  ? `${metodo.bandeira} •••• ${metodo.ultimosDigitos}`
                  : metodo.apelido ?? 'Pix'}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onComprar}
        disabled={!pacoteSelecionado || !metodoSelecionado || isLoading}
        className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {isLoading ? 'Processando…' : 'Comprar agora'}
      </button>
    </div>
  )
}
