import {
  TrendingUp, Users, DollarSign, MessageCircle, Coins,
  UserPlus, Wallet, Image, Zap, CalendarRange, Eye, ShieldCheck, Store,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useDashboardPage } from '@/features/atriz/dashboard/hooks/useDashboardPage'
import type { PeriodoDashboard, TipoAtividade, AtividadeItem } from '@/features/atriz/dashboard/types'
import { creatorMediaTypeLabel, formatCreatorCredits } from '@/features/atriz/creator/utils'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const PERIODOS: { key: PeriodoDashboard; label: string }[] = [
  { key: 'diario', label: 'Diário' },
  { key: 'semanal', label: 'Semanal' },
  { key: 'mensal', label: 'Mensal' },
  { key: 'personalizado', label: 'Personalizado' },
]

const ATIVIDADE_CONFIG: Record<TipoAtividade, { icon: React.ElementType; color: string; bg: string }> = {
  assinante: { icon: UserPlus, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  ganho: { icon: Wallet, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  imagem_gerada: { icon: Image, color: 'text-pink-400', bg: 'bg-pink-500/10' },
  mensagem: { icon: Zap, color: 'text-violet-400', bg: 'bg-violet-500/10' },
}

function AtividadeRow({ item }: { item: AtividadeItem }) {
  const cfg = ATIVIDADE_CONFIG[item.tipo]
  const Icon = cfg.icon
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className={`shrink-0 rounded-lg p-1.5 ${cfg.bg}`}>
        <Icon size={13} className={cfg.color} strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-300">{item.descricao}</p>
        <p className="text-xs text-zinc-600">{formatDate(item.criadaEm)}</p>
      </div>
      {item.valor !== undefined && (
        <span className="shrink-0 text-xs font-semibold text-emerald-400">
          +{formatCreatorCredits(item.valor)}
        </span>
      )}
    </div>
  )
}

function ChartTooltipContent({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 shadow-xl">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="text-sm font-bold text-emerald-400">{formatCreatorCredits(payload[0].value)}</p>
    </div>
  )
}

export function Dashboard() {
  const { periodo, setPeriodo, de, setDe, ate, setAte, data, isLoading, isError } = useDashboardPage()

  const resumo = data?.resumo
  const grafico = data?.grafico ?? []
  const atividades = data?.atividades ?? []
  const publication = data?.publication
  const publishedProducts = publication?.publishedProducts ?? 0
  const hiddenProducts = publication?.hiddenProducts ?? 0
  const protectedBeforePurchase = publication?.clientMediaVisibleBeforePurchase === false

  const periodoLabel: Record<PeriodoDashboard, string> = {
    diario: 'hoje',
    semanal: 'últimos 7 dias',
    mensal: 'últimos 30 dias',
    personalizado: 'período selecionado',
  }

  const STAT_CARDS = [
    {
      label: 'Repasse estimado',
      value: resumo ? formatCreatorCredits(resumo.ganhosMes) : '0 créditos',
      icon: DollarSign,
      color: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      label: 'Vendas',
      value: resumo ? String(resumo.totalAssinantes) : '0',
      icon: Users,
      color: 'text-blue-400 bg-blue-500/10',
    },
    {
      label: 'Produtos ativos',
      value: resumo ? String(resumo.mensagensIA) : '0',
      icon: MessageCircle,
      color: 'text-violet-400 bg-violet-500/10',
    },
    {
      label: 'Pendências',
      value: resumo ? String(resumo.imagensGeradas) : '0',
      icon: TrendingUp,
      color: 'text-pink-400 bg-pink-500/10',
    },
    {
      label: 'Receita bruta',
      value: resumo ? formatCreatorCredits(resumo.creditosGastos) : '0 créditos',
      icon: Coins,
      color: 'text-amber-400 bg-amber-500/10',
    },
  ] as const

  if (!isLoading && isError && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-zinc-900 p-5">
          <TrendingUp size={32} className="text-zinc-600" strokeWidth={1.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-zinc-300">Seu painel ainda está sendo preparado</h2>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">
          Assim que houver produtos, vendas ou materiais para analisar, os dados aparecerão aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filtro de período */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900 p-1">
          {PERIODOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setPeriodo(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
                periodo === key
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {periodo === 'personalizado' && (
          <div className="flex items-center gap-2">
            <CalendarRange size={14} className="text-zinc-500" />
            <input
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
            />
            <span className="text-xs text-zinc-600">até</span>
            <input
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 focus:border-zinc-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <div className={`inline-flex rounded-xl p-2.5 ${color}`}>
              <Icon size={20} strokeWidth={1.75} />
            </div>
            <p className={`mt-3 text-2xl font-bold ${isLoading ? 'animate-pulse text-zinc-700' : 'text-zinc-100'}`}>
              {isLoading ? '———' : value}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <section data-actor-panel-publication-visibility="true" className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">Visibilidade dos produtos</p>
            <h2 className="mt-1 text-xl font-bold text-zinc-100">Publicação para Cliente</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
              Acompanhe quais produtos do seu avatar estão visíveis para clientes. A mídia completa continua protegida antes da compra.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:w-[520px]">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="inline-flex rounded-lg bg-emerald-500/10 p-2 text-emerald-400"><Eye size={16} /></div>
              <p className="mt-2 text-2xl font-bold text-zinc-100">{publishedProducts}</p>
              <p className="text-xs text-zinc-500">Produtos visíveis para cliente</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="inline-flex rounded-lg bg-amber-500/10 p-2 text-amber-400"><Store size={16} /></div>
              <p className="mt-2 text-2xl font-bold text-zinc-100">{hiddenProducts}</p>
              <p className="text-xs text-zinc-500">Variações aprovadas</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
              <div className="inline-flex rounded-lg bg-violet-500/10 p-2 text-violet-400"><ShieldCheck size={16} /></div>
              <p className="mt-2 text-sm font-bold text-zinc-100">{protectedBeforePurchase ? 'Protegida' : 'A conferir'}</p>
              <p className="text-xs text-zinc-500">Mídia antes da compra</p>
            </div>
          </div>
        </div>

        {publication?.products?.length ? (
          <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {publication.products.slice(0, 6).map((product) => (
              <div key={product.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-zinc-200">{product.title}</p>
                  <span className={product.clientVisible ? 'rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-300' : 'rounded-full bg-zinc-800 px-2 py-1 text-[10px] font-bold text-zinc-400'}>
                    {product.clientVisible ? 'Visível' : 'Oculto'}
                  </span>
                </div>
                <p className="mt-2 text-xs text-zinc-600">{creatorMediaTypeLabel(product.mediaType)} • {product.priceCredits > 0 ? `${product.priceCredits} créditos` : 'Preço pendente'}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-600">
            Nenhum produto publicado para cliente ainda.
          </div>
        )}
      </section>

      {/* Gráfico + Atividade recente */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-sm font-medium text-zinc-400">
            Repasses estimados — <span className="text-zinc-500">{periodoLabel[periodo]}</span>
          </p>

          {isLoading ? (
            <div className="mt-4 h-48 animate-pulse rounded-xl bg-zinc-800" />
          ) : grafico.length === 0 ? (
            <div className="mt-4 flex h-48 items-center justify-center rounded-xl border border-dashed border-zinc-700">
              <p className="text-sm text-zinc-600">Sem dados para o período</p>
            </div>
          ) : (
            <div className="mt-4 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={grafico} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradGanhos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#27272a" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#52525b', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v} cr`}
                    width={48}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="valor"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#gradGanhos)"
                    dot={false}
                    activeDot={{ r: 4, fill: '#10b981', stroke: '#065f46', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-1 text-sm font-medium text-zinc-400">Atividade recente</p>

          {isLoading ? (
            <div className="mt-3 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : atividades.length === 0 ? (
            <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-zinc-700">
              <p className="text-sm text-zinc-600">Nenhuma atividade</p>
            </div>
          ) : (
            <div className="mt-1 divide-y divide-zinc-800/60">
              {atividades.slice(0, 7).map((item) => (
                <AtividadeRow key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
