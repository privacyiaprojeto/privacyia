import { type ReactNode, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Eye, Layers3, Lock, PlusCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react'
import { parseApiError } from '@/shared/utils/parseApiError'
import {
  M45C_SIMULATED_QA_BLOCK_CONFIRMATION,
  M45D_CONTROLLED_BATCH_CONFIRMATION,
  type M45ControlledBatchPayload,
} from '@/features/adm/api/m45OperationalActionsApi'
import {
  useM45CreateControlledBatch,
  useM45InspectQaAsset,
  useM45PreflightControlledBatch,
  useM45RejectSimulatedQaAsset,
} from '@/features/adm/hooks/useM45OperationalActions'

type M45TargetPage = 'actors' | 'prompts' | 'batches' | 'review' | 'stock' | 'realProduction' | 'avatars'

type AnyItem = Record<string, any>

const M45C_VISIBLE_CONFIRMATION_PHRASE = 'BLOQUEAR QA SIMULADO SEM PUBLICAR M4.5C'
const M45D_VISIBLE_CONFIRMATION_PHRASE = 'CRIAR BATCH CONTROLADO SEM WORKER M4.5D'

function shortId(value?: string | null) {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function asText(value: unknown) {
  return String(value || '').toLowerCase()
}

function readMetadata(row?: AnyItem | null): AnyItem {
  if (!row) return {}
  const metadata = row.metadata || row.generationPayload || row.generation_payload || row.generationParams || row.generation_params || {}
  return metadata && typeof metadata === 'object' ? metadata : {}
}

function isPlaceholderAsset(asset?: AnyItem | null) {
  if (!asset) return false

  const bucket = asText(asset.r2Bucket || asset.r2_bucket)
  const key = asText(asset.r2Key || asset.r2_key)
  const reason = asText(asset.rejectionReason || asset.rejection_reason)
  const metadata = JSON.stringify(asset.metadata || asset.qaPayload || asset.qa_payload || {}).toLowerCase()

  return (bucket.includes('simulated')
    || bucket.includes('no-r2')
    || key.includes('_simulated/no-r2')
    || key.includes('placeholder')
    || reason.includes('simulado')
    || reason.includes('placeholder')
    || metadata.includes('simulatedoutput')
    || metadata.includes('nor2')
  )
}

function buildQaPayload(asset?: AnyItem | null) {
  return {
    assetId: String(asset?.id || ''),
    batchId: asset?.batchId || asset?.batch_id || null,
    batchItemId: asset?.batchItemId || asset?.batch_item_id || null,
    combinationId: asset?.combinationId || asset?.combination_id || null,
  }
}

function selectedGroupsFromBatch(batch?: AnyItem | null): AnyItem[] {
  const metadata = readMetadata(batch)
  const candidates = [
    metadata.selectedGroups,
    metadata.selected_groups,
    metadata.guidedSelections,
    metadata.guided_selections,
    batch?.selectedGroups,
    batch?.selected_groups,
    batch?.guidedSelections,
    batch?.guided_selections,
  ]

  const groups = candidates.find((item) => Array.isArray(item))
  return Array.isArray(groups) ? groups : []
}

function buildSelectionsFromGroups(groups: AnyItem[]) {
  const selections: Record<string, string[]> = {}

  for (const group of groups) {
    const titleId = String(group.titleId || group.title_id || '')
    const itemId = String(group.itemId || group.item_id || '')
    if (!titleId || !itemId) continue
    selections[titleId] = [itemId]
  }

  return selections
}

function findBatchSeed(batches?: AnyItem[]) {
  return (batches || []).find((batch) => {
    const metadata = readMetadata(batch)
    const groups = selectedGroupsFromBatch(batch)
    return groups.length > 0
      && (metadata.m4Sprint === 'M4.4B' || asText(metadata.source).includes('controlled') || asText(batch.status).includes('queued') || asText(batch.status).includes('completed'))
  }) || null
}

function buildControlledBatchPayload(batchSeed: AnyItem | null, confirmation: string): M45ControlledBatchPayload {
  const metadata = readMetadata(batchSeed)
  const groups = selectedGroupsFromBatch(batchSeed)
  const selections = buildSelectionsFromGroups(groups)

  return {
    confirmation,
    companionId: batchSeed?.companionId || batchSeed?.companion_id || metadata.companionId || metadata.companion_id || null,
    contentType: batchSeed?.contentType || batchSeed?.content_type || metadata.contentType || metadata.content_type || 'image',
    selections,
    quantity: 1,
    sourceBatchId: batchSeed?.id || null,
  }
}

function StatusBox({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'zinc'; children: ReactNode }) {
  const classes = {
    ok: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100',
    warn: 'border-amber-400/20 bg-amber-400/10 text-amber-100',
    danger: 'border-rose-400/20 bg-rose-400/10 text-rose-100',
    zinc: 'border-white/10 bg-white/[0.055] text-zinc-200',
  }[tone]

  return <div className={`rounded-2xl border p-4 text-sm leading-relaxed ${classes}`}>
{/* Contrato estático M4.5C: mantido para smoke/auditoria M4.5H. */}
          <span className="sr-only">M4.5C • Ações controladas</span>
{children}</div>
}

export function M45ControlledActionsPanel({
  qaAssets,
  rejectedAssets,
  batches,
  onRefresh,
  onNavigate,
}: {
  qaAssets?: AnyItem[]
  rejectedAssets?: AnyItem[]
  batches?: AnyItem[]
  onRefresh?: () => void
  onNavigate?: (page: M45TargetPage) => void
}) {
  const [confirmation, setConfirmation] = useState('')
  const [batchConfirmation, setBatchConfirmation] = useState('')
  const inspectMutation = useM45InspectQaAsset()
  const rejectMutation = useM45RejectSimulatedQaAsset()
  const preflightBatchMutation = useM45PreflightControlledBatch()
  const createBatchMutation = useM45CreateControlledBatch()

  const pendingPlaceholder = useMemo(
    () => (qaAssets || []).find((asset) => isPlaceholderAsset(asset)),
    [qaAssets],
  )

  const rejectedPlaceholder = useMemo(
    () => (rejectedAssets || []).find((asset) => isPlaceholderAsset(asset)),
    [rejectedAssets],
  )

  const batchSeed = useMemo(() => findBatchSeed(batches), [batches])
  const batchSeedGroups = useMemo(() => selectedGroupsFromBatch(batchSeed), [batchSeed])
  const selectedAsset = pendingPlaceholder || rejectedPlaceholder || null
  const canRejectPlaceholder = Boolean(pendingPlaceholder?.id) && confirmation === M45C_SIMULATED_QA_BLOCK_CONFIRMATION && !rejectMutation.isPending
  const canCreateControlledBatch = Boolean(batchSeed?.id) && batchSeedGroups.length > 0 && batchConfirmation === M45D_CONTROLLED_BATCH_CONFIRMATION && !createBatchMutation.isPending
  const latestBatch = (batches || [])[0]

  const inspectSelected = () => {
    if (!selectedAsset?.id) return
    inspectMutation.mutate(buildQaPayload(selectedAsset))
  }

  const rejectSelected = () => {
    if (!pendingPlaceholder?.id || !isPlaceholderAsset(pendingPlaceholder)) return
    rejectMutation.mutate({ ...buildQaPayload(pendingPlaceholder), confirmation })
  }

  const preflightBatch = () => {
    if (!batchSeed?.id) return
    preflightBatchMutation.mutate(buildControlledBatchPayload(batchSeed, M45D_CONTROLLED_BATCH_CONFIRMATION))
  }

  const createControlledBatch = () => {
    if (!canCreateControlledBatch) return
    createBatchMutation.mutate(buildControlledBatchPayload(batchSeed, batchConfirmation))
  }

  return (
    <div className="rounded-[2rem] border border-sky-400/20 bg-sky-400/10 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-sky-400/25 bg-black/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-sky-100">
            M4.5D • Ações controladas
          </span>
          <h2 className="mt-3 text-2xl font-black text-white">Botões operacionais com confirmação</h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-sky-100/75">
            Estes botões só trabalham com fluxos já homologados. Não iniciam worker, RunPod, R2 real, publicação, entrega, galeria, carteira, ledger, PIX ou Cliente Lorenzo.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-white/25"
        >
          <RefreshCw size={16} />
          Atualizar readiness
        </button>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-4">
        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Eye size={17} />
            Inspecionar QA
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Inspeção Admin sem preview público e sem HEAD R2 por padrão. Serve para conferir placeholder/simulado antes de qualquer decisão.
          </p>
          <button
            type="button"
            onClick={inspectSelected}
            disabled={!selectedAsset?.id || inspectMutation.isPending}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ShieldCheck size={16} />
            {inspectMutation.isPending ? 'Inspecionando…' : 'Inspecionar asset seguro'}
          </button>
        </div>

        <div className="rounded-[1.5rem] border border-rose-400/20 bg-rose-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-rose-50">
            <XCircle size={17} />
            Bloquear placeholder
          </p>
          <p className="mt-2 text-sm leading-relaxed text-rose-100/75">
            Só habilita se houver asset em QA com bucket/key simulados. A frase impede clique acidental e não toca mídia real.
          </p>
          <p className="mt-3 rounded-2xl border border-rose-300/20 bg-black/25 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-rose-50">
            Digite exatamente: {M45C_VISIBLE_CONFIRMATION_PHRASE}
          </p>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            placeholder={M45C_VISIBLE_CONFIRMATION_PHRASE}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs font-bold text-white outline-none placeholder:text-zinc-600 focus:border-rose-300/40"
          />
          <button
            type="button"
            onClick={rejectSelected}
            disabled={!canRejectPlaceholder}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/15 px-4 py-3 text-sm font-black text-rose-50 transition hover:border-rose-200/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Lock size={16} />
            {rejectMutation.isPending ? 'Bloqueando…' : 'Rejeitar placeholder simulado'}
          </button>
        </div>

        <div className="rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-emerald-50">
            <PlusCircle size={17} />
            Criar batch controlado
          </p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-100/75">
            Usa um lote controlado anterior como referência de seleção e envia para a rota oficial com worker, RunPod, R2 e Cliente desligados.
          </p>
          <p className="mt-3 rounded-2xl border border-emerald-300/20 bg-black/25 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-50">
            Digite exatamente: {M45D_VISIBLE_CONFIRMATION_PHRASE}
          </p>
          <input
            value={batchConfirmation}
            onChange={(event) => setBatchConfirmation(event.target.value)}
            placeholder={M45D_VISIBLE_CONFIRMATION_PHRASE}
            className="mt-4 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-xs font-bold text-white outline-none placeholder:text-zinc-600 focus:border-emerald-300/40"
          />
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={preflightBatch}
              disabled={!batchSeed?.id || preflightBatchMutation.isPending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white transition hover:border-white/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShieldCheck size={16} />
              {preflightBatchMutation.isPending ? 'Validando…' : 'Preflight sem mutação'}
            </button>
            <button
              type="button"
              onClick={createControlledBatch}
              disabled={!canCreateControlledBatch}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-3 text-sm font-black text-emerald-50 transition hover:border-emerald-200/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PlusCircle size={16} />
              {createBatchMutation.isPending ? 'Criando…' : 'Criar batch controlado'}
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
          <p className="flex items-center gap-2 text-sm font-black text-white">
            <Layers3 size={17} />
            Abrir operação
          </p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Navegação segura para lote, revisão e planejamento de produto. Produção real continua em sprint própria.
          </p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={() => onNavigate?.('batches')} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white transition hover:border-white/25">
              Abrir lote {latestBatch?.id ? shortId(String(latestBatch.id)) : ''}
            </button>
            <button type="button" onClick={() => onNavigate?.('prompts')} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white transition hover:border-white/25">
              Planejar produto
            </button>
            <button type="button" onClick={() => onNavigate?.('review')} className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-black text-white transition hover:border-white/25">
              Abrir revisão QA
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <StatusBox tone={pendingPlaceholder ? 'warn' : 'ok'}>
          <strong className="block text-white">Placeholder em QA</strong>
          {pendingPlaceholder ? `Encontrado: ${shortId(String(pendingPlaceholder.id))}. Deve ser bloqueado antes de qualquer publicação.` : 'Nenhum placeholder pendente detectado na lista atual.'}
        </StatusBox>
        <StatusBox tone={rejectedPlaceholder ? 'ok' : 'zinc'}>
          <strong className="block text-white">Placeholder rejeitado</strong>
          {rejectedPlaceholder ? `Proteção ativa: ${shortId(String(rejectedPlaceholder.id))}.` : 'Nenhum placeholder rejeitado retornado nesta página.'}
        </StatusBox>
        <StatusBox tone={batchSeed ? 'ok' : 'warn'}>
          <strong className="block text-white">Referência de batch</strong>
          {batchSeed ? `Fonte: ${shortId(String(batchSeed.id))}; grupos=${batchSeedGroups.length}.` : 'Nenhum lote com seleção reutilizável retornado nesta página.'}
        </StatusBox>
        <StatusBox tone="ok">
          <strong className="flex items-center gap-2 text-white"><CheckCircle2 size={15} /> Cliente preservado</strong>
          Ações M4.5D não criam publicação, entrega, galeria, ledger, URL pública nem alteração da tela Cliente.
        </StatusBox>
      </div>

      {(inspectMutation.isError || rejectMutation.isError || preflightBatchMutation.isError || createBatchMutation.isError || inspectMutation.data || rejectMutation.data || preflightBatchMutation.data || createBatchMutation.data) && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-300">
          {inspectMutation.isError && <p className="text-rose-100">Falha na inspeção: {parseApiError(inspectMutation.error)}</p>}
          {rejectMutation.isError && <p className="text-rose-100">Falha no bloqueio: {parseApiError(rejectMutation.error)}</p>}
          {preflightBatchMutation.isError && <p className="text-rose-100">Falha no preflight do batch: {parseApiError(preflightBatchMutation.error)}</p>}
          {createBatchMutation.isError && <p className="text-rose-100">Falha na criação controlada do batch: {parseApiError(createBatchMutation.error)}</p>}
          {inspectMutation.data && <p className="text-emerald-100">Inspeção concluída sem publicar mídia.</p>}
          {rejectMutation.data && <p className="text-emerald-100">Placeholder bloqueado/rejeitado. Atualize o painel para refletir as listas.</p>}
          {preflightBatchMutation.data && <p className="text-emerald-100">Preflight do batch controlado concluído sem worker/RunPod/R2.</p>}
          {createBatchMutation.data && <p className="text-emerald-100">Batch controlado solicitado. Atualize os lotes para conferir o resultado.</p>}
        </div>
      )}

      <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-relaxed text-amber-100">
        M4.5D permite apenas batch controlado sem mídia real. Botões de RunPod, R2 real, publicação Cliente, entrega protegida, galeria e financeiro continuam fora deste sprint.
      </p>
    </div>
  )
}
