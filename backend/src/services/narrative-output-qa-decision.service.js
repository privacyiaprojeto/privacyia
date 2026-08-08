import { supabaseAdmin } from '../config/supabase.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const SPRINT = '6.3P2'
const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const CREDIT_LEDGER_TABLE = 'credit_ledger'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const APPROVE_CONFIRMATION_PHRASE = 'APROVAR SAIDA NARRATIVA SIMULADA 6.3P2'
const REJECT_CONFIRMATION_PHRASE = 'REJEITAR SAIDA NARRATIVA SIMULADA 6.3P2'

const ACTIONS = new Set(['approve', 'reject'])

function nowIso() {
  return new Date().toISOString()
}

function toBool(value) {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase())
}

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function cleanPayload(payload = {}) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
}

function buildSafety(extra = {}) {
  return {
    runPodCalledByThisService: false,
    r2RealUploadByThisService: false,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    databaseMutationExecutedByThisService: false,
    runPodMayBeCalledByWorkerAfterQueue: false,
    ...extra,
  }
}

function parseMissingColumn(error) {
  const message = String(error?.message || '')
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /record "[^"]+" has no field "([^"]+)"/i,
    /column ([a-zA-Z0-9_]+) does not exist/i,
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

async function safeSelectMaybeSingle({ table, filters = [], select = '*' }) {
  let query = supabaseAdmin.from(table).select(select)

  for (const filter of filters) {
    if (!filter?.column || !hasValue(filter.value)) continue
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.maybeSingle()
  if (error) return { ok: false, data: null, error: error.message || String(error), code: error.code || null }
  return { ok: true, data: data || null, error: null, code: null }
}

async function safeSelectList({ table, filters = [], limit = 50, select = '*' }) {
  let query = supabaseAdmin.from(table).select(select)

  for (const filter of filters) {
    if (!filter?.column || !hasValue(filter.value)) continue
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.limit(Math.min(Math.max(Number(limit || 50), 1), 200))
  if (error) return { ok: false, data: [], error: error.message || String(error), code: error.code || null }
  return { ok: true, data: data || [], error: null, code: null }
}

async function safeUpdateAdaptive({ table, id, payload, label = table }) {
  const removedColumns = []
  let currentPayload = cleanPayload({ ...payload })

  if (!id) return { ok: false, table, data: null, removedColumns, error: `${label}: id ausente`, code: 'MISSING_ID' }

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    if (!Object.keys(currentPayload).length) {
      return { ok: false, table, data: null, removedColumns, error: `${label}: payload vazio`, code: 'EMPTY_PAYLOAD' }
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .update(currentPayload)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (!error) return { ok: true, table, data, removedColumns, error: null, code: null }

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return { ok: false, table, data: null, removedColumns, error: error.message || `Falha ao atualizar ${label}.`, code: error.code || null }
  }

  return { ok: false, table, data: null, removedColumns, error: `Falha ao atualizar ${label}: limite de adaptação esgotado.`, code: 'ADAPTIVE_UPDATE_EXHAUSTED' }
}

function summarizeAsset(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  const qa = asObject(meta.qa)
  return {
    id: row.id,
    status: row.status || null,
    mediaType: row.media_type || meta.mediaType || meta.contentType || null,
    companionId: row.companion_id || row.avatar_id || meta.companionId || null,
    combinationId: row.combination_id || row.media_combination_id || meta.draftId || null,
    batchId: row.batch_id || meta.batchId || null,
    batchItemId: row.batch_item_id || row.media_generation_batch_item_id || meta.batchItemId || null,
    r2BucketPresent: Boolean(row.r2_bucket || row.bucket),
    r2KeyPresent: Boolean(row.r2_key || row.storage_key),
    urlPresent: Boolean(row.url || row.file_url || row.public_url),
    simulatedOutput: Boolean(meta.simulatedOutput || meta.simulatedNoR2),
    clientMediaVisibleBeforePurchase: Boolean(meta.clientMediaVisibleBeforePurchase),
    approvedByQa: Boolean(qa.approved),
    rejectedByQa: Boolean(qa.rejected),
    rejectionReasonPresent: Boolean(row.rejection_reason || qa.rejectionReason),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeDraft(row = {}) {
  const meta = asObject(row.metadata)
  const publication = asObject(meta.publication)
  const production = asObject(meta.production)
  const displayPayload = asObject(row.display_payload)
  const clientCard = asObject(meta.clientCard || displayPayload.clientCard)
  const contentType = row.media_type || meta.contentType || clientCard.contentType || null

  return {
    id: row.id,
    title: row.title || displayPayload.publicTitle || clientCard.title || 'Produto narrativo',
    publicTitle: displayPayload.publicTitle || clientCard.title || row.title || 'Produto narrativo',
    publicDescription: displayPayload.publicDescription || clientCard.description || '',
    contentType,
    companionId: row.companion_id || meta.companionId || null,
    status: row.status || meta.status || publication.status || 'draft',
    publicationStatus: publication.status || row.status || 'draft',
    productionStatus: production.status || 'not_requested',
    outputVariantId: production.outputVariantId || production.simulatedOutputVariantId || null,
    priceCredits: Number(row.price_credits ?? clientCard.priceCredits ?? 0),
    durationSeconds: Number(clientCard.durationSeconds ?? meta.narrative?.durationSeconds ?? 0),
    visibleToClient: Boolean(row.visible_to_client),
    adminOnly: row.admin_only !== false,
    actorVisible: Boolean(publication.actorVisible),
    clientCardVisible: Boolean(publication.clientCardVisible),
    clientMediaVisibleBeforePurchase: Boolean(publication.clientMediaVisibleBeforePurchase),
    internalPromptVisibleToClient: false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeBatch(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  return {
    id: row.id,
    status: row.status || null,
    batchType: row.batch_type || row.type || null,
    companionId: row.companion_id || row.avatar_id || meta.companionId || null,
    combinationId: row.combination_id || row.media_combination_id || meta.draftId || null,
    jobOrigin: row.job_origin || row.origin || meta.source || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeItem(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  return {
    id: row.id,
    batchId: row.batch_id || null,
    status: row.status || null,
    companionId: row.companion_id || row.avatar_id || meta.companionId || null,
    combinationId: row.combination_id || row.media_combination_id || meta.draftId || null,
    outputVariantId: row.variant_id || meta.simulatedOutputVariantId || meta.outputVariantId || null,
    jobOrigin: row.job_origin || row.origin || meta.source || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function isNarrativeOutput(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  return meta.source === 'narrative_output_qa_simulated_6_3P'
    || meta.sprint === '6.3P'
    || meta.simulatedOutput === true
    || row.media_origin === 'narrative_output_qa_simulated_6_3P'
}

async function loadOutputById(outputVariantId) {
  if (!outputVariantId) return { ok: false, row: null, asset: null, error: 'outputVariantId ausente', code: 'MISSING_OUTPUT_VARIANT_ID' }
  const result = await safeSelectMaybeSingle({ table: ASSETS_TABLE, filters: [{ column: 'id', value: outputVariantId }] })
  if (!result.ok) return { ok: false, row: null, asset: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, asset: null, error: 'Saída narrativa não encontrada.', code: 'OUTPUT_NOT_FOUND' }
  if (!isNarrativeOutput(result.data)) return { ok: false, row: result.data, asset: null, error: 'Saída não pertence ao QA narrativo simulado 6.3P.', code: 'NOT_NARRATIVE_SIMULATED_OUTPUT' }
  return { ok: true, row: result.data, asset: summarizeAsset(result.data), error: null, code: null }
}

async function findLatestNarrativeOutput() {
  const result = await safeSelectList({ table: ASSETS_TABLE, limit: 160 })
  if (!result.ok) return { ok: false, row: null, asset: null, error: result.error, code: result.code }
  const candidates = (result.data || []).filter(isNarrativeOutput)
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
  const row = candidates[0] || null
  return row
    ? { ok: true, row, asset: summarizeAsset(row), error: null, code: null }
    : { ok: false, row: null, asset: null, error: 'Nenhuma saída narrativa simulada encontrada.', code: 'NO_NARRATIVE_OUTPUT' }
}

async function loadTarget({ outputVariantId = null } = {}) {
  const selectedId = outputVariantId || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || process.env.NARRATIVE_STUDIO_6_3P_OUTPUT_VARIANT_ID || null
  const outputLookup = selectedId ? await loadOutputById(selectedId) : await findLatestNarrativeOutput()
  if (!outputLookup.ok) return { ok: false, error: outputLookup.error, code: outputLookup.code, outputLookup }

  const assetRow = outputLookup.row
  const asset = outputLookup.asset
  const meta = asObject(assetRow.metadata || assetRow.meta)
  const draftId = asset.combinationId || meta.draftId || null
  const batchId = asset.batchId || meta.batchId || null
  const batchItemId = asset.batchItemId || meta.batchItemId || null

  const [draftResult, batchResult, itemResult] = await Promise.all([
    draftId ? safeSelectMaybeSingle({ table: COMBINATIONS_TABLE, filters: [{ column: 'id', value: draftId }] }) : { ok: true, data: null },
    batchId ? safeSelectMaybeSingle({ table: BATCHES_TABLE, filters: [{ column: 'id', value: batchId }] }) : { ok: true, data: null },
    batchItemId ? safeSelectMaybeSingle({ table: BATCH_ITEMS_TABLE, filters: [{ column: 'id', value: batchItemId }] }) : { ok: true, data: null },
  ])

  return {
    ok: true,
    assetRow,
    draftRow: draftResult.data || null,
    batchRow: batchResult.data || null,
    itemRow: itemResult.data || null,
    asset,
    draft: draftResult.data ? summarizeDraft(draftResult.data) : null,
    batch: batchResult.data ? summarizeBatch(batchResult.data) : null,
    batchItem: itemResult.data ? summarizeItem(itemResult.data) : null,
    queryWarnings: [draftResult, batchResult, itemResult].filter((r) => !r.ok).map((r) => r.error),
    error: null,
    code: null,
  }
}

function buildAssetDecisionPayload({ target, action, adminProfileId, rejectionReason }) {
  const now = nowIso()
  const meta = asObject(target.assetRow.metadata || target.assetRow.meta)
  const qa = asObject(meta.qa)
  const approved = action === 'approve'
  const rejected = action === 'reject'

  return {
    status: approved ? 'available' : 'rejected',
    requires_qa: false,
    rejection_reason: rejected ? (rejectionReason || 'Rejeitado no QA narrativo simulado 6.3P2.') : null,
    cleanup_after: rejected ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() : null,
    published_at: approved ? now : undefined,
    metadata: {
      ...meta,
      sprint: SPRINT,
      qa: {
        ...qa,
        status: approved ? 'approved' : 'rejected',
        approved,
        rejected,
        rejectionReason: rejected ? (rejectionReason || 'Rejeitado no QA narrativo simulado 6.3P2.') : null,
        decidedAt: now,
        decidedByProfileId: adminProfileId || null,
      },
      productionStatus: approved ? 'approved_simulated' : 'rejected_simulated',
      simulatedOutput: true,
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
      noRealMedia: true,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      qaStatus: approved ? 'approved' : 'rejected',
      simulatedOutput: true,
    },
    updated_at: now,
  }
}

function buildBatchItemDecisionPayload({ target, action, assetId }) {
  const now = nowIso()
  const meta = asObject(target.itemRow?.metadata || target.itemRow?.meta)
  const approved = action === 'approve'
  return {
    status: approved ? 'completed' : 'rejected',
    qa_status: approved ? 'approved' : 'rejected',
    variant_id: assetId,
    metadata: {
      ...meta,
      sprint: SPRINT,
      outputStatus: approved ? 'available' : 'rejected',
      qaStatus: approved ? 'approved' : 'rejected',
      simulatedOutputVariantId: assetId,
      simulatedOutput: true,
      clientMediaVisibleBeforePurchase: false,
      completedAt: approved ? now : undefined,
      rejectedAt: approved ? undefined : now,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      qaStatus: approved ? 'approved' : 'rejected',
      simulatedOutputVariantId: assetId,
    },
    updated_at: now,
  }
}

function buildBatchDecisionPayload({ target, action }) {
  const now = nowIso()
  const meta = asObject(target.batchRow?.metadata || target.batchRow?.meta)
  const approved = action === 'approve'
  return {
    status: approved ? 'completed' : 'completed',
    approved_items: approved ? 1 : 0,
    rejected_items: approved ? 0 : 1,
    completed_items: 1,
    metadata: {
      ...meta,
      sprint: SPRINT,
      qaStatus: approved ? 'approved' : 'rejected',
      outputStatus: approved ? 'available' : 'rejected',
      simulatedOutput: true,
      completedAt: now,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      qaStatus: approved ? 'approved' : 'rejected',
      simulatedOutput: true,
    },
    updated_at: now,
  }
}

function buildDraftDecisionPayload({ target, action, assetId, adminProfileId, rejectionReason }) {
  const now = nowIso()
  const meta = asObject(target.draftRow?.metadata)
  const publication = asObject(meta.publication)
  const production = asObject(meta.production)
  const displayPayload = asObject(target.draftRow?.display_payload)
  const approved = action === 'approve'

  return {
    metadata: {
      ...meta,
      status: approved ? 'approved' : 'rejected',
      production: {
        ...production,
        status: approved ? 'approved_simulated' : 'rejected_simulated',
        outputVariantId: assetId,
        simulatedOutputVariantId: assetId,
        simulatedOutput: true,
        qaDecisionAt: now,
        qaDecisionByProfileId: adminProfileId || null,
        rejectionReason: approved ? null : (rejectionReason || 'Rejeitado no QA narrativo simulado 6.3P2.'),
      },
      publication: {
        ...publication,
        status: 'draft',
        adminVisible: true,
        actorVisible: false,
        clientCardVisible: false,
        clientMediaVisibleBeforePurchase: false,
        internalPromptVisibleToClient: false,
      },
    },
    display_payload: {
      ...displayPayload,
      productionStatus: approved ? 'approved_simulated' : 'rejected_simulated',
      outputVariantId: assetId,
      clientCardVisible: false,
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
    },
    visible_to_client: false,
    admin_only: true,
    is_active: false,
    updated_at: now,
  }
}

async function auditClientExposure({ assetId, draftId, batchItemId }) {
  async function countBy(table, column, value) {
    if (!hasValue(value)) return { column, ok: true, total: 0, error: null, code: null }
    const result = await safeSelectList({ table, filters: [{ column, value }], limit: 10 })
    return { column, ok: result.ok, total: result.data?.length || 0, error: result.error, code: result.code }
  }

  const deliveries = [
    await countBy(DELIVERIES_TABLE, 'variant_id', assetId),
    await countBy(DELIVERIES_TABLE, 'combination_id', draftId),
  ]
  const gallery = [
    await countBy(GALLERY_TABLE, 'variant_id', assetId),
    await countBy(GALLERY_TABLE, 'combination_id', draftId),
  ]
  const ledger = [
    await countBy(CREDIT_LEDGER_TABLE, 'reference_id', assetId),
    await countBy(CREDIT_LEDGER_TABLE, 'reference_id', batchItemId),
  ]

  return {
    deliveriesTotal: deliveries.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    galleryItemsTotal: gallery.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    creditLedgerTotal: ledger.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    publicUrlDetected: false,
    attempts: { deliveries, galleryItems: gallery, creditLedger: ledger },
  }
}

export async function previewNarrativeOutputQaDecision({ outputVariantId = null } = {}) {
  const target = await loadTarget({ outputVariantId })
  if (!target.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_DECISION_BLOCKED_BY_TARGET',
      canApprove: false,
      canReject: false,
      blocker: target.code,
      error: target.error,
      safety: buildSafety(),
    }
  }

  const status = String(target.asset.status || '').toLowerCase()
  const isQaPending = status === 'qa_pending'
  const alreadyApproved = ['available', 'completed'].includes(status)
  const alreadyRejected = status === 'rejected'

  return {
    sprint: SPRINT,
    status: isQaPending ? 'NARRATIVE_OUTPUT_QA_READY_FOR_DECISION' : (alreadyApproved ? 'NARRATIVE_OUTPUT_QA_ALREADY_APPROVED' : (alreadyRejected ? 'NARRATIVE_OUTPUT_QA_ALREADY_REJECTED' : 'NARRATIVE_OUTPUT_QA_NOT_READY_FOR_DECISION')),
    canApprove: isQaPending,
    canReject: isQaPending,
    target: {
      output: target.asset,
      draft: target.draft,
      batch: target.batch,
      batchItem: target.batchItem,
    },
    decisionWould: {
      approve: {
        outputStatus: 'available',
        batchStatus: 'completed',
        batchItemStatus: 'completed',
        draftProductionStatus: 'approved_simulated',
        clientCardVisible: false,
        clientMediaVisibleBeforePurchase: false,
      },
      reject: {
        outputStatus: 'rejected',
        batchStatus: 'completed',
        batchItemStatus: 'rejected',
        draftProductionStatus: 'rejected_simulated',
        clientCardVisible: false,
        clientMediaVisibleBeforePurchase: false,
      },
    },
    blockers: isQaPending ? [] : [alreadyApproved ? 'output_already_approved' : (alreadyRejected ? 'output_already_rejected' : `output_status_not_qa_pending:${status}`)],
    warnings: target.queryWarnings || [],
    safety: buildSafety(),
  }
}

export async function applyNarrativeOutputQaDecision({ outputVariantId = null, action = null, adminProfileId = null, confirmationPhrase = '', rejectionReason = '', dryRunOnly = true } = {}) {
  const normalizedAction = String(action || process.env.NARRATIVE_STUDIO_6_3P2_QA_ACTION || '').trim().toLowerCase()
  const preview = await previewNarrativeOutputQaDecision({ outputVariantId })
  const requestedMutation = toBool(process.env.RUN_6_3P2_NARRATIVE_QA_DECISION_MUTATION)
  const mutationAllowed = toBool(process.env.ALLOW_6_3P2_NARRATIVE_QA_DECISION)
  const expectedPhrase = normalizedAction === 'approve' ? APPROVE_CONFIRMATION_PHRASE : (normalizedAction === 'reject' ? REJECT_CONFIRMATION_PHRASE : null)
  const confirmationOk = expectedPhrase ? String(confirmationPhrase || process.env.NARRATIVE_STUDIO_6_3P2_CONFIRMATION_PHRASE || '').trim() === expectedPhrase : false

  const blockers = [
    ...(dryRunOnly ? ['dry_run_only'] : []),
    ...(!ACTIONS.has(normalizedAction) ? ['qa_action_missing_or_invalid'] : []),
    ...(!requestedMutation ? ['mutation_env_not_requested'] : []),
    ...(!mutationAllowed ? ['mutation_env_not_allowed'] : []),
    ...(!confirmationOk ? ['confirmation_phrase_missing_or_invalid'] : []),
    ...(!(normalizedAction === 'approve' ? preview.canApprove : preview.canReject) ? (preview.blockers?.length ? preview.blockers : ['output_not_ready_for_decision']) : []),
  ]

  if (blockers.length) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_DECISION_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedApply: !dryRunOnly,
      requestedAction: normalizedAction || null,
      blockers,
      preview,
      safety: buildSafety(),
    }
  }

  const target = await loadTarget({ outputVariantId: preview.target.output.id })
  if (!target.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_DECISION_BLOCKED_BY_TARGET',
      dryRun: true,
      blocker: target.code,
      error: target.error,
      safety: buildSafety(),
    }
  }

  const assetUpdate = await safeUpdateAdaptive({
    table: ASSETS_TABLE,
    id: target.asset.id,
    payload: buildAssetDecisionPayload({ target, action: normalizedAction, adminProfileId, rejectionReason }),
    label: 'saída narrativa em QA',
  })

  const itemUpdate = target.batchItem?.id
    ? await safeUpdateAdaptive({ table: BATCH_ITEMS_TABLE, id: target.batchItem.id, payload: buildBatchItemDecisionPayload({ target, action: normalizedAction, assetId: target.asset.id }), label: 'item de produção narrativa' })
    : { ok: false, removedColumns: [], error: 'batchItem ausente', code: 'MISSING_BATCH_ITEM' }

  const batchUpdate = target.batch?.id
    ? await safeUpdateAdaptive({ table: BATCHES_TABLE, id: target.batch.id, payload: buildBatchDecisionPayload({ target, action: normalizedAction }), label: 'lote de produção narrativa' })
    : { ok: false, removedColumns: [], error: 'batch ausente', code: 'MISSING_BATCH' }

  const draftUpdate = target.draft?.id
    ? await safeUpdateAdaptive({ table: COMBINATIONS_TABLE, id: target.draft.id, payload: buildDraftDecisionPayload({ target, action: normalizedAction, assetId: target.asset.id, adminProfileId, rejectionReason }), label: 'rascunho narrativo' })
    : { ok: false, removedColumns: [], error: 'draft ausente', code: 'MISSING_DRAFT' }

  const audit = await insertAdminAuditAdaptive({
    profileId: adminProfileId,
    action: `narrative_studio.output.${normalizedAction}`,
    entityType: 'media_asset_variant',
    entityId: target.asset.id,
    message: `Saída narrativa ${normalizedAction === 'approve' ? 'aprovada' : 'rejeitada'} no QA simulado ${SPRINT}.`,
    sprint: SPRINT,
    metadata: {
      action: normalizedAction,
      outputVariantId: target.asset.id,
      batchId: target.batch?.id || null,
      batchItemId: target.batchItem?.id || null,
      draftId: target.draft?.id || null,
      simulatedOutput: true,
      noRunPod: true,
      noR2: true,
      noClientPublication: true,
      rejectionReason: normalizedAction === 'reject' ? rejectionReason || null : null,
      assetUpdateRemovedColumns: assetUpdate.removedColumns,
      itemUpdateRemovedColumns: itemUpdate.removedColumns,
      batchUpdateRemovedColumns: batchUpdate.removedColumns,
      draftUpdateRemovedColumns: draftUpdate.removedColumns,
    },
  })

  const postInspect = await inspectNarrativeOutputQaDecision({ outputVariantId: target.asset.id })

  return {
    sprint: SPRINT,
    status: normalizedAction === 'approve' ? 'NARRATIVE_OUTPUT_QA_APPROVED_CONTROLLED' : 'NARRATIVE_OUTPUT_QA_REJECTED_CONTROLLED',
    dryRun: false,
    requestedApply: true,
    mutationEnvAllowed: true,
    confirmationOk: true,
    requestedAction: normalizedAction,
    output: assetUpdate.data ? summarizeAsset(assetUpdate.data) : target.asset,
    target: {
      draft: target.draft,
      batch: target.batch,
      batchItem: target.batchItem,
    },
    operations: {
      assetUpdate: { ok: assetUpdate.ok, removedColumns: assetUpdate.removedColumns, error: assetUpdate.error, code: assetUpdate.code },
      itemUpdate: { ok: itemUpdate.ok, removedColumns: itemUpdate.removedColumns, error: itemUpdate.error, code: itemUpdate.code },
      batchUpdate: { ok: batchUpdate.ok, removedColumns: batchUpdate.removedColumns, error: batchUpdate.error, code: batchUpdate.code },
      draftUpdate: { ok: draftUpdate.ok, removedColumns: draftUpdate.removedColumns, error: draftUpdate.error, code: draftUpdate.code },
      audit,
    },
    postInspect,
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}

export async function inspectNarrativeOutputQaDecision({ outputVariantId = null } = {}) {
  const target = await loadTarget({ outputVariantId })
  let exposure = null
  let blockers = []
  let warnings = []
  let selected = null

  if (!target.ok) {
    blockers = [target.code || 'target_not_found']
    warnings = [target.error]
  } else {
    selected = {
      output: target.asset,
      draft: target.draft,
      batch: target.batch,
      batchItem: target.batchItem,
    }
    exposure = await auditClientExposure({
      assetId: target.asset.id,
      draftId: target.draft?.id || target.asset.combinationId,
      batchItemId: target.batchItem?.id || target.asset.batchItemId,
    })
    warnings = target.queryWarnings || []
  }

  const status = !target.ok
    ? 'NARRATIVE_OUTPUT_QA_DECISION_TARGET_NOT_FOUND'
    : (String(target.asset.status || '').toLowerCase() === 'qa_pending'
      ? 'NARRATIVE_OUTPUT_QA_READY_FOR_DECISION'
      : (String(target.asset.status || '').toLowerCase() === 'available'
        ? 'NARRATIVE_OUTPUT_QA_APPROVED_READY'
        : (String(target.asset.status || '').toLowerCase() === 'rejected'
          ? 'NARRATIVE_OUTPUT_QA_REJECTED_READY'
          : 'NARRATIVE_OUTPUT_QA_DECISION_INSPECTED')))

  return {
    sprint: SPRINT,
    status,
    checkedAt: nowIso(),
    selectedOutputVariantId: target.ok ? target.asset.id : null,
    selected,
    readiness: {
      canApprove: target.ok && String(target.asset.status || '').toLowerCase() === 'qa_pending',
      canReject: target.ok && String(target.asset.status || '').toLowerCase() === 'qa_pending',
      approved: target.ok && String(target.asset.status || '').toLowerCase() === 'available',
      rejected: target.ok && String(target.asset.status || '').toLowerCase() === 'rejected',
      simulatedOutput: Boolean(target.asset?.simulatedOutput),
      clientCardVisible: Boolean(target.draft?.clientCardVisible),
      clientMediaVisibleBeforePurchase: false,
      realMediaCreatedByThisSprint: false,
      r2ObjectCreatedByThisSprint: false,
    },
    clientExposureAudit: exposure,
    rules: {
      qaDecisionDoesNotPublishClientCard: true,
      clientMediaVisibleOnlyAfterPurchase: true,
      runPodStillDisabledByThisSprint: true,
      r2StillDisabledByThisSprint: true,
      billingStillDisabledByThisSprint: true,
    },
    blockers,
    warnings,
    safety: buildSafety(),
  }
}

export function getNarrativeOutputQaDecisionConfig() {
  return {
    sprint: SPRINT,
    name: 'QA / decisão controlada de saída narrativa simulada',
    approveConfirmationPhrase: APPROVE_CONFIRMATION_PHRASE,
    rejectConfirmationPhrase: REJECT_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3P2_NARRATIVE_QA_DECISION_MUTATION: toBool(process.env.RUN_6_3P2_NARRATIVE_QA_DECISION_MUTATION),
      ALLOW_6_3P2_NARRATIVE_QA_DECISION: toBool(process.env.ALLOW_6_3P2_NARRATIVE_QA_DECISION),
      NARRATIVE_STUDIO_6_3P2_QA_ACTION: process.env.NARRATIVE_STUDIO_6_3P2_QA_ACTION || null,
      NARRATIVE_STUDIO_6_3P2_CONFIRMATION_PHRASE: hasValue(process.env.NARRATIVE_STUDIO_6_3P2_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
      NARRATIVE_STUDIO_OUTPUT_VARIANT_ID: process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || process.env.NARRATIVE_STUDIO_6_3P_OUTPUT_VARIANT_ID || null,
      NARRATIVE_STUDIO_ADMIN_PROFILE_ID: hasValue(process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID) ? '[preenchido]' : null,
    },
    safety: buildSafety(),
  }
}
