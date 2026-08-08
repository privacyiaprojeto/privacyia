import { Users, TrendingUp, TrendingDown, UserPlus } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useCreatorFinance } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { formatCreatorCredits } from '@/features/atriz/creator/utils'
import type { CreatorSale } from '@/features/atriz/creator/types'

type PerformanceGroup = 'image' | 'audio' | 'video'

const GROUP_LABEL: Record<PerformanceGroup, string> = {
  image: 'Imagens',
  audio: 'Áudios',
  video: 'Vídeos / Live Action',
}

const GROUP_COLOR: Record<PerformanceGroup, { card: string; badge: string; bar: string }> = {
  image: { card: 'border-blue-500/20 bg-blue-500/5', badge: 'bg-blue-500/10 text-blue-400', bar: '#3b82f6' },
  audio: { card: 'border-violet-500/20 bg-violet-500/5', badge: 'bg-violet-500/10 text-violet-400', bar: '#8b5cf6' },
  video: { card: 'border-amber-500/20 bg-amber-500/5', badge: 'bg-amber-500/10 text-amber-400', bar: '#f59e0b' },
}

function saleGroup(sale: CreatorSale): PerformanceGroup {
  const mediaType = String(sale.mediaType || '').toLowerCase()
  if (mediaType.includes('audio')) return 'audio'
  if (mediaType.includes('video') || mediaType.includes('live')) return 'video'
  return 'image'
}

function monthKey(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function buildHistory(sales: CreatorSale[]) {
  const totals = new Map<string, number>()
  for (const sale of sales) {
    if (!sale.createdAt) continue
    const key = monthKey(sale.createdAt)
    if (!key) continue
    totals.set(key, (totals.get(key) || 0) + 1)
  }

  return [...totals.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([key, total]) => ({
      label: new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }),
      total,
    }))
}

function groupGrowth(sales: CreatorSale[], group: PerformanceGroup) {
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - 29)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - 30)

  const grouped = sales.filter((sale) => saleGroup(sale) === group && sale.createdAt)
  const current = grouped.filter((sale) => new Date(sale.createdAt as string) >= currentStart).length
  const previous = grouped.filter((sale) => {
    const date = new Date(sale.createdAt as string)
    return date >= previousStart && date < currentStart
  }).length

  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
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
      <p className="text-sm font-bold text-zinc-200">{payload[0].value} vendas</p>
    </div>
  )
}

export function Assinantes() {
  const { data, isLoading, isError } = useCreatorFinance()

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

  if (!data || isError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <Users size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Nenhuma venda ainda</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">O desempenho dos seus produtos aparecerá aqui quando houver compras.</p>
      </div>
    )
  }

  const now = new Date()
  const month = now.getMonth()
  const year = now.getFullYear()
  const salesThisMonth = data.recentSales.filter((sale) => {
    if (!sale.createdAt) return false
    const createdAt = new Date(sale.createdAt)
    return createdAt.getMonth() === month && createdAt.getFullYear() === year
  }).length

  const groups = (['image', 'audio', 'video'] as PerformanceGroup[]).map((group) => {
    const sales = data.recentSales.filter((sale) => saleGroup(sale) === group)
    const gross = sales.reduce((total, sale) => total + Number(sale.grossCredits || 0), 0)
    return {
      group,
      quantity: sales.length,
      average: sales.length ? gross / sales.length : 0,
      gross,
      growth: groupGrowth(data.recentSales, group),
    }
  })
  const history = buildHistory(data.recentSales)

  return (
    <div className="space-y-6">
      {/* Resumo geral */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-blue-500/10 p-2.5">
            <Users size={18} className="text-blue-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{data.summary.totalSales.toLocaleString('pt-BR')}</p>
          <p className="mt-1 text-sm text-zinc-500">Vendas registradas</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <UserPlus size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">+{salesThisMonth}</p>
          <p className="mt-1 text-sm text-zinc-500">Vendas neste mês</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="inline-flex rounded-xl bg-emerald-500/10 p-2.5">
            <TrendingUp size={18} className="text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-2xl font-bold text-zinc-100">{formatCreatorCredits(data.summary.grossCredits)}</p>
          <p className="mt-1 text-sm text-zinc-500">Receita bruta total</p>
        </div>
      </div>

      {/* Cards por tipo de produto */}
      <div className="grid grid-cols-3 gap-4">
        {groups.map((item) => {
          const colors = GROUP_COLOR[item.group]
          const positivo = item.growth >= 0
          return (
            <div key={item.group} className={`rounded-2xl border p-5 ${colors.card}`}>
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colors.badge}`}>
                  {GROUP_LABEL[item.group]}
                </span>
                <span className={`flex items-center gap-1 text-sm font-medium ${positivo ? 'text-emerald-400' : 'text-red-400'}`}>
                  {positivo ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {positivo ? '+' : ''}{item.growth}%
                </span>
              </div>

              <p className="mt-4 text-3xl font-bold text-zinc-100">
                {item.quantity.toLocaleString('pt-BR')}
              </p>
              <p className="text-sm text-zinc-500">vendas</p>

              <div className="mt-4 border-t border-zinc-700/50 pt-3">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs text-zinc-500">Média por venda</p>
                  <p className="text-sm font-semibold text-zinc-300">{formatCreatorCredits(item.average)}</p>
                </div>
                <div className="mt-1 flex items-baseline justify-between">
                  <p className="text-xs text-zinc-500">Receita bruta</p>
                  <p className="text-sm font-semibold text-emerald-400">{formatCreatorCredits(item.gross)}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Gráfico de vendas */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="mb-4 text-sm font-medium text-zinc-400">Vendas — últimos meses</p>
        {history.length === 0 ? (
          <div className="flex h-44 items-center justify-center rounded-xl border border-dashed border-zinc-700">
            <p className="text-sm text-zinc-600">Nenhuma venda para exibir.</p>
          </div>
        ) : (
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
        )}
      </div>
    </div>
  )
}
