import { supabaseAdmin } from '../config/supabase.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const SPRINT = '6.3P5'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'
const GALLERY_TABLE = 'gallery_items'
const CREDIT_LEDGER_TABLE = 'credit_ledger'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const PURCHASE_CONFIRMATION_PHRASE = 'SIMULAR COMPRA AUDIO LIVE 6.3P5'
// O banco atual restringe user_media_deliveries.delivery_source aos valores oficiais
// usados pelas RPCs de entrega: button, album, chat, admin_grant, premium_studio.
// Mantemos a origem detalhada da simulação no metadata.source, mas usamos
// premium_studio no campo restrito para respeitar a check constraint.
const SAFE_SIMULATED_DELIVERY_SOURCE = 'premium_studio'

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

function safeJson(value) {
  if (!value) return {}
  if (typeof value === 'string') {
    try {
      return asObject(JSON.parse(value))
    } catch {
      return {}
    }
  }
  return asObject(value)
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

async function safeInsertAdaptive({ table, payload, label = table }) {
  const removedColumns = []
  let currentPayload = cleanPayload({ ...payload })

  for (let attempt = 1; attempt <= 80; attempt += 1) {
    if (!Object.keys(currentPayload).length) {
      return { ok: false, table, data: null, removedColumns, error: `${label}: payload vazio`, code: 'EMPTY_PAYLOAD' }
    }

    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(currentPayload)
      .select('*')
      .maybeSingle()

    if (!error) return { ok: true, table, data, removedColumns, error: null, code: null }

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return { ok: false, table, data: null, removedColumns, error: error.message || `Falha ao inserir ${label}.`, code: error.code || null }
  }

  return { ok: false, table, data: null, removedColumns, error: `Falha ao inserir ${label}: limite de adaptação esgotado.`, code: 'ADAPTIVE_INSERT_EXHAUSTED' }
}

function summarizeAsset(row = {}) {
  const metadata = safeJson(row.metadata || row.meta)
  const publication = asObject(metadata.publication)
  return {
    id: row.id,
    status: row.status || null,
    mediaType: row.media_type || metadata.mediaType || metadata.contentType || null,
    companionId: row.companion_id || row.avatar_id || metadata.companionId || null,
    combinationId: row.combination_id || row.media_combination_id || metadata.draftId || null,
    batchId: row.batch_id || metadata.batchId || null,
    batchItemId: row.batch_item_id || row.media_generation_batch_item_id || metadata.batchItemId || null,
    r2BucketPresent: Boolean(row.r2_bucket || row.bucket),
    r2KeyPresent: Boolean(row.r2_key || row.storage_key),
    urlPresent: Boolean(row.url || row.file_url || row.public_url),
    cardPublished: Boolean(publication.clientCardVisible || metadata.cardPublished),
    simulatedOutput: Boolean(metadata.simulatedOutput || metadata.simulatedNoR2),
    clientMediaVisibleBeforePurchase: Boolean(metadata.clientMediaVisibleBeforePurchase || publication.clientMediaVisibleBeforePurchase),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeDraft(row = {}) {
  const metadata = safeJson(row.metadata || row.meta)
  const displayPayload = safeJson(row.display_payload)
  const publication = asObject(metadata.publication)
  const production = asObject(metadata.production)
  const clientCard = asObject(metadata.clientCard || displayPayload.clientCard)
  const narrative = asObject(metadata.narrative)
  const contentType = row.media_type || metadata.contentType || clientCard.contentType || displayPayload.contentType || null

  return {
    id: row.id,
    title: row.title || displayPayload.publicTitle || clientCard.title || 'Produto narrativo',
    publicTitle: displayPayload.publicTitle || clientCard.title || row.title || 'Produto narrativo',
    publicDescription: displayPayload.publicDescription || clientCard.description || '',
    contentType,
    contentTypeLabel: contentType === 'live_audio' ? 'Audio Live' : (contentType === 'live_action' ? 'Live Action' : 'Narrativo'),
    companionId: row.companion_id || metadata.companionId || null,
    actressId: row.actress_id || metadata.actressId || null,
    status: row.status || metadata.status || publication.status || 'draft',
    publicationStatus: publication.status || row.status || 'draft',
    productionStatus: production.status || 'not_requested',
    outputVariantId: production.outputVariantId || production.simulatedOutputVariantId || clientCard.outputVariantId || null,
    priceCredits: Number(row.price_credits ?? clientCard.priceCredits ?? 0),
    durationSeconds: Number(clientCard.durationSeconds ?? narrative.durationSeconds ?? 0),
    publishDestination: publication.publishDestination || clientCard.publishDestination || metadata.publishDestination || 'chat_side_store',
    visibleToClient: Boolean(row.visible_to_client),
    adminOnly: row.admin_only !== false,
    isActive: Boolean(row.is_active),
    actorVisible: Boolean(publication.actorVisible),
    clientCardVisible: Boolean(publication.clientCardVisible),
    clientMediaVisibleBeforePurchase: Boolean(publication.clientMediaVisibleBeforePurchase || clientCard.mediaVisibleBeforePurchase),
    internalPromptVisibleToClient: Boolean(publication.internalPromptVisibleToClient),
    metadataPublication: publication,
    clientCard: {
      title: clientCard.title || displayPayload.publicTitle || row.title || 'Produto narrativo',
      description: clientCard.description || displayPayload.publicDescription || '',
      durationSeconds: Number(clientCard.durationSeconds ?? narrative.durationSeconds ?? 0),
      priceCredits: Number(clientCard.priceCredits ?? row.price_credits ?? 0),
      contentType,
      contentTypeLabel: contentType === 'live_audio' ? 'Audio Live' : (contentType === 'live_action' ? 'Live Action' : 'Narrativo'),
      lockedBeforePurchase: clientCard.lockedBeforePurchase !== false,
      mediaVisibleBeforePurchase: Boolean(clientCard.mediaVisibleBeforePurchase || publication.clientMediaVisibleBeforePurchase),
      showGenerateButtonBeforePurchase: Boolean(clientCard.showGenerateButtonBeforePurchase),
      ctaLabel: clientCard.ctaLabel || 'Comprar',
      friendlyProcessingMessage: clientCard.friendlyProcessingMessage || 'A personagem está preparando esse conteúdo para você...',
      outputVariantId: clientCard.outputVariantId || production.outputVariantId || null,
      simulatedOutput: Boolean(clientCard.simulatedOutput || production.simulatedOutput),
    },
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function summarizeDelivery(row = {}) {
  const metadata = safeJson(row.metadata || row.meta)
  return {
    id: row.id,
    profileId: row.profile_id || metadata.profileId || null,
    companionId: row.companion_id || metadata.companionId || null,
    combinationId: row.combination_id || metadata.combinationId || null,
    variantId: row.variant_id || row.media_asset_variant_id || row.asset_variant_id || metadata.outputVariantId || null,
    deliverySource: row.delivery_source || metadata.deliverySource || null,
    totalPriceCredits: Number(row.total_price_credits || 0),
    companionCreditsUsed: Number(row.companion_credits_used || 0),
    universalCreditsUsed: Number(row.universal_credits_used || 0),
    charged: Boolean(metadata.charged),
    simulatedPurchase: Boolean(metadata.simulatedPurchase),
    protectedViewUrl: row.id ? `/media/deliveries/${row.id}/protected-view` : null,
    publicUrlDetected: Boolean(row.public_url || row.url || row.media_url),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

function isNarrativeCardCandidate(row = {}) {
  const draft = summarizeDraft(row)
  const metadata = safeJson(row.metadata || row.meta)
  return ['live_audio', 'live_action'].includes(String(draft.contentType || ''))
    || metadata.source === 'narrative_studio_6_3N'
    || asObject(metadata.publication).source === 'narrative_card_publication_6_3P3'
    || Boolean(draft.outputVariantId)
}

async function loadDraft(draftId = null) {
  if (draftId) {
    const result = await safeSelectMaybeSingle({ table: COMBINATIONS_TABLE, filters: [{ column: 'id', value: draftId }] })
    if (!result.ok) return { ok: false, row: null, draft: null, error: result.error, code: result.code }
    if (!result.data) return { ok: false, row: null, draft: null, error: 'Card/rascunho narrativo não encontrado.', code: 'DRAFT_NOT_FOUND' }
    return { ok: true, row: result.data, draft: summarizeDraft(result.data), error: null, code: null }
  }

  const result = await safeSelectList({ table: COMBINATIONS_TABLE, limit: 250 })
  if (!result.ok) return { ok: false, row: null, draft: null, error: result.error, code: result.code }

  const candidates = (result.data || [])
    .filter(isNarrativeCardCandidate)
    .filter((row) => {
      const draft = summarizeDraft(row)
      return draft.clientCardVisible || draft.visibleToClient || draft.publicationStatus === 'published_card_simulated'
    })
    .sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))

  const row = candidates[0] || null
  return row
    ? { ok: true, row, draft: summarizeDraft(row), error: null, code: null }
    : { ok: false, row: null, draft: null, error: 'Nenhum card narrativo publicado encontrado.', code: 'NO_PUBLISHED_NARRATIVE_CARD' }
}

async function loadAsset(outputVariantId = null, fallbackDraft = null) {
  const selectedId = outputVariantId || fallbackDraft?.outputVariantId || null
  if (!selectedId) return { ok: false, row: null, asset: null, error: 'outputVariantId ausente', code: 'MISSING_OUTPUT_VARIANT_ID' }
  const result = await safeSelectMaybeSingle({ table: ASSETS_TABLE, filters: [{ column: 'id', value: selectedId }] })
  if (!result.ok) return { ok: false, row: null, asset: null, error: result.error, code: result.code }
  if (!result.data) return { ok: false, row: null, asset: null, error: 'Output narrativo não encontrado.', code: 'OUTPUT_NOT_FOUND' }
  return { ok: true, row: result.data, asset: summarizeAsset(result.data), error: null, code: null }
}

async function findExistingDelivery({ profileId, draftId, outputVariantId }) {
  if (!hasValue(profileId)) return { ok: true, delivery: null, deliveryRow: null, attempts: [] }

  const attempts = []
  const filtersList = [
    [{ column: 'profile_id', value: profileId }, { column: 'variant_id', value: outputVariantId }],
    [{ column: 'profile_id', value: profileId }, { column: 'combination_id', value: draftId }],
  ]

  for (const filters of filtersList) {
    const result = await safeSelectList({ table: DELIVERIES_TABLE, filters, limit: 10 })
    attempts.push({ filters: filters.map((item) => item.column), ok: result.ok, total: result.data?.length || 0, error: result.error, code: result.code })
    if (result.ok && result.data?.length) {
      const row = result.data.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
      return { ok: true, delivery: summarizeDelivery(row), deliveryRow: row, attempts }
    }
  }

  return { ok: true, delivery: null, deliveryRow: null, attempts }
}

async function safeCount({ table, column, value }) {
  if (!hasValue(value)) return { column, ok: false, total: 0, error: 'valor ausente', code: 'MISSING_VALUE' }
  const { count, error } = await supabaseAdmin.from(table).select('id', { count: 'exact', head: true }).eq(column, value)
  if (error) return { column, ok: false, total: 0, error: error.message || String(error), code: error.code || null }
  return { column, ok: true, total: count || 0, error: null, code: null }
}

async function auditClientState({ draftId, outputVariantId, profileId }) {
  const deliveryAttempts = [
    await safeCount({ table: DELIVERIES_TABLE, column: 'variant_id', value: outputVariantId }),
    await safeCount({ table: DELIVERIES_TABLE, column: 'combination_id', value: draftId }),
  ]

  if (hasValue(profileId)) {
    deliveryAttempts.push(await safeCount({ table: DELIVERIES_TABLE, column: 'profile_id', value: profileId }))
  }

  const galleryAttempts = [
    await safeCount({ table: GALLERY_TABLE, column: 'variant_id', value: outputVariantId }),
    await safeCount({ table: GALLERY_TABLE, column: 'combination_id', value: draftId }),
  ]

  const creditAttempts = [
    await safeCount({ table: CREDIT_LEDGER_TABLE, column: 'reference_id', value: outputVariantId }),
    await safeCount({ table: CREDIT_LEDGER_TABLE, column: 'reference_id', value: draftId }),
  ]

  const totalFrom = (attempts) => attempts.filter((item) => item.ok).reduce((sum, item) => sum + Number(item.total || 0), 0)

  return {
    deliveriesTotal: totalFrom(deliveryAttempts),
    galleryItemsTotal: totalFrom(galleryAttempts),
    creditLedgerTotal: totalFrom(creditAttempts),
    publicUrlDetected: false,
    attempts: {
      deliveries: deliveryAttempts,
      galleryItems: galleryAttempts,
      creditLedger: creditAttempts,
    },
  }
}

function buildClientPurchaseCard({ draft, asset, delivery = null }) {
  return {
    title: draft.clientCard.title,
    description: draft.clientCard.description,
    durationSeconds: draft.clientCard.durationSeconds,
    priceCredits: draft.clientCard.priceCredits || draft.priceCredits,
    contentType: draft.contentType,
    contentTypeLabel: draft.contentTypeLabel,
    ctaLabel: delivery ? 'Abrir' : 'Comprar',
    lockedBeforePurchase: !delivery,
    mediaVisibleBeforePurchase: false,
    mediaAccessibleAfterSimulatedPurchase: Boolean(delivery),
    playableRealAudio: false,
    protectedViewUrlAfterPurchase: delivery?.protectedViewUrl || null,
    outputVariantId: asset.id,
    simulatedOutput: Boolean(asset.simulatedOutput),
  }
}

function getConfigEnv() {
  return {
    RUN_6_3P5_NARRATIVE_PURCHASE_SIMULATION_MUTATION: toBool(process.env.RUN_6_3P5_NARRATIVE_PURCHASE_SIMULATION_MUTATION),
    ALLOW_6_3P5_NARRATIVE_PURCHASE_SIMULATION: toBool(process.env.ALLOW_6_3P5_NARRATIVE_PURCHASE_SIMULATION),
    NARRATIVE_STUDIO_6_3P5_CONFIRMATION_PHRASE: process.env.NARRATIVE_STUDIO_6_3P5_CONFIRMATION_PHRASE ? '[preenchida]' : null,
    NARRATIVE_STUDIO_DRAFT_ID: process.env.NARRATIVE_STUDIO_DRAFT_ID || null,
    NARRATIVE_STUDIO_OUTPUT_VARIANT_ID: process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || null,
    NARRATIVE_STUDIO_CLIENT_PROFILE_ID: process.env.NARRATIVE_STUDIO_CLIENT_PROFILE_ID || null,
    NARRATIVE_STUDIO_ADMIN_PROFILE_ID: process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID ? '[preenchido]' : null,
  }
}

export function getNarrativeCardPurchaseSimulationConfig() {
  return {
    sprint: SPRINT,
    name: 'Compra/entrega simulada do card narrativo',
    purchaseConfirmationPhrase: PURCHASE_CONFIRMATION_PHRASE,
    envHints: getConfigEnv(),
    safety: buildSafety(),
  }
}

export async function inspectNarrativeCardPurchaseSimulation({ draftId = null, outputVariantId = null, clientProfileId = null } = {}) {
  const selectedClientProfileId = clientProfileId || process.env.NARRATIVE_STUDIO_CLIENT_PROFILE_ID || null
  const draftResult = await loadDraft(draftId || process.env.NARRATIVE_STUDIO_DRAFT_ID || null)
  const blockers = []
  const warnings = []

  if (!draftResult.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_PURCHASE_SIMULATION_NOT_READY',
      checkedAt: nowIso(),
      selectedDraftId: draftId || process.env.NARRATIVE_STUDIO_DRAFT_ID || null,
      selectedOutputVariantId: outputVariantId || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || null,
      selectedClientProfileId,
      selected: null,
      blockers: [draftResult.code || 'draft_not_found'],
      warnings,
      safety: buildSafety(),
    }
  }

  const assetResult = await loadAsset(outputVariantId || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID || null, draftResult.draft)
  if (!assetResult.ok) blockers.push(assetResult.code || 'output_not_found')

  const draft = draftResult.draft
  const asset = assetResult.asset

  if (!draft.clientCardVisible || !draft.visibleToClient || draft.adminOnly) blockers.push('narrative_card_not_published_for_client')
  if (asset && asset.status !== 'available') blockers.push('output_variant_not_available')
  if (draft.clientMediaVisibleBeforePurchase) blockers.push('media_visible_before_purchase')
  if (asset?.clientMediaVisibleBeforePurchase) blockers.push('asset_media_visible_before_purchase')
  if (Number(draft.priceCredits || draft.clientCard?.priceCredits || 0) <= 0) blockers.push('price_not_configured')
  if (!hasValue(selectedClientProfileId)) warnings.push('client_profile_id_required_for_apply')
  if (asset?.simulatedOutput) warnings.push('simulated_output_without_real_media')

  const existing = asset
    ? await findExistingDelivery({ profileId: selectedClientProfileId, draftId: draft.id, outputVariantId: asset.id })
    : { delivery: null, attempts: [] }
  const exposure = asset
    ? await auditClientState({ draftId: draft.id, outputVariantId: asset.id, profileId: selectedClientProfileId })
    : { deliveriesTotal: 0, galleryItemsTotal: 0, creditLedgerTotal: 0, publicUrlDetected: false, attempts: {} }

  const delivery = existing.delivery || null
  const purchaseCard = asset ? buildClientPurchaseCard({ draft, asset, delivery }) : null

  return {
    sprint: SPRINT,
    status: blockers.length
      ? 'NARRATIVE_CARD_PURCHASE_SIMULATION_NOT_READY'
      : delivery
        ? 'NARRATIVE_CARD_SIMULATED_DELIVERY_READY'
        : 'NARRATIVE_CARD_READY_FOR_SIMULATED_PURCHASE',
    checkedAt: nowIso(),
    selectedDraftId: draft.id,
    selectedOutputVariantId: asset?.id || null,
    selectedClientProfileId,
    selected: {
      draft,
      output: asset,
      existingDelivery: delivery,
      clientPurchaseCard: purchaseCard,
    },
    readiness: {
      canSimulatePurchase: blockers.length === 0,
      alreadyDelivered: Boolean(delivery),
      clientCanSeeCard: Boolean(draft.clientCardVisible),
      buttonMustBeBuyBeforePurchase: !delivery,
      buttonLabelBeforePurchase: delivery ? 'Abrir' : 'Comprar',
      protectedViewUrlBeforePurchase: false,
      protectedViewUrlAfterPurchase: delivery?.protectedViewUrl || null,
      realAudioPlayableAfterThisSprint: false,
      simulatedDeliveryOnly: Boolean(delivery),
      walletWillChange: false,
      creditLedgerWillBeCreated: false,
      galleryWillBeCreated: false,
      publicUrlWillBeCreated: false,
    },
    clientStateAudit: exposure,
    existingDeliveryAttempts: existing.attempts || [],
    rules: {
      purchaseSimulationDoesNotChargeWallet: true,
      deliveryDoesNotCreateGalleryYet: true,
      deliveryDoesNotCreatePublicUrl: true,
      protectedUrlCanExistButMediaIsStillSimulated: true,
      runPodStillDisabledByThisSprint: true,
      r2RealStillDisabledByThisSprint: true,
      billingStillDisabledByThisSprint: true,
    },
    blockers,
    warnings,
    safety: buildSafety(),
  }
}

export async function previewNarrativeCardPurchaseSimulation(input = {}) {
  const inspect = await inspectNarrativeCardPurchaseSimulation(input)
  return {
    sprint: SPRINT,
    status: inspect.status === 'NARRATIVE_CARD_READY_FOR_SIMULATED_PURCHASE'
      ? 'NARRATIVE_CARD_PURCHASE_SIMULATION_READY'
      : inspect.status,
    canSimulatePurchase: inspect.readiness?.canSimulatePurchase || false,
    selected: inspect.selected,
    purchaseWould: {
      createDelivery: inspect.status === 'NARRATIVE_CARD_READY_FOR_SIMULATED_PURCHASE',
      charged: false,
      walletChanged: false,
      creditLedgerCreated: false,
      galleryItemCreated: false,
      publicUrlCreated: false,
      protectedViewUrlCreated: true,
      realMediaPlayable: false,
      totalPriceCreditsRecorded: inspect.selected?.draft?.priceCredits || 0,
    },
    blockers: inspect.blockers || [],
    warnings: inspect.warnings || [],
    safety: buildSafety(),
  }
}

function buildDeliveryPayload({ profileId, draft, asset, adminProfileId }) {
  const createdAt = nowIso()
  const totalPriceCredits = Number(draft.priceCredits || draft.clientCard?.priceCredits || 0)

  return {
    profile_id: profileId,
    companion_id: draft.companionId || asset.companionId || null,
    combination_id: draft.id,
    variant_id: asset.id,
    media_asset_variant_id: asset.id,
    asset_variant_id: asset.id,
    delivery_source: SAFE_SIMULATED_DELIVERY_SOURCE,
    total_price_credits: totalPriceCredits,
    companion_credits_used: 0,
    universal_credits_used: 0,
    companion_credit_ledger_id: null,
    universal_credit_ledger_id: null,
    media_url: null,
    idempotency_key: `narrative-sim-purchase:${profileId}:${draft.id}:${asset.id}`,
    metadata: {
      source: 'narrative_card_purchase_simulation_6_3P5',
      deliverySource: SAFE_SIMULATED_DELIVERY_SOURCE,
      originalIntentSource: 'narrative_card_simulated_6_3P5',
      sprint: SPRINT,
      simulatedPurchase: true,
      simulatedDelivery: true,
      charged: false,
      walletChanged: false,
      creditLedgerCreated: false,
      galleryItemCreated: false,
      publicUrlCreated: false,
      realMediaPlayable: false,
      clientClickedBuy: true,
      noRealMedia: Boolean(asset.simulatedOutput),
      requiresFutureRealTts: Boolean(asset.simulatedOutput),
      profileId,
      companionId: draft.companionId || asset.companionId || null,
      combinationId: draft.id,
      outputVariantId: asset.id,
      publicTitle: draft.publicTitle,
      contentType: draft.contentType,
      priceCredits: totalPriceCredits,
      createdByProfileId: adminProfileId || null,
      createdAt,
    },
    created_at: createdAt,
    updated_at: createdAt,
  }
}

export async function applyNarrativeCardPurchaseSimulation({
  draftId = null,
  outputVariantId = null,
  clientProfileId = null,
  adminProfileId = null,
  confirmationPhrase = null,
  dryRunOnly = true,
} = {}) {
  const requestedApply = dryRunOnly === false
  const mutationEnvAllowed = toBool(process.env.RUN_6_3P5_NARRATIVE_PURCHASE_SIMULATION_MUTATION)
    && toBool(process.env.ALLOW_6_3P5_NARRATIVE_PURCHASE_SIMULATION)
  const confirmationOk = String(confirmationPhrase || process.env.NARRATIVE_STUDIO_6_3P5_CONFIRMATION_PHRASE || '').trim() === PURCHASE_CONFIRMATION_PHRASE
  const selectedClientProfileId = clientProfileId || process.env.NARRATIVE_STUDIO_CLIENT_PROFILE_ID || null

  const preview = await previewNarrativeCardPurchaseSimulation({ draftId, outputVariantId, clientProfileId: selectedClientProfileId })
  const blockers = []

  if (!requestedApply) blockers.push('dry_run_only')
  if (!mutationEnvAllowed) blockers.push('mutation_env_not_requested_or_allowed')
  if (!confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')
  if (!hasValue(selectedClientProfileId)) blockers.push('client_profile_id_required')
  if (!preview.canSimulatePurchase) blockers.push(...(preview.blockers || ['purchase_simulation_not_ready']))

  if (blockers.length) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_PURCHASE_SIMULATION_BLOCKED_BY_GUARD',
      dryRun: !requestedApply,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      selectedClientProfileId,
      blockers: [...new Set(blockers)],
      preview,
      safety: buildSafety(),
    }
  }

  const draft = preview.selected?.draft
  const asset = preview.selected?.output
  const existing = await findExistingDelivery({ profileId: selectedClientProfileId, draftId: draft.id, outputVariantId: asset.id })

  if (existing.delivery) {
    const postInspect = await inspectNarrativeCardPurchaseSimulation({ draftId: draft.id, outputVariantId: asset.id, clientProfileId: selectedClientProfileId })
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_SIMULATED_DELIVERY_ALREADY_EXISTS',
      dryRun: false,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      delivery: existing.delivery,
      postInspect,
      safety: buildSafety(),
    }
  }

  const deliveryPayload = buildDeliveryPayload({ profileId: selectedClientProfileId, draft, asset, adminProfileId })
  const deliveryInsert = await safeInsertAdaptive({ table: DELIVERIES_TABLE, payload: deliveryPayload, label: 'entrega simulada narrativa' })

  if (!deliveryInsert.ok) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_CARD_SIMULATED_DELIVERY_FAILED',
      dryRun: false,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      operations: { deliveryInsert },
      blockers: [deliveryInsert.code || 'delivery_insert_failed'],
      safety: buildSafety({ databaseMutationExecutedByThisService: false }),
    }
  }

  const delivery = summarizeDelivery(deliveryInsert.data)
  const audit = await insertAdminAuditAdaptive({
    actorProfileId: adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null,
    action: 'narrative_studio.card.simulated_purchase',
    entityType: 'user_media_delivery',
    entityId: delivery.id,
    sprint: SPRINT,
    details: {
      draftId: draft.id,
      outputVariantId: asset.id,
      clientProfileId: selectedClientProfileId,
      charged: false,
      walletChanged: false,
      simulatedPurchase: true,
    },
  })

  const postInspect = await inspectNarrativeCardPurchaseSimulation({ draftId: draft.id, outputVariantId: asset.id, clientProfileId: selectedClientProfileId })

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_CARD_SIMULATED_DELIVERY_CREATED_CONTROLLED',
    dryRun: false,
    requestedApply,
    mutationEnvAllowed,
    confirmationOk,
    purchase: {
      charged: false,
      walletChanged: false,
      creditLedgerCreated: false,
      totalPriceCreditsRecorded: Number(draft.priceCredits || 0),
      simulatedPurchase: true,
    },
    delivery,
    operations: {
      deliveryInsert,
      audit,
    },
    postInspect,
    safety: buildSafety({ databaseMutationExecutedByThisService: true }),
  }
}
