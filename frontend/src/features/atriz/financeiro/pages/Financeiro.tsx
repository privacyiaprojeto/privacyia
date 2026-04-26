import { useState } from 'react'
import { Wallet, TrendingUp, ArrowDownCircle, Clock, CheckCircle, XCircle, Coins, Loader2 } from 'lucide-react'
import { useFinanceiro } from '@/features/atriz/financeiro/hooks/useFinanceiro'
import { useSolicitarSaque } from '@/features/atriz/financeiro/hooks/useSolicitarSaque'
import { ModalSolicitarSaque } from '@/features/atriz/financeiro/components/ModalSolicitarSaque'
import type { SaqueItem } from '@/features/atriz/financeiro/types'

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

const TIPO_LABEL: Record<string, string> = {
  assinatura: 'Assinatura',
  mensagem: 'Mensagens IA',
  imagem_gerada: 'Imagem gerada',
  conteudo: 'Conteúdo',
  credito: 'Créditos',
}

function SaqueStatus({ status }: { status: SaqueItem['status'] }) {
  if (status === 'processado')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
        <CheckCircle size={11} /> Processado
      </span>
    )
  if (status === 'pendente')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">
        <Clock size={11} /> Pendente
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">
      <XCircle size={11} /> Recusado
    </span>
  )
}

export function Financeiro() {
  const { data, isLoading } = useFinanceiro()
  const [modalAberto, setModalAberto] = useState(false)
  const { mutate: solicitar, isPending } = useSolicitarSaque()

  function handleSolicitar() {
    if (!data) return
    const total = data.saldo.disponivel + data.saldo.ganhoCreditos
    if (total <= 0) return
    solicitar(total, {
      onSuccess: () => setModalAberto(false),
    })
  }

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

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Wallet size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Financeiro</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Não foi possível carregar seus dados financeiros.
        </p>
      </div>
    )
  }

  const semSaldo = data.saldo.disponivel <= 0 && data.saldo.ganhoCreditos <= 0

  return (
    <>
    <div className="space-y-6">
      {/* Cards de saldo — ordem: disponível, créditos, pendente, total */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <Wallet size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCurrency(data.saldo.disponivel)}</p>
          <p className="mt-1 text-sm text-zinc-500">Disponível para saque</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-amber-500/10 p-2.5">
            <Coins size={18} className="text-amber-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">
            {data.saldo.creditosGastos.toLocaleString('pt-BR')}
          </p>
          <p className="mt-1 text-sm text-zinc-500">Créditos gastos no perfil</p>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            +{formatCurrency(data.saldo.ganhoCreditos)}{' '}
            <span className="font-normal text-zinc-600">(R$0,10/crédito)</span>
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-zinc-700/60 p-2.5">
            <Clock size={18} className="text-zinc-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCurrency(data.saldo.pendente)}</p>
          <p className="mt-1 text-sm text-zinc-500">Pendente de liberação</p>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-blue-500/10 p-2.5">
            <TrendingUp size={18} className="text-blue-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCurrency(data.saldo.totalRecebido)}</p>
          <p className="mt-1 text-sm text-zinc-500">Total recebido</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-medium text-zinc-400">Últimos ganhos</p>
          <div className="space-y-3">
            {data.ganhos.slice(0, 6).map((ganho) => (
              <div key={ganho.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">{ganho.descricao}</p>
                  <p className="text-xs text-zinc-500">{TIPO_LABEL[ganho.tipo] ?? ganho.tipo} · {formatDate(ganho.criadaEm)}</p>
                </div>
                <span className="text-sm font-semibold text-emerald-400">
                  +{formatCurrency(ganho.valor)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-4 text-sm font-medium text-zinc-400">Saques</p>
          <div className="flex-1 space-y-3">
            {data.saques.map((saque) => (
              <div key={saque.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-zinc-300">{formatCurrency(saque.valor)}</p>
                  <p className="text-xs text-zinc-500">{formatDate(saque.criadaEm)}</p>
                </div>
                <SaqueStatus status={saque.status} />
              </div>
            ))}
          </div>

          <button
            onClick={() => setModalAberto(true)}
            disabled={isPending || semSaldo}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 active:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isPending ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <ArrowDownCircle size={20} strokeWidth={2} />
            )}
            {isPending ? 'Solicitando…' : semSaldo ? 'Sem saldo disponível' : 'Solicitar saque'}
          </button>
        </div>
      </div>
    </div>

    {modalAberto && data && (
      <ModalSolicitarSaque
        saldo={data.saldo}
        metodo={data.metodos.find((m) => m.principal)}
        isPending={isPending}
        onConfirmar={handleSolicitar}
        onFechar={() => setModalAberto(false)}
      />
    )}
    </>
  )
}
