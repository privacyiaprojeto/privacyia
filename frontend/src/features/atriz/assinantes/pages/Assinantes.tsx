import { Users, TrendingUp, TrendingDown, UserPlus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAssinantes } from '@/features/atriz/assinantes/hooks/useAssinantes'
import type { TipoPlano } from '@/features/atriz/assinantes/types'

const PLANO_LABEL: Record<TipoPlano, string> = {
  mensal: 'Mensal',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

const PLANO_COLOR: Record<TipoPlano, { card: string; badge: string; bar: string }> = {
  mensal:      { card: 'border-blue-500/20 bg-blue-500/5',   badge: 'bg-blue-500/10 text-blue-400',   bar: '#3b82f6' },
  trimestral:  { card: 'border-violet-500/20 bg-violet-500/5', badge: 'bg-violet-500/10 text-violet-400', bar: '#8b5cf6' },
  anual:       { card: 'border-amber-500/20 bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-400', bar: '#f59e0b' },
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-bold text-zinc-200">{payload[0].value} assinantes</p>
    </div>
  )
}

export function Assinantes() {
  const { data, isLoading } = useAssinantes()

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Users size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Sem dados disponíveis</h2>
      </div>
    )
  }

  const receitaTotal = data.planos.reduce((acc, p) => acc + p.receitaMensal, 0)

  return (
    <div className="space-y-6">
      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-blue-500/10 p-2.5">
            <Users size={18} className="text-blue-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{data.totalAtivos.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-sm text-zinc-500">Assinantes ativos</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <UserPlus size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">+{data.novosEsteMes}</p>
          <p className="mt-1 text-sm text-zinc-500">Novos este mês</p>
        </div>
<div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <TrendingUp size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCurrency(receitaTotal)}</p>
          <p className="mt-1 text-sm text-zinc-500">Receita mensal total</p>
        </div>
      </div>

      {/* Cards por plano */}
      <div className="grid grid-cols-3 gap-4">
        {data.planos.map((plano) => {
          const colors = PLANO_COLOR[plano.tipo]
          const positivo = plano.crescimento >= 0
          return (
            <div key={plano.tipo} className={`rounded-2xl border p-5 ${colors.card}`}>
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors.badge}`}>
                  {PLANO_LABEL[plano.tipo]}
                </span>
                <span className={`flex items-center gap-1 text-sm font-medium ${positivo ? 'text-emerald-400' : 'text-red-400'}`}>
                  {positivo ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {positivo ? '+' : ''}{plano.crescimento}%
                </span>
              </div>

              <p className="mt-4 text-3xl font-bold text-zinc-100">
                {plano.quantidade.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-zinc-500">assinantes</p>

              <div className="mt-4 border-t border-zinc-700/50 pt-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-zinc-500">Por assinante/mês</p>
                  <p className="text-sm font-semibold text-zinc-300">{formatCurrency(plano.valorMensal)}</p>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <p className="text-xs text-zinc-500">Receita mensal</p>
                  <p className="text-sm font-semibold text-emerald-400">{formatCurrency(plano.receitaMensal)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Gráfico de crescimento */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-4 text-sm font-medium text-zinc-400">Crescimento — últimos 6 meses</p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.historico} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#27272a" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#52525b', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: '#52525b', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
