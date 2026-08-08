import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CheckSquare,
  Clock3,
  Crown,
  Eye,
  Gauge,
  Layers3,
  LayoutGrid,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Store,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { parseApiError } from '@/shared/utils/parseApiError'
import {
  useM45Batches,
  useM45OperationalDashboard,
  useM45QaAssets,
  useM45RealProductionReadiness,
  useM45RejectedAssets,
} from '@/features/adm/hooks/useM45Operational'
import { M45ControlledActionsPanel } from '@/features/adm/components/M45ControlledActionsPanel'

type M45TargetPage = 'actors' | 'prompts' | 'batches' | 'review' | 'stock' | 'realProduction' | 'avatars'

type Tone = 'zinc' | 'amber' | 'emerald' | 'rose' | 'blue' | 'violet'

function toneClasses(tone: Tone) {
  const map: Record<Tone, string> = {
    zinc: 'border-white/10 bg-white/[0.055] text-zinc-300',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    rose: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    violet: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
  }

  return map[tone]
}

function numberOrDash(value?: number | null) {
  return Number.isFinite(Number(value)) ? Number(value) : '—'
}

function shortId(value?: string | null) {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    SAFE_ONLY: 'Modo seguro',
    GO_REAL_READY: 'Real pronto',
    NO_GO: 'Bloqueado',
    qa_pending: 'Aguardando QA',
    queued: 'Na fila',
    running: 'Produzindo',
    completed: 'Concluído',
    rejected: 'Rejeitado',
    available: 'Disponível',
  }

  if (!value) return '—'
  return labels[value] || value
}

function MetricCard({ icon: Icon, label, value, helper, tone = 'zinc' }: { icon: LucideIcon; label: string; value: string | number; helper: string; tone?: Tone }) {
  return (
    <div className={`rounded-[2rem] border p-5 shadow-2xl shadow-black/20 ${toneClasses(tone)}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <Icon size={22} />
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-zinc-400">{helper}</p>
    </div>
  )
}

function ActionCard({ icon: Icon, title, description, tone = 'zinc', onClick, disabled = false }: { icon: LucideIcon; title: string; description: string; tone?: Tone; onClick?: () => void; disabled?: boolean }) {
  const content = (
    <div className="flex items-start gap-4">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Icon size={20} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  )

  if (!onClick || disabled) {
    return (
      <div className={`rounded-[2rem] border p-5 opacity-80 shadow-2xl shadow-black/20 ${toneClasses(tone)}`}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[2rem] border p-5 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 ${toneClasses(tone)}`}
    >
      {content}
    </button>
  )
}

function SafetyPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.13em] ${ok ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-rose-400/25 bg-rose-400/10 text-rose-100'}`}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {label}
    </span>
  )
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
      <strong className="block text-rose-50">Não consegui carregar uma parte do painel operacional.</strong>
      <span className="mt-1 block text-rose-100/80">{parseApiError(error)}</span>
    </div>
  )
}

export function M45OperationalPanel({ onNavigate }: { onNavigate?: (page: M45TargetPage) => void }) {
  const dashboardQuery = useM45OperationalDashboard()
  const readinessQuery = useM45RealProductionReadiness()
  const qaAssetsQuery = useM45QaAssets()
  const rejectedAssetsQuery = useM45RejectedAssets()
  const batchesQuery = useM45Batches()

  const dashboard = dashboardQuery.data
  const readiness = readinessQuery.data
  const counters = dashboard?.counters
  const readinessStatus = readiness?.status || 'SAFE_ONLY'
  const readinessSummary = readiness?.summary
  const hasReadOnlyFailure = dashboardQuery.isError || readinessQuery.isError || qaAssetsQuery.isError || rejectedAssetsQuery.isError || batchesQuery.isError
  const isLoading = dashboardQuery.isLoading || readinessQuery.isLoading || qaAssetsQuery.isLoading || rejectedAssetsQuery.isLoading || batchesQuery.isLoading
  const qaAssets = qaAssetsQuery.data?.items || []
  const rejectedAssets = rejectedAssetsQuery.data?.items || []
  const batches = batchesQuery.data?.items || []
  const blockedSimulated = rejectedAssets.find((asset) => {
    const bucket = String(asset.r2Bucket || '').toLowerCase()
    const key = String(asset.r2Key || '').toLowerCase()
    const reason = String(asset.rejectionReason || '').toLowerCase()
    return bucket.includes('simulated') || key.includes('_simulated/no-r2') || reason.includes('simulado') || reason.includes('placeholder')
  })

  const refreshAll = () => {
    dashboardQuery.refetch()
    readinessQuery.refetch()
    qaAssetsQuery.refetch()
    rejectedAssetsQuery.refetch()
    batchesQuery.refetch()
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">
            M4.5A • Operacional seguro
          </span>
          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">Painel operacional do fluxo Admin</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
            Primeira tela para transformar os scripts homologados em operação real do Admin. Esta versão é segura: só consulta, orienta e navega. Não cria lote, não aprova mídia, não chama worker, RunPod, R2, financeiro, entrega ou Cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshAll}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-white/25"
        >
          <RefreshCw size={16} />
          Atualizar painel
        </button>
      </div>

      {hasReadOnlyFailure && (
        <div className="grid gap-3">
          {dashboardQuery.isError && <ErrorBox error={dashboardQuery.error} />}
          {readinessQuery.isError && <ErrorBox error={readinessQuery.error} />}
          {qaAssetsQuery.isError && <ErrorBox error={qaAssetsQuery.error} />}
          {rejectedAssetsQuery.isError && <ErrorBox error={rejectedAssetsQuery.error} />}
          {batchesQuery.isError && <ErrorBox error={batchesQuery.error} />}
        </div>
      )}

      <div className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-black text-emerald-100">
              <ShieldCheck size={18} />
              Status de segurança: {statusLabel(readinessStatus)}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-100/75">
              Produção real permanece bloqueada por padrão. O painel pode avançar para botões operacionais, mas qualquer ação real de mídia continua dependendo de readiness próprio, QA real e confirmação separada.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <SafetyPill label="Sem worker" ok={readiness?.safety?.realWorkerEnabled !== true} />
            <SafetyPill label="Sem real agora" ok={readiness?.canStartReal !== true} />
            <SafetyPill label="Somente Admin" ok />
            <SafetyPill label="Cliente intacto" ok />
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard icon={UserCheck} label="Atores" value={numberOrDash(counters?.actors?.total)} helper="Perfis de atores/atrizes no Admin." tone="blue" />
        <MetricCard icon={CheckSquare} label="Mapeamentos aprovados" value={numberOrDash(counters?.mappingCases?.approved)} helper="Casos aprovados para seguir no fluxo." tone="emerald" />
        <MetricCard icon={Crown} label="Autorizações" value={numberOrDash(counters?.avatarAuthorizations?.total)} helper="Autorizações de produção registradas." tone="violet" />
        <MetricCard icon={Clock3} label="QA pendente" value={numberOrDash(counters?.production?.assetsQaPending)} helper="Assets aguardando revisão humana." tone={Number(counters?.production?.assetsQaPending || 0) > 0 ? 'amber' : 'zinc'} />
        <MetricCard icon={Store} label="Visíveis ao cliente" value={numberOrDash(counters?.publication?.visibleCombinations)} helper="Combinações já visíveis. M4.5A não altera isso." tone="zinc" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Fluxo operacional</p>
              <h2 className="mt-2 text-2xl font-black text-white">Botões seguros do Admin</h2>
            </div>
            {isLoading && <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-zinc-400">Carregando…</span>}
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <ActionCard icon={UserCheck} title="1. Atores e mapeamento" description="Abrir cadastro, convite, materiais, aprovação de mapeamento e autorização de produção." tone="blue" onClick={() => onNavigate?.('actors')} />
            <ActionCard icon={Sparkles} title="2. Planejar produto" description="Abrir Criações da Fábrica para selecionar avatar, tipo de mídia, títulos e opções." tone="violet" onClick={() => onNavigate?.('prompts')} />
            <ActionCard icon={Layers3} title="3. Acompanhar lotes" description="Abrir Central de Lotes para acompanhar itens criados em modo seguro." tone="amber" onClick={() => onNavigate?.('batches')} />
            <ActionCard icon={LayoutGrid} title="4. Revisar QA" description="Abrir revisão para aprovar/reprovar apenas mídias reais. Placeholders simulados devem continuar bloqueados." tone="emerald" onClick={() => onNavigate?.('review')} />
            <ActionCard icon={Gauge} title="5. Readiness real" description="Abrir produção real controlada, ainda bloqueada por padrão e com dupla confirmação própria." tone="rose" onClick={() => onNavigate?.('realProduction')} />
            <ActionCard icon={Lock} title="6. Cliente protegido" description="M4.5A não toca na tela Cliente, não publica combinação e não cria entrega/galeria/ledger." tone="zinc" disabled />
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/20">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Checklist real</p>
          <h2 className="mt-2 text-2xl font-black text-white">Readiness SAFE_ONLY</h2>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Status</p>
              <p className="mt-2 text-lg font-black text-white">{statusLabel(readinessStatus)}</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-2xl bg-white/[0.055] p-3">
                <p className="text-zinc-500">Checks</p>
                <p className="mt-1 font-black text-white">{numberOrDash(readinessSummary?.totalChecks)}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.055] p-3">
                <p className="text-zinc-500">Blockers</p>
                <p className="mt-1 font-black text-white">{numberOrDash(readinessSummary?.blockers)}</p>
              </div>
              <div className="rounded-2xl bg-white/[0.055] p-3">
                <p className="text-zinc-500">Warnings</p>
                <p className="mt-1 font-black text-white">{numberOrDash(readinessSummary?.warnings)}</p>
              </div>
            </div>
            <p className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">
              Mesmo com chaves configuradas, produção real só deve iniciar em sprint próprio. Este painel é operação segura, não execução real.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <AlertTriangle size={18} className="text-amber-200" />
            QA pendente
          </p>
          <div className="mt-4 space-y-3">
            {qaAssets.length === 0 && <p className="text-sm text-zinc-500">Nenhum asset em QA pendente neste momento.</p>}
            {qaAssets.slice(0, 4).map((asset) => (
              <div key={asset.id} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm">
                <p className="font-black text-white">{asset.combination?.title || `Asset ${shortId(asset.id)}`}</p>
                <p className="mt-1 text-xs text-zinc-500">{statusLabel(asset.status)} • {asset.mediaType} • {shortId(asset.id)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <XCircle size={18} className="text-rose-200" />
            Simulados bloqueados
          </p>
          <div className="mt-4 space-y-3">
            {!blockedSimulated && <p className="text-sm text-zinc-500">Nenhum placeholder simulado recente foi encontrado na lista de rejeitados.</p>}
            {blockedSimulated && (
              <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">
                <p className="font-black">Placeholder rejeitado</p>
                <p className="mt-1 text-xs text-rose-100/75">{shortId(blockedSimulated.id)} • {blockedSimulated.r2Bucket || 'sem bucket'}</p>
                <p className="mt-2 text-xs leading-relaxed text-rose-100/75">{blockedSimulated.rejectionReason || 'Rejeitado para impedir publicação acidental.'}</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Boxes size={18} className="text-sky-200" />
            Lotes recentes
          </p>
          <div className="mt-4 space-y-3">
            {batches.length === 0 && <p className="text-sm text-zinc-500">Nenhum lote recente retornado.</p>}
            {batches.slice(0, 4).map((batch) => (
              <button key={batch.id} type="button" onClick={() => onNavigate?.('batches')} className="w-full rounded-2xl border border-white/10 bg-black/30 p-3 text-left text-sm transition hover:border-white/25">
                <p className="font-black text-white">{batch.title || `Lote ${shortId(batch.id)}`}</p>
                <p className="mt-1 text-xs text-zinc-500">{statusLabel(batch.status)} • {shortId(batch.id)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>


      <M45ControlledActionsPanel
        qaAssets={qaAssets}
        rejectedAssets={rejectedAssets}
        batches={batches}
        onRefresh={refreshAll}
        onNavigate={onNavigate}
      />

      <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5 text-sm leading-relaxed text-zinc-400">
        <strong className="text-white">Escopo M4.5A:</strong> esta tela não executa mutações críticas. Ela consolida leitura operacional e direciona o Admin para áreas já existentes. As próximas sprints podem transformar cada etapa em ação controlada com confirmação, uma por vez.
      </div>
    </section>
  )
}
