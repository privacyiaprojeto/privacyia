import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const SPRINT = '6.3O'
const COMBINATIONS_TABLE = 'media_combinations'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const REQUIRED_CONFIRMATION_PHRASE = 'ENVIAR RASCUNHO NARRATIVO PARA PRODUCAO 6.3O'

const TYPE_LABELS = {
  live_audio: 'Audio Live',
  live_action: 'Live Action',
}

const MEDIA_TYPE_FOR_CONTENT_TYPE = {
  live_audio: 'audio',
  live_action: 'video',
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

async function safeInsertAdaptive({ table, payload, label = table }) {
  let currentPayload = cleanPayload({ ...payload })
  const removedColumns = []

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(currentPayload)
      .select('*')
      .single()

    if (!error) {
      return { ok: true, table, data, removedColumns, error: null, code: null }
    }

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return {
      ok: false,
      table,
      data: null,
      removedColumns,
      error: error.message || `Falha ao inserir ${label}.`,
      code: error.code || null,
    }
  }

  return {
    ok: false,
    table,
    data: null,
    removedColumns,
    error: `Falha ao inserir ${label}: limite de adaptação esgotado.`,
    code: 'ADAPTIVE_INSERT_EXHAUSTED',
  }
}

async function safeUpdateAdaptive({ table, id, payload, label = table }) {
  let currentPayload = cleanPayload({ ...payload })
  const removedColumns = []

  if (!id) {
    return { ok: false, table, data: null, removedColumns, error: `${label}: id ausente`, code: 'MISSING_ID' }
  }

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    if (!Object.keys(currentPayload).length) {
      return { ok: false, table, data: null, removedColumns, error: `${label}: payload vazio`, code: 'EMPTY_PAYLOAD' }
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .update(currentPayload)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (!error) {
      return { ok: true, table, data, removedColumns, error: null, code: null }
    }

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return {
      ok: false,
      table,
      data: null,
      removedColumns,
      error: error.message || `Falha ao atualizar ${label}.`,
      code: error.code || null,
    }
  }

  return {
    ok: false,
    table,
    data: null,
    removedColumns,
    error: `Falha ao atualizar ${label}: limite de adaptação esgotado.`,
    code: 'ADAPTIVE_UPDATE_EXHAUSTED',
  }
}

async function safeSelectMaybeSingle({ table, filters = [], select = '*' }) {
  let query = supabaseAdmin.from(table).select(select)

  for (const filter of filters) {
    if (!filter?.column || !hasValue(filter.value)) continue
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.maybeSingle()

  if (error) {
    return { ok: false, data: null, error: error.message || String(error), code: error.code || null }
  }

  return { ok: true, data: data || null, error: null, code: null }
}

async function safeSelectList({ table, filters = [], limit = 30, select = '*' }) {
  let query = supabaseAdmin.from(table).select(select)

  for (const filter of filters) {
    if (!filter?.column || !hasValue(filter.value)) continue
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.limit(Math.min(Math.max(Number(limit || 30), 1), 200))

  if (error) {
    return { ok: false, data: [], error: error.message || String(error), code: error.code || null }
  }

  return { ok: true, data: data || [], error: null, code: null }
}

function normalizeNarrativeContentType(row = {}) {
  const metadata = asObject(row.metadata)
  const config = asObject(row.config)
  const displayPayload = asObject(row.display_payload)
  const raw = metadata.contentType || config.contentType || config.mediaKind || displayPayload.contentType || row.media_type || row.content_type || ''
  const normalized = String(raw || '').toLowerCase()

  if (['live_audio', 'audio_live', 'audio'].includes(normalized)) return 'live_audio'
  if (['live_action', 'video_live', 'video'].includes(normalized)) return 'live_action'

  return null
}

function isNarrativeDraftRow(row = {}) {
  const metadata = asObject(row.metadata)
  const config = asObject(row.config)
  const displayPayload = asObject(row.display_payload)

  return (
    metadata.source === 'admin_narrative_studio' ||
    config.source === 'narrative_studio' ||
    displayPayload.source === 'narrative_studio' ||
    Boolean(metadata.narrative) ||
    Boolean(config.narrativeProduct)
  )
}

function normalizeDraft(row = {}) {
  const metadata = asObject(row.metadata)
  const publication = asObject(metadata.publication)
  const displayPayload = asObject(row.display_payload)
  const clientCard = asObject(metadata.clientCard || displayPayload.clientCard)
  const contentType = normalizeNarrativeContentType(row)
  const title = row.title || row.name || row.label || displayPayload.publicTitle || clientCard.title || 'Produto narrativo'

  return {
    id: row.id,
    title,
    publicTitle: displayPayload.publicTitle || clientCard.title || title,
    publicDescription: displayPayload.publicDescription || clientCard.description || '',
    contentType,
    contentTypeLabel: TYPE_LABELS[contentType] || contentType || 'Narrativo',
    companionId: row.companion_id || metadata.companionId || null,
    actressId: row.actress_id || row.atriz_id || null,
    status: row.status || metadata.status || publication.status || 'draft',
    publicationStatus: publication.status || row.status || 'draft',
    productionStatus: metadata.production?.status || 'not_requested',
    priceCredits: Number(row.price_credits ?? clientCard.priceCredits ?? 0),
    durationSeconds: Number(clientCard.durationSeconds ?? metadata.narrative?.durationSeconds ?? 0),
    publishDestination: publication.destination || clientCard.placement || 'admin_only',
    visibleToClient: Boolean(row.visible_to_client),
    adminOnly: row.admin_only !== false,
    isActive: Boolean(row.is_active || row.active),
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
    jobOrigin: row.job_origin || row.origin || meta.source || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

async function getNarrativeDraftById(draftId) {
  if (!draftId) {
    return { ok: false, row: null, draft: null, error: 'draftId não informado', code: 'MISSING_DRAFT_ID' }
  }

  const result = await safeSelectMaybeSingle({
    table: COMBINATIONS_TABLE,
    filters: [{ column: 'id', value: draftId }],
  })

  if (!result.ok) return { ok: false, row: null, draft: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, draft: null, error: 'Rascunho narrativo não encontrado.', code: 'DRAFT_NOT_FOUND' }
  if (!isNarrativeDraftRow(result.data)) return { ok: false, row: result.data, draft: null, error: 'Registro não parece ser rascunho do Estúdio Narrativo.', code: 'NOT_NARRATIVE_DRAFT' }

  const draft = normalizeDraft(result.data)
  if (!draft.contentType) return { ok: false, row: result.data, draft, error: 'Tipo narrativo ausente ou inválido.', code: 'INVALID_NARRATIVE_TYPE' }

  return { ok: true, row: result.data, draft, error: null, code: null }
}

function buildProductionPackage(row = {}, draft = {}) {
  const metadata = asObject(row.metadata)
  const displayPayload = asObject(row.display_payload)
  const clientCard = asObject(metadata.clientCard || displayPayload.clientCard)
  const narrative = asObject(metadata.narrative)
  const contentType = draft.contentType

  return {
    sprint: SPRINT,
    draftId: draft.id,
    companionId: draft.companionId,
    contentType,
    contentTypeLabel: TYPE_LABELS[contentType] || contentType,
    mediaType: MEDIA_TYPE_FOR_CONTENT_TYPE[contentType] || contentType,
    publicTitle: draft.publicTitle,
    publicDescription: draft.publicDescription,
    durationSeconds: draft.durationSeconds,
    priceCredits: draft.priceCredits,
    publishDestination: draft.publishDestination,
    clientCard: {
      title: clientCard.title || draft.publicTitle,
      description: clientCard.description || draft.publicDescription,
      durationSeconds: draft.durationSeconds,
      priceCredits: draft.priceCredits,
      contentType,
      contentTypeLabel: TYPE_LABELS[contentType] || contentType,
      lockedBeforePurchase: true,
      mediaVisibleBeforePurchase: false,
      showGenerateButtonBeforePurchase: false,
      ctaLabel: Number(draft.priceCredits) > 0 ? 'Comprar' : 'Liberar',
      friendlyProcessingMessage: clientCard.friendlyProcessingMessage || (contentType === 'live_audio'
        ? 'A avatar está preparando esse áudio para você...'
        : 'A avatar está preparando esse momento para você...'),
    },
    productionPlan: {
      mode: 'safe_preproduction_request',
      provider: contentType === 'live_audio' ? 'tts_pending_future_sprint' : 'video_pending_future_sprint',
      workerEnabled: false,
      queueJobWillBeCreated: false,
      outputExpected: contentType === 'live_audio' ? 'audio_file_after_future_worker' : 'video_file_after_future_worker',
      targetStatus: 'queued',
      qaRequired: true,
    },
    internalOnly: {
      event: narrative.event || '',
      mood: narrative.mood || '',
      location: narrative.location || '',
      narrativeIntent: narrative.narrativeIntent || '',
      manualPromptPresent: Boolean(narrative.manualPrompt),
      voiceStyle: narrative.voiceStyle || '',
      visualStyle: narrative.visualStyle || '',
      internalPromptVisibleToClient: false,
    },
  }
}

function buildBatchPayload({ draft, productionPackage, adminProfileId }) {
  const now = nowIso()
  const metadata = {
    sprint: SPRINT,
    source: 'narrative_studio_preproduction_6_3O',
    purpose: 'controlled_narrative_production_request',
    draftId: draft.id,
    companionId: draft.companionId,
    contentType: draft.contentType,
    title: draft.publicTitle,
    productionPackage,
    workerEnabled: false,
    queueJobCreated: false,
  }

  return {
    status: 'queued',
    mode: 'narrative_preproduction_controlled',
    type: productionPackage.mediaType,
    batch_type: 'premium_studio',
    companion_id: draft.companionId,
    avatar_id: draft.companionId,
    media_combination_id: draft.id,
    combination_id: draft.id,
    requested_items: 1,
    total_items: 1,
    completed_items: 0,
    failed_items: 0,
    approved_items: 0,
    rejected_items: 0,
    job_origin: 'narrative_studio_6_3O',
    origin: 'narrative_studio_6_3O',
    source: 'admin_narrative_studio',
    created_by: adminProfileId,
    created_by_profile_id: adminProfileId,
    requested_by: adminProfileId,
    queued_at: now,
    real_production: false,
    real_worker_enabled: false,
    metadata,
    meta: metadata,
    notes: 'Sprint 6.3O: pedido seguro de pré-produção narrativa, sem worker real, sem R2, sem cobrança, sem entrega e sem URL pública.',
    admin_notes: 'Sprint 6.3O: pedido seguro de pré-produção narrativa, sem worker real, sem R2, sem cobrança, sem entrega e sem URL pública.',
  }
}

function buildBatchItemPayload({ batchId, draft, productionPackage, adminProfileId }) {
  const now = nowIso()
  const metadata = {
    sprint: SPRINT,
    source: 'narrative_studio_preproduction_6_3O',
    purpose: 'controlled_narrative_production_request_item',
    draftId: draft.id,
    companionId: draft.companionId,
    contentType: draft.contentType,
    title: draft.publicTitle,
    productionPackage,
    workerEnabled: false,
    queueJobCreated: false,
  }

  return {
    batch_id: batchId,
    status: 'queued',
    mode: 'narrative_preproduction_controlled',
    type: productionPackage.mediaType,
    companion_id: draft.companionId,
    avatar_id: draft.companionId,
    media_combination_id: draft.id,
    combination_id: draft.id,
    job_origin: 'narrative_studio_6_3O',
    origin: 'narrative_studio_6_3O',
    source: 'admin_narrative_studio',
    created_by: adminProfileId,
    created_by_profile_id: adminProfileId,
    requested_by: adminProfileId,
    queued_at: now,
    real_production: false,
    real_worker_enabled: false,
    requested_variants: 1,
    metadata,
    meta: metadata,
    notes: 'Sprint 6.3O: item de pré-produção narrativa controlada, sem worker real, sem R2, sem cobrança e sem entrega.',
    admin_notes: 'Sprint 6.3O: item de pré-produção narrativa controlada, sem worker real, sem R2, sem cobrança e sem entrega.',
  }
}

function buildDraftUpdatePayload({ row, draft, batchId, batchItemId, productionPackage, adminProfileId }) {
  const now = nowIso()
  const metadata = asObject(row.metadata)
  const publication = asObject(metadata.publication)
  const production = asObject(metadata.production)

  const nextMetadata = {
    ...metadata,
    status: 'production_requested',
    production: {
      ...production,
      status: 'queued',
      sprint: SPRINT,
      requestedAt: now,
      requestedByProfileId: adminProfileId || null,
      batchId,
      batchItemId,
      queueJobCreated: false,
      workerEnabled: false,
      productionPackage,
    },
    publication: {
      ...publication,
      status: 'draft',
      adminVisible: true,
      actorVisible: false,
      clientCardVisible: false,
      clientMediaVisibleBeforePurchase: false,
    },
  }

  const displayPayload = asObject(row.display_payload)

  return {
    metadata: nextMetadata,
    display_payload: {
      ...displayPayload,
      productionStatus: 'queued',
      productionBatchId: batchId,
      productionBatchItemId: batchItemId,
      source: displayPayload.source || 'narrative_studio',
    },
    updated_at: now,
    is_active: false,
    active: false,
    visible_to_client: false,
    admin_only: true,
  }
}

async function findProductionRequestsForDraft(draftId) {
  const [itemsByCombination, itemsByMeta] = await Promise.all([
    safeSelectList({ table: BATCH_ITEMS_TABLE, filters: [{ column: 'combination_id', value: draftId }], limit: 20 }),
    safeSelectList({ table: BATCH_ITEMS_TABLE, filters: [{ column: 'media_combination_id', value: draftId }], limit: 20 }),
  ])

  const itemMap = new Map()
  for (const result of [itemsByCombination, itemsByMeta]) {
    for (const row of result.data || []) {
      if (row?.id) itemMap.set(row.id, row)
    }
  }

  const items = [...itemMap.values()].filter((row) => {
    const meta = asObject(row.metadata || row.meta)
    return row.job_origin === 'narrative_studio_6_3O' || row.origin === 'narrative_studio_6_3O' || meta.source === 'narrative_studio_preproduction_6_3O'
  })

  const batchIds = [...new Set(items.map((item) => item.batch_id).filter(Boolean))]
  const batches = []
  for (const batchId of batchIds) {
    const result = await safeSelectMaybeSingle({ table: BATCHES_TABLE, filters: [{ column: 'id', value: batchId }] })
    if (result.ok && result.data) batches.push(result.data)
  }

  return {
    batches: batches.map(summarizeBatch),
    items: items.map(summarizeItem),
    queryWarnings: [itemsByCombination, itemsByMeta].filter((r) => !r.ok).map((r) => r.error),
  }
}

export async function previewNarrativeProductionRequest({ draftId }) {
  const draftLookup = await getNarrativeDraftById(draftId)

  if (!draftLookup.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_PRODUCTION_BLOCKED_BY_DRAFT',
      canRequestProduction: false,
      blocker: draftLookup.code,
      error: draftLookup.error,
      safety: buildSafety(),
    }
  }

  const productionPackage = buildProductionPackage(draftLookup.row, draftLookup.draft)
  const existingRequests = await findProductionRequestsForDraft(draftLookup.draft.id)
  const hasOpenRequest = existingRequests.items.some((item) => ['queued', 'running', 'processing'].includes(String(item.status || '').toLowerCase()))

  return {
    sprint: SPRINT,
    status: hasOpenRequest ? 'NARRATIVE_PRODUCTION_ALREADY_REQUESTED' : 'NARRATIVE_PRODUCTION_READY_TO_REQUEST',
    canRequestProduction: !hasOpenRequest,
    draft: draftLookup.draft,
    productionPackage,
    existingRequests,
    blockers: hasOpenRequest ? ['open_production_request_already_exists'] : [],
    warnings: [],
    safety: buildSafety(),
  }
}

export async function requestNarrativeProduction({ draftId, adminProfileId = null, confirmationPhrase = '', dryRunOnly = true } = {}) {
  const preview = await previewNarrativeProductionRequest({ draftId })
  const requestedMutation = toBool(process.env.RUN_6_3O_NARRATIVE_PRODUCTION_MUTATION)
  const mutationAllowed = toBool(process.env.ALLOW_6_3O_NARRATIVE_PRODUCTION_REQUEST)
  const confirmationOk = String(confirmationPhrase || process.env.NARRATIVE_STUDIO_6_3O_CONFIRMATION_PHRASE || '').trim() === REQUIRED_CONFIRMATION_PHRASE
  const blockers = [
    ...(dryRunOnly ? ['dry_run_only'] : []),
    ...(!requestedMutation ? ['mutation_env_not_requested'] : []),
    ...(!mutationAllowed ? ['mutation_env_not_allowed'] : []),
    ...(!confirmationOk ? ['confirmation_phrase_missing_or_invalid'] : []),
    ...(!preview.canRequestProduction ? (preview.blockers?.length ? preview.blockers : ['draft_not_ready_for_production']) : []),
  ]

  if (blockers.length) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_PRODUCTION_REQUEST_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedApply: !dryRunOnly,
      blockers,
      preview,
      safety: buildSafety(),
    }
  }

  const draftLookup = await getNarrativeDraftById(draftId)
  if (!draftLookup.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_PRODUCTION_BLOCKED_BY_DRAFT',
      dryRun: true,
      blocker: draftLookup.code,
      error: draftLookup.error,
      safety: buildSafety(),
    }
  }

  const draft = draftLookup.draft
  const productionPackage = buildProductionPackage(draftLookup.row, draft)
  const batchInsert = await safeInsertAdaptive({
    table: BATCHES_TABLE,
    payload: buildBatchPayload({ draft, productionPackage, adminProfileId }),
    label: 'lote de pré-produção narrativa',
  })

  if (!batchInsert.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_PRODUCTION_BATCH_CREATE_FAILED',
      dryRun: false,
      batchInsert,
      safety: buildSafety({ databaseMutationExecutedByThisService: false }),
    }
  }

  const batchId = batchInsert.data?.id
  const batchItemInsert = await safeInsertAdaptive({
    table: BATCH_ITEMS_TABLE,
    payload: buildBatchItemPayload({ batchId, draft, productionPackage, adminProfileId }),
    label: 'item de pré-produção narrativa',
  })

  if (!batchItemInsert.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_PRODUCTION_BATCH_ITEM_CREATE_FAILED',
      dryRun: false,
      batch: batchInsert.data,
      batchInsert,
      batchItemInsert,
      safety: buildSafety({ databaseMutationExecutedByThisService: true }),
    }
  }

  const batchItemId = batchItemInsert.data?.id
  const draftUpdate = await safeUpdateAdaptive({
    table: COMBINATIONS_TABLE,
    id: draft.id,
    payload: buildDraftUpdatePayload({
      row: draftLookup.row,
      draft,
      batchId,
      batchItemId,
      productionPackage,
      adminProfileId,
    }),
    label: 'rascunho narrativo',
  })

  const audit = await insertAdminAuditAdaptive({
    profileId: adminProfileId,
    action: 'narrative_studio.production.request',
    entityType: 'media_generation_batch',
    entityId: batchId,
    message: `Rascunho narrativo enviado para pré-produção controlada ${SPRINT}.`,
    sprint: SPRINT,
    metadata: {
      draftId: draft.id,
      batchId,
      batchItemId,
      contentType: draft.contentType,
      title: draft.publicTitle,
      workerEnabled: false,
      queueJobCreated: false,
      batchRemovedColumns: batchInsert.removedColumns,
      itemRemovedColumns: batchItemInsert.removedColumns,
      draftUpdateRemovedColumns: draftUpdate.removedColumns,
    },
  })

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_PRODUCTION_REQUEST_CREATED_CONTROLLED',
    dryRun: false,
    requestedApply: true,
    mutationEnvAllowed: true,
    confirmationOk: true,
    draft: {
      ...draft,
      productionStatus: 'queued',
    },
    batch: summarizeBatch(batchInsert.data),
    batchItem: summarizeItem(batchItemInsert.data),
    operations: {
      batchInsert: {
        ok: batchInsert.ok,
        removedColumns: batchInsert.removedColumns,
      },
      batchItemInsert: {
        ok: batchItemInsert.ok,
        removedColumns: batchItemInsert.removedColumns,
      },
      draftUpdate: {
        ok: draftUpdate.ok,
        removedColumns: draftUpdate.removedColumns,
        error: draftUpdate.error,
        code: draftUpdate.code,
      },
      audit,
    },
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}

export async function inspectNarrativeProduction({ draftId = null } = {}) {
  const selectedDraftId = draftId || process.env.NARRATIVE_STUDIO_DRAFT_ID || process.env.NARRATIVE_STUDIO_6_3O_DRAFT_ID || null
  const preview = selectedDraftId ? await previewNarrativeProductionRequest({ draftId: selectedDraftId }) : null

  let globalRequests = { batches: [], items: [], warnings: [] }

  const itemsResult = await safeSelectList({ table: BATCH_ITEMS_TABLE, limit: 80 })
  const narrativeItems = (itemsResult.data || []).filter((row) => {
    const meta = asObject(row.metadata || row.meta)
    return row.job_origin === 'narrative_studio_6_3O' || row.origin === 'narrative_studio_6_3O' || meta.source === 'narrative_studio_preproduction_6_3O'
  })

  globalRequests = {
    items: narrativeItems.map(summarizeItem),
    total: narrativeItems.length,
    byStatus: narrativeItems.reduce((acc, item) => {
      const status = item.status || 'unknown'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {}),
    warnings: itemsResult.ok ? [] : [itemsResult.error],
  }

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_PRODUCTION_READINESS_READY',
    checkedAt: nowIso(),
    selectedDraftId,
    preview,
    productionRequests: globalRequests,
    rules: {
      draftCanBeSentToControlledPreproduction: true,
      queueJobCreatedByThisSprint: false,
      realWorkerStillDisabled: true,
      clientCardStillHiddenUntilPublication: true,
      clientMediaVisibleOnlyAfterPurchase: true,
    },
    blockers: [],
    warnings: globalRequests.warnings || [],
    safety: buildSafety(),
  }
}

export function getNarrativeProductionConfig() {
  return {
    sprint: SPRINT,
    name: 'Pré-produção narrativa controlada',
    requiredConfirmationPhrase: REQUIRED_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3O_NARRATIVE_PRODUCTION_MUTATION: toBool(process.env.RUN_6_3O_NARRATIVE_PRODUCTION_MUTATION),
      ALLOW_6_3O_NARRATIVE_PRODUCTION_REQUEST: toBool(process.env.ALLOW_6_3O_NARRATIVE_PRODUCTION_REQUEST),
      NARRATIVE_STUDIO_6_3O_CONFIRMATION_PHRASE: hasValue(process.env.NARRATIVE_STUDIO_6_3O_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
      NARRATIVE_STUDIO_DRAFT_ID: process.env.NARRATIVE_STUDIO_DRAFT_ID || process.env.NARRATIVE_STUDIO_6_3O_DRAFT_ID || null,
      NARRATIVE_STUDIO_ADMIN_PROFILE_ID: hasValue(process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID) ? '[preenchido]' : null,
    },
    safety: buildSafety(),
  }
}
