import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { approveAssetVariant, rejectAssetVariant } from './factory-qa.service.js'
import { createAdminSecureAssetPreview } from './media-secure-access.service.js'
import { headObject } from './storage.service.js'
import { auditRealProductionAfterJob } from './real-production-audit.service.js'

export const REAL_PRODUCTION_QA_SPRINT = '6.3K'
export const APPROVE_CONFIRMATION_PHRASE = 'APROVAR ASSET 6.3K QA REAL'
export const REJECT_CONFIRMATION_PHRASE = 'REJEITAR ASSET 6.3K QA REAL'

const ASSET_VARIANTS_TABLE = 'media_asset_variants'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const BATCHES_TABLE = 'media_generation_batches'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const LEDGER_TABLE = 'credit_ledger'

const QA_PENDING_STATUS = 'qa_pending'
const AVAILABLE_STATUS = 'available'
const REJECTED_STATUS = 'rejected'

const toBool = (value) => ['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado']
  .includes(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const asArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

const uniqueById = (rows = []) => {
  const map = new Map()

  for (const row of rows) {
    if (!row) continue
    const key = row.id || JSON.stringify(row)
    if (!map.has(key)) map.set(key, row)
  }

  return Array.from(map.values())
}

const nowIso = () => new Date().toISOString()

function maskValue(value, start = 12, end = 10) {
  const text = String(value || '')
  if (!text) return null
  if (text.length <= start + end) return `${text.slice(0, start)}***`
  return `${text.slice(0, start)}***${text.slice(-end)}`
}

function compactSafety({ databaseMutationExecutedByThisService = false, r2HeadExecutedByThisService = false } = {}) {
  return {
    runPodCalledByThisService: false,
    r2RealUploadByThisService: false,
    r2HeadExecutedByThisService,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    databaseMutationExecutedByThisService,
    runPodMayBeCalledByWorkerAfterQueue: false,
  }
}

function pickFirst(record = {}, fields = []) {
  for (const field of fields) {
    if (hasValue(record[field])) return record[field]
  }
  return null
}

function compactAsset(asset = {}) {
  if (!asset) return null

  const r2Bucket = pickFirst(asset, ['r2_bucket', 'bucket', 'storage_bucket'])
  const r2Key = pickFirst(asset, ['r2_key', 'storage_key', 'object_key', 'bucket_key', 'file_key', 'path'])
  const url = pickFirst(asset, ['public_url', 'url', 'image_url', 'media_url'])

  return {
    id: asset.id || null,
    status: asset.status || asset.publication_status || null,
    mediaType: asset.media_type || asset.mediaType || null,
    companionId: asset.companion_id || asset.avatar_id || asset.actress_id || null,
    combinationId: asset.combination_id || asset.media_combination_id || null,
    batchId: asset.batch_id || null,
    batchItemId: asset.batch_item_id || null,
    variantNumber: asset.variant_number || null,
    requiresQa: asset.requires_qa ?? null,
    r2BucketPresent: hasValue(r2Bucket),
    r2KeyPresent: hasValue(r2Key),
    r2KeyMasked: r2Key ? maskValue(r2Key, 18, 16) : null,
    urlPresent: hasValue(url),
    publishedAt: asset.published_at || null,
    cleanupAfter: asset.cleanup_after || null,
    rejectionReasonPresent: hasValue(asset.rejection_reason),
    createdAt: asset.created_at || null,
    updatedAt: asset.updated_at || null,
  }
}

function compactRow(row = {}) {
  if (!row) return null

  return {
    id: row.id || null,
    status: row.status || row.state || row.publication_status || null,
    batchId: row.batch_id || row.media_generation_batch_id || null,
    batchItemId: row.batch_item_id || row.media_generation_batch_item_id || null,
    variantId: row.variant_id || row.media_asset_variant_id || row.asset_variant_id || null,
    companionId: row.companion_id || row.avatar_id || row.actress_id || null,
    combinationId: row.combination_id || row.media_combination_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

async function safeSelect({ table, filters = [], maybeSingle = false, limit = 20 } = {}) {
  try {
    let query = supabaseAdmin.from(table).select('*')

    for (const filter of filters) {
      if (!filter?.column || filter.value === undefined || filter.value === null) continue
      query = query.eq(filter.column, filter.value)
    }

    if (Number.isFinite(limit) && limit > 0) query = query.limit(limit)
    if (maybeSingle) query = query.maybeSingle()

    const { data, error } = await query

    if (error) {
      return {
        ok: false,
        table,
        data: maybeSingle ? null : [],
        rows: [],
        error: error.message,
        code: error.code || null,
      }
    }

    return {
      ok: true,
      table,
      data: data ?? (maybeSingle ? null : []),
      rows: asArray(data),
      error: null,
      code: null,
    }
  } catch (error) {
    return {
      ok: false,
      table,
      data: maybeSingle ? null : [],
      rows: [],
      error: error?.message || 'Erro inesperado ao consultar tabela.',
      code: error?.code || null,
    }
  }
}

async function findByCandidateColumns({ table, value, columns = [], limit = 20 } = {}) {
  const attempts = []
  const rows = []

  if (!hasValue(value)) {
    return {
      ok: false,
      table,
      value,
      rows: [],
      attempts: [],
      error: 'value_missing',
    }
  }

  for (const column of columns) {
    const result = await safeSelect({ table, filters: [{ column, value }], limit })
    attempts.push({ column, ok: result.ok, total: result.rows.length, error: result.error, code: result.code })
    if (result.ok && result.rows.length > 0) rows.push(...result.rows)
  }

  return {
    ok: attempts.some((attempt) => attempt.ok),
    table,
    value,
    rows: uniqueById(rows),
    attempts,
    error: rows.length ? null : 'not_found',
  }
}

async function getAssetById(assetId) {
  if (!hasValue(assetId)) return null

  const result = await safeSelect({
    table: ASSET_VARIANTS_TABLE,
    filters: [{ column: 'id', value: assetId }],
    maybeSingle: true,
    limit: 1,
  })

  if (!result.ok) {
    throw new ApiError(500, 'Erro ao buscar asset real 6.3K.', {
      assetId,
      error: result.error,
      code: result.code,
    })
  }

  return result.data || null
}

async function findTargetAsset({ assetId, batchId, batchItemId } = {}) {
  const warnings = []
  const blockers = []

  if (hasValue(assetId)) {
    const asset = await getAssetById(assetId)

    if (!asset) {
      blockers.push('asset_not_found')
      return { asset: null, candidates: [], warnings, blockers }
    }

    if (hasValue(batchId) && asset.batch_id !== batchId) blockers.push('asset_batch_id_mismatch')
    if (hasValue(batchItemId) && asset.batch_item_id !== batchItemId) blockers.push('asset_batch_item_id_mismatch')

    return { asset, candidates: [asset], warnings, blockers }
  }

  const queries = []

  if (hasValue(batchItemId)) {
    queries.push(await findByCandidateColumns({
      table: ASSET_VARIANTS_TABLE,
      value: batchItemId,
      columns: ['batch_item_id', 'media_generation_batch_item_id', 'generation_batch_item_id', 'item_id'],
      limit: 20,
    }))
  }

  if (hasValue(batchId)) {
    queries.push(await findByCandidateColumns({
      table: ASSET_VARIANTS_TABLE,
      value: batchId,
      columns: ['batch_id', 'media_generation_batch_id', 'generation_batch_id'],
      limit: 20,
    }))
  }

  const candidates = uniqueById(queries.flatMap((query) => query.rows))
  const exactCandidates = candidates.filter((asset) => {
    if (hasValue(batchId) && asset.batch_id !== batchId) return false
    if (hasValue(batchItemId) && asset.batch_item_id !== batchItemId) return false
    return true
  })

  if (exactCandidates.length === 0) blockers.push('exact_asset_not_found')
  if (exactCandidates.length > 1) blockers.push('multiple_exact_assets_found')

  return {
    asset: exactCandidates.length === 1 ? exactCandidates[0] : null,
    candidates: exactCandidates,
    warnings,
    blockers,
    attempts: queries.flatMap((query) => query.attempts || []),
  }
}

async function getBatch(batchId) {
  if (!hasValue(batchId)) return null

  const result = await safeSelect({
    table: BATCHES_TABLE,
    filters: [{ column: 'id', value: batchId }],
    maybeSingle: true,
    limit: 1,
  })

  return result.data || null
}

async function getBatchItem(batchItemId) {
  if (!hasValue(batchItemId)) return null

  const result = await safeSelect({
    table: BATCH_ITEMS_TABLE,
    filters: [{ column: 'id', value: batchItemId }],
    maybeSingle: true,
    limit: 1,
  })

  return result.data || null
}

async function loadExposureAndFinance({ assetId, batchId, batchItemId, queueJobId, companionId, combinationId } = {}) {
  const audit = await auditRealProductionAfterJob({
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
  })

  const deliveryQueries = []
  const galleryQueries = []
  const ledgerQueries = []

  if (hasValue(assetId)) {
    deliveryQueries.push(await findByCandidateColumns({
      table: DELIVERIES_TABLE,
      value: assetId,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20,
    }))

    galleryQueries.push(await findByCandidateColumns({
      table: GALLERY_TABLE,
      value: assetId,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20,
    }))

    ledgerQueries.push(await findByCandidateColumns({
      table: LEDGER_TABLE,
      value: assetId,
      columns: ['reference_id', 'variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20,
    }))
  }

  const deliveries = uniqueById(deliveryQueries.flatMap((query) => query.rows))
  const galleryItems = uniqueById(galleryQueries.flatMap((query) => query.rows))
  const creditLedger = uniqueById(ledgerQueries.flatMap((query) => query.rows))

  return {
    audit,
    deliveries,
    galleryItems,
    creditLedger,
  }
}

async function optionalStorageHead(asset, { enabled = false } = {}) {
  if (!enabled) {
    return {
      checked: false,
      exists: null,
      error: null,
    }
  }

  const bucket = pickFirst(asset, ['r2_bucket', 'bucket', 'storage_bucket'])
  const key = pickFirst(asset, ['r2_key', 'storage_key', 'object_key', 'bucket_key', 'file_key', 'path'])

  if (!bucket || !key) {
    return {
      checked: true,
      exists: false,
      error: 'missing_bucket_or_key',
    }
  }

  try {
    const result = await headObject(bucket, key)
    return {
      checked: true,
      exists: Boolean(result.exists),
      contentType: result.contentType || null,
      contentLength: result.contentLength || null,
      lastModified: result.lastModified || null,
      error: null,
    }
  } catch (error) {
    return {
      checked: true,
      exists: false,
      error: error?.message || 'head_object_failed',
    }
  }
}

async function optionalSecurePreview(assetId, actorProfileId, { enabled = false, printUrl = false } = {}) {
  if (!enabled) {
    return {
      checked: false,
      created: false,
      error: null,
      protectedViewPath: `/api/admin/media/assets/${assetId}/protected-view`,
    }
  }

  if (!actorProfileId) {
    return {
      checked: true,
      created: false,
      error: 'admin_profile_id_required_for_secure_preview',
      protectedViewPath: `/api/admin/media/assets/${assetId}/protected-view`,
    }
  }

  try {
    const preview = await createAdminSecureAssetPreview(assetId, {
      actorProfileId,
      expiresIn: Number(process.env.REAL_PRODUCTION_QA_PREVIEW_TTL_SECONDS || 120),
      source: 'real_production_qa_6_3K_script',
    })

    return {
      checked: true,
      created: true,
      type: preview.access?.type || null,
      expiresAt: preview.access?.expiresAt || null,
      expiresIn: preview.access?.expiresIn || null,
      urlPresent: hasValue(preview.access?.url),
      url: printUrl ? preview.access?.url || null : '[hidden_by_default]',
      protectedViewPath: `/api/admin/media/assets/${assetId}/protected-view`,
      error: null,
    }
  } catch (error) {
    return {
      checked: true,
      created: false,
      error: error?.message || 'secure_preview_failed',
      protectedViewPath: `/api/admin/media/assets/${assetId}/protected-view`,
    }
  }
}

function resolveEnvTarget(input = {}) {
  return {
    assetId: input.assetId || input.asset_id || process.env.REAL_PRODUCTION_QA_ASSET_ID || process.env.REAL_PRODUCTION_ASSET_ID || process.env.QA_TEST_ASSET_ID || null,
    batchId: input.batchId || input.batch_id || process.env.REAL_PRODUCTION_AUDIT_BATCH_ID || process.env.REAL_PRODUCTION_QA_BATCH_ID || null,
    batchItemId: input.batchItemId || input.batch_item_id || process.env.REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID || process.env.REAL_PRODUCTION_QA_BATCH_ITEM_ID || null,
    queueJobId: input.queueJobId || input.queue_job_id || process.env.REAL_PRODUCTION_AUDIT_QUEUE_JOB_ID || process.env.REAL_PRODUCTION_QA_QUEUE_JOB_ID || null,
    companionId: input.companionId || input.companion_id || process.env.REAL_PRODUCTION_COMPANION_ID || null,
    combinationId: input.combinationId || input.combination_id || process.env.REAL_PRODUCTION_COMBINATION_ID || null,
  }
}

function resolveAdminProfileId(input = {}) {
  return input.actorProfileId ||
    input.actor_profile_id ||
    process.env.REAL_PRODUCTION_QA_ADMIN_PROFILE_ID ||
    process.env.QA_TEST_ADMIN_PROFILE_ID ||
    process.env.ADMIN_PROFILE_ID ||
    null
}

function normalizeAction(action) {
  const normalized = String(action || '').trim().toLowerCase()

  if (['approve', 'aprovar', 'approved', 'available'].includes(normalized)) return 'approve'
  if (['reject', 'rejeitar', 'rejected'].includes(normalized)) return 'reject'

  return normalized || null
}

function expectedPhraseForAction(action) {
  if (action === 'approve') return APPROVE_CONFIRMATION_PHRASE
  if (action === 'reject') return REJECT_CONFIRMATION_PHRASE
  return null
}

function buildExposureSummary({ audit, deliveries, galleryItems, creditLedger } = {}) {
  const auditDeliveriesTotal = audit?.clientExposureAudit?.deliveries?.total ?? audit?.clientExposureAudit?.deliveriesTotal ?? 0
  const auditGalleryTotal = audit?.clientExposureAudit?.galleryItems?.total ?? audit?.clientExposureAudit?.galleryItemsTotal ?? 0
  const auditLedgerTotal = audit?.financeAudit?.creditLedger?.total ?? audit?.financeAudit?.creditLedgerTotal ?? 0

  return {
    deliveriesTotal: Math.max(deliveries?.length || 0, Number(auditDeliveriesTotal || 0)),
    galleryItemsTotal: Math.max(galleryItems?.length || 0, Number(auditGalleryTotal || 0)),
    creditLedgerTotal: Math.max(creditLedger?.length || 0, Number(auditLedgerTotal || 0)),
    publicUrlDetected: Boolean(audit?.clientExposureAudit?.publicUrlDetected),
  }
}

function buildHumanStatus({ asset, batch, batchItem, exposureSummary }) {
  const blockers = []
  const warnings = []

  if (!asset) blockers.push('asset_not_found')
  if (asset && asset.status !== QA_PENDING_STATUS) warnings.push(`asset_status_is_${asset.status}`)
  if (!hasValue(pickFirst(asset, ['r2_key', 'storage_key', 'object_key', 'bucket_key', 'file_key', 'path']))) blockers.push('asset_missing_storage_key')
  if (!hasValue(pickFirst(asset, ['r2_bucket', 'bucket', 'storage_bucket']))) blockers.push('asset_missing_storage_bucket')
  if (exposureSummary.deliveriesTotal > 0) blockers.push('client_delivery_detected_unexpectedly')
  if (exposureSummary.galleryItemsTotal > 0) blockers.push('gallery_item_detected_unexpectedly')
  if (exposureSummary.creditLedgerTotal > 0) blockers.push('credit_ledger_detected_unexpectedly')
  if (exposureSummary.publicUrlDetected) blockers.push('public_url_detected_review_needed')

  return {
    canApproveOrReject: blockers.length === 0 && asset?.status === QA_PENDING_STATUS,
    blockers,
    warnings,
    status: blockers.length > 0
      ? 'QA_REVIEW_BLOCKED'
      : asset?.status === QA_PENDING_STATUS
        ? 'QA_PENDING_READY_FOR_DECISION'
        : asset?.status === AVAILABLE_STATUS
          ? 'QA_ALREADY_APPROVED_AVAILABLE'
          : asset?.status === REJECTED_STATUS
            ? 'QA_ALREADY_REJECTED'
            : 'QA_REVIEW_READ_ONLY',
    batchStatus: batch?.status || null,
    batchItemStatus: batchItem?.status || null,
  }
}

export function getRealProductionQaControlConfig() {
  const action = normalizeAction(process.env.REAL_PRODUCTION_QA_ACTION)

  return {
    sprint: REAL_PRODUCTION_QA_SPRINT,
    name: 'QA Visual / Aprovação Controlada do Primeiro Item Real',
    approveConfirmationPhrase: APPROVE_CONFIRMATION_PHRASE,
    rejectConfirmationPhrase: REJECT_CONFIRMATION_PHRASE,
    requestedAction: action,
    envHints: {
      RUN_6_3K_QA_MUTATION: toBool(process.env.RUN_6_3K_QA_MUTATION),
      ALLOW_6_3K_QA_DECISION: toBool(process.env.ALLOW_6_3K_QA_DECISION),
      REAL_PRODUCTION_QA_ACTION: process.env.REAL_PRODUCTION_QA_ACTION || null,
      REAL_PRODUCTION_QA_ASSET_ID: process.env.REAL_PRODUCTION_QA_ASSET_ID || null,
      REAL_PRODUCTION_AUDIT_BATCH_ID: process.env.REAL_PRODUCTION_AUDIT_BATCH_ID || null,
      REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID: process.env.REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID || null,
      REAL_PRODUCTION_QA_HEAD_R2: toBool(process.env.REAL_PRODUCTION_QA_HEAD_R2),
      REAL_PRODUCTION_QA_SECURE_PREVIEW: toBool(process.env.REAL_PRODUCTION_QA_SECURE_PREVIEW),
    },
    safety: compactSafety(),
  }
}

export async function inspectRealProductionQaAsset(input = {}) {
  const target = resolveEnvTarget(input)
  const actorProfileId = resolveAdminProfileId(input)

  const targetResult = await findTargetAsset(target)
  const asset = targetResult.asset
  const effectiveBatchId = target.batchId || asset?.batch_id || null
  const effectiveBatchItemId = target.batchItemId || asset?.batch_item_id || null

  const [batch, batchItem, exposureAndFinance] = await Promise.all([
    getBatch(effectiveBatchId),
    getBatchItem(effectiveBatchItemId),
    loadExposureAndFinance({
      assetId: asset?.id || target.assetId,
      batchId: effectiveBatchId,
      batchItemId: effectiveBatchItemId,
      queueJobId: target.queueJobId,
      companionId: target.companionId || asset?.companion_id || null,
      combinationId: target.combinationId || asset?.combination_id || null,
    }),
  ])

  const exposureSummary = buildExposureSummary(exposureAndFinance)
  const statusSummary = buildHumanStatus({ asset, batch, batchItem, exposureSummary })
  const r2Head = await optionalStorageHead(asset, {
    enabled: toBool(input.headR2 ?? process.env.REAL_PRODUCTION_QA_HEAD_R2),
  })
  const securePreview = await optionalSecurePreview(asset?.id || target.assetId, actorProfileId, {
    enabled: toBool(input.securePreview ?? process.env.REAL_PRODUCTION_QA_SECURE_PREVIEW),
    printUrl: toBool(input.printSignedUrl ?? process.env.REAL_PRODUCTION_QA_PRINT_SIGNED_URL),
  })

  return {
    sprint: REAL_PRODUCTION_QA_SPRINT,
    status: statusSummary.status,
    generatedAt: nowIso(),
    target: {
      ...target,
      assetId: asset?.id || target.assetId || null,
    },
    selected: {
      asset: compactAsset(asset),
      batch: compactRow(batch),
      batchItem: compactRow(batchItem),
    },
    candidates: targetResult.candidates.map(compactAsset),
    canApproveOrReject: statusSummary.canApproveOrReject,
    blockers: [...targetResult.blockers, ...statusSummary.blockers],
    warnings: [...targetResult.warnings, ...statusSummary.warnings],
    storage: {
      keyPresent: Boolean(compactAsset(asset)?.r2KeyPresent),
      bucketPresent: Boolean(compactAsset(asset)?.r2BucketPresent),
      r2Head,
    },
    preview: securePreview,
    clientExposureAudit: {
      deliveriesTotal: exposureSummary.deliveriesTotal,
      galleryItemsTotal: exposureSummary.galleryItemsTotal,
      publicUrlDetected: exposureSummary.publicUrlDetected,
    },
    financeAudit: {
      creditLedgerTotal: exposureSummary.creditLedgerTotal,
    },
    strictAudit: {
      status: exposureAndFinance.audit?.status || null,
      exactGeneratedMediaFound: Boolean(exposureAndFinance.audit?.stuckAnalysis?.exactGeneratedMediaFound),
      variantsTotal: exposureAndFinance.audit?.generatedMedia?.variants?.total ?? exposureAndFinance.audit?.generatedMedia?.variantsTotal ?? null,
      critical: exposureAndFinance.audit?.integrity?.critical || [],
      warnings: exposureAndFinance.audit?.integrity?.warnings || [],
    },
    actionHints: {
      approve: `REAL_PRODUCTION_QA_ACTION=approve + ${APPROVE_CONFIRMATION_PHRASE}`,
      reject: `REAL_PRODUCTION_QA_ACTION=reject + ${REJECT_CONFIRMATION_PHRASE}`,
    },
    safety: compactSafety({ r2HeadExecutedByThisService: Boolean(r2Head.checked) }),
  }
}

export async function applyRealProductionQaDecision(input = {}) {
  const action = normalizeAction(input.action || process.env.REAL_PRODUCTION_QA_ACTION)
  const requestedApply = toBool(input.apply ?? process.env.RUN_6_3K_QA_MUTATION)
  const mutationEnvAllowed = toBool(input.allowMutation ?? process.env.ALLOW_6_3K_QA_DECISION)
  const confirmationPhrase = input.confirmationPhrase || process.env.REAL_PRODUCTION_QA_CONFIRMATION_PHRASE || ''
  const expectedPhrase = expectedPhraseForAction(action)
  const confirmationOk = Boolean(expectedPhrase) && confirmationPhrase === expectedPhrase
  const actorProfileId = resolveAdminProfileId(input)

  const inspection = await inspectRealProductionQaAsset(input)
  const blockers = []

  if (!['approve', 'reject'].includes(action)) blockers.push('qa_action_invalid_or_missing')
  if (!inspection.canApproveOrReject) blockers.push('asset_not_ready_for_qa_decision')
  if (!actorProfileId) blockers.push('admin_profile_id_required')
  if (requestedApply && !mutationEnvAllowed) blockers.push('mutation_env_not_allowed')
  if (requestedApply && !confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')
  if (action === 'reject' && !String(input.reason || process.env.REAL_PRODUCTION_QA_REJECTION_REASON || '').trim()) {
    blockers.push('rejection_reason_required')
  }

  if (!requestedApply || blockers.length > 0) {
    return {
      sprint: REAL_PRODUCTION_QA_SPRINT,
      status: blockers.length > 0 ? 'BLOCKED_BY_QA_CONTROL' : 'DRY_RUN_READY_FOR_QA_DECISION',
      dryRun: true,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      expectedConfirmationPhrase: expectedPhrase,
      action,
      blockers,
      inspection,
      applied: null,
      safety: compactSafety(),
    }
  }

  const assetId = inspection.target.assetId
  let result

  if (action === 'approve') {
    result = await approveAssetVariant(assetId, {
      actorProfileId,
      source: 'real_production_qa_control_6_3K',
      notes: input.notes || process.env.REAL_PRODUCTION_QA_NOTES || 'Aprovação controlada 6.3K do primeiro item real.',
    })
  } else {
    result = await rejectAssetVariant(assetId, {
      actorProfileId,
      source: 'real_production_qa_control_6_3K',
      reason: input.reason || process.env.REAL_PRODUCTION_QA_REJECTION_REASON,
    })
  }

  const postInspection = await inspectRealProductionQaAsset({
    ...input,
    assetId,
    headR2: false,
    securePreview: false,
  })

  return {
    sprint: REAL_PRODUCTION_QA_SPRINT,
    status: action === 'approve'
      ? 'QA_ASSET_APPROVED_CONTROLLED'
      : 'QA_ASSET_REJECTED_CONTROLLED',
    dryRun: false,
    requestedApply,
    mutationEnvAllowed,
    confirmationOk,
    action,
    target: inspection.target,
    applied: result,
    postInspection,
    safety: compactSafety({ databaseMutationExecutedByThisService: true }),
  }
}
