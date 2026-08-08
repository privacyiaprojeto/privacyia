import { supabaseAdmin } from '../config/supabase.js'
import { auditRealProductionAfterJob } from './real-production-audit.service.js'
import { insertAdminAuditLogAdaptive } from './admin-audit-adaptive.service.js'

export const REAL_PRODUCTION_RELEASE_SPRINT = '6.3L'
export const REQUIRED_6_3L_PUBLISH_PHRASE = 'PUBLICAR ASSET 6.3L PARA VENDA CONTROLADA'
export const REQUIRED_6_3L_HIDE_PHRASE = 'OCULTAR ASSET 6.3L DO CLIENTE'

const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const LEDGER_TABLE = 'credit_ledger'
const AUDIT_TABLE = 'admin_audit_logs'

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const FINAL_ASSET_STATUSES = new Set(['available', 'sold'])

const nowIso = () => new Date().toISOString()

const toBool = (value) => TRUE_VALUES.has(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const safeObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})

const normalizeAction = (value) => {
  const action = String(value || '').trim().toLowerCase()
  if (['publish', 'publicar', 'release', 'show', 'visible'].includes(action)) return 'publish'
  if (['hide', 'ocultar', 'unpublish', 'hidden', 'admin_only'].includes(action)) return 'hide'
  return null
}

const normalizePositiveInteger = (value, fallback = null) => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return parsed
}

const isSameId = (left, right) => {
  if (!hasValue(left) || !hasValue(right)) return false
  return String(left).trim() === String(right).trim()
}

const maskR2Key = (key = '') => {
  const value = String(key || '')
  if (!value) return null
  const parts = value.split('/')
  if (parts.length <= 2) return `${value.slice(0, 8)}***`

  return parts.map((part, index) => {
    if (index < parts.length - 2) return part
    if (index === parts.length - 2) return `${part.slice(0, 1)}***`
    return part
  }).join('/')
}

const buildSafety = ({ databaseMutationExecutedByThisService = false } = {}) => ({
  runPodCalledByThisService: false,
  r2RealUploadByThisService: false,
  r2HeadExecutedByThisService: false,
  destructiveDelete: false,
  paymentExecutedByThisService: false,
  walletChangedByThisService: false,
  publicClientUrlCreatedByThisService: false,
  realQueueJobCreated: false,
  databaseMutationExecutedByThisService,
  runPodMayBeCalledByWorkerAfterQueue: false,
})

const safeSelectById = async (table, id) => {
  if (!hasValue(id)) {
    return { ok: false, table, row: null, error: 'id não informado', code: null }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) return { ok: false, table, row: null, error: error.message, code: error.code }
    return { ok: true, table, row: data || null, error: null, code: null }
  } catch (error) {
    return { ok: false, table, row: null, error: error?.message || 'Erro inesperado', code: error?.code || null }
  }
}

const safeFindRowsByColumns = async ({ table, value, columns = [], limit = 20 } = {}) => {
  const attempts = []
  const rowsById = new Map()

  if (!hasValue(value)) {
    return { table, value, rows: [], total: 0, attempts, ok: false }
  }

  for (const column of columns) {
    try {
      const { data, error } = await supabaseAdmin
        .from(table)
        .select('*')
        .eq(column, value)
        .limit(limit)

      attempts.push({ column, ok: !error, total: (data || []).length, error: error?.message || null, code: error?.code || null })

      if (!error) {
        for (const row of data || []) {
          rowsById.set(row.id || JSON.stringify(row), row)
        }
      }
    } catch (error) {
      attempts.push({ column, ok: false, total: 0, error: error?.message || 'Erro inesperado', code: error?.code || null })
    }
  }

  const rows = Array.from(rowsById.values())
  return { table, value, rows, total: rows.length, attempts, ok: attempts.some((item) => item.ok) }
}

const getExactClientExposure = async ({ assetId, batchId, batchItemId, queueJobId } = {}) => {
  const deliveryQueries = []
  const galleryQueries = []
  const ledgerQueries = []

  if (hasValue(assetId)) {
    deliveryQueries.push(await safeFindRowsByColumns({
      table: DELIVERIES_TABLE,
      value: assetId,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id'],
    }))

    galleryQueries.push(await safeFindRowsByColumns({
      table: GALLERY_TABLE,
      value: assetId,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id'],
    }))

    ledgerQueries.push(await safeFindRowsByColumns({
      table: LEDGER_TABLE,
      value: assetId,
      columns: ['reference_id', 'variant_id', 'media_asset_variant_id', 'asset_variant_id'],
    }))
  }

  for (const id of [batchId, batchItemId, queueJobId].filter(hasValue)) {
    ledgerQueries.push(await safeFindRowsByColumns({
      table: LEDGER_TABLE,
      value: id,
      columns: ['reference_id', 'batch_id', 'batch_item_id', 'media_generation_batch_id', 'media_generation_batch_item_id', 'job_id', 'queue_job_id'],
    }))
  }

  const unique = (queries) => {
    const byId = new Map()
    for (const query of queries) {
      for (const row of query.rows || []) byId.set(row.id || JSON.stringify(row), row)
    }
    return Array.from(byId.values())
  }

  const deliveries = unique(deliveryQueries)
  const galleryItems = unique(galleryQueries)
  const creditLedger = unique(ledgerQueries)

  return {
    deliveriesTotal: deliveries.length,
    galleryItemsTotal: galleryItems.length,
    creditLedgerTotal: creditLedger.length,
    publicUrlDetected: [...deliveries, ...galleryItems].some((row) => JSON.stringify(row || {}).toLowerCase().includes('http')),
    details: {
      deliveries: deliveries.map((row) => ({ id: row.id || null, status: row.status || null })),
      galleryItems: galleryItems.map((row) => ({ id: row.id || null, status: row.status || null })),
      creditLedger: creditLedger.map((row) => ({ id: row.id || null, type: row.type || row.entry_type || null, referenceId: row.reference_id || null })),
    },
    attempts: {
      deliveries: deliveryQueries.flatMap((query) => query.attempts || []),
      galleryItems: galleryQueries.flatMap((query) => query.attempts || []),
      creditLedger: ledgerQueries.flatMap((query) => query.attempts || []),
    },
  }
}

const mapAsset = (asset = null) => {
  if (!asset) return null
  return {
    id: asset.id || null,
    status: asset.status || null,
    mediaType: asset.media_type || null,
    companionId: asset.companion_id || null,
    combinationId: asset.combination_id || asset.media_combination_id || null,
    batchId: asset.batch_id || asset.media_generation_batch_id || null,
    batchItemId: asset.batch_item_id || asset.media_generation_batch_item_id || null,
    r2BucketPresent: hasValue(asset.r2_bucket),
    r2KeyPresent: hasValue(asset.r2_key || asset.storage_key),
    r2KeyMasked: maskR2Key(asset.r2_key || asset.storage_key),
    urlPresent: hasValue(asset.public_url || asset.url || asset.media_url),
    publishedAt: asset.published_at || null,
    currentAssignments: Number(asset.current_assignments || 0),
    maxAssignments: Number(asset.max_assignments || 1),
    metadataPublication: safeObject(safeObject(asset.metadata).productPublication || safeObject(asset.metadata).clientPublication),
    createdAt: asset.created_at || null,
    updatedAt: asset.updated_at || null,
  }
}

const mapCombination = (combination = null) => {
  if (!combination) return null
  const metadata = safeObject(combination.metadata)
  return {
    id: combination.id || null,
    title: combination.title || combination.combination_key || null,
    companionId: combination.companion_id || null,
    mediaType: combination.media_type || null,
    priceCredits: Number(combination.price_credits || 0),
    visibleToClient: combination.visible_to_client === true,
    adminOnly: combination.admin_only !== false,
    isActive: combination.is_active !== false,
    metadataPublication: safeObject(metadata.productPublication || metadata.publication),
    createdAt: combination.created_at || null,
    updatedAt: combination.updated_at || null,
  }
}

const isAssetPublishedForClient = ({ asset, combination }) => {
  if (!asset || !combination) return false
  const assetPublication = safeObject(safeObject(asset.metadata).productPublication || safeObject(asset.metadata).clientPublication)
  const combinationPublication = safeObject(safeObject(combination.metadata).productPublication || safeObject(combination.metadata).publication)
  const publicationStatus = assetPublication.status || combinationPublication.status || null

  if (publicationStatus === 'hidden') return false
  if (publicationStatus === 'published') return true

  return FINAL_ASSET_STATUSES.has(String(asset.status || '').trim()) &&
    combination.visible_to_client === true &&
    combination.admin_only !== true &&
    combination.is_active !== false
}

const buildPublicationPayload = ({ action, asset, combination, actorProfileId, priceCredits, notes }) => {
  const now = nowIso()
  const published = action === 'publish'

  return {
    sprint: REAL_PRODUCTION_RELEASE_SPRINT,
    status: published ? 'published' : 'hidden',
    published,
    visibleToClient: published,
    adminOnly: !published,
    updatedAt: now,
    updatedByProfileId: actorProfileId || null,
    source: 'real_production_release_6_3L',
    assetId: asset.id,
    batchId: asset.batch_id || null,
    batchItemId: asset.batch_item_id || null,
    combinationId: combination.id,
    companionId: asset.companion_id || combination.companion_id || null,
    priceCredits,
    note: notes || (published
      ? 'Asset real aprovado liberado de forma controlada para seleção/venda no cliente.'
      : 'Asset real ocultado de forma controlada do cliente.'),
  }
}

const softInsertAdminAuditLog = async (payload = {}) => insertAdminAuditLogAdaptive(payload, {
  label: 'real_production_release_6_3L',
})

export const getRealProductionReleaseConfig = () => {
  const action = normalizeAction(process.env.REAL_PRODUCTION_RELEASE_ACTION)
  return {
    sprint: REAL_PRODUCTION_RELEASE_SPRINT,
    name: 'Disponibilização Controlada do Asset Aprovado',
    publishConfirmationPhrase: REQUIRED_6_3L_PUBLISH_PHRASE,
    hideConfirmationPhrase: REQUIRED_6_3L_HIDE_PHRASE,
    requestedAction: action,
    envHints: {
      RUN_6_3L_RELEASE_MUTATION: toBool(process.env.RUN_6_3L_RELEASE_MUTATION),
      ALLOW_6_3L_PUBLISH_TO_CLIENT: toBool(process.env.ALLOW_6_3L_PUBLISH_TO_CLIENT),
      REAL_PRODUCTION_RELEASE_ACTION: action,
      REAL_PRODUCTION_RELEASE_ASSET_ID: process.env.REAL_PRODUCTION_RELEASE_ASSET_ID || process.env.REAL_PRODUCTION_QA_ASSET_ID || null,
      REAL_PRODUCTION_AUDIT_BATCH_ID: process.env.REAL_PRODUCTION_AUDIT_BATCH_ID || null,
      REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID: process.env.REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID || null,
      REAL_PRODUCTION_RELEASE_PRICE_CREDITS: process.env.REAL_PRODUCTION_RELEASE_PRICE_CREDITS || null,
    },
    safety: buildSafety(),
  }
}

export const inspectRealProductionRelease = async ({
  assetId = process.env.REAL_PRODUCTION_RELEASE_ASSET_ID || process.env.REAL_PRODUCTION_QA_ASSET_ID,
  batchId = process.env.REAL_PRODUCTION_AUDIT_BATCH_ID,
  batchItemId = process.env.REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID,
  queueJobId = process.env.REAL_PRODUCTION_AUDIT_QUEUE_JOB_ID,
  companionId = process.env.REAL_PRODUCTION_COMPANION_ID,
  combinationId = process.env.REAL_PRODUCTION_COMBINATION_ID,
} = {}) => {
  const config = getRealProductionReleaseConfig()
  const blockers = []
  const warnings = []

  const assetResult = await safeSelectById(ASSETS_TABLE, assetId)
  const asset = assetResult.row

  if (!assetResult.ok) blockers.push('asset_query_failed')
  if (!asset) blockers.push('asset_not_found')

  const effectiveCombinationId = asset?.combination_id || asset?.media_combination_id || combinationId || null
  const combinationResult = await safeSelectById(COMBINATIONS_TABLE, effectiveCombinationId)
  const combination = combinationResult.row

  if (asset && !combinationResult.ok) blockers.push('combination_query_failed')
  if (asset && !combination) blockers.push('combination_not_found')

  if (asset && hasValue(batchId) && !isSameId(asset.batch_id || asset.media_generation_batch_id, batchId)) blockers.push('asset_batch_mismatch')
  if (asset && hasValue(batchItemId) && !isSameId(asset.batch_item_id || asset.media_generation_batch_item_id, batchItemId)) blockers.push('asset_batch_item_mismatch')
  if (asset && hasValue(companionId) && !isSameId(asset.companion_id, companionId)) blockers.push('asset_companion_mismatch')
  if (asset && hasValue(combinationId) && !isSameId(asset.combination_id || asset.media_combination_id, combinationId)) blockers.push('asset_combination_mismatch')

  if (asset && !FINAL_ASSET_STATUSES.has(String(asset.status || '').trim())) blockers.push('asset_not_available')
  if (asset && !hasValue(asset.r2_key || asset.storage_key)) blockers.push('asset_missing_r2_key')
  if (asset && !hasValue(asset.r2_bucket)) blockers.push('asset_missing_r2_bucket')

  const priceCredits = normalizePositiveInteger(process.env.REAL_PRODUCTION_RELEASE_PRICE_CREDITS, Number(combination?.price_credits || 0))
  if (!priceCredits || priceCredits <= 0) blockers.push('price_not_configured')

  const exposure = await getExactClientExposure({ assetId, batchId, batchItemId, queueJobId })
  if (exposure.deliveriesTotal > 0) blockers.push('delivery_already_exists_review_needed')
  if (exposure.galleryItemsTotal > 0) blockers.push('gallery_item_already_exists_review_needed')
  if (exposure.creditLedgerTotal > 0) blockers.push('credit_ledger_already_exists_review_needed')
  if (exposure.publicUrlDetected) blockers.push('public_url_detected_review_needed')

  let strictAudit = null
  if (hasValue(batchId) || hasValue(batchItemId)) {
    strictAudit = await auditRealProductionAfterJob({
      batchId,
      batchItemId,
      queueJobId,
      companionId,
      combinationId,
    })

    if (strictAudit?.integrity?.critical?.length > 0) blockers.push('strict_audit_critical_review_needed')
    if (strictAudit?.generatedMedia?.variants?.total === 0) blockers.push('strict_audit_missing_exact_generated_asset')
  }

  const alreadyPublished = isAssetPublishedForClient({ asset, combination })
  const combinationMapped = mapCombination(combination)
  const assetMapped = mapAsset(asset)

  if (alreadyPublished) warnings.push('asset_already_published_for_client')
  if (combinationMapped?.adminOnly === true || combinationMapped?.visibleToClient === false) warnings.push('combination_currently_hidden_from_client')

  const canPublish = blockers.length === 0 && !alreadyPublished
  const canHide = Boolean(asset && combination && alreadyPublished)
  const status = blockers.length > 0
    ? 'RELEASE_BLOCKED_REVIEW_REQUIRED'
    : alreadyPublished
      ? 'RELEASE_ALREADY_PUBLISHED_FOR_CLIENT'
      : 'RELEASE_READY_TO_PUBLISH'

  return {
    sprint: REAL_PRODUCTION_RELEASE_SPRINT,
    status,
    generatedAt: nowIso(),
    target: {
      assetId,
      batchId,
      batchItemId,
      queueJobId,
      companionId: companionId || asset?.companion_id || combination?.companion_id || null,
      combinationId: effectiveCombinationId,
    },
    selected: {
      asset: assetMapped,
      combination: combinationMapped,
    },
    releaseReadiness: {
      canPublish,
      canHide,
      alreadyPublished,
      priceCredits,
      sellableWhenPublished: canPublish || alreadyPublished,
      publicationWouldChangeCombination: Boolean(combination && !alreadyPublished),
      willCreateDelivery: false,
      willCreateGalleryItem: false,
      willChargeCustomer: false,
    },
    clientExposureAudit: exposure,
    strictAudit: strictAudit
      ? {
        status: strictAudit.status,
        exactGeneratedMediaFound: strictAudit.stuckAnalysis?.exactGeneratedMediaFound ?? null,
        variantsTotal: strictAudit.generatedMedia?.variants?.total ?? null,
        deliveriesTotal: strictAudit.clientExposureAudit?.deliveries?.total ?? null,
        galleryItemsTotal: strictAudit.clientExposureAudit?.galleryItems?.total ?? null,
        creditLedgerTotal: strictAudit.financeAudit?.creditLedger?.total ?? null,
        critical: strictAudit.integrity?.critical ?? [],
        warnings: strictAudit.integrity?.warnings ?? [],
      }
      : null,
    blockers,
    warnings,
    actionHints: {
      publish: `REAL_PRODUCTION_RELEASE_ACTION=publish + ${REQUIRED_6_3L_PUBLISH_PHRASE}`,
      hide: `REAL_PRODUCTION_RELEASE_ACTION=hide + ${REQUIRED_6_3L_HIDE_PHRASE}`,
    },
    safety: buildSafety(),
  }
}

export const applyRealProductionReleaseDecision = async ({
  action = process.env.REAL_PRODUCTION_RELEASE_ACTION,
  confirmationPhrase = process.env.REAL_PRODUCTION_RELEASE_CONFIRMATION_PHRASE,
  actorProfileId = process.env.REAL_PRODUCTION_RELEASE_ADMIN_PROFILE_ID || process.env.REAL_PRODUCTION_QA_ADMIN_PROFILE_ID || null,
  notes = process.env.REAL_PRODUCTION_RELEASE_NOTES || null,
  assetId = process.env.REAL_PRODUCTION_RELEASE_ASSET_ID || process.env.REAL_PRODUCTION_QA_ASSET_ID,
  batchId = process.env.REAL_PRODUCTION_AUDIT_BATCH_ID,
  batchItemId = process.env.REAL_PRODUCTION_AUDIT_BATCH_ITEM_ID,
  queueJobId = process.env.REAL_PRODUCTION_AUDIT_QUEUE_JOB_ID,
  companionId = process.env.REAL_PRODUCTION_COMPANION_ID,
  combinationId = process.env.REAL_PRODUCTION_COMBINATION_ID,
  apply = process.env.RUN_6_3L_RELEASE_MUTATION,
  allowMutation = process.env.ALLOW_6_3L_PUBLISH_TO_CLIENT,
} = {}) => {
  const normalizedAction = normalizeAction(action)
  const requestedApply = toBool(apply)
  const mutationEnvAllowed = toBool(allowMutation)
  const expectedPhrase = normalizedAction === 'publish' ? REQUIRED_6_3L_PUBLISH_PHRASE : normalizedAction === 'hide' ? REQUIRED_6_3L_HIDE_PHRASE : null
  const confirmationOk = hasValue(expectedPhrase) && String(confirmationPhrase || '').trim() === expectedPhrase
  const inspection = await inspectRealProductionRelease({
    assetId,
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
  })
  const blockers = []

  if (!normalizedAction) blockers.push('release_action_invalid_or_missing')
  if (!requestedApply) blockers.push('mutation_env_not_requested')
  if (!mutationEnvAllowed) blockers.push('release_env_not_allowed')
  if (!confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')
  if (normalizedAction === 'publish' && !inspection.releaseReadiness.canPublish) blockers.push('asset_not_ready_to_publish')
  if (normalizedAction === 'hide' && !inspection.releaseReadiness.canHide) blockers.push('asset_not_currently_published')

  if (blockers.length > 0) {
    return {
      sprint: REAL_PRODUCTION_RELEASE_SPRINT,
      status: 'BLOCKED_BY_RELEASE_GUARD',
      dryRun: true,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      requestedAction: normalizedAction,
      blockers,
      inspection,
      safety: buildSafety(),
    }
  }

  const assetResult = await safeSelectById(ASSETS_TABLE, inspection.target.assetId)
  const asset = assetResult.row
  const combinationResult = await safeSelectById(COMBINATIONS_TABLE, inspection.target.combinationId)
  const combination = combinationResult.row
  const now = nowIso()
  const priceCredits = inspection.releaseReadiness.priceCredits
  const publicationPayload = buildPublicationPayload({
    action: normalizedAction,
    asset,
    combination,
    actorProfileId,
    priceCredits,
    notes,
  })

  const combinationMetadata = safeObject(combination.metadata)
  const assetMetadata = safeObject(asset.metadata)

  const combinationUpdate = {
    visible_to_client: normalizedAction === 'publish',
    admin_only: normalizedAction !== 'publish',
    is_active: true,
    price_credits: priceCredits,
    updated_at: now,
    metadata: {
      ...combinationMetadata,
      productPublication: publicationPayload,
      publication: {
        ...safeObject(combinationMetadata.publication),
        ...publicationPayload,
      },
    },
  }

  const assetUpdate = {
    updated_at: now,
    metadata: {
      ...assetMetadata,
      productPublication: publicationPayload,
      clientPublication: publicationPayload,
    },
  }

  const { data: updatedCombination, error: updateCombinationError } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .update(combinationUpdate)
    .eq('id', combination.id)
    .select('*')
    .maybeSingle()

  if (updateCombinationError) {
    return {
      sprint: REAL_PRODUCTION_RELEASE_SPRINT,
      status: 'RELEASE_FAILED_ON_COMBINATION_UPDATE',
      error: updateCombinationError.message,
      code: updateCombinationError.code,
      safety: buildSafety({ databaseMutationExecutedByThisService: false }),
    }
  }

  const { data: updatedAsset, error: updateAssetError } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .update(assetUpdate)
    .eq('id', asset.id)
    .select('*')
    .maybeSingle()

  if (updateAssetError) {
    return {
      sprint: REAL_PRODUCTION_RELEASE_SPRINT,
      status: 'RELEASE_PARTIAL_FAILURE_ASSET_UPDATE',
      error: updateAssetError.message,
      code: updateAssetError.code,
      updatedCombination: mapCombination(updatedCombination),
      safety: buildSafety({ databaseMutationExecutedByThisService: true }),
    }
  }

  const auditLog = await softInsertAdminAuditLog({
    actor_profile_id: actorProfileId || null,
    action: normalizedAction === 'publish'
      ? 'real_production.asset.publish_6_3L'
      : 'real_production.asset.hide_6_3L',
    entity_type: ASSETS_TABLE,
    entity_id: asset.id,
    before_payload: {
      asset: mapAsset(asset),
      combination: mapCombination(combination),
    },
    after_payload: {
      asset: mapAsset(updatedAsset || asset),
      combination: mapCombination(updatedCombination || combination),
      publication: publicationPayload,
    },
    reason: normalizedAction === 'publish'
      ? 'controlled_release_after_real_qa_6_3L'
      : 'controlled_hide_after_real_qa_6_3L',
    metadata: {
      sprint: REAL_PRODUCTION_RELEASE_SPRINT,
      assetId: asset.id,
      batchId: inspection.target.batchId,
      batchItemId: inspection.target.batchItemId,
    },
  })

  const postInspection = await inspectRealProductionRelease({
    assetId,
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
  })
  const expectedStatus = normalizedAction === 'publish'
    ? 'RELEASE_ASSET_PUBLISHED_CONTROLLED'
    : 'RELEASE_ASSET_HIDDEN_CONTROLLED'

  return {
    sprint: REAL_PRODUCTION_RELEASE_SPRINT,
    status: expectedStatus,
    dryRun: false,
    requestedApply,
    mutationEnvAllowed,
    confirmationOk,
    requestedAction: normalizedAction,
    appliedOperations: [
      {
        target: COMBINATIONS_TABLE,
        id: combination.id,
        ok: true,
        visibleToClient: updatedCombination?.visible_to_client ?? null,
        adminOnly: updatedCombination?.admin_only ?? null,
        priceCredits: updatedCombination?.price_credits ?? null,
      },
      {
        target: ASSETS_TABLE,
        id: asset.id,
        ok: true,
        status: updatedAsset?.status ?? null,
      },
      {
        target: AUDIT_TABLE,
        ok: auditLog.ok,
        error: auditLog.error,
        code: auditLog.code,
      },
    ],
    postInspection,
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}
