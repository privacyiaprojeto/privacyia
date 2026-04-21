import { useState } from 'react'
import { CreditCard, Plus, QrCode } from 'lucide-react'
import { clsx } from 'clsx'
import type { MetodoPagamento, TipoMetodo } from '@/features/cliente/carteira/types'
import { useAdicionarMetodo } from '@/features/cliente/carteira/hooks/useAdicionarMetodo'

interface MetodosPagamentoProps {
  metodos: MetodoPagamento[]
}

export function MetodosPagamento({ metodos }: MetodosPagamentoProps) {
  const [aberto, setAberto] = useState(false)
  const [tipo, setTipo] = useState<TipoMetodo>('cartao')
  const [bandeira, setBandeira] = useState('')
  const [ultimos, setUltimos] = useState('')
  const [apelido, setApelido] = useState('')

  const { mutate, isPending } = useAdicionarMetodo()

  function handleSalvar() {
    mutate(
      { tipo, bandeira: tipo === 'cartao' ? bandeira : undefined, ultimosDigitos: tipo === 'cartao' ? ultimos : undefined, apelido: tipo === 'pix' ? apelido : undefined },
      {
        onSuccess: () => {
          setAberto(false)
          setBandeira('')
          setUltimos('')
          setApelido('')
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
          <CreditCard size={15} className="text-violet-400" />
          Métodos de pagamento
        </h2>
        <button
          onClick={() => setAberto((v) => !v)}
          className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 transition hover:text-zinc-200"
        >
          <Plus size={13} />
          Adicionar
        </button>
      </div>

      {metodos.length === 0 && (
        <p className="text-xs text-zinc-600">Nenhum método cadastrado.</p>
      )}

      <div className="space-y-2">
        {metodos.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3"
          >
            {m.tipo === 'cartao' ? (
              <CreditCard size={16} className="shrink-0 text-zinc-400" />
            ) : (
              <QrCode size={16} className="shrink-0 text-zinc-400" />
            )}
            <span className="text-sm text-zinc-300">
              {m.tipo === 'cartao'
                ? `${m.bandeira} •••• ${m.ultimosDigitos}`
                : m.apelido ?? 'Pix'}
            </span>
          </div>
        ))}
      </div>

      {aberto && (
        <div className="space-y-3 rounded-xl border border-zinc-700 bg-zinc-800/60 p-4">
          <div className="flex gap-2">
            {(['cartao', 'pix'] as TipoMetodo[]).map((t) => (
              <button
                key={t}
                onClick={() => setTipo(t)}
                className={clsx(
                  'flex-1 rounded-lg border py-2 text-xs font-medium transition',
                  tipo === t
                    ? 'border-violet-500 bg-violet-600/20 text-violet-200'
                    : 'border-zinc-700 text-zinc-500 hover:border-zinc-500',
                )}
              >
                {t === 'cartao' ? 'Cartão' : 'Pix'}
              </button>
            ))}
          </div>

          {tipo === 'cartao' && (
            <div className="space-y-2">
              <input
                placeholder="Bandeira (ex: Visa)"
                value={bandeira}
                onChange={(e) => setBandeira(e.target.value)}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
              />
              <input
                placeholder="Últimos 4 dígitos"
                maxLength={4}
                value={ultimos}
                onChange={(e) => setUltimos(e.target.value.replace(/\D/g, ''))}
                className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
              />
            </div>
          )}

          {tipo === 'pix' && (
            <input
              placeholder="Apelido da chave (ex: Meu Pix)"
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500"
            />
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setAberto(false)}
              className="flex-1 rounded-lg border border-zinc-700 py-2 text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Cancelar
            </button>
            <button
              onClick={handleSalvar}
              disabled={isPending || (tipo === 'cartao' && (!bandeira || ultimos.length !== 4))}
              className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white transition hover:bg-violet-500 disabled:opacity-40"
            >
              {isPending ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
