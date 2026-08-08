import { supabaseAdmin } from '../config/supabase.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const SPRINT = '6.3P3'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const CREDIT_LEDGER_TABLE = 'credit_ledger'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const ACTIONS = new Set(['publish', 'hide'])
const PUBLISH_CONFIRMATION_PHRASE = 'PUBLICAR CARD AUDIO LIVE SIMULADO 6.3P3'
const HIDE_CONFIRMATION_PHRASE = 'OCULTAR CARD AUDIO LIVE SIMULADO 6.3P3'

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

async function safeSelectList({ table, filters = [], limit = 80, select = '*' }) {
  let query = supabaseAdmin.from(table).select(select)

  for (const filter of filters) {
    if (!filter?.column || !hasValue(filter.value)) continue
    query = query.eq(filter.column, filter.value)
  }

  const { data, error } = await query.limit(Math.min(Math.max(Number(limit || 80), 1), 250))
  if (error) return { ok: false, data: [], error: error.message || String(error), code: error.code || null }
  return { ok: true, data: data || [], error: null, code: null }
}

async function safeUpdateAdaptive({ table, id, payload, label = table }) {
  const removedColumns = []
  let currentPayload = cleanPayload({ ...payload })

  if (!id) return { ok: false, table, data: null, removedColumns, error: `${label}: id ausente`, code: 'MISSING_ID' }

  for (let attempt = 1; attempt <= 70; attempt += 1) {
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
  const publication = asObject(meta.publication)
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
    cardPublished: Boolean(publication.clientCardVisible),
    clientMediaVisibleBeforePurchase: Boolean(meta.clientMediaVisibleBeforePurchase || publication.clientMediaVisibleBeforePurchase),
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
    contentTypeLabel: contentType === 'live_audio' ? 'Audio Live' : (contentType === 'live_action' ? 'Live Action' : 'Narrativo'),
    companionId: row.companion_id || meta.companionId || null,
    status: row.status || meta.status || publication.status || 'draft',
    publicationStatus: publication.status || row.status || 'draft',
    productionStatus: production.status || 'not_requested',
    outputVariantId: production.outputVariantId || production.simulatedOutputVariantId || null,
    priceCredits: Number(row.price_credits ?? clientCard.priceCredits ?? 0),
    durationSeconds: Number(clientCard.durationSeconds ?? meta.narrative?.durationSeconds ?? 0),
    publishDestination: publication.publishDestination || clientCard.publishDestination || meta.publishDestination || 'chat_side_store',
    visibleToClient: Boolean(row.visible_to_client),
    adminOnly: row.admin_only !== false,
    isActive: Boolean(row.is_active),
    actorVisible: Boolean(publication.actorVisible),
    clientCardVisible: Boolean(publication.clientCardVisible),
    clientMediaVisibleBeforePurchase: Boolean(publication.clientMediaVisibleBeforePurchase),
    internalPromptVisibleToClient: false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function isNarrativeDraft(row = {}) {
  const meta = asObject(row.metadata)
  const production = asObject(meta.production)
  const publication = asObject(meta.publication)
  const contentType = row.media_type || meta.contentType || asObject(row.display_payload).contentType || asObject(row.display_payload).clientCard?.contentType
  return ['live_audio', 'live_action'].includes(String(contentType || ''))
    || meta.source === 'narrative_studio_6_3N'
    || production.outputVariantId
    || publication.source === 'narrative_card_publication_6_3P3'
}

async function loadAsset(assetId) {
  if (!assetId) return { ok: false, row: null, asset: null, error: 'outputVariantId ausente', code: 'MISSING_OUTPUT_VARIANT_ID' }
  const result = await safeSelectMaybeSingle({ table: ASSETS_TABLE, filters: [{ column: 'id', value: assetId }] })
  if (!result.ok) return { ok: false, row: null, asset: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, asset: null, error: 'Output/asset narrativo não encontrado.', code: 'OUTPUT_NOT_FOUND' }
  return { ok: true, row: result.data, asset: summarizeAsset(result.data), error: null, code: null }
}

async function loadDraftById(draftId) {
  if (!draftId) return { ok: false, row: null, draft: null, error: 'draftId ausente', code: 'MISSING_DRAFT_ID' }
  const result = await safeSelectMaybeSingle({ table: COMBINATIONS_TABLE, filters: [{ column: 'id', value: draftId }] })
  if (!result.ok) return { ok: false, row: null, draft: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, draft: null, error: 'Rascunho narrativo não encontrado.', code: 'DRAFT_NOT_FOUND' }
  if (!isNarrativeDraft(result.data)) return { ok: false, row: result.data, draft: null, error: 'Combinação não parece ser um produto narrativo.', code: 'NOT_NARRATIVE_DRAFT' }
  return { ok: true, row: result.data, draft: summarizeDraft(result.data), error: null, code: null }
}

async function findLatestApprovedNarrativeDraft() {
  const result = await safeSelectList({ table: COMBINATIONS_TABLE, limit: 220 })
  if (!result.ok) return { ok: false, row: null, draft: null, error: result.error, code: result.code }

  const candidates = (result.data || [])
    .filter(isNarrativeDraft)
    .filter((row) => {
      const draft = summarizeDraft(row)
      const meta = asObject(row.metadata)
      const production = asObject(meta.production)
      return draft.outputVariantId
        && ['approved', 'approved_simulated', 'available'].includes(String(draft.status || '').toLowerCase())
        || ['approved_simulated', 'approved_real', 'approved'].includes(String(production.status || '').toLowerCase())
    })
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))

  const row = candidates[0] || null
  return row
    ? { ok: true, row, draft: summarizeDraft(row), error: null, code: null }
    : { ok: false, row: null, draft: null, error: 'Nenhum rascunho narrativo aprovado encontrado.', code: 'NO_APPROVED_NARRATIVE_DRAFT' }
}

async function loadTarget({ draftId = null, outputVariantId = null } = {}) {
  const selectedDraftId = draftId || process.env.NARRATIVE_STUDIO_DRAFT_ID || process.env.NARRATIVE_STUDIO_6_3P3_DRAFT_ID || null
  const draftLookup = selectedDraftId ? await loadDraftById(selectedDraftId) : await findLatestApprovedNarrativeDraft()
  if (!draftLookup.ok) return { ok: false, error: draftLookup.error, code: draftLookup.code, draftLookup }

  const draftRow = draftLookup.row
  const draft = draftLookup.draft
  const meta = asObject(draftRow.metadata)
  const production = asObject(meta.production)
  const selectedOutputId = outputVariantId
    || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID
    || process.env.NARRATIVE_STUDIO_6_3P3_OUTPUT_VARIANT_ID
    || draft.outputVariantId
    || production.outputVariantId
    || production.simulatedOutputVariantId
    || null

  const assetLookup = await loadAsset(selectedOutputId)
  if (!assetLookup.ok) return { ok: false, error: assetLookup.error, code: assetLookup.code, draftLookup, assetLookup }

  const asset = assetLookup.asset
  const draftIdFromAsset = asset.combinationId
  if (draftIdFromAsset && draftIdFromAsset !== draft.id) {
    return { ok: false, error: 'Output/asset não pertence ao rascunho narrativo selecionado.', code: 'OUTPUT_DRAFT_MISMATCH', draftLookup, assetLookup }
  }

  return {
    ok: true,
    draftRow,
    assetRow: assetLookup.row,
    draft,
    asset,
    error: null,
    code: null,
  }
}

function buildClientCard({ draft, asset, now }) {
  return {
    title: draft.publicTitle || draft.title || 'Audio Live',
    description: draft.publicDescription || '',
    durationSeconds: draft.durationSeconds || 0,
    priceCredits: draft.priceCredits || 0,
    contentType: draft.contentType || asset.mediaType || 'live_audio',
    contentTypeLabel: draft.contentTypeLabel || 'Audio Live',
    lockedBeforePurchase: true,
    mediaVisibleBeforePurchase: false,
    showGenerateButtonBeforePurchase: false,
    ctaLabel: 'Comprar',
    friendlyProcessingMessage: 'Sofia está preparando esse áudio para você...',
    outputVariantId: asset.id,
    simulatedOutput: Boolean(asset.simulatedOutput),
    publishedAt: now,
  }
}

function buildDraftPublicationPayload({ target, action, adminProfileId }) {
  const now = nowIso()
  const meta = asObject(target.draftRow.metadata)
  const publication = asObject(meta.publication)
  const production = asObject(meta.production)
  const displayPayload = asObject(target.draftRow.display_payload)
  const published = action === 'publish'
  const clientCard = buildClientCard({ draft: target.draft, asset: target.asset, now })

  return {
    metadata: {
      ...meta,
      status: published ? 'published_card_simulated' : 'approved',
      publication: {
        ...publication,
        source: 'narrative_card_publication_6_3P3',
        sprint: SPRINT,
        status: published ? 'published_card_simulated' : 'hidden_after_simulated_qa',
        published,
        adminVisible: true,
        actorVisible: published,
        clientCardVisible: published,
        clientMediaVisibleBeforePurchase: false,
        internalPromptVisibleToClient: false,
        requiresPurchase: true,
        publishDestination: target.draft.publishDestination || 'chat_side_store',
        outputVariantId: target.asset.id,
        simulatedOutput: Boolean(target.asset.simulatedOutput),
        noRealMedia: Boolean(target.asset.simulatedOutput),
        updatedAt: now,
        updatedByProfileId: adminProfileId || null,
      },
      production: {
        ...production,
        outputVariantId: target.asset.id,
        simulatedOutputVariantId: target.asset.id,
        status: target.draft.productionStatus || 'approved_simulated',
      },
      clientCard,
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
    },
    display_payload: {
      ...displayPayload,
      publicTitle: target.draft.publicTitle,
      publicDescription: target.draft.publicDescription,
      clientCard: published ? clientCard : { ...clientCard, hidden: true },
      clientCardVisible: published,
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
      outputVariantId: target.asset.id,
      productionStatus: target.draft.productionStatus,
      publicationStatus: published ? 'published_card_simulated' : 'hidden_after_simulated_qa',
    },
    visible_to_client: published,
    admin_only: !published,
    is_active: published,
    updated_at: now,
  }
}

function buildAssetPublicationPayload({ target, action, adminProfileId }) {
  const now = nowIso()
  const meta = asObject(target.assetRow.metadata || target.assetRow.meta)
  const publication = asObject(meta.publication)
  const published = action === 'publish'

  return {
    metadata: {
      ...meta,
      sprint: SPRINT,
      publication: {
        ...publication,
        source: 'narrative_card_publication_6_3P3',
        sprint: SPRINT,
        cardPublished: published,
        clientCardVisible: published,
        clientMediaVisibleBeforePurchase: false,
        internalPromptVisibleToClient: false,
        publishDestination: target.draft.publishDestination || 'chat_side_store',
        updatedAt: now,
        updatedByProfileId: adminProfileId || null,
      },
      simulatedOutput: Boolean(target.asset.simulatedOutput),
      clientMediaVisibleBeforePurchase: false,
      internalPromptVisibleToClient: false,
    },
    meta: {
      ...meta,
      sprint: SPRINT,
      cardPublished: published,
      clientCardVisible: published,
      simulatedOutput: Boolean(target.asset.simulatedOutput),
    },
    updated_at: now,
  }
}

async function auditClientExposure({ assetId, draftId }) {
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
    await countBy(CREDIT_LEDGER_TABLE, 'reference_id', draftId),
  ]

  return {
    deliveriesTotal: deliveries.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    galleryItemsTotal: gallery.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    creditLedgerTotal: ledger.filter((a) => a.ok).reduce((sum, a) => sum + a.total, 0),
    publicUrlDetected: false,
    attempts: { deliveries, galleryItems: gallery, creditLedger: ledger },
  }
}

function evaluateReadiness({ target }) {
  if (!target.ok) {
    return {
      canPublish: false,
      canHide: false,
      alreadyPublished: false,
      blockers: [target.code || 'target_not_found'],
      warnings: [target.error].filter(Boolean),
    }
  }

  const outputStatus = String(target.asset.status || '').toLowerCase()
  const productionStatus = String(target.draft.productionStatus || '').toLowerCase()
  const publicationStatus = String(target.draft.publicationStatus || '').toLowerCase()
  const hasApprovedOutput = outputStatus === 'available'
  const hasApprovedDraft = ['approved', 'approved_simulated', 'published_card_simulated'].includes(String(target.draft.status || '').toLowerCase())
    || ['approved_simulated', 'approved_real', 'approved'].includes(productionStatus)
  const cardPublished = Boolean(target.draft.clientCardVisible && target.draft.visibleToClient && !target.draft.adminOnly)

  const blockers = [
    ...(!hasApprovedOutput ? [`output_status_not_available:${outputStatus || 'missing'}`] : []),
    ...(!hasApprovedDraft ? [`draft_not_approved:${target.draft.status || productionStatus || 'missing'}`] : []),
    ...(target.draft.clientMediaVisibleBeforePurchase ? ['client_media_visible_before_purchase'] : []),
    ...(target.asset.clientMediaVisibleBeforePurchase ? ['output_media_visible_before_purchase'] : []),
  ]

  return {
    canPublish: !cardPublished && blockers.length === 0,
    canHide: cardPublished,
    alreadyPublished: cardPublished || publicationStatus === 'published_card_simulated',
    blockers,
    warnings: target.asset.simulatedOutput ? ['publishing_simulated_card_without_real_media'] : [],
  }
}

export async function previewNarrativeCardPublication({ draftId = null, outputVariantId = null } = {}) {
  const target = await loadTarget({ draftId, outputVariantId })
  const readiness = evaluateReadiness({ target })

  return {
    sprint: SPRINT,
    status: !target.ok
      ? 'NARRATIVE_CARD_PUBLICATION_BLOCKED_BY_TARGET'
      : (readiness.alreadyPublished ? 'NARRATIVE_CARD_ALREADY_PUBLISHED' : (readiness.canPublish ? 'NARRATIVE_CARD_READY_TO_PUBLISH' : 'NARRATIVE_CARD_NOT_READY_TO_PUBLISH')),
    canPublish: readiness.canPublish,
    canHide: readiness.canHide,
    alreadyPublished: readiness.alreadyPublished,
    selected: target.ok ? {
      draft: target.draft,
      output: target.asset,
      clientCard: buildClientCard({ draft: target.draft, asset: target.asset, now: nowIso() }),
    } : null,
    publicationWould: target.ok ? {
      clientCardVisible: true,
      clientMediaVisibleBeforePurchase: false,
      visibleToClient: true,
      adminOnly: false,
      actorVisible: true,
      deliveryCreated: false,
      galleryItemCreated: false,
      creditLedgerCreated: false,
      publicUrlCreated: false,
    } : null,
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    safety: buildSafety(),
  }
}

export async function applyNarrativeCardPublication({ draftId = null, outputVariantId = null, action = null, adminProfileId = null, confirmationPhrase = '', dryRunOnly = true } = {}) {
  const normalizedAction = String(action || process.env.NARRATIVE_STUDIO_6_3P3_ACTION || '').trim().toLowerCase()
  const requestedMutation = toBool(process.env.RUN_6_3P3_NARRATIVE_CARD_PUBLICATION_MUTATION)
  const mutationAllowed = toBool(process.env.ALLOW_6_3P3_NARRATIVE_CARD_PUBLICATION)
  const expectedPhrase = normalizedAction === 'publish' ? PUBLISH_CONFIRMATION_PHRASE : (normalizedAction === 'hide' ? HIDE_CONFIRMATION_PHRASE : null)
  const confirmationOk = expectedPhrase ? String(confirmationPhrase || process.env.NARRATIVE_STUDIO_6_3P3_CONFIRMATION_PHRASE || '').trim() === expectedPhrase : false
  const preview = await previewNarrativeCardPublication({ draftId, outputVariantId })

  const actionAllowed = normalizedAction === 'publish' ? preview.canPublish : (normalizedAction === 'hide' ? preview.canHide : false)
  const blockers = [
    ...(dryRunOnly ? ['dry_run_only'] : []),
    ...(!ACTIONS.has(normalizedAction) ? ['card_publication_action_missing_or_invalid'] : []),
    ...(!requestedMutation ? ['mutation_env_not_requested'] : []),
    ...(!mutationAllowed ? ['mutation_env_not_allowed'] : []),
    ...(!confirmationOk ? ['confirmation_phrase_missing_or_invalid'] : []),
    ...(!actionAllowed ? (preview.blockers?.length ? preview.blockers : [`action_not_allowed:${normalizedAction || 'missing'}`]) : []),
  ]

  if (blockers.length) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_PUBLICATION_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedApply: !dryRunOnly,
      requestedAction: normalizedAction || null,
      blockers,
      preview,
      safety: buildSafety(),
    }
  }

  const target = await loadTarget({ draftId: preview.selected.draft.id, outputVariantId: preview.selected.output.id })
  if (!target.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_PUBLICATION_BLOCKED_BY_TARGET',
      dryRun: true,
      blocker: target.code,
      error: target.error,
      safety: buildSafety(),
    }
  }

  const draftUpdate = await safeUpdateAdaptive({
    table: COMBINATIONS_TABLE,
    id: target.draft.id,
    payload: buildDraftPublicationPayload({ target, action: normalizedAction, adminProfileId }),
    label: 'rascunho/card narrativo',
  })

  const assetUpdate = await safeUpdateAdaptive({
    table: ASSETS_TABLE,
    id: target.asset.id,
    payload: buildAssetPublicationPayload({ target, action: normalizedAction, adminProfileId }),
    label: 'output narrativo aprovado',
  })

  const audit = await insertAdminAuditAdaptive({
    profileId: adminProfileId,
    action: normalizedAction === 'publish' ? 'narrative_studio.card.publish' : 'narrative_studio.card.hide',
    entityType: 'media_combination',
    entityId: target.draft.id,
    message: `Card narrativo ${normalizedAction === 'publish' ? 'publicado' : 'ocultado'} de forma controlada no ${SPRINT}.`,
    sprint: SPRINT,
    metadata: {
      action: normalizedAction,
      draftId: target.draft.id,
      outputVariantId: target.asset.id,
      simulatedOutput: Boolean(target.asset.simulatedOutput),
      noRunPod: true,
      noR2: true,
      noBilling: true,
      noDelivery: true,
      clientMediaVisibleBeforePurchase: false,
      draftUpdateRemovedColumns: draftUpdate.removedColumns,
      assetUpdateRemovedColumns: assetUpdate.removedColumns,
    },
  })

  const postInspect = await inspectNarrativeCardPublication({ draftId: target.draft.id, outputVariantId: target.asset.id })

  return {
    sprint: SPRINT,
    status: normalizedAction === 'publish' ? 'NARRATIVE_CARD_PUBLISHED_CONTROLLED' : 'NARRATIVE_CARD_HIDDEN_CONTROLLED',
    dryRun: false,
    requestedApply: true,
    mutationEnvAllowed: true,
    confirmationOk: true,
    requestedAction: normalizedAction,
    draft: draftUpdate.data ? summarizeDraft(draftUpdate.data) : target.draft,
    output: assetUpdate.data ? summarizeAsset(assetUpdate.data) : target.asset,
    operations: {
      draftUpdate: { ok: draftUpdate.ok, removedColumns: draftUpdate.removedColumns, error: draftUpdate.error, code: draftUpdate.code },
      assetUpdate: { ok: assetUpdate.ok, removedColumns: assetUpdate.removedColumns, error: assetUpdate.error, code: assetUpdate.code },
      audit,
    },
    postInspect,
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}

export async function inspectNarrativeCardPublication({ draftId = null, outputVariantId = null } = {}) {
  const target = await loadTarget({ draftId, outputVariantId })
  const readiness = evaluateReadiness({ target })
  const exposure = target.ok ? await auditClientExposure({ assetId: target.asset.id, draftId: target.draft.id }) : null

  const status = !target.ok
    ? 'NARRATIVE_CARD_PUBLICATION_TARGET_NOT_FOUND'
    : (readiness.alreadyPublished
      ? 'NARRATIVE_CARD_PUBLISHED_READY'
      : (readiness.canPublish ? 'NARRATIVE_CARD_READY_TO_PUBLISH' : 'NARRATIVE_CARD_PUBLICATION_NOT_READY'))

  return {
    sprint: SPRINT,
    status,
    checkedAt: nowIso(),
    selectedDraftId: target.ok ? target.draft.id : null,
    selectedOutputVariantId: target.ok ? target.asset.id : null,
    selected: target.ok ? {
      draft: target.draft,
      output: target.asset,
      clientCard: buildClientCard({ draft: target.draft, asset: target.asset, now: nowIso() }),
    } : null,
    readiness: {
      canPublish: readiness.canPublish,
      canHide: readiness.canHide,
      alreadyPublished: readiness.alreadyPublished,
      clientCardVisible: Boolean(target.draft?.clientCardVisible),
      actorVisible: Boolean(target.draft?.actorVisible),
      visibleToClient: Boolean(target.draft?.visibleToClient),
      adminOnly: Boolean(target.draft?.adminOnly),
      clientMediaVisibleBeforePurchase: Boolean(target.draft?.clientMediaVisibleBeforePurchase || target.asset?.clientMediaVisibleBeforePurchase),
      simulatedOutput: Boolean(target.asset?.simulatedOutput),
      realMediaCreatedByThisSprint: false,
      r2ObjectCreatedByThisSprint: false,
    },
    clientExposureAudit: exposure,
    rules: {
      cardPublicationDoesNotRevealMedia: true,
      clientMediaVisibleOnlyAfterPurchase: true,
      cardCanBeShownAsPurchaseOffer: true,
      runPodStillDisabledByThisSprint: true,
      r2StillDisabledByThisSprint: true,
      billingStillDisabledByThisSprint: true,
    },
    blockers: readiness.blockers,
    warnings: readiness.warnings,
    safety: buildSafety(),
  }
}

export function getNarrativeCardPublicationConfig() {
  return {
    sprint: SPRINT,
    name: 'Publicação lógica do card narrativo simulado',
    publishConfirmationPhrase: PUBLISH_CONFIRMATION_PHRASE,
    hideConfirmationPhrase: HIDE_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3P3_NARRATIVE_CARD_PUBLICATION_MUTATION: toBool(process.env.RUN_6_3P3_NARRATIVE_CARD_PUBLICATION_MUTATION),
      ALLOW_6_3P3_NARRATIVE_CARD_PUBLICATION: toBool(process.env.ALLOW_6_3P3_NARRATIVE_CARD_PUBLICATION),
      NARRATIVE_STUDIO_6_3P3_ACTION: process.env.NARRATIVE_STUDIO_6_3P3_ACTION || null,
      NARRATIVE_STUDIO_6_3P3_CONFIRMATION_PHRASE: hasValue(process.env.NARRATIVE_STUDIO_6_3P3_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
      NARRATIVE_STUDIO_DRAFT_ID: process.env.NARRATIVE_STUDIO_DRAFT_ID || process.env.NARRATIVE_STUDIO_6_3P3_DRAFT_ID || null,
      NARRATIVE_STUDIO_OUTPUT_VARIANT_ID: process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || process.env.NARRATIVE_STUDIO_6_3P3_OUTPUT_VARIANT_ID || null,
      NARRATIVE_STUDIO_ADMIN_PROFILE_ID: hasValue(process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID) ? '[preenchido]' : null,
    },
    safety: buildSafety(),
  }
}
