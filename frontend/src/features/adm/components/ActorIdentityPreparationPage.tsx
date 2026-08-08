import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  Database,
  FileCheck2,
  Fingerprint,
  HardDrive,
  Info,
  Link2,
  Loader2,
  LockKeyhole,
  Microscope,
  PlayCircle,
  RefreshCcw,
  ScanSearch,
  ServerCog,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserRoundCheck,
  X,
} from 'lucide-react'
import type { ActorProfile } from '@/features/adm/api/actorComplianceApi'
import { getActorIdentityPreviewBlob } from '@/features/adm/api/actorPipelineApi'
import {
  useActorIdentityDatasetReadiness,
  useActorPipelineSummary,
  useAuthorizeActorIdentityPreparation,
  usePrepareActorIdentityLoraReadiness,
  useStartActorIdentityTraining,
  useRefreshActorIdentityTrainingStatus,
  useStartActorIdentityPreview,
  useRefreshActorIdentityPreviewStatus,
  useRunActorIdentityVideoForensicAudit,
  useRunActorIdentityTrainingTargetAudit,
  useDecideActorIdentityReview,
  useRegisterActorIdentityDataset,
} from '@/features/adm/hooks/useActorPipeline'
import { parseApiError } from '@/shared/utils/parseApiError'

const AUTHORIZATION_CONFIRMATION = 'AUTORIZAR USO PARA PREPARAR IDENTIDADE'
const DATASET_REGISTRATION_CONFIRMATION = 'REGISTRAR CONJUNTO APROVADO'
const TRAINING_CONFIRMATION = 'CRIAR IDENTIDADE REAL CONTROLADA D3.6B'
const PREVIEW_CONFIRMATION = 'PREPARAR PREVIA PRIVADA DA IDENTIDADE'

const FORENSIC_CONFIRMATION = 'EXECUTAR AUDITORIA FORENSE SEM GPU D3.6H3'
const TRAINING_TARGET_AUDIT_CONFIRMATION = 'EXECUTAR AUDITORIA DO ALVO DE TREINAMENTO D3.6H4'
const APPROVE_IDENTITY_CONFIRMATION = 'APROVAR IDENTIDADE DE VIDEO DO ATOR'
const REJECT_IDENTITY_CONFIRMATION = 'REJEITAR IDENTIDADE E SOLICITAR NOVO TREINAMENTO'

interface ActorIdentityPreparationPageProps {
  actor: ActorProfile
  onBack: () => void
}

type JourneyState = 'done' | 'current' | 'locked'

function actorInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase())
    .join('') || 'AT'
}

function JourneyStep({ number, title, state }: { number: number; title: string; state: JourneyState }) {
  const done = state === 'done'
  const current = state === 'current'
  return (
    <div className={current
      ? 'rounded-2xl border border-amber-300/30 bg-amber-300/[0.08] p-4'
      : done
        ? 'rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4'
        : 'rounded-2xl border border-white/8 bg-black/20 p-4 opacity-70'}
    >
      <div className="flex items-center gap-3">
        <span className={done
          ? 'flex size-8 items-center justify-center rounded-xl bg-emerald-300/15 text-emerald-100'
          : current
            ? 'flex size-8 items-center justify-center rounded-xl bg-amber-300/15 text-amber-100'
            : 'flex size-8 items-center justify-center rounded-xl bg-white/5 text-zinc-500'}
        >
          {done ? <Check size={16} /> : current ? number : <LockKeyhole size={14} />}
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Etapa {number}</p>
          <p className="mt-1 text-sm font-black text-white">{title}</p>
        </div>
      </div>
    </div>
  )
}

function SummaryMetric({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] px-4 py-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-100/70">{label}</p>
      <p className="mt-1 text-xl font-black text-white">{value}</p>
      <p className="mt-1 text-[11px] text-zinc-500">{helper}</p>
    </div>
  )
}


function ConfigurationItem({
  label,
  value,
  ready,
  helper,
  icon,
}: {
  label: string
  value: string
  ready: boolean
  helper: string
  icon: ReactNode
}) {
  return (
    <div className={ready
      ? 'rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4'
      : 'rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={ready ? 'mt-0.5 text-emerald-200' : 'mt-0.5 text-amber-200'}>{icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">{label}</p>
            <p className="mt-1 break-words text-sm font-black text-white">{value}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">{helper}</p>
          </div>
        </div>
        <span className={ready
          ? 'shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100'
          : 'shrink-0 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100'}
        >
          {ready ? 'Pronto' : 'Pendente'}
        </span>
      </div>
    </div>
  )
}

function ExecutionPhase({
  title,
  description,
  state,
  icon,
}: {
  title: string
  description: string
  state: 'ready' | 'current' | 'locked'
  icon: ReactNode
}) {
  const ready = state === 'ready'
  const current = state === 'current'
  return (
    <div className={ready
      ? 'rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045] p-4'
      : current
        ? 'rounded-2xl border border-sky-300/20 bg-sky-300/[0.055] p-4'
        : 'rounded-2xl border border-white/8 bg-black/20 p-4 opacity-70'}
    >
      <div className="flex items-start gap-3">
        <span className={ready ? 'mt-0.5 text-emerald-200' : current ? 'mt-0.5 text-sky-200' : 'mt-0.5 text-zinc-600'}>{icon}</span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-white">{title}</p>
            <span className={ready
              ? 'rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-emerald-100'
              : current
                ? 'rounded-full border border-sky-300/20 bg-sky-300/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-sky-100'
                : 'rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500'}
            >
              {ready ? 'Preparado' : current ? 'Ação atual' : 'Bloqueado'}
            </span>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">{description}</p>
        </div>
      </div>
    </div>
  )
}

function friendlyBaseModelName(value?: string | null) {
  if (!value) return 'Modelo-base não informado'
  if (value === 'Wan-AI/Wan2.1-VACE-14B') return 'Wan 2.1 VACE — 14B'
  return value
}

function formatIdentityTimestamp(value?: string | null) {
  if (!value) return 'ainda não sincronizado'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'horário indisponível'
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(date)
}

function identityStateLabel(state?: string | null) {
  const labels: Record<string, string> = {
    readiness_required: 'Não iniciada',
    dataset_ready: 'Conjunto registrado',
    dry_run_ready: 'Pronta para criar',
    training_pending: 'Na fila',
    training_in_progress: 'Em treinamento',
    training_completed: 'Treinamento concluído',
    qa_pending: 'Revisão necessária',
    qa_rejected: 'Ajustes necessários',
    adapter_approved_injection_pending: 'Aprovada • integração pendente',
    production_ready: 'Aprovada e integrada',
    failed: 'Falhou',
    cancelled: 'Cancelada',
  }
  return labels[String(state || '')] || 'Em preparação'
}

function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  actorName,
  imageCount,
  videoCount,
  pending,
  pendingLabel = 'Processando...',
  reviewText = 'Confirmo que revisei o ator e o conjunto aprovado. Esta ação não inicia treinamento e não libera produtos.',
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  actorName: string
  imageCount: number
  videoCount: number
  pending: boolean
  pendingLabel?: string
  reviewText?: string
  onClose: () => void
  onConfirm: () => void
}) {
  const [reviewed, setReviewed] = useState(false)
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Fechar confirmação" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Confirmação administrativa</p>
            <h3 className="mt-2 text-2xl font-black text-white">{title}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-black/25 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{description}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Ator</p><p className="mt-1 truncate text-sm font-black text-white">{actorName}</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Fotos</p><p className="mt-1 text-sm font-black text-white">{imageCount} aprovadas</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-600">Vídeos</p><p className="mt-1 text-sm font-black text-white">{videoCount} aprovados</p></div>
        </div>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1 size-4 accent-amber-300" />
          <span className="text-sm leading-relaxed text-zinc-300">{reviewText}</span>
        </label>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-300 hover:border-white/25">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={!reviewed || pending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
            {pending ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  )
}


function IdentityDecisionDialog({
  action,
  actorName,
  pending,
  onClose,
  onConfirm,
}: {
  action: 'approve' | 'reject'
  actorName: string
  pending: boolean
  onClose: () => void
  onConfirm: (reason: string, notes: string) => void
}) {
  const [reviewed, setReviewed] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const approving = action === 'approve'
  const reasonReady = approving || reason.trim().length >= 10
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Fechar decisão" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={approving ? 'text-xs font-black uppercase tracking-[0.16em] text-emerald-100' : 'text-xs font-black uppercase tracking-[0.16em] text-rose-100'}>Decisão administrativa</p>
            <h3 className="mt-2 text-2xl font-black text-white">{approving ? 'Aprovar identidade de vídeo' : 'Rejeitar identidade e solicitar novo treinamento'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/10 bg-black/25 p-2 text-zinc-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">{approving
          ? `A aprovação confirma que a identidade de ${actorName} passou pelo teste final de vídeo com base aleatória e comparação A/B. Ela não publica produtos nem ativa produção automaticamente.`
          : `A rejeição registra que a identidade de ${actorName} precisa de novo treinamento. Nenhum retry ou novo gasto será iniciado automaticamente.`}</p>
        {!approving && (
          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Motivo obrigatório</span>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={1500} placeholder="Explique por que a identidade precisa ser refeita." className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-rose-300/40" />
          </label>
        )}
        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Observação opcional</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={1500} placeholder="Observação administrativa." className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-white/20" />
        </label>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
          <input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-1 size-4 accent-amber-300" />
          <span className="text-sm leading-relaxed text-zinc-300">Confirmo que revisei as evidências e compreendo que esta decisão será registrada no histórico da identidade.</span>
        </label>
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-300 hover:border-white/25">Cancelar</button>
          <button type="button" onClick={() => onConfirm(reason.trim(), notes.trim())} disabled={!reviewed || !reasonReady || pending} className={approving
            ? 'inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45'
            : 'inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45'}>
            {pending ? <Loader2 size={17} className="animate-spin" /> : approving ? <ThumbsUp size={17} /> : <ThumbsDown size={17} />}
            {pending ? 'Salvando...' : approving ? 'Aprovar identidade' : 'Rejeitar identidade'}
          </button>
        </div>
      </section>
    </div>
  )
}

export function ActorIdentityPreparationPage({ actor, onBack }: ActorIdentityPreparationPageProps) {
  const summaryQuery = useActorPipelineSummary(actor.id)
  const datasetQuery = useActorIdentityDatasetReadiness(actor.id)
  const authorizationMutation = useAuthorizeActorIdentityPreparation(actor.id)
  const datasetRegistrationMutation = useRegisterActorIdentityDataset(actor.id)
  const trainingConfigurationMutation = usePrepareActorIdentityLoraReadiness(actor.id)
  const trainingStartMutation = useStartActorIdentityTraining(actor.id)
  const trainingStatusMutation = useRefreshActorIdentityTrainingStatus(actor.id)
  const previewStartMutation = useStartActorIdentityPreview(actor.id)
  const previewStatusMutation = useRefreshActorIdentityPreviewStatus(actor.id)
  const forensicAuditMutation = useRunActorIdentityVideoForensicAudit(actor.id)
  const trainingTargetAuditMutation = useRunActorIdentityTrainingTargetAudit(actor.id)
  const identityDecisionMutation = useDecideActorIdentityReview(actor.id)
  const [note, setNote] = useState('')
  const [authorizationDialogOpen, setAuthorizationDialogOpen] = useState(false)
  const [freezeDialogOpen, setFreezeDialogOpen] = useState(false)
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false)
  const [trainingStartDialogOpen, setTrainingStartDialogOpen] = useState(false)
  const [reviewWorkspaceOpen, setReviewWorkspaceOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [identityDecisionDialog, setIdentityDecisionDialog] = useState<'approve' | 'reject' | null>(null)
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  const [message, setMessage] = useState('')
  const trainingRefreshInFlight = useRef(false)
  const previewRefreshInFlight = useRef(false)

  const summary = summaryQuery.data
  const dataset = datasetQuery.data
  const latestRun = summary?.identityLora.latestRun || null
  const latestAdapter = summary?.identityLora.latestAdapter || null
  const adapter = summary?.identityLora.approvedAdapter || null
  const identityReview = summary?.identityLora.review || null
  const identityPreview = identityReview?.preview || null
  const previewPolicy = summary?.identityLora.previewPolicy || null
  const previewActive = Boolean(identityPreview && ['submitting', 'queued', 'running'].includes(identityPreview.status))
  const previewMediaAvailable = Boolean(identityPreview?.mediaAvailable && (identityPreview?.assetCount || 0) > 0)
  const previewReady = Boolean(identityPreview?.validForApproval && identityPreview?.mediaAvailable)
  const previewVideoAssets = (identityPreview?.assets || []).filter((asset) => asset.kind === 'video')
  const previewNotStarted = !identityPreview || identityPreview.status === 'not_started'
  const previewContractReady = Boolean(
    previewPolicy?.ready
      && previewPolicy.contractVersion === 'privacy-identity-neutral-ab-v1'
      && previewPolicy.maxJobs === 1
      && previewPolicy.actorMatched === true
      && previewPolicy.runMatched === true
      && previewPolicy.adapterMatched === true,
  )
  const forensicAudit = identityReview?.forensicAudit || identityPreview?.forensicAudit || null
  const forensicStatus = forensicAudit?.status || 'not_run'
  const forensicFailed = forensicStatus === 'failed' || identityPreview?.status === 'invalid'
  const trainingTargetAudit = identityReview?.trainingTargetAudit || null
  const trainingTargetStatus = trainingTargetAudit?.status || 'not_run'
  const trainingTargetFailed = trainingTargetStatus === 'failed'
  const authorizationActive = dataset?.authorization?.status === 'active'
  const diagnostics = dataset?.diagnostics.summary
  const includedAssets = useMemo(
    () => (dataset?.diagnostics.assets || []).filter((item) => item.datasetStatus === 'included'),
    [dataset?.diagnostics.assets],
  )
  const excludedAssets = useMemo(
    () => (dataset?.diagnostics.assets || []).filter((item) => item.datasetStatus === 'excluded'),
    [dataset?.diagnostics.assets],
  )
  const materialsComplete = Boolean(
    dataset
      && dataset.summary.pendingReviewAssets === 0
      && dataset.summary.validUniqueImages >= dataset.thresholds.minimumImages
      && dataset.summary.validUniqueVideos >= dataset.thresholds.minimumVideos
      && dataset.coverage.missingImageTags.length === 0
      && dataset.coverage.missingVideoTags.length === 0
      && dataset.diagnostics.summary.actionRequired === 0,
  )
  const datasetRegistrationBlockers = dataset?.datasetRegistration?.blockers || []
  const trainingConfigurationBlockers = dataset?.trainingConfiguration?.blockers || []
  const manifestRegistered = Boolean(latestRun && [
    'dataset_ready',
    'dry_run_ready',
    'training_pending',
    'training_in_progress',
    'training_completed',
    'qa_pending',
    'approved',
    'failed',
    'cancelled',
  ].includes(latestRun.status))
  const trainingConfigured = Boolean(latestRun && [
    'dry_run_ready',
    'training_pending',
    'training_in_progress',
    'training_completed',
    'qa_pending',
    'approved',
    'failed',
    'cancelled',
  ].includes(latestRun.status))
  const executionPlanPrepared = latestRun?.executionPlan?.prepared === true
  const trainingJob = latestRun?.trainingJob || null
  const trainingActive = Boolean(latestRun && ['training_pending', 'training_in_progress'].includes(latestRun.status))
  const trainingCompleted = Boolean(latestRun && ['training_completed', 'qa_pending', 'approved'].includes(latestRun.status))
  const trainingFailed = latestRun?.status === 'failed'
  const reviewRequired = Boolean(identityReview && ['review_required', 'adapter_pending'].includes(identityReview.status))
  const identityApproved = Boolean(identityReview?.status === 'approved' || adapter)
  const canPreparePreview = Boolean(
    latestAdapter
      && !identityApproved
      && previewNotStarted
      && !identityPreview?.providerJobIdConfigured
      && previewContractReady,
  )
  const canStartTraining = Boolean(trainingConfigured && latestRun?.status === 'dry_run_ready' && !latestAdapter && latestRun?.executionPlan?.runtimeExecutionEnabled)
  const canAuthorize = Boolean(!authorizationActive && materialsComplete)
  const canRegisterManifest = Boolean(
    authorizationActive
      && materialsComplete
      && dataset?.datasetRegistration?.ready
      && !manifestRegistered,
  )
  const canValidateTrainingConfiguration = Boolean(
    manifestRegistered
      && latestRun?.status === 'dataset_ready'
      && dataset?.trainingConfiguration?.ready,
  )
  const actorName = summary?.actor.displayName || actor.displayName || actor.legalName || 'Ator/Atriz'
  const identityStatus = identityStateLabel(summary?.identityLora.state)
  const lastSynchronizedAt = identityPreview?.lastCheckedAt || identityPreview?.completedAt || identityReview?.lastUpdatedAt || latestAdapter?.updatedAt || latestRun?.trainingJob?.lastCheckedAt || latestRun?.updatedAt || null
  const trainingProgress = latestRun?.trainingJob?.progressPercent
  const trainingStatusText = trainingFailed
    ? 'Falhou'
    : trainingCompleted
      ? 'Concluído'
      : trainingActive
        ? latestRun?.status === 'training_pending' ? 'Na fila' : 'Em andamento'
        : latestRun?.statusLabel || 'Não iniciado'

  async function handleAuthorize() {
    if (!canAuthorize) return
    setMessage('')
    try {
      const result = await authorizationMutation.mutateAsync({
        confirmation: AUTHORIZATION_CONFIRMATION,
        note: note.trim() || null,
      })
      setMessage(result.message)
      setAuthorizationDialogOpen(false)
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleRegisterManifest() {
    if (!canRegisterManifest) return
    setMessage('')
    try {
      const result = await datasetRegistrationMutation.mutateAsync({
        confirmation: DATASET_REGISTRATION_CONFIRMATION,
      })
      setMessage(result.message)
      setFreezeDialogOpen(false)
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }


  async function handleValidateTrainingConfiguration() {
    if (!canValidateTrainingConfiguration) return
    setMessage('')
    try {
      const result = await trainingConfigurationMutation.mutateAsync()
      setMessage(result.message)
      setTrainingDialogOpen(false)
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function refreshIdentityQueries({ showMessage = false } = {}) {
    const [datasetResult, summaryResult] = await Promise.all([datasetQuery.refetch(), summaryQuery.refetch()])
    if (datasetResult.error || summaryResult.error) {
      if (showMessage) setMessage(parseApiError(datasetResult.error || summaryResult.error))
      return false
    }
    if (showMessage) setMessage('Status sincronizado com o estado mais recente da identidade.')
    return true
  }

  async function handleRefreshExecutionState() {
    setMessage('')
    if (previewActive) await handleRefreshPreviewStatus({ silent: true })
    await refreshIdentityQueries({ showMessage: true })
  }

  async function handleStartTraining() {
    if (!canStartTraining) return
    setMessage('')
    try {
      const result = await trainingStartMutation.mutateAsync({ confirmation: TRAINING_CONFIRMATION })
      setMessage(result.message || 'Criação da identidade iniciada.')
      setTrainingStartDialogOpen(false)
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleRefreshTrainingStatus({ silent = false } = {}) {
    if (!trainingActive || trainingRefreshInFlight.current) return
    trainingRefreshInFlight.current = true
    try {
      const result = await trainingStatusMutation.mutateAsync()
      await refreshIdentityQueries()
      if (!silent && result.message) setMessage(result.message)
    } catch (error) {
      if (!silent) setMessage(parseApiError(error))
    } finally {
      trainingRefreshInFlight.current = false
    }
  }

  useEffect(() => {
    if (!trainingActive) return undefined

    const refresh = () => { void handleRefreshTrainingStatus({ silent: true }) }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    refresh()
    const timer = window.setInterval(refresh, 10000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [trainingActive, actor.id])


  async function handleStartPreview() {
    setMessage('')
    try {
      const result = await previewStartMutation.mutateAsync({ confirmation: PREVIEW_CONFIRMATION })
      setMessage(result.message || 'A prévia privada começou a ser preparada.')
      setPreviewDialogOpen(false)
      setReviewWorkspaceOpen(true)
      await refreshIdentityQueries()
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleRefreshPreviewStatus({ silent = false } = {}) {
    if (!previewActive || previewRefreshInFlight.current) return
    previewRefreshInFlight.current = true
    try {
      const result = await previewStatusMutation.mutateAsync()
      await refreshIdentityQueries()
      if (!silent && result.message) setMessage(result.message)
    } catch (error) {
      if (!silent) setMessage(parseApiError(error))
    } finally {
      previewRefreshInFlight.current = false
    }
  }

  useEffect(() => {
    if (!previewActive) return undefined
    const refresh = () => { void handleRefreshPreviewStatus({ silent: true }) }
    const handleVisibility = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const timer = window.setInterval(refresh, 10000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [previewActive, actor.id])

  useEffect(() => {
    let cancelled = false
    const localUrls: string[] = []
    if (!previewMediaAvailable) {
      setPreviewUrls((current) => { Object.values(current).forEach((url) => URL.revokeObjectURL(url)); return {} })
      return undefined
    }
    setPreviewLoading(true)
    Promise.all((identityPreview?.assets || []).map(async (asset) => {
      const blob = await getActorIdentityPreviewBlob(actor.id, asset.assetKey)
      const url = URL.createObjectURL(blob)
      localUrls.push(url)
      return [asset.assetKey, url] as const
    })).then((entries) => { if (!cancelled) setPreviewUrls(Object.fromEntries(entries)) })
      .catch((error) => { if (!cancelled) setMessage(parseApiError(error)) })
      .finally(() => { if (!cancelled) setPreviewLoading(false) })
    return () => { cancelled = true; localUrls.forEach((url) => URL.revokeObjectURL(url)) }
  }, [previewMediaAvailable, actor.id, identityPreview?.completedAt, identityPreview?.invalidatedAt])

  async function handleRunForensicAudit() {
    setMessage('')
    try {
      const result = await forensicAuditMutation.mutateAsync({ confirmation: FORENSIC_CONFIRMATION })
      setMessage(result.nextAction || 'Verificação profunda concluída sem uso de GPU.')
      await refreshIdentityQueries()
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleRunTrainingTargetAudit() {
    setMessage('')
    try {
      const result = await trainingTargetAuditMutation.mutateAsync({ confirmation: TRAINING_TARGET_AUDIT_CONFIRMATION })
      setMessage(result.nextAction || 'Auditoria do alvo de treinamento concluída sem uso de GPU.')
      await refreshIdentityQueries()
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleIdentityDecision(action: 'approve' | 'reject', reason: string, notes: string) {
    setMessage('')
    try {
      const result = await identityDecisionMutation.mutateAsync(action === 'approve'
        ? { action: 'approve', confirmation: APPROVE_IDENTITY_CONFIRMATION, notes: notes || null }
        : { action: 'reject', confirmation: REJECT_IDENTITY_CONFIRMATION, reason, notes: notes || null })
      setMessage(result.message)
      setIdentityDecisionDialog(null)
      await refreshIdentityQueries()
    } catch (error) {
      setMessage(parseApiError(error))
    }
  }

  async function handleRefreshTrainingConfiguration() {
    setMessage('')
    const [datasetResult, summaryResult] = await Promise.all([
      datasetQuery.refetch(),
      summaryQuery.refetch(),
    ])
    if (datasetResult.error || summaryResult.error) {
      setMessage(parseApiError(datasetResult.error || summaryResult.error))
      return
    }
    setMessage(datasetResult.data?.trainingConfiguration?.ready
      ? 'Configuração encontrada. Revise os itens e valide a preparação segura.'
      : 'Verificação atualizada. A configuração pendente continua indicada abaixo.')
  }

  if (summaryQuery.isLoading || datasetQuery.isLoading) {
    return <div className="flex min-h-[420px] items-center justify-center text-zinc-400"><Loader2 className="mr-3 animate-spin" size={22} /> Carregando preparação da identidade...</div>
  }

  if (summaryQuery.isError || datasetQuery.isError || !summary || !dataset) {
    return (
      <section className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-400 hover:text-white"><ArrowLeft size={16} /> Voltar ao ator</button>
        <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-6 text-sm font-bold text-rose-100">{parseApiError(summaryQuery.error || datasetQuery.error)}</div>
      </section>
    )
  }

  const materialsPrepared = authorizationActive && manifestRegistered && trainingConfigured
  const journey: Array<{ title: string; state: JourneyState }> = [
    { title: 'Materiais preparados', state: materialsPrepared ? 'done' : 'current' },
    { title: 'Criar identidade', state: trainingCompleted ? 'done' : materialsPrepared ? 'current' : 'locked' },
    { title: 'Revisar identidade', state: identityApproved ? 'done' : reviewRequired || trainingCompleted ? 'current' : 'locked' },
  ]

  return (
    <section data-admin-section="actor-identity-preparation-page" data-actor-profile-id={actor.id} className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500 transition hover:text-white"><ArrowLeft size={16} /> Voltar ao perfil</button>
        <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-lg font-black text-amber-100">{actorInitials(actorName)}</div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Identidade digital do ator</p>
              <h2 className="mt-1 text-3xl font-black text-white">{actorName}</h2>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">O conjunto aprovado e todas as ações desta página ficam vinculados somente a {actorName}.</p>
            </div>
          </div>
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <span className={identityApproved
              ? 'w-fit rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-100'
              : reviewRequired
                ? 'w-fit rounded-full border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-violet-100'
                : trainingActive
                  ? 'w-fit rounded-full border border-sky-300/20 bg-sky-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-100'
                  : 'w-fit rounded-full border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-amber-100'}
            >
              Identidade: {identityStatus}
            </span>
            <button
              type="button"
              onClick={() => void handleRefreshExecutionState()}
              disabled={summaryQuery.isFetching || datasetQuery.isFetching || trainingStatusMutation.isPending || previewStatusMutation.isPending}
              className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCcw size={13} className={summaryQuery.isFetching || datasetQuery.isFetching ? 'animate-spin' : ''} />
              Atualizar status
            </button>
            <p className="text-[11px] text-zinc-600">Última sincronização: {formatIdentityTimestamp(lastSynchronizedAt)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetric label="Fotos aprovadas" value={`${dataset.summary.validUniqueImages}/${dataset.thresholds.minimumImages}`} helper="Quantidade mínima atendida" />
        <SummaryMetric label="Vídeos aprovados" value={`${dataset.summary.validUniqueVideos}/${dataset.thresholds.minimumVideos}`} helper="Quantidade mínima atendida" />
        <SummaryMetric label="Pendências" value={`${dataset.summary.pendingReviewAssets + diagnostics.actionRequired}`} helper="Itens do conjunto que exigem ação" />
        <SummaryMetric label="Identidade" value={identityStatus} helper={identityReview?.nextAction || 'Estado operacional consolidado'} />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {journey.map((item, index) => <JourneyStep key={item.title} number={index + 1} title={item.title} state={item.state} />)}
      </div>

      {!authorizationActive && (
        <div className="rounded-[2rem] border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.08] to-transparent p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3"><UserRoundCheck size={23} className="text-amber-200" /><p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Próxima ação</p></div>
              <h3 className="mt-3 text-2xl font-black text-white">Autorizar os materiais de {actorName} para criar sua identidade digital</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">A autorização permite registrar e preparar o conjunto aprovado deste ator. Ela não inicia treinamento, não cria produtos e não associa nenhuma identidade externa.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {['Ator e mapeamento aprovados', 'Conjunto visual completo', 'Produção continua bloqueada'].map((label) => (
                  <div key={label} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-xs font-bold text-zinc-300"><CheckCircle2 size={16} className="shrink-0 text-emerald-200" />{label}</div>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => setAuthorizationDialogOpen(true)} disabled={!canAuthorize} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
              <ShieldCheck size={17} /> Autorizar preparação da identidade
            </button>
          </div>

          <details className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-400"><span>Adicionar observação administrativa</span><ChevronDown size={16} /></summary>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1500} placeholder="Observação opcional sobre a conferência dos materiais." className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-amber-300/40" />
          </details>

          {!materialsComplete && <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100"><AlertTriangle className="mr-2 inline" size={17} />O conjunto ainda possui pendências e não pode ser autorizado.</div>}
        </div>
      )}

      {authorizationActive && !manifestRegistered && (
        <div className="rounded-[2rem] border border-sky-300/20 bg-sky-300/[0.05] p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3"><Database size={23} className="text-sky-200" /><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Próxima ação</p></div>
              <h3 className="mt-3 text-2xl font-black text-white">Registrar e congelar o conjunto aprovado</h3>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">O sistema criará o manifesto imutável dos {includedAssets.length} materiais aprovados. Nenhum arquivo será copiado e nenhum treinamento será iniciado.</p>
              {datasetRegistrationBlockers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/[0.07] p-4 text-sm text-rose-100">
                  <AlertTriangle className="mr-2 inline" size={17} />O conjunto ainda possui uma pendência própria dos materiais e não pode ser registrado.
                </div>
              )}
              {datasetRegistrationBlockers.length === 0 && trainingConfigurationBlockers.length > 0 && (
                <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/[0.06] p-4 text-sm text-sky-100">
                  <Info className="mr-2 inline" size={17} />A configuração do treinamento será tratada na próxima etapa e não impede o registro deste conjunto.
                </div>
              )}
            </div>
            <button type="button" onClick={() => setFreezeDialogOpen(true)} disabled={!canRegisterManifest} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-sky-200 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
              <Fingerprint size={17} /> Registrar conjunto aprovado
            </button>
          </div>
        </div>
      )}

      {manifestRegistered && (
        <div className="space-y-4">
          <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.055] p-6">
            <div className="flex items-start gap-4">
              <Sparkles size={24} className="mt-0.5 shrink-0 text-emerald-200" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Conjunto registrado</p>
                <h3 className="mt-2 text-2xl font-black text-white">Os materiais aprovados foram congelados com segurança</h3>
                <p className="mt-3 text-sm leading-relaxed text-zinc-400">Manifesto {latestRun?.datasetManifestSha256Prefix || 'protegido'} registrado. O modelo-base, o ambiente de treinamento e a execução continuam separados deste conjunto.</p>
              </div>
            </div>
          </div>

          {!trainingConfigured && (
            <div className="rounded-[2rem] border border-violet-300/20 bg-violet-300/[0.05] p-6">
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="flex items-center gap-3"><ServerCog size={23} className="text-violet-200" /><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Próxima ação • Preparar a configuração do treinamento</p></div>
                    <h3 className="mt-3 text-2xl font-black text-white">Validar a configuração segura do treinamento</h3>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-400">Esta conferência vincula o conjunto registrado ao modelo-base, ao armazenamento privado e à versão controlada do ambiente. Ela não inicia treinamento e não altera os produtos já construídos.</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => void handleRefreshTrainingConfiguration()}
                      disabled={datasetQuery.isFetching || summaryQuery.isFetching || trainingConfigurationMutation.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <RefreshCcw size={16} className={datasetQuery.isFetching || summaryQuery.isFetching ? 'animate-spin' : ''} /> Atualizar verificação
                    </button>
                    <button
                      type="button"
                      onClick={() => setTrainingDialogOpen(true)}
                      disabled={!canValidateTrainingConfiguration}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-violet-200 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      <ShieldCheck size={17} /> Validar configuração
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <ConfigurationItem
                    label="Modelo-base da identidade"
                    value={dataset.trainingConfiguration.baseModelRevisionConfigured
                      ? `${friendlyBaseModelName(dataset.trainingConfiguration.baseModel)} • revisão fixada`
                      : friendlyBaseModelName(dataset.trainingConfiguration.baseModel)}
                    ready={Boolean(dataset.trainingConfiguration.baseModel) && dataset.trainingConfiguration.baseModelRevisionConfigured}
                    helper="O modelo precisa estar vinculado a uma revisão imutável antes da validação."
                    icon={<Fingerprint size={18} />}
                  />
                  <ConfigurationItem
                    label="Assinatura de integridade"
                    value={dataset.trainingConfiguration.baseModelLockVerified
                      ? `Lock auditável confirmado • ${dataset.trainingConfiguration.baseModelLockFingerprintPrefix || dataset.trainingConfiguration.baseModelFingerprintPrefix || 'validado'}`
                      : dataset.trainingConfiguration.baseModelLockConfigured
                        ? 'Lock encontrado, aguardando conferência'
                        : 'Lock auditável ainda não gerado'}
                    ready={dataset.trainingConfiguration.baseModelLockVerified}
                    helper="Confere a revisão e os nove arquivos oficiais exigidos pelo treinamento, sem baixar os pesos nesta etapa."
                    icon={<ShieldCheck size={18} />}
                  />
                  <ConfigurationItem
                    label="Armazenamento privado"
                    value={dataset.trainingConfiguration.privateTrainingBucketConfigured ? 'Espaço privado confirmado' : 'Espaço privado pendente'}
                    ready={dataset.trainingConfiguration.privateTrainingBucketConfigured}
                    helper="Destino interno e não público para os artefatos da preparação."
                    icon={<HardDrive size={18} />}
                  />
                  <ConfigurationItem
                    label="Ambiente controlado"
                    value={dataset.trainingConfiguration.trainingEngineCommitConfigured ? 'Versão controlada confirmada' : 'Versão controlada pendente'}
                    ready={dataset.trainingConfiguration.trainingEngineCommitConfigured && dataset.trainingConfiguration.dryRunOnly && dataset.trainingConfiguration.realTrainingDisabled}
                    helper="A validação ocorre em modo seguro, com o treinamento real desligado."
                    icon={<ServerCog size={18} />}
                  />
                </div>

                {!dataset.trainingConfiguration.ready && (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4">
                    <p className="text-sm font-black text-amber-100">A configuração ainda depende de uma ação da equipe técnica: gerar o lock auditável do modelo-base.</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">A equipe técnica deve resolver uma revisão imutável do modelo, conferir os nove artefatos oficiais e aplicar a assinatura resultante no backend. Depois, reinicie o serviço e use <strong className="text-zinc-200">Atualizar verificação</strong>.</p>
                  </div>
                )}

                {dataset.trainingConfiguration.ready && (
                  <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] p-4 text-sm text-emerald-100">
                    <CheckCircle2 className="mr-2 inline" size={17} />Todos os itens estão prontos para uma validação segura. Nenhum treinamento será iniciado ao confirmar.
                  </div>
                )}
              </div>
            </div>
          )}

          {trainingConfigured && (
            <div className="rounded-[2rem] border border-sky-300/20 bg-sky-300/[0.045] p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3"><Sparkles size={24} className="text-sky-200" /><p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Criação da identidade</p></div>
                  <h3 className="mt-3 text-2xl font-black text-white">{trainingFailed ? 'A identidade não foi criada' : trainingCompleted ? 'Identidade criada e aguardando revisão' : trainingActive ? `Criando a identidade de ${actorName}` : 'Identidade pronta para criação'}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{trainingFailed
                    ? 'O job terminou sem produzir adapter. Nenhuma identidade foi criada e todos os produtos continuam bloqueados.'
                    : trainingCompleted
                      ? 'A identidade foi criada e continua bloqueada até uma revisão simples e visual.'
                      : trainingActive
                        ? 'O sistema está preparando os materiais e treinando a identidade. O andamento é atualizado automaticamente.'
                        : 'Todas as verificações internas foram concluídas. Um único clique inicia a criação controlada da identidade deste ator.'}</p>
                </div>
                {!trainingActive && !trainingCompleted && !trainingFailed && (
                  <button type="button" onClick={() => setTrainingStartDialogOpen(true)} disabled={!canStartTraining} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-sky-200 px-6 py-4 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
                    <Sparkles size={18} /> Criar identidade
                  </button>
                )}
              </div>

              {trainingActive && (
                <div className="mt-5 rounded-2xl border border-sky-300/15 bg-black/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3"><Loader2 size={18} className="animate-spin text-sky-200" /><p className="text-sm font-black text-white">{latestRun?.status === 'training_pending' ? 'Aguardando servidor de criação' : 'Treinamento em andamento'}</p></div>
                    {typeof trainingProgress === 'number' && <span className="text-sm font-black text-sky-100">{trainingProgress}%</span>}
                  </div>
                  {typeof trainingProgress === 'number' && (
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-sky-200 transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, trainingProgress))}%` }} />
                    </div>
                  )}
                  <p className="mt-3 text-xs text-zinc-500">Job protegido {trainingJob?.providerJobIdPrefix || 'em registro'} {trainingJob?.targetSteps ? `• meta ${trainingJob.targetSteps} passos` : ''} • produtos continuam bloqueados</p>
                  <p className="mt-2 text-[11px] text-zinc-600">Sincronização automática a cada 10 segundos e ao retornar para esta aba.</p>
                </div>
              )}

              {!trainingActive && !trainingCompleted && !trainingFailed && !latestRun?.executionPlan?.runtimeExecutionEnabled && (
                <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4">
                  <p className="text-sm font-black text-amber-100">A criação real ainda não foi liberada para este ator.</p>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">A equipe técnica precisa armar a primeira execução controlada. Depois disso, este mesmo botão ficará disponível e todo o restante acontecerá automaticamente.</p>
                </div>
              )}

              {trainingFailed && (
                <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] p-5">
                  <div className="flex items-start gap-3"><AlertTriangle size={20} className="mt-0.5 shrink-0 text-rose-200" /><div><p className="text-sm font-black text-rose-100">Falha na criação da identidade — nenhuma identidade foi criada</p><p className="mt-2 text-sm leading-relaxed text-rose-100/80">{trainingJob?.lastError || 'O servidor encerrou o job antes de produzir o adapter.'}</p></div></div>
                  <div className="mt-4 grid gap-2 text-xs text-zinc-400 md:grid-cols-2">
                    <p><strong className="text-zinc-300">Código:</strong> {trainingJob?.failureCode || 'IDENTITY_TRAINING_PROVIDER_FAILED'}</p>
                    <p><strong className="text-zinc-300">Job:</strong> {trainingJob?.providerJobIdPrefix || 'não informado'}</p>
                    <p><strong className="text-zinc-300">Adapter:</strong> não criado</p>
                    <p><strong className="text-zinc-300">Produtos:</strong> continuam bloqueados</p>
                  </div>
                  <p className="mt-4 rounded-xl border border-white/8 bg-black/20 px-3 py-3 text-xs leading-relaxed text-zinc-400">{trainingJob?.operatorMessage || 'A equipe técnica precisa corrigir o trainer e preparar uma nova tentativa controlada. O sistema não fará nova cobrança nem reenvio automático.'}</p>
                </div>
              )}

              <details className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4">
                <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Auditoria interna da criação</summary>
                <div className="mt-3 grid gap-2 text-xs text-zinc-500 md:grid-cols-2">
                  <p><strong className="text-zinc-300">Plano interno:</strong> {executionPlanPrepared ? 'preparado' : 'será preparado automaticamente'}</p>
                  <p><strong className="text-zinc-300">Estado:</strong> {latestRun?.statusLabel || 'aguardando'}</p>
                  <p><strong className="text-zinc-300">Servidor:</strong> {latestRun?.executionPlan?.runtimeExecutionEnabled ? 'conectado' : 'não conectado'}</p>
                  <p><strong className="text-zinc-300">Produtos:</strong> bloqueados até aprovação</p>
                </div>
              </details>
            </div>
          )}

          {(trainingCompleted || latestAdapter) && (
            <div className="rounded-[2rem] border border-violet-300/20 bg-violet-300/[0.045] p-6" data-identity-review-workspace>
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3"><ScanSearch size={24} className="text-violet-200" /><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Revisão da identidade</p></div>
                  <h3 className="mt-3 text-2xl font-black text-white">{identityApproved ? 'Identidade aprovada' : 'Identidade criada'}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{identityApproved
                    ? 'A identidade já foi aprovada e está pronta para a próxima etapa do fluxo.'
                    : 'O treinamento terminou. Antes de liberar a identidade para produção, falta apenas conferir uma prévia visual privada.'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewWorkspaceOpen((value) => !value)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-200 px-6 py-4 text-xs font-black uppercase tracking-[0.12em] text-zinc-950"
                >
                  <ScanSearch size={18} /> {reviewWorkspaceOpen ? 'Fechar' : 'Ver próxima etapa'}
                </button>
              </div>

              {reviewWorkspaceOpen && (
                <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-5">
                  {identityApproved ? (
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-200" />
                      <div>
                        <p className="text-lg font-black text-white">Revisão concluída</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">A identidade foi aprovada. Os próximos passos de integração continuam controlados pelo sistema.</p>
                      </div>
                    </div>
                  ) : previewMediaAvailable ? (
                    <div>
                      <div className="flex items-start gap-3">
                        {forensicFailed ? <AlertTriangle size={22} className="mt-0.5 shrink-0 text-rose-200" /> : previewReady ? <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-emerald-200" /> : <Info size={22} className="mt-0.5 shrink-0 text-amber-200" />}
                        <div>
                          <p className="text-lg font-black text-white">{forensicFailed
                            ? 'Kit preservado como evidência inválida'
                            : previewReady
                              ? 'Comparação A/B neutra pronta para inspeção'
                              : 'Kit disponível, porém ainda não comprova a identidade'}</p>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{forensicFailed
                            ? 'O kit reutilizou materiais do mapeamento como controle visual e não demonstra o comportamento da LoRA em vídeos novos. As mídias permanecem privadas para auditoria, mas não podem aprovar ou reprovar a qualidade do adapter.'
                            : previewReady
                              ? 'A evidência passou pelo perfil de vídeo-base aleatório, controle apenas de movimento e comparação A/B com a mesma seed.'
                              : 'Antes de qualquer novo teste pago, execute a verificação profunda sem GPU para validar o arquivo do adapter, a linhagem das fontes e a semelhança com o material original.'}</p>
                        </div>
                      </div>

                      <div className="mt-5 space-y-4">
                        {previewLoading ? (
                          <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-black text-sm font-bold text-zinc-400"><Loader2 size={20} className="animate-spin" /> Abrindo evidências protegidas...</div>
                        ) : (
                          <>
                            <div className="grid gap-4 lg:grid-cols-2">
                              {previewVideoAssets.map((asset) => previewUrls[asset.assetKey] ? (
                                <figure key={asset.assetKey} className="overflow-hidden rounded-2xl border border-white/10 bg-black">
                                  <video controls playsInline preload="metadata" src={previewUrls[asset.assetKey]} className="aspect-video w-full bg-black object-contain" />
                                  <figcaption className="border-t border-white/10 px-3 py-3 text-xs font-bold text-zinc-300">{asset.label}</figcaption>
                                </figure>
                              ) : null)}
                            </div>
                          </>
                        )}
                      </div>

                      <div className={forensicStatus === 'passed'
                        ? 'mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4'
                        : forensicFailed
                          ? 'mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4'
                          : 'mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4'}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <Microscope size={21} className={forensicStatus === 'passed' ? 'mt-0.5 shrink-0 text-emerald-200' : forensicFailed ? 'mt-0.5 shrink-0 text-rose-200' : 'mt-0.5 shrink-0 text-amber-200'} />
                            <div>
                              <p className="text-sm font-black text-white">{forensicStatus === 'passed' ? 'Verificação profunda concluída' : forensicFailed ? 'Verificação profunda encontrou evidência inválida' : 'Verificação profunda obrigatória antes de gastar GPU'}</p>
                              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{forensicStatus === 'passed'
                                ? 'O arquivo privado, checksum, estrutura do adapter e linhagem foram conferidos. O próximo teste pago continua sujeito ao contrato final de vídeo A/B.'
                                : forensicFailed
                                  ? 'O adapter permanece em qa_pending e sem conclusão funcional. Corrija o contrato do teste; não repita a geração atual.'
                                  : 'Esta ação não chama RunPod nem liga GPU. Ela realiza somente leituras privadas do R2 e processamento de CPU para verificar o adapter e comparar as evidências existentes.'}</p>
                            </div>
                          </div>
                          {forensicStatus === 'not_run' && (
                            <button type="button" onClick={() => void handleRunForensicAudit()} disabled={forensicAuditMutation.isPending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
                              {forensicAuditMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Microscope size={17} />}
                              {forensicAuditMutation.isPending ? 'Verificando...' : 'Verificação profunda sem GPU'}
                            </button>
                          )}
                        </div>
                        {forensicAudit?.blockers?.length ? (
                          <div className="mt-4 space-y-2">
                            {forensicAudit.blockers.slice(0, 8).map((item) => (
                              <div key={item.code} className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                                <p className="text-xs font-black text-white">{item.message}</p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{item.code}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className={trainingTargetFailed
                        ? 'mt-5 rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-4'
                        : 'mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-4'}>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex items-start gap-3">
                            <ServerCog size={21} className={trainingTargetFailed ? 'mt-0.5 shrink-0 text-rose-200' : 'mt-0.5 shrink-0 text-amber-200'} />
                            <div>
                              <p className="text-sm font-black text-white">{trainingTargetFailed ? 'Alvo do treinamento atual é incompatível com a validação final' : 'Auditoria do alvo real do treinamento'}</p>
                              <p className="mt-2 text-xs leading-relaxed text-zinc-400">{trainingTargetFailed
                                ? 'O adapter atual foi confirmado no ramo de controle VACE, mas não comprovou identidade geral no gerador de vídeo. Ele permanece em qa_pending.'
                                : 'Esta auditoria lê apenas o adapter privado e o contrato atual para confirmar em qual componente a LoRA foi treinada. Não chama RunPod, não liga GPU e não inicia novo treinamento.'}</p>
                              <p className="mt-2 text-xs font-black text-amber-100">Nenhum novo teste pago será liberado por esta auditoria.</p>
                            </div>
                          </div>
                          {trainingTargetStatus === 'not_run' && (
                            <button type="button" onClick={() => void handleRunTrainingTargetAudit()} disabled={trainingTargetAuditMutation.isPending} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45">
                              {trainingTargetAuditMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <ServerCog size={17} />}
                              {trainingTargetAuditMutation.isPending ? 'Auditando...' : 'Auditar alvo do treinamento sem GPU'}
                            </button>
                          )}
                        </div>
                        {trainingTargetAudit?.blockers?.length ? (
                          <div className="mt-4 space-y-2">
                            {trainingTargetAudit.blockers.slice(0, 8).map((item) => (
                              <div key={item.code} className="rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                                <p className="text-xs font-black text-white">{item.message}</p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{item.code}</p>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-5 rounded-2xl border border-sky-300/15 bg-sky-300/[0.045] p-4">
                        <div className="flex items-start gap-3">
                          <PlayCircle size={21} className="mt-0.5 shrink-0 text-sky-200" />
                          <div>
                            <p className="text-sm font-black text-white">Foco da validação final: produção de vídeo</p>
                            <p className="mt-2 text-xs leading-relaxed text-zinc-400">A identidade será validada para vídeos criados por prompt e para vídeos com bases aleatórias. O teste final deverá usar vídeo-base independente do ator, controle apenas de movimento e comparação com/sem LoRA na mesma seed. Materiais brutos do mapeamento não poderão controlar a aparência do resultado.</p>
                            <p className="mt-3 text-xs font-black text-amber-100">Novo teste pago: {identityReview?.videoValidation?.nextPaidTestAllowed ? 'liberado pelo contrato completo' : 'bloqueado até a verificação e o contrato A/B estarem completos'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : previewActive ? (
                    <div className="flex items-start gap-3">
                      <Loader2 size={22} className="mt-0.5 shrink-0 animate-spin text-sky-200" />
                      <div>
                        <p className="text-lg font-black text-white">Preparando prévia privada A/B</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">Os dois ramos estão sendo preparados com o mesmo vídeo neutro, prompt, seed e modelo-base. Esta página se atualiza automaticamente.</p>
                      </div>
                    </div>
                  ) : canPreparePreview ? (
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <PlayCircle size={22} className="mt-0.5 shrink-0 text-sky-200" />
                        <div>
                          <p className="text-lg font-black text-white">Prévia privada A/B pronta para execução</p>
                          <p className="mt-2 text-sm leading-relaxed text-zinc-400">O gate one-shot está ativo para este ator, run e adapter. O ramo A usa o modelo-base sem LoRA; o ramo B usa a mesma configuração com a LoRA em força 0,65.</p>
                          <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-sky-100">Uma única execução privada • sem publicação • sem liberação automática</p>
                          {previewPolicy?.expiresAt && <p className="mt-2 text-xs text-zinc-500">Janela válida até {formatIdentityTimestamp(previewPolicy.expiresAt)}.</p>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewDialogOpen(true)}
                        disabled={previewStartMutation.isPending}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-sky-200 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {previewStartMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <PlayCircle size={17} />}
                        {previewStartMutation.isPending ? 'Enviando...' : 'Preparar prévia privada A/B'}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <LockKeyhole size={22} className="mt-0.5 shrink-0 text-amber-200" />
                      <div>
                        <p className="text-lg font-black text-white">Prévia privada A/B ainda bloqueada</p>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-400">A janela one-shot precisa estar armada no backend para este ator, treinamento e adapter. A interface não envia job enquanto o gate real estiver fechado.</p>
                        <p className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-amber-100">RunPod e GPU permanecem protegidos.</p>
                      </div>
                    </div>
                  )}

                  {!identityApproved && latestAdapter && (
                    <div className="mt-5">
                      <div className="grid gap-3 md:grid-cols-2">
                        <button type="button" onClick={() => setIdentityDecisionDialog('approve')} disabled={!identityReview?.finalApprovalAllowed || identityDecisionMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-35"><ThumbsUp size={17} /> Aprovar identidade</button>
                        <button type="button" onClick={() => setIdentityDecisionDialog('reject')} disabled={!identityReview?.finalRejectionAllowed || identityDecisionMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-300/30 bg-rose-300/10 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-rose-100 disabled:cursor-not-allowed disabled:opacity-35"><ThumbsDown size={17} /> Rejeitar identidade</button>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-zinc-500">Aprovar só será habilitado após uma evidência válida de vídeo com base aleatória. Rejeitar registra o motivo e exige novo treinamento, mas não inicia GPU nem retry automaticamente.</p>
                    </div>
                  )}

                  {!identityApproved && (
                    <div className="mt-5 rounded-2xl border border-white/8 bg-black/25 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Próxima ação</p>
                      <p className="mt-1 text-sm font-bold text-white">{forensicStatus === 'not_run' && previewMediaAvailable
                        ? 'Executar a verificação profunda sem GPU antes de qualquer novo teste pago.'
                        : forensicFailed
                          ? 'Preservar o adapter em revisão e corrigir o contrato de vídeo com base aleatória; não repetir o kit atual.'
                          : previewReady
                            ? 'Registrar a decisão administrativa de aprovação ou rejeição.'
                            : previewActive
                              ? 'Aguardar a conclusão automática da evidência.'
                              : canPreparePreview
                                ? 'Preparar uma única prévia privada A/B para revisar a identidade.'
                                : 'Armar a janela one-shot no backend antes de preparar a prévia.'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <details className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Conjunto aprovado</p><h3 className="mt-1 text-lg font-black text-white">Ver os {includedAssets.length} materiais que formarão a identidade</h3></div>
          <ChevronDown size={18} className="text-zinc-500" />
        </summary>
        <div className="mt-5 grid gap-2 md:grid-cols-2">
          {includedAssets.map((item) => (
            <div key={item.assetId} className="flex items-center gap-3 rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.035] px-4 py-3">
              <FileCheck2 size={17} className="shrink-0 text-emerald-200" />
              <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{item.originalFilename || item.requirementTitle || 'Material aprovado'}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-zinc-600">{item.mediaType === 'video' ? 'Vídeo' : 'Foto'} • aprovado</p></div>
            </div>
          ))}
        </div>
      </details>

      {excludedAssets.length > 0 && (
        <details className="rounded-[2rem] border border-white/8 bg-black/15 p-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-zinc-400"><span>{excludedAssets.length} versões históricas preservadas, fora do conjunto</span><ChevronDown size={17} /></summary>
          <div className="mt-4 space-y-2">
            {excludedAssets.map((item) => <div key={item.assetId} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3"><p className="text-sm font-bold text-zinc-300">{item.originalFilename || item.requirementTitle || 'Material histórico'}</p><p className="mt-1 text-xs text-zinc-600">{item.reasonLabel}</p></div>)}
          </div>
        </details>
      )}

      <details className="rounded-[2rem] border border-white/8 bg-black/15 p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-black text-zinc-500"><span>Detalhes técnicos e auditoria</span><ChevronDown size={17} /></summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs leading-relaxed text-zinc-500">
            <p><strong className="text-zinc-300">Ator:</strong> {actorName}</p>
            <p className="mt-2"><strong className="text-zinc-300">ID do ator:</strong> {actor.id}</p>
            <p className="mt-2"><strong className="text-zinc-300">Mapeamento aprovado:</strong> Conjunto visual de {actorName}</p>
            <p className="mt-2"><strong className="text-zinc-300">ID do mapeamento:</strong> {dataset.mappingCase?.id || 'não encontrado'}</p>
          </div>
          <div className="rounded-2xl border border-white/8 bg-black/20 p-4 text-xs leading-relaxed text-zinc-500"><p><strong className="text-zinc-300">Autorização:</strong> {authorizationActive ? 'ativa para preparar a identidade' : 'ainda não registrada'}</p><p className="mt-2"><strong className="text-zinc-300">Conjunto:</strong> {manifestRegistered ? 'registrado e congelado' : 'aguardando registro'}</p><p className="mt-2"><strong className="text-zinc-300">Configuração:</strong> {trainingConfigured ? 'validada em modo seguro' : 'aguardando validação'}</p><p className="mt-2"><strong className="text-zinc-300">Preparação interna:</strong> {executionPlanPrepared ? `preparado • ${latestRun?.executionPlan?.sha256Prefix || 'assinatura protegida'}` : 'aguardando preparação'}</p><p className="mt-2"><strong className="text-zinc-300">Treinamento:</strong> {trainingStatusText}{typeof trainingProgress === 'number' ? ` • ${trainingProgress}%` : ''}</p><p className="mt-2"><strong className="text-zinc-300">Última sincronização:</strong> {formatIdentityTimestamp(lastSynchronizedAt)}</p><p className="mt-2"><strong className="text-zinc-300">Produtos:</strong> preservados e bloqueados até a identidade ser aprovada</p><p className="mt-2"><strong className="text-zinc-300">Vínculo comercial:</strong> somente na etapa futura de produto</p></div>
        </div>
        {!trainingConfigured && trainingConfigurationBlockers.length > 0 && (
          <details className="mt-3 rounded-2xl border border-white/8 bg-black/20 p-4">
            <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Códigos internos da configuração</summary>
            <div className="mt-3 space-y-2">
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Modelo:</strong> {dataset.trainingConfiguration.baseModel || 'não informado'}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Revisão:</strong> {dataset.trainingConfiguration.baseModelRevisionPrefix || 'pendente'}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Assinatura:</strong> {dataset.trainingConfiguration.baseModelFingerprintPrefix || 'pendente'}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Lock auditável:</strong> {dataset.trainingConfiguration.baseModelLockVerified ? 'válido' : dataset.trainingConfiguration.baseModelLockConfigured ? 'encontrado, porém não validado' : 'pendente'} {dataset.trainingConfiguration.baseModelArtifactCount ? `• ${dataset.trainingConfiguration.baseModelArtifactCount}/${dataset.trainingConfiguration.baseModelRequiredArtifactCount} artefatos` : ''}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Caminho do lock:</strong> {dataset.trainingConfiguration.baseModelLockPath || 'não informado'}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Bucket privado:</strong> {dataset.trainingConfiguration.privateTrainingBucketName || 'pendente'}</div>
              <div className="rounded-xl border border-white/8 bg-black/25 px-3 py-2 text-xs text-zinc-400"><strong className="text-zinc-300">Ambiente:</strong> {dataset.trainingConfiguration.trainingEngine || 'não informado'} {dataset.trainingConfiguration.trainingEngineCommit ? `• ${dataset.trainingConfiguration.trainingEngineCommit}` : ''}</div>
              {trainingConfigurationBlockers.map((item) => <div key={item.code} className="rounded-xl border border-white/8 bg-black/25 px-3 py-2"><p className="text-xs text-zinc-400">{item.code}</p></div>)}
            </div>
          </details>
        )}
      </details>

      {message && <div className={`rounded-2xl border p-4 text-sm font-bold ${authorizationMutation.isError || datasetRegistrationMutation.isError || trainingConfigurationMutation.isError || trainingStartMutation.isError || trainingStatusMutation.isError || previewStartMutation.isError || previewStatusMutation.isError || forensicAuditMutation.isError || trainingTargetAuditMutation.isError || identityDecisionMutation.isError ? 'border-rose-300/20 bg-rose-300/10 text-rose-100' : 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'}`}>{message}</div>}

      {authorizationDialogOpen && (
        <ConfirmationDialog
          title={`Autorizar identidade de ${actorName}`}
          description={`Você está autorizando exclusivamente o uso dos materiais aprovados de ${actorName} para preparar sua identidade digital. Nenhum produto ou identidade externa será associado.`}
          confirmLabel="Confirmar autorização"
          actorName={actorName}
          imageCount={dataset.summary.validUniqueImages}
          videoCount={dataset.summary.validUniqueVideos}
          pending={authorizationMutation.isPending}
          pendingLabel="Autorizando..."
          onClose={() => setAuthorizationDialogOpen(false)}
          onConfirm={() => void handleAuthorize()}
        />
      )}

      {freezeDialogOpen && (
        <ConfirmationDialog
          title="Registrar conjunto aprovado"
          description="O manifesto será congelado com os materiais aprovados deste ator. Isso ainda não inicia GPU, RunPod ou treinamento."
          confirmLabel="Registrar conjunto"
          actorName={actorName}
          imageCount={dataset.summary.validUniqueImages}
          videoCount={dataset.summary.validUniqueVideos}
          pending={datasetRegistrationMutation.isPending}
          pendingLabel="Registrando..."
          onClose={() => setFreezeDialogOpen(false)}
          onConfirm={() => void handleRegisterManifest()}
        />
      )}


      {trainingDialogOpen && (
        <ConfirmationDialog
          title="Validar configuração do treinamento"
          description={`A configuração segura de ${actorName} será vinculada ao conjunto já registrado. Esta ação não inicia treinamento, não liga GPU e não altera a fábrica de produtos.`}
          confirmLabel="Validar configuração"
          actorName={actorName}
          imageCount={dataset.summary.validUniqueImages}
          videoCount={dataset.summary.validUniqueVideos}
          pending={trainingConfigurationMutation.isPending}
          pendingLabel="Validando..."
          onClose={() => setTrainingDialogOpen(false)}
          onConfirm={() => void handleValidateTrainingConfiguration()}
        />
      )}



      {previewDialogOpen && (
        <ConfirmationDialog
          title={`Preparar prévia privada A/B de ${actorName}`}
          description={`Será executada uma única comparação privada sobre o vídeo neutro homologado. Os dois ramos usarão o mesmo modelo-base, prompt e seed; somente o ramo B receberá a LoRA em força 0,65. O treinamento não será repetido e nenhum produto será liberado.`}
          confirmLabel="Preparar prévia A/B"
          reviewText={`Confirmo uma única execução privada A/B para revisar a identidade de ${actorName}, sem publicação ou liberação automática.`}
          actorName={actorName}
          imageCount={dataset.summary.validUniqueImages}
          videoCount={dataset.summary.validUniqueVideos}
          pending={previewStartMutation.isPending}
          pendingLabel="Preparando..."
          onClose={() => setPreviewDialogOpen(false)}
          onConfirm={() => void handleStartPreview()}
        />
      )}


      {identityDecisionDialog && (
        <IdentityDecisionDialog
          action={identityDecisionDialog}
          actorName={actorName}
          pending={identityDecisionMutation.isPending}
          onClose={() => setIdentityDecisionDialog(null)}
          onConfirm={(reason, notes) => void handleIdentityDecision(identityDecisionDialog, reason, notes)}
        />
      )}


      {trainingStartDialogOpen && (
        <ConfirmationDialog
          title={`Criar identidade de ${actorName}`}
          description={`Esta ação inicia a criação real da identidade de ${actorName} usando o conjunto aprovado e o servidor privado. Haverá consumo de GPU. O resultado ficará aguardando revisão e nenhum produto será liberado automaticamente.`}
          confirmLabel="Criar identidade"
          reviewText={`Confirmo a criação real da identidade de ${actorName}, o consumo controlado de GPU e que o resultado continuará bloqueado até revisão.`}
          actorName={actorName}
          imageCount={dataset.summary.validUniqueImages}
          videoCount={dataset.summary.validUniqueVideos}
          pending={trainingStartMutation.isPending}
          pendingLabel="Iniciando criação..."
          onClose={() => setTrainingStartDialogOpen(false)}
          onConfirm={() => void handleStartTraining()}
        />
      )}
    </section>
  )
}
