import { supabaseAdmin } from '../config/supabase.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const SPRINT = '6.3P'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const CREDIT_LEDGER_TABLE = 'credit_ledger'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const REQUIRED_CONFIRMATION_PHRASE = 'PROCESSAR SAIDA NARRATIVA SIMULADA 6.3P'

const TYPE_LABELS = {
  live_audio: 'Audio Live',
  live_action: 'Live Action',
}

const MEDIA_TYPE_CANDIDATES = {
  live_audio: ['live_audio', 'audio', 'audio_live', 'voz'],
  live_action: ['live_action', 'video', 'video_live', 'vídeo'],
}

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

function parseRequiredColumn(error) {
  const message = String(error?.message || '')
  const match = message.match(/null value in column "([^"]+)"/i)
  return match?.[1] || null
}

function isRetryableCheckError(error) {
  const message = String(error?.message || '')
  const code = String(error?.code || '')
  return code === '23514' || message.includes('violates check constraint') || message.includes('media_type')
}

function defaultRequiredValue(column, context = {}) {
  const name = String(column || '').toLowerCase()
  if (name === 'id') return undefined
  if (name.includes('created_at') || name.includes('updated_at') || name.endsWith('_at')) return nowIso()
  if (name.includes('status')) return context.status || 'qa_pending'
  if (name.includes('media_type') || name.includes('type')) return context.mediaType || 'live_audio'
  if (name.includes('r2_key') || name.includes('storage_key') || name.includes('key')) return context.simulatedStorageKey || `simulated/narrative/${context.batchItemId || 'item'}/placeholder.txt`
  if (name.includes('r2_bucket') || name.includes('bucket')) return context.simulatedBucket || 'simulated-no-r2'
  if (name.includes('url')) return null
  if (name.includes('price') || name.includes('credits') || name.includes('score') || name.includes('count') || name.includes('number') || name.includes('assignments')) return 0
  if (name.startsWith('is_') || name.startsWith('has_') || name.includes('visible') || name.includes('active') || name.includes('requires_')) return false
  if (name.includes('metadata') || name.includes('payload') || name.includes('config') || name.includes('snapshot')) return {}
  if (name.includes('companion') || name.includes('avatar')) return context.companionId || undefined
  if (name.includes('combination')) return context.draftId || undefined
  if (name.includes('batch_item')) return context.batchItemId || undefined
  if (name.includes('batch')) return context.batchId || undefined
  return `simulated-6-3P-${name}`
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

async function safeInsertAdaptive({ table, payload, label = table, requiredContext = {} }) {
  const removedColumns = []
  const filledRequiredColumns = []
  let currentPayload = cleanPayload({ ...payload })

  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(currentPayload)
      .select('*')
      .single()

    if (!error) {
      return { ok: true, table, data, removedColumns, filledRequiredColumns, error: null, code: null }
    }

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    const requiredColumn = parseRequiredColumn(error)
    const requiredValue = requiredColumn ? defaultRequiredValue(requiredColumn, requiredContext) : undefined
    if (requiredColumn && requiredValue !== undefined && !Object.prototype.hasOwnProperty.call(currentPayload, requiredColumn)) {
      currentPayload[requiredColumn] = requiredValue
      filledRequiredColumns.push(requiredColumn)
      continue
    }

    return {
      ok: false,
      table,
      data: null,
      removedColumns,
      filledRequiredColumns,
      error: error.message || `Falha ao inserir ${label}.`,
      code: error.code || null,
    }
  }

  return {
    ok: false,
    table,
    data: null,
    removedColumns,
    filledRequiredColumns,
    error: `Falha ao inserir ${label}: limite de adaptação esgotado.`,
    code: 'ADAPTIVE_INSERT_EXHAUSTED',
  }
}

async function safeInsertVariantWithMediaTypeFallback({ payload, contentType, requiredContext }) {
  const candidates = MEDIA_TYPE_CANDIDATES[contentType] || [contentType, 'audio', 'video']
  const attempts = []

  for (const mediaType of candidates) {
    const result = await safeInsertAdaptive({
      table: ASSETS_TABLE,
      payload: { ...payload, media_type: mediaType },
      label: `saída narrativa simulada (${mediaType})`,
      requiredContext: { ...requiredContext, mediaType },
    })

    if (result.ok) return { ...result, acceptedMediaType: mediaType, attempts }

    attempts.push({ mediaType, error: result.error, code: result.code, removedColumns: result.removedColumns })
    if (!isRetryableCheckError({ message: result.error, code: result.code })) {
      return { ...result, acceptedMediaType: null, attempts }
    }
  }

  return {
    ok: false,
    table: ASSETS_TABLE,
    data: null,
    acceptedMediaType: null,
    attempts,
    removedColumns: [],
    filledRequiredColumns: [],
    error: `Nenhum media_type aceito para saída narrativa simulada. Tentativas: ${attempts.map((a) => `${a.mediaType}: ${a.error}`).join(' | ')}`,
    code: 'NO_ACCEPTED_MEDIA_TYPE',
  }
}

async function safeUpdateAdaptive({ table, id, payload, label = table }) {
  const removedColumns = []
  let currentPayload = cleanPayload({ ...payload })

  if (!id) return { ok: false, table, data: null, removedColumns, error: `${label}: id ausente`, code: 'MISSING_ID' }

  for (let attempt = 1; attempt <= 50; attempt += 1) {
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

function normalizeContentTypeFrom(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  const pkg = asObject(meta.productionPackage)
  const raw = row.content_type || row.media_type || pkg.contentType || meta.contentType || ''
  const normalized = String(raw || '').toLowerCase()
  if (['live_audio', 'audio_live', 'audio'].includes(normalized)) return 'live_audio'
  if (['live_action', 'video_live', 'video'].includes(normalized)) return 'live_action'
  return null
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
    contentType: normalizeContentTypeFrom(row) || meta.contentType || null,
    jobOrigin: row.job_origin || row.origin || meta.source || null,
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
  const contentType = normalizeContentTypeFrom({ ...row, metadata: { ...meta, ...(clientCard.contentType ? { contentType: clientCard.contentType } : {}) } })

  return {
    id: row.id,
    title: row.title || displayPayload.publicTitle || clientCard.title || 'Produto narrativo',
    publicTitle: displayPayload.publicTitle || clientCard.title || row.title || 'Produto narrativo',
    publicDescription: displayPayload.publicDescription || clientCard.description || '',
    contentType,
    contentTypeLabel: TYPE_LABELS[contentType] || contentType || 'Narrativo',
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

function summarizeAsset(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  return {
    id: row.id,
    status: row.status || null,
    mediaType: row.media_type || meta.mediaType || null,
    companionId: row.companion_id || row.avatar_id || meta.companionId || null,
    combinationId: row.combination_id || row.media_combination_id || meta.draftId || null,
    batchId: row.batch_id || meta.batchId || null,
    batchItemId: row.batch_item_id || row.media_generation_batch_item_id || meta.batchItemId || null,
    r2BucketPresent: Boolean(row.r2_bucket || row.bucket),
    r2KeyPresent: Boolean(row.r2_key || row.storage_key),
    urlPresent: Boolean(row.url || row.file_url || row.public_url),
    requiresQa: row.requires_qa,
    simulatedOutput: Boolean(meta.simulatedOutput || meta.simulatedNoR2),
    clientMediaVisibleBeforePurchase: Boolean(meta.clientMediaVisibleBeforePurchase),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function isNarrativeItem(row = {}) {
  const meta = asObject(row.metadata || row.meta)
  return row.job_origin === 'narrative_studio_6_3O' || row.origin === 'narrative_studio_6_3O' || meta.source === 'narrative_studio_preproduction_6_3O'
}

async function loadBatchItem(batchItemId) {
  if (!batchItemId) return { ok: false, row: null, item: null, error: 'batchItemId ausente', code: 'MISSING_BATCH_ITEM_ID' }
  const result = await safeSelectMaybeSingle({ table: BATCH_ITEMS_TABLE, filters: [{ column: 'id', value: batchItemId }] })
  if (!result.ok) return { ok: false, row: null, item: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, item: null, error: 'Item de produção narrativa não encontrado.', code: 'BATCH_ITEM_NOT_FOUND' }
  if (!isNarrativeItem(result.data)) return { ok: false, row: result.data, item: null, error: 'Item não pertence à pré-produção narrativa 6.3O.', code: 'NOT_NARRATIVE_PRODUCTION_ITEM' }
  return { ok: true, row: result.data, item: summarizeItem(result.data), error: null, code: null }
}

async function findLatestNarrativeBatchItem() {
  const result = await safeSelectList({ table: BATCH_ITEMS_TABLE, limit: 120 })
  if (!result.ok) return { ok: false, row: null, item: null, error: result.error, code: result.code }
  const candidates = (result.data || []).filter(isNarrativeItem)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
  const row = candidates[0] || null
  return row
    ? { ok: true, row, item: summarizeItem(row), error: null, code: null }
    : { ok: false, row: null, item: null, error: 'Nenhum item narrativo 6.3O encontrado.', code: 'NO_NARRATIVE_ITEM' }
}

async function loadTarget({ batchItemId = null } = {}) {
  const selectedBatchItemId = batchItemId || process.env.NARRATIVE_STUDIO_BATCH_ITEM_ID || process.env.NARRATIVE_STUDIO_6_3P_BATCH_ITEM_ID || null
  const itemLookup = selectedBatchItemId ? await loadBatchItem(selectedBatchItemId) : await findLatestNarrativeBatchItem()
  if (!itemLookup.ok) return { ok: false, error: itemLookup.error, code: itemLookup.code, itemLookup }

  const itemRow = itemLookup.row
  const item = itemLookup.item
  const batchResult = item.batchId ? await safeSelectMaybeSingle({ table: BATCHES_TABLE, filters: [{ column: 'id', value: item.batchId }] }) : { ok: true, data: null }
  const draftId = item.combinationId || asObject(itemRow.metadata || itemRow.meta).draftId || null
  const draftResult = draftId ? await safeSelectMaybeSingle({ table: COMBINATIONS_TABLE, filters: [{ column: 'id', value: draftId }] }) : { ok: true, data: null }

  const draft = draftResult.data ? summarizeDraft(draftResult.data) : null
  const batch = batchResult.data ? summarizeBatch(batchResult.data) : null

  return {
    ok: true,
    itemRow,
    batchRow: batchResult.data || null,
    draftRow: draftResult.data || null,
    item,
    batch,
    draft,
    error: null,
    code: null,
  }
}

async function findExistingAssetsForItem({ batchItemId, draftId }) {
  const [byItem, byCombination] = await Promise.all([
    safeSelectList({ table: ASSETS_TABLE, filters: [{ column: 'batch_item_id', value: batchItemId }], limit: 20 }),
    safeSelectList({ table: ASSETS_TABLE, filters: [{ column: 'combination_id', value: draftId }], limit: 50 }),
  ])

  const map = new Map()
  for (const row of byItem.data || []) {
    if (row?.id) map.set(row.id, row)
  }

  for (const row of byCombination.data || []) {
    const meta = asObject(row.metadata || row.meta)
    if (row?.id && (meta.batchItemId === batchItemId || row.batch_item_id === batchItemId || meta.source === 'narrative_output_qa_simulated_6_3P')) {
      map.set(row.id, row)
    }
  }

  return {
    assets: [...map.values()].map(summarizeAsset),
    warnings: [byItem, byCombination].filter((r) => !r.ok).map((r) => r.error),
  }
}

function buildSimulatedOutputPayload({ target }) {
  const now = nowIso()
  const item = target.item
  const draft = target.draft || {}
  const batch = target.batch || {}
  const contentType = draft.contentType || item.contentType || normalizeContentTypeFrom(target.itemRow) || 'live_audio'
  const label = TYPE_LABELS[contentType] || contentType
  const title = draft.publicTitle || draft.title || 'Saída narrativa simulada'
  const mediaKind = contentType === 'live_audio' ? 'audio' : 'video'
  const simulatedStorageKey = `simulated/narrative/${draft.id || item.combinationId}/${item.id}/qa-placeholder.${mediaKind === 'audio' ? 'txt' : 'json'}`

  const metadata = {
    sprint: SPRINT,
    source: 'narrative_output_qa_simulated_6_3P',
    simulatedOutput: true,
    simulatedNoR2: true,
    noRunPod: true,
    noRealTts: true,
    noRealVideo: true,
    warning: 'Saída simulada para validar QA/read model. Não é arquivo real de mídia e não deve ser entregue ao cliente.',
    draftId: draft.id || item.combinationId,
    batchId: item.batchId,
    batchItemId: item.id,
    companionId: draft.companionId || item.companionId,
    contentType,
    contentTypeLabel: label,
    mediaKind,
    publicTitle: title,
    publicDescription: draft.publicDescription || '',
    durationSeconds: draft.durationSeconds || 0,
    priceCredits: draft.priceCredits || 0,
    clientMediaVisibleBeforePurchase: false,
    internalPromptVisibleToClient: false,
    qaRequired: true,
    createdFrom: 'queued_narrative_preproduction_item',
  }

  return {
    companion_id: draft.companionId || item.companionId,
    avatar_id: draft.companionId || item.companionId,
    combination_id: draft.id || item.combinationId,
    media_combination_id: draft.id || item.combinationId,
    batch_id: item.batchId,
    media_generation_batch_id: item.batchId,
    batch_item_id: item.id,
    media_generation_batch_item_id: item.id,
    variant_number: 1,
    title,
    label: title,
    status: 'qa_pending',
    requires_qa: true,
    max_assignments: 1,
    current_assignments: 0,
    quality_score: null,
    r2_bucket: 'simulated-no-r2',
    bucket: 'simulated-no-r2',
    r2_key: simulatedStorageKey,
    storage_key: simulatedStorageKey,
    media_origin: 'narrative_output_qa_simulated_6_3P',
    source: 'narrative_output_qa_simulated_6_3P',
    metadata,
    meta: metadata,
    finance_snapshot: {
      price_credits: draft.priceCredits || 0,
      simulatedOutput: true,
      noCharge: true,
    },
    created_at: now,
    updated_at: now,
  }
}

function buildBatchItemUpdate({ target, assetId }) {
  const now = nowIso()
  const meta = asObject(target.itemRow.metadata || target.itemRow.meta)
  return {
    status: 'qa_pending',
    variant_id: assetId,
    qa_status: 'qa_pending',
    metadata: {
      ...meta,
      sprint: SPRINT,
      outputStatus: 'qa_pending',
      simulatedOutputVariantId: assetId,
      simulatedOutputCreatedAt: now,
      source: meta.source || 'narrative_studio_preproduction_6_3O',
      simulatedOutput: true,
      workerEnabled: false,
      queueJobCreated: false,
      clientMediaVisibleBeforePurchase: false,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      outputStatus: 'qa_pending',
      simulatedOutputVariantId: assetId,
    },
    updated_at: now,
  }
}

function buildBatchUpdate({ target }) {
  const now = nowIso()
  const meta = asObject(target.batchRow?.metadata || target.batchRow?.meta)
  return {
    status: 'qa_pending',
    completed_items: 1,
    pending_items: 0,
    metadata: {
      ...meta,
      sprint: SPRINT,
      outputStatus: 'qa_pending',
      simulatedOutput: true,
      simulatedOutputCreatedAt: now,
      workerEnabled: false,
      queueJobCreated: false,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      outputStatus: 'qa_pending',
      simulatedOutput: true,
    },
    updated_at: now,
  }
}

function buildDraftUpdate({ target, assetId }) {
  const now = nowIso()
  const meta = asObject(target.draftRow?.metadata)
  const publication = asObject(meta.publication)
  const production = asObject(meta.production)
  const displayPayload = asObject(target.draftRow?.display_payload)

  return {
    metadata: {
      ...meta,
      status: 'qa_pending',
      production: {
        ...production,
        status: 'qa_pending',
        outputVariantId: assetId,
        simulatedOutputVariantId: assetId,
        simulatedOutput: true,
        qaPendingAt: now,
        workerEnabled: false,
        queueJobCreated: false,
      },
      publication: {
        ...publication,
        status: 'draft',
        adminVisible: true,
        actorVisible: false,
        clientCardVisible: false,
        clientMediaVisibleBeforePurchase: false,
      },
    },
    display_payload: {
      ...displayPayload,
      productionStatus: 'qa_pending',
      outputVariantId: assetId,
      clientCardVisible: false,
      clientMediaVisibleBeforePurchase: false,
    },
    updated_at: now,
    visible_to_client: false,
    admin_only: true,
    is_active: false,
  }
}

async function auditClientExposure({ assetId, draftId, batchItemId }) {
  const attempts = {}

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

  attempts.deliveries = deliveries
  attempts.galleryItems = gallery
  attempts.creditLedger = ledger

  return {
    deliveriesTotal: deliveries.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    galleryItemsTotal: gallery.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    creditLedgerTotal: ledger.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    publicUrlDetected: false,
    attempts,
  }
}

export async function previewNarrativeOutputQa({ batchItemId = null } = {}) {
  const target = await loadTarget({ batchItemId })

  if (!target.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_BLOCKED_BY_TARGET',
      canSimulateOutput: false,
      blocker: target.code,
      error: target.error,
      safety: buildSafety(),
    }
  }

  const existing = await findExistingAssetsForItem({
    batchItemId: target.item.id,
    draftId: target.draft?.id || target.item.combinationId,
  })
  const hasOutput = existing.assets.some((asset) => ['qa_pending', 'available', 'completed'].includes(String(asset.status || '').toLowerCase()))
  const itemStatus = String(target.item.status || '').toLowerCase()
  const canSimulate = ['queued', 'running', 'processing'].includes(itemStatus) && !hasOutput

  return {
    sprint: SPRINT,
    status: hasOutput ? 'NARRATIVE_OUTPUT_QA_ALREADY_EXISTS' : (canSimulate ? 'NARRATIVE_OUTPUT_READY_FOR_SIMULATED_QA' : 'NARRATIVE_OUTPUT_NOT_READY_FOR_SIMULATED_QA'),
    canSimulateOutput: canSimulate,
    target: {
      draft: target.draft,
      batch: target.batch,
      batchItem: target.item,
    },
    expectedOutput: {
      contentType: target.draft?.contentType || target.item.contentType,
      contentTypeLabel: TYPE_LABELS[target.draft?.contentType || target.item.contentType] || 'Narrativo',
      targetStatusAfterProcess: 'qa_pending',
      willCreateSimulatedAssetVariant: true,
      willCreateR2Object: false,
      willCallRunPod: false,
      willChargeCustomer: false,
      willCreateDelivery: false,
      willCreateGalleryItem: false,
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
    },
    existingAssets: existing.assets,
    blockers: canSimulate ? [] : [hasOutput ? 'output_already_exists' : `item_status_not_processable:${itemStatus}`],
    warnings: existing.warnings,
    safety: buildSafety(),
  }
}

export async function processNarrativeOutputQa({ batchItemId = null, adminProfileId = null, confirmationPhrase = '', dryRunOnly = true } = {}) {
  const preview = await previewNarrativeOutputQa({ batchItemId })
  const requestedMutation = toBool(process.env.RUN_6_3P_NARRATIVE_OUTPUT_QA_MUTATION)
  const mutationAllowed = toBool(process.env.ALLOW_6_3P_SIMULATED_OUTPUT_QA)
  const confirmationOk = String(confirmationPhrase || process.env.NARRATIVE_STUDIO_6_3P_CONFIRMATION_PHRASE || '').trim() === REQUIRED_CONFIRMATION_PHRASE

  const blockers = [
    ...(dryRunOnly ? ['dry_run_only'] : []),
    ...(!requestedMutation ? ['mutation_env_not_requested'] : []),
    ...(!mutationAllowed ? ['mutation_env_not_allowed'] : []),
    ...(!confirmationOk ? ['confirmation_phrase_missing_or_invalid'] : []),
    ...(!preview.canSimulateOutput ? (preview.blockers?.length ? preview.blockers : ['target_not_ready']) : []),
  ]

  if (blockers.length) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedApply: !dryRunOnly,
      blockers,
      preview,
      safety: buildSafety(),
    }
  }

  const target = await loadTarget({ batchItemId: preview.target.batchItem.id })
  if (!target.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_BLOCKED_BY_TARGET',
      dryRun: true,
      blocker: target.code,
      error: target.error,
      safety: buildSafety(),
    }
  }

  const outputPayload = buildSimulatedOutputPayload({ target })
  const contentType = target.draft?.contentType || target.item.contentType || 'live_audio'
  const requiredContext = {
    status: 'qa_pending',
    contentType,
    batchId: target.item.batchId,
    batchItemId: target.item.id,
    draftId: target.draft?.id || target.item.combinationId,
    companionId: target.draft?.companionId || target.item.companionId,
    simulatedStorageKey: outputPayload.r2_key,
    simulatedBucket: 'simulated-no-r2',
  }

  const assetInsert = await safeInsertVariantWithMediaTypeFallback({
    payload: outputPayload,
    contentType,
    requiredContext,
  })

  if (!assetInsert.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_OUTPUT_QA_ASSET_CREATE_FAILED',
      dryRun: false,
      assetInsert,
      safety: buildSafety({ databaseMutationExecutedByThisService: false }),
    }
  }

  const assetId = assetInsert.data?.id
  const itemUpdate = await safeUpdateAdaptive({
    table: BATCH_ITEMS_TABLE,
    id: target.item.id,
    payload: buildBatchItemUpdate({ target, assetId }),
    label: 'item de produção narrativa',
  })

  const batchUpdate = target.batch?.id
    ? await safeUpdateAdaptive({ table: BATCHES_TABLE, id: target.batch.id, payload: buildBatchUpdate({ target }), label: 'lote de produção narrativa' })
    : { ok: false, removedColumns: [], error: 'batch ausente', code: 'MISSING_BATCH' }

  const draftUpdate = target.draft?.id
    ? await safeUpdateAdaptive({ table: COMBINATIONS_TABLE, id: target.draft.id, payload: buildDraftUpdate({ target, assetId }), label: 'rascunho narrativo' })
    : { ok: false, removedColumns: [], error: 'draft ausente', code: 'MISSING_DRAFT' }

  const audit = await insertAdminAuditAdaptive({
    profileId: adminProfileId,
    action: 'narrative_studio.output.simulated_qa',
    entityType: 'media_asset_variant',
    entityId: assetId,
    message: `Saída narrativa simulada criada para QA ${SPRINT}.`,
    sprint: SPRINT,
    metadata: {
      assetId,
      batchId: target.item.batchId,
      batchItemId: target.item.id,
      draftId: target.draft?.id || target.item.combinationId,
      contentType,
      simulatedOutput: true,
      noRunPod: true,
      noR2: true,
      acceptedMediaType: assetInsert.acceptedMediaType,
      assetRemovedColumns: assetInsert.removedColumns,
      itemUpdateRemovedColumns: itemUpdate.removedColumns,
      batchUpdateRemovedColumns: batchUpdate.removedColumns,
      draftUpdateRemovedColumns: draftUpdate.removedColumns,
    },
  })

  const postInspect = await inspectNarrativeOutputQa({ batchItemId: target.item.id })

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_OUTPUT_SIMULATED_QA_CREATED_CONTROLLED',
    dryRun: false,
    requestedApply: true,
    mutationEnvAllowed: true,
    confirmationOk: true,
    output: summarizeAsset(assetInsert.data),
    target: {
      draft: target.draft,
      batch: target.batch,
      batchItem: target.item,
    },
    operations: {
      assetInsert: {
        ok: assetInsert.ok,
        acceptedMediaType: assetInsert.acceptedMediaType,
        removedColumns: assetInsert.removedColumns,
        filledRequiredColumns: assetInsert.filledRequiredColumns,
        attempts: assetInsert.attempts,
      },
      itemUpdate: {
        ok: itemUpdate.ok,
        removedColumns: itemUpdate.removedColumns,
        error: itemUpdate.error,
        code: itemUpdate.code,
      },
      batchUpdate: {
        ok: batchUpdate.ok,
        removedColumns: batchUpdate.removedColumns,
        error: batchUpdate.error,
        code: batchUpdate.code,
      },
      draftUpdate: {
        ok: draftUpdate.ok,
        removedColumns: draftUpdate.removedColumns,
        error: draftUpdate.error,
        code: draftUpdate.code,
      },
      audit,
    },
    postInspect,
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}

export async function inspectNarrativeOutputQa({ batchItemId = null } = {}) {
  const target = await loadTarget({ batchItemId })
  let selected = null
  let exposure = null
  let blockers = []
  let warnings = []

  if (!target.ok) {
    blockers = [target.code || 'target_not_found']
    warnings = [target.error]
  } else {
    const existing = await findExistingAssetsForItem({
      batchItemId: target.item.id,
      draftId: target.draft?.id || target.item.combinationId,
    })
    selected = {
      target: {
        draft: target.draft,
        batch: target.batch,
        batchItem: target.item,
      },
      outputs: existing.assets,
    }
    warnings = [...warnings, ...(existing.warnings || [])]
    const firstOutput = existing.assets[0]
    exposure = await auditClientExposure({
      assetId: firstOutput?.id || null,
      draftId: target.draft?.id || target.item.combinationId,
      batchItemId: target.item.id,
    })
  }

  const status = selected?.outputs?.length
    ? 'NARRATIVE_OUTPUT_QA_READY'
    : (target.ok ? 'NARRATIVE_OUTPUT_QA_WAITING_OUTPUT' : 'NARRATIVE_OUTPUT_QA_TARGET_NOT_FOUND')

  return {
    sprint: SPRINT,
    status,
    checkedAt: nowIso(),
    selectedBatchItemId: target.ok ? target.item.id : null,
    selected,
    outputReadiness: {
      hasOutput: Boolean(selected?.outputs?.length),
      qaPendingOutputs: (selected?.outputs || []).filter((asset) => String(asset.status || '').toLowerCase() === 'qa_pending').length,
      simulatedOutputs: (selected?.outputs || []).filter((asset) => asset.simulatedOutput).length,
      realMediaCreatedByThisSprint: false,
      r2ObjectCreatedByThisSprint: false,
      clientMediaVisibleBeforePurchase: false,
    },
    clientExposureAudit: exposure,
    rules: {
      simulatedOutputCanReachQa: true,
      qaDoesNotMeanClientPublication: true,
      clientCardStillHiddenUntilPublication: true,
      clientMediaVisibleOnlyAfterPurchase: true,
      runPodStillDisabledByThisSprint: true,
      r2StillDisabledByThisSprint: true,
    },
    blockers,
    warnings,
    safety: buildSafety(),
  }
}

export function getNarrativeOutputQaConfig() {
  return {
    sprint: SPRINT,
    name: 'Processamento simulado / QA de saída narrativa',
    requiredConfirmationPhrase: REQUIRED_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3P_NARRATIVE_OUTPUT_QA_MUTATION: toBool(process.env.RUN_6_3P_NARRATIVE_OUTPUT_QA_MUTATION),
      ALLOW_6_3P_SIMULATED_OUTPUT_QA: toBool(process.env.ALLOW_6_3P_SIMULATED_OUTPUT_QA),
      NARRATIVE_STUDIO_6_3P_CONFIRMATION_PHRASE: hasValue(process.env.NARRATIVE_STUDIO_6_3P_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
      NARRATIVE_STUDIO_BATCH_ITEM_ID: process.env.NARRATIVE_STUDIO_BATCH_ITEM_ID || process.env.NARRATIVE_STUDIO_6_3P_BATCH_ITEM_ID || null,
      NARRATIVE_STUDIO_ADMIN_PROFILE_ID: hasValue(process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID) ? '[preenchido]' : null,
    },
    safety: buildSafety(),
  }
}
