import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const ASSET_VARIANTS_TABLE = 'media_asset_variants'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const BATCHES_TABLE = 'media_generation_batches'
const AUDIT_TABLE = 'admin_audit_logs'

const APPROVABLE_STATUS = 'qa_pending'
const AVAILABLE_STATUS = 'available'
const REJECTED_STATUS = 'rejected'
const COMPLETED_STATUS = 'completed'
const QA_PENDING_STATUS = 'qa_pending'
const FAILED_STATUS = 'failed'
const CANCELLED_STATUS = 'cancelled'
const RUNNING_STATUS = 'running'
const QUEUED_STATUS = 'queued'

function nowIso() {
  return new Date().toISOString()
}

function addDaysIso(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + Number(days || 0))
  return date.toISOString()
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function safeMetadata(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function toInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback
}

function getActorProfileId(input = {}) {
  const actorProfileId = (
    input.actorProfileId ||
    input.actor_profile_id ||
    null
  )

  if (!actorProfileId) {
    throw new ApiError(401, 'Perfil administrador autenticado obrigatório para curadoria.')
  }

  return actorProfileId
}

function buildRequestContext(input = {}) {
  return {
    source: input.source || 'factory_qa_backend',
    requestId: input.requestId || input.request_id || null,
    ip: input.ip || null,
    userAgent: input.userAgent || input.user_agent || null,
  }
}

async function getAssetVariant(assetId) {
  if (!assetId) {
    throw new ApiError(400, 'assetId obrigatório.')
  }

  const { data, error } = await supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar asset para curadoria.', {
      assetId,
      error: error.message,
    })
  }

  if (!data) {
    throw new ApiError(404, 'Asset não encontrado para curadoria.', {
      assetId,
    })
  }

  return data
}

async function getBatchItem(batchItemId) {
  if (!batchItemId) return null

  const { data, error } = await supabaseAdmin
    .from(BATCH_ITEMS_TABLE)
    .select('*')
    .eq('id', batchItemId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar item do lote da fábrica.', {
      batchItemId,
      error: error.message,
    })
  }

  return data || null
}

async function getBatch(batchId) {
  if (!batchId) return null

  const { data, error } = await supabaseAdmin
    .from(BATCHES_TABLE)
    .select('*')
    .eq('id', batchId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar lote da fábrica.', {
      batchId,
      error: error.message,
    })
  }

  return data || null
}

async function updateAsset(assetId, payload) {
  const { data, error } = await supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .update(payload)
    .eq('id', assetId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar asset na curadoria.', {
      assetId,
      error: error.message,
    })
  }

  return data
}

async function updateBatchItem(batchItemId, payload) {
  if (!batchItemId) return null

  const { data, error } = await supabaseAdmin
    .from(BATCH_ITEMS_TABLE)
    .update(payload)
    .eq('id', batchItemId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar item do lote após curadoria.', {
      batchItemId,
      error: error.message,
    })
  }

  return data || null
}

async function updateBatch(batchId, payload) {
  if (!batchId) return null

  const { data, error } = await supabaseAdmin
    .from(BATCHES_TABLE)
    .update(payload)
    .eq('id', batchId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar lote após curadoria.', {
      batchId,
      error: error.message,
    })
  }

  return data || null
}

async function listAssetsByBatchItem(batchItemId) {
  if (!batchItemId) return []

  const { data, error } = await supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .select('id, status, batch_item_id, variant_number, updated_at')
    .eq('batch_item_id', batchItemId)

  if (error) {
    throw new ApiError(500, 'Erro ao recalcular assets do item do lote.', {
      batchItemId,
      error: error.message,
    })
  }

  return data || []
}

async function listBatchItems(batchId) {
  if (!batchId) return []

  const { data, error } = await supabaseAdmin
    .from(BATCH_ITEMS_TABLE)
    .select('*')
    .eq('batch_id', batchId)

  if (error) {
    throw new ApiError(500, 'Erro ao recalcular itens do lote.', {
      batchId,
      error: error.message,
    })
  }

  return data || []
}

function isTerminalBatchItemStatus(status) {
  return [COMPLETED_STATUS, FAILED_STATUS, CANCELLED_STATUS].includes(status)
}

function shouldBatchItemComplete(batchItem, assets = []) {
  const requestedVariants = Math.max(toInteger(batchItem?.requested_variants, 1), 1)
  const generatedVariants = Math.max(toInteger(batchItem?.generated_variants, 0), assets.length)
  const reviewedVariants = assets.filter((item) => [AVAILABLE_STATUS, REJECTED_STATUS].includes(item.status)).length

  return generatedVariants >= requestedVariants && reviewedVariants >= requestedVariants
}

function buildAssetQaPayload({ asset, action, actorProfileId, reason, previousQaPayload = {} }) {
  const timestamp = nowIso()
  const normalizedReason = normalizeText(reason)

  return {
    ...previousQaPayload,
    status: action === 'approve' ? AVAILABLE_STATUS : REJECTED_STATUS,
    requires_qa: false,
    reviewed_at: timestamp,
    reviewed_by_profile_id: actorProfileId || null,
    review_action: action,
    rejection_reason: action === 'reject' ? normalizedReason : previousQaPayload.rejection_reason || null,
    history: [
      ...Array.isArray(previousQaPayload.history) ? previousQaPayload.history : [],
      {
        action,
        status: action === 'approve' ? AVAILABLE_STATUS : REJECTED_STATUS,
        reviewed_at: timestamp,
        reviewed_by_profile_id: actorProfileId || null,
        reason: normalizedReason || null,
      },
    ],
    asset_id: asset.id,
    batch_id: asset.batch_id || previousQaPayload.batch_id || null,
    batch_item_id: asset.batch_item_id || previousQaPayload.batch_item_id || null,
    combination_id: asset.combination_id || previousQaPayload.combination_id || null,
    companion_id: asset.companion_id || previousQaPayload.companion_id || null,
  }
}

function buildAssetMetadata({ asset, action, actorProfileId, reason, previousMetadata = {} }) {
  const timestamp = nowIso()
  const normalizedReason = normalizeText(reason)

  return {
    ...previousMetadata,
    lastQaAction: {
      action,
      status: action === 'approve' ? AVAILABLE_STATUS : REJECTED_STATUS,
      reviewed_at: timestamp,
      reviewed_by_profile_id: actorProfileId || null,
      reason: normalizedReason || null,
    },
    qaHistory: [
      ...Array.isArray(previousMetadata.qaHistory) ? previousMetadata.qaHistory : [],
      {
        action,
        status: action === 'approve' ? AVAILABLE_STATUS : REJECTED_STATUS,
        reviewed_at: timestamp,
        reviewed_by_profile_id: actorProfileId || null,
        reason: normalizedReason || null,
      },
    ],
    asset_id: asset.id,
  }
}

async function recalculateBatchItem(batchItemId) {
  const batchItem = await getBatchItem(batchItemId)

  if (!batchItem) {
    return {
      batchItem: null,
      batch: null,
    }
  }

  const assets = await listAssetsByBatchItem(batchItemId)
  const approvedVariants = assets.filter((asset) => asset.status === AVAILABLE_STATUS).length
  const rejectedVariants = assets.filter((asset) => asset.status === REJECTED_STATUS).length
  const generatedVariants = Math.max(toInteger(batchItem.generated_variants, 0), assets.length)
  const completed = shouldBatchItemComplete(
    {
      ...batchItem,
      generated_variants: generatedVariants,
    },
    assets,
  )

  const updatedMetadata = {
    ...safeMetadata(batchItem.metadata),
    qa_summary: {
      approved_variants: approvedVariants,
      rejected_variants: rejectedVariants,
      generated_variants: generatedVariants,
      completed,
      recalculated_at: nowIso(),
    },
  }

  const updatedBatchItem = await updateBatchItem(batchItemId, {
    status: completed ? COMPLETED_STATUS : QA_PENDING_STATUS,
    approved_variants: approvedVariants,
    rejected_variants: rejectedVariants,
    generated_variants: generatedVariants,
    metadata: updatedMetadata,
    updated_at: nowIso(),
  })

  const updatedBatch = await recalculateBatch(batchItem.batch_id)

  return {
    batchItem: updatedBatchItem,
    batch: updatedBatch,
  }
}

async function recalculateBatch(batchId) {
  const batch = await getBatch(batchId)

  if (!batch) return null

  const items = await listBatchItems(batchId)

  if (items.length === 0) {
    return batch
  }

  const requestedCount = items.reduce((sum, item) => sum + Math.max(toInteger(item.requested_variants, 1), 1), 0)
  const generatedCount = items.reduce((sum, item) => sum + Math.max(toInteger(item.generated_variants, 0), 0), 0)
  const approvedCount = items.reduce((sum, item) => sum + Math.max(toInteger(item.approved_variants, 0), 0), 0)
  const rejectedCount = items.reduce((sum, item) => sum + Math.max(toInteger(item.rejected_variants, 0), 0), 0)
  const allTerminal = items.every((item) => isTerminalBatchItemStatus(item.status))

  let nextStatus = batch.status || QA_PENDING_STATUS

  if (allTerminal) {
    nextStatus = COMPLETED_STATUS
  } else if (items.some((item) => item.status === RUNNING_STATUS)) {
    nextStatus = RUNNING_STATUS
  } else if (items.some((item) => item.status === QA_PENDING_STATUS)) {
    nextStatus = QA_PENDING_STATUS
  } else if (items.some((item) => item.status === QUEUED_STATUS)) {
    nextStatus = QUEUED_STATUS
  }

  const metadata = {
    ...safeMetadata(batch.metadata),
    qa_summary: {
      requested_count: requestedCount,
      generated_count: generatedCount,
      approved_count: approvedCount,
      rejected_count: rejectedCount,
      all_terminal: allTerminal,
      recalculated_at: nowIso(),
    },
  }

  const payload = {
    status: nextStatus,
    requested_count: requestedCount,
    generated_count: generatedCount,
    approved_count: approvedCount,
    rejected_count: rejectedCount,
    metadata,
    updated_at: nowIso(),
  }

  if (allTerminal) {
    payload.completed_at = batch.completed_at || nowIso()
  }

  return updateBatch(batchId, payload)
}



function compactPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )
}

function parseMissingColumn(error) {
  const message = String(error?.message || '')

  return (
    message.match(/Could not find the '([^']+)' column/)?.[1] ||
    message.match(/column "([^"]+)" of relation "[^"]+" does not exist/)?.[1] ||
    null
  )
}

function parseNullViolationColumn(error) {
  const message = String(error?.message || '')

  return message.match(/null value in column "([^"]+)"/)?.[1] || null
}

async function getFallbackAuditProfileId() {
  if (fallbackAuditProfileIdCache !== null) return fallbackAuditProfileIdCache

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[factory-qa] não foi possível buscar profile fallback para auditoria:', error.message)
    fallbackAuditProfileIdCache = null
    return null
  }

  fallbackAuditProfileIdCache = data?.id || null
  return fallbackAuditProfileIdCache
}

function buildAuditSupersetPayload({
  action,
  assetBefore,
  assetAfter,
  actorProfileId,
  auditMetadata,
}) {
  const description = `Curadoria da fábrica: ${action} em ${ASSET_VARIANTS_TABLE}/${assetAfter.id}`

  return compactPayload({
    action,
    event: action,
    event_name: action,
    event_type: action,
    operation: action,
    activity: action,

    entity_type: ASSET_VARIANTS_TABLE,
    resource_type: ASSET_VARIANTS_TABLE,
    target_type: ASSET_VARIANTS_TABLE,
    target_table: ASSET_VARIANTS_TABLE,
    table_name: ASSET_VARIANTS_TABLE,
    record_table: ASSET_VARIANTS_TABLE,

    entity_id: assetAfter.id,
    resource_id: assetAfter.id,
    target_id: assetAfter.id,
    record_id: assetAfter.id,
    row_id: assetAfter.id,

    actor_profile_id: actorProfileId || null,
    profile_id: actorProfileId || null,
    user_id: actorProfileId || null,
    actor_id: actorProfileId || null,

    description,
    message: description,

    metadata: auditMetadata,
    details: auditMetadata,
    payload: auditMetadata,
    data: auditMetadata,
    context: auditMetadata,
    audit_payload: auditMetadata,
    change_payload: auditMetadata,
    changes: auditMetadata,

    old_values: auditMetadata.assetBefore || {},
    previous_values: auditMetadata.assetBefore || {},
    before: auditMetadata.assetBefore || {},

    new_values: auditMetadata.assetAfter || {},
    current_values: auditMetadata.assetAfter || {},
    after: auditMetadata.assetAfter || {},

    ip_address: auditMetadata?.requestContext?.ip || null,
    user_agent: auditMetadata?.requestContext?.userAgent || null,
    request_id: auditMetadata?.requestContext?.requestId || null,

    created_at: nowIso(),
  })
}

async function fillRequiredAuditColumn(payload, column, {
  action,
  assetAfter,
  actorProfileId,
  auditMetadata,
}) {
  const normalized = String(column || '').toLowerCase()

  if (normalized.includes('action') || normalized.includes('event') || normalized.includes('operation') || normalized.includes('activity')) {
    payload[column] = action
    return true
  }

  if (normalized.includes('description') || normalized.includes('message')) {
    payload[column] = `Curadoria da fábrica: ${action} em ${ASSET_VARIANTS_TABLE}/${assetAfter.id}`
    return true
  }

  if (normalized.includes('table') || normalized.includes('entity_type') || normalized.includes('resource_type') || normalized.includes('target_type')) {
    payload[column] = ASSET_VARIANTS_TABLE
    return true
  }

  if (normalized.includes('metadata') || normalized.includes('details') || normalized.includes('payload') || normalized.includes('context') || normalized.includes('change') || normalized.includes('data')) {
    payload[column] = auditMetadata
    return true
  }

  if (normalized.includes('old') || normalized.includes('before') || normalized.includes('previous')) {
    payload[column] = auditMetadata.assetBefore || {}
    return true
  }

  if (normalized.includes('new') || normalized.includes('after') || normalized.includes('current')) {
    payload[column] = auditMetadata.assetAfter || {}
    return true
  }

  if (normalized.includes('profile') || normalized.includes('user') || normalized.includes('actor') || normalized.includes('admin')) {
    payload[column] = actorProfileId
    return Boolean(payload[column])
  }

  if ((normalized.includes('id') || normalized.endsWith('_uuid')) && normalized !== 'id') {
    payload[column] = assetAfter.id
    return true
  }

  if (normalized.includes('created') || normalized.includes('updated') || normalized.includes('at')) {
    payload[column] = nowIso()
    return true
  }

  return false
}

async function insertAuditLog({ action, assetBefore, assetAfter, actorProfileId, requestContext, metadata = {} }) {
  const resolvedActorProfileId = actorProfileId

  const auditMetadata = {
    ...metadata,
    requestContext,
    assetBefore: {
      id: assetBefore.id,
      status: assetBefore.status,
      batch_id: assetBefore.batch_id || null,
      batch_item_id: assetBefore.batch_item_id || null,
      combination_id: assetBefore.combination_id || null,
      companion_id: assetBefore.companion_id || null,
      r2_key: assetBefore.r2_key || null,
    },
    assetAfter: {
      id: assetAfter.id,
      status: assetAfter.status,
      batch_id: assetAfter.batch_id || null,
      batch_item_id: assetAfter.batch_item_id || null,
      combination_id: assetAfter.combination_id || null,
      companion_id: assetAfter.companion_id || null,
      r2_key: assetAfter.r2_key || null,
    },
  }

  const basePayload = buildAuditSupersetPayload({
    action,
    assetBefore,
    assetAfter,
    actorProfileId: resolvedActorProfileId,
    auditMetadata,
  })

  let payload = { ...basePayload }
  const errors = []

  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(AUDIT_TABLE)
      .insert(payload)
      .select('*')
      .maybeSingle()

    if (!error) {
      return data || payload
    }

    errors.push(error.message)

    const missingColumn = parseMissingColumn(error)

    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn]
      continue
    }

    const nullColumn = parseNullViolationColumn(error)

    if (nullColumn && !payload[nullColumn]) {
      const filled = await fillRequiredAuditColumn(payload, nullColumn, {
        action,
        assetAfter,
        actorProfileId: resolvedActorProfileId,
        auditMetadata,
      })

      if (filled) continue
    }

    throw new ApiError(500, 'Erro ao inserir log de auditoria da curadoria.', {
      action,
      assetId: assetAfter.id,
      payloadColumns: Object.keys(payload),
      error: error.message,
      previousErrors: errors.slice(-10),
    })
  }

  throw new ApiError(500, 'Erro ao inserir log de auditoria da curadoria após múltiplas tentativas adaptativas.', {
    action,
    assetId: assetAfter.id,
    payloadColumns: Object.keys(payload),
    errors: errors.slice(-20),
  })
}

function buildServiceResult({ action, assetBefore, assetAfter, batchItem, batch, auditLog }) {
  return {
    ok: true,
    action,
    asset: {
      id: assetAfter.id,
      status: assetAfter.status,
      previousStatus: assetBefore.status,
      publishedAt: assetAfter.published_at || null,
      cleanupAfter: assetAfter.cleanup_after || null,
      rejectionReason: assetAfter.rejection_reason || null,
      batchId: assetAfter.batch_id || null,
      batchItemId: assetAfter.batch_item_id || null,
      combinationId: assetAfter.combination_id || null,
      companionId: assetAfter.companion_id || null,
      r2Bucket: assetAfter.r2_bucket || null,
      r2Key: assetAfter.r2_key || null,
    },
    batchItem: batchItem
      ? {
          id: batchItem.id,
          status: batchItem.status,
          requestedVariants: batchItem.requested_variants,
          generatedVariants: batchItem.generated_variants,
          approvedVariants: batchItem.approved_variants,
          rejectedVariants: batchItem.rejected_variants,
        }
      : null,
    batch: batch
      ? {
          id: batch.id,
          status: batch.status,
          requestedCount: batch.requested_count,
          generatedCount: batch.generated_count,
          approvedCount: batch.approved_count,
          rejectedCount: batch.rejected_count,
          completedAt: batch.completed_at || null,
        }
      : null,
    auditLog: auditLog
      ? {
          id: auditLog.id || null,
          action: auditLog.action || action,
        }
      : null,
  }
}

export async function approveAssetVariant(assetId, input = {}) {
  const actorProfileId = getActorProfileId(input)
  const requestContext = buildRequestContext(input)
  const assetBefore = await getAssetVariant(assetId)

  if (assetBefore.status !== APPROVABLE_STATUS) {
    throw new ApiError(409, 'Somente assets em qa_pending podem ser aprovados.', {
      assetId,
      currentStatus: assetBefore.status,
    })
  }

  const timestamp = nowIso()
  const qaPayload = buildAssetQaPayload({
    asset: assetBefore,
    action: 'approve',
    actorProfileId,
    reason: input.notes || input.reason || null,
    previousQaPayload: safeMetadata(assetBefore.qa_payload),
  })

  const metadata = buildAssetMetadata({
    asset: assetBefore,
    action: 'approve',
    actorProfileId,
    reason: input.notes || input.reason || null,
    previousMetadata: safeMetadata(assetBefore.metadata),
  })

  const assetAfter = await updateAsset(assetId, {
    status: AVAILABLE_STATUS,
    qa_payload: qaPayload,
    metadata,
    rejection_reason: null,
    cleanup_after: null,
    published_at: assetBefore.published_at || timestamp,
    updated_at: timestamp,
  })

  const { batchItem, batch } = await recalculateBatchItem(assetAfter.batch_item_id)

  const auditLog = await insertAuditLog({
    action: 'factory.asset.approve',
    assetBefore,
    assetAfter,
    actorProfileId,
    requestContext,
    metadata: {
      notes: input.notes || null,
    },
  })

  return buildServiceResult({
    action: 'approve',
    assetBefore,
    assetAfter,
    batchItem,
    batch,
    auditLog,
  })
}

export async function rejectAssetVariant(assetId, input = {}) {
  const actorProfileId = getActorProfileId(input)
  const requestContext = buildRequestContext(input)
  const rejectionReason = normalizeText(input.reason || input.rejectionReason || input.rejection_reason)

  if (!rejectionReason) {
    throw new ApiError(400, 'Motivo da rejeição é obrigatório.')
  }

  const assetBefore = await getAssetVariant(assetId)

  if (assetBefore.status !== APPROVABLE_STATUS) {
    throw new ApiError(409, 'Somente assets em qa_pending podem ser rejeitados.', {
      assetId,
      currentStatus: assetBefore.status,
    })
  }

  const timestamp = nowIso()
  const qaPayload = buildAssetQaPayload({
    asset: assetBefore,
    action: 'reject',
    actorProfileId,
    reason: rejectionReason,
    previousQaPayload: safeMetadata(assetBefore.qa_payload),
  })

  const metadata = buildAssetMetadata({
    asset: assetBefore,
    action: 'reject',
    actorProfileId,
    reason: rejectionReason,
    previousMetadata: safeMetadata(assetBefore.metadata),
  })

  const assetAfter = await updateAsset(assetId, {
    status: REJECTED_STATUS,
    qa_payload: qaPayload,
    metadata,
    rejection_reason: rejectionReason,
    cleanup_after: addDaysIso(7),
    updated_at: timestamp,
  })

  const { batchItem, batch } = await recalculateBatchItem(assetAfter.batch_item_id)

  const auditLog = await insertAuditLog({
    action: 'factory.asset.reject',
    assetBefore,
    assetAfter,
    actorProfileId,
    requestContext,
    metadata: {
      rejectionReason,
      cleanupAfter: assetAfter.cleanup_after || null,
    },
  })

  return buildServiceResult({
    action: 'reject',
    assetBefore,
    assetAfter,
    batchItem,
    batch,
    auditLog,
  })
}
