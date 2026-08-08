import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { claimAvailableAssetForProfile } from './media-delivery.service.js'
import { createSignedReadUrl } from './storage.service.js'
import { resolveCommercialPriceForAsset } from './commercial-pricing.service.js'

const ASSETS_TABLE = 'media_asset_variants'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const DELIVERIES_TABLE = 'user_media_deliveries'

function normalizePositiveInteger(value, fallback = 30, max = 100) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) return fallback

  return Math.min(parsed, max)
}

function normalizeOffset(value) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) return 0

  return parsed
}

function normalizeStatus(value) {
  const status = String(value || '').trim()

  return status || null
}

function normalizeMediaType(value) {
  const mediaType = String(value || '').trim()

  return mediaType || null
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function truthy(value) {
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value || '').trim().toLowerCase())
}

function metadataValue(record = {}, fields = []) {
  for (const field of fields) {
    const value = record?.[field]
    if (value !== null && value !== undefined && String(value).trim() !== '') return value
  }

  return null
}

function normalizeAuthorizationContentType(value) {
  const raw = String(value || '').trim().toLowerCase()

  if (['image', 'imagem', 'foto', 'photo', 'picture', 'img'].includes(raw)) return 'image'
  if (['video', 'vídeo', 'short_video', 'live_action', 'live-action'].includes(raw)) return 'video'
  if (['audio', 'áudio', 'live_audio', 'audio_live', 'voice'].includes(raw)) return 'audio'

  return raw || null
}

function authorizationContentTypeAliases(value) {
  const normalized = normalizeAuthorizationContentType(value)

  if (normalized === 'image') return ['image', 'imagem', 'foto', 'photo', 'picture', 'img']
  if (normalized === 'video') return ['video', 'vídeo', 'short_video', 'live_action', 'live-action']
  if (normalized === 'audio') return ['audio', 'áudio', 'live_audio', 'audio_live', 'voice']

  return normalized ? [normalized] : []
}

function isAuthorizationCurrentlyValid(row = {}, { contentType = null } = {}) {
  if (!row) return false

  const status = String(row.status || '').trim().toLowerCase()
  if (!['active', 'ativo', 'approved', 'aprovado', 'authorized', 'autorizado', 'valid', 'valido', 'válido'].includes(status)) return false
  if (row.revoked_at) return false

  const now = Date.now()
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null

  if (startsAt && startsAt > now) return false
  if (endsAt && endsAt <= now) return false

  const requestedAliases = authorizationContentTypeAliases(contentType)
  const allowed = Array.isArray(row.authorized_for_content_types) ? row.authorized_for_content_types : []
  const allowedAliases = allowed.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean)

  return requestedAliases.length === 0 || allowedAliases.length === 0 || requestedAliases.some((alias) => allowedAliases.includes(alias))
}

function mapBatchAuthorizationRow(row = {}, { contentType = null } = {}) {
  const authorized = isAuthorizationCurrentlyValid(row, { contentType })
  const requestedType = normalizeAuthorizationContentType(contentType)

  return {
    id: row?.id || null,
    companionId: row?.companion_id || null,
    actorProfileId: row?.actor_profile_id || null,
    status: row?.status || null,
    authorized,
    contentType: requestedType,
    contentTypeAllowed: authorized,
    startsAt: row?.starts_at || null,
    endsAt: row?.ends_at || null,
    revokedAt: row?.revoked_at || null,
    checkedAt: new Date().toISOString(),
    label: authorized ? 'Autorização ativa encontrada' : 'Autorização pendente de conferência',
    helper: authorized
      ? `Modelo autorizado para ${requestedType || 'este tipo de conteúdo'}.`
      : 'Não encontrei autorização ativa para este tipo de conteúdo neste lote.',
  }
}

function buildMissingBatchAuthorization({ companionId = null, contentType = null } = {}) {
  const requestedType = normalizeAuthorizationContentType(contentType)

  return {
    id: null,
    companionId,
    actorProfileId: null,
    status: 'missing',
    authorized: false,
    contentType: requestedType,
    contentTypeAllowed: false,
    startsAt: null,
    endsAt: null,
    revokedAt: null,
    checkedAt: new Date().toISOString(),
    label: 'Autorização não identificada',
    helper: 'Valide a autorização do modelo antes de iniciar qualquer produção real.',
  }
}

async function getProductionAuthorizationsByCompanionIds(companionIds = []) {
  const ids = uniqueValues(companionIds)

  if (ids.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from('avatar_production_authorizations')
    .select('id, companion_id, actor_profile_id, status, authorized_for_content_types, starts_at, ends_at, revoked_at, created_at')
    .in('companion_id', ids)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return new Map(ids.map((id) => [id, [{
      id: null,
      companion_id: id,
      status: 'lookup_error',
      authorized_for_content_types: [],
      starts_at: null,
      ends_at: null,
      revoked_at: null,
      created_at: null,
      lookup_error: error.message,
    }]]))
  }

  const grouped = new Map()

  for (const row of data || []) {
    const companionId = row.companion_id
    if (!companionId) continue
    if (!grouped.has(companionId)) grouped.set(companionId, [])
    grouped.get(companionId).push(row)
  }

  return grouped
}

function resolveBatchItemProductionAuthorization({ item, combination, authorizationsByCompanion }) {
  const metadata = item?.metadata || {}
  const companionId = item?.companion_id || combination?.companion_id || metadataValue(metadata, ['companionId', 'companion_id', 'avatarId', 'avatar_id']) || null
  const contentType = item?.media_type || item?.content_type || combination?.media_type || metadataValue(metadata, ['contentType', 'content_type', 'mediaType', 'media_type']) || null
  const explicitAuthorizationId = item?.avatar_production_authorization_id || combination?.avatar_production_authorization_id || metadataValue(metadata, [
    'productionAuthorizationId',
    'production_authorization_id',
    'avatarProductionAuthorizationId',
    'avatar_production_authorization_id',
  ]) || null
  const candidates = companionId ? (authorizationsByCompanion.get(companionId) || []) : []
  const explicit = explicitAuthorizationId ? candidates.find((row) => row.id === explicitAuthorizationId) || null : null
  const active = candidates.find((row) => isAuthorizationCurrentlyValid(row, { contentType })) || null
  const latest = explicit || active || candidates[0] || null

  if (active) return mapBatchAuthorizationRow(active, { contentType })
  if (explicit) return mapBatchAuthorizationRow(explicit, { contentType })
  if (latest?.lookup_error) return {
    ...buildMissingBatchAuthorization({ companionId, contentType }),
    status: 'lookup_error',
    label: 'Autorização não conferida',
    helper: 'A consulta de autorização não respondeu. Tente novamente antes de iniciar produção real.',
  }

  return buildMissingBatchAuthorization({ companionId, contentType })
}

function mediaTypeAliases(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'all') return []
  if (['image', 'imagem', 'foto', 'photo', 'picture', 'img'].includes(normalized)) return ['image', 'imagem', 'foto', 'photo', 'picture', 'img']
  if (['audio', 'áudio', 'live_audio', 'voice'].includes(normalized)) return ['audio', 'áudio', 'live_audio', 'voice']
  if (['video', 'vídeo', 'short_video', 'live_action'].includes(normalized)) return ['video', 'vídeo', 'short_video', 'live_action']
  return [normalized]
}

function isAssetApprovedForPublication(asset = {}) {
  return ['available', 'sold'].includes(String(asset.status || '').trim().toLowerCase())
}

function normalizePublicationStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  return ['published', 'hidden', 'all'].includes(status) ? status : 'all'
}

function normalizeGuidedSelections(selections) {
  if (Array.isArray(selections)) {
    return selections
      .map((item) => ({
        titleId: item?.titleId || item?.dimensionId || item?.dimension_id || null,
        titleName: item?.titleName || item?.dimensionName || item?.title || item?.category || 'Título',
        itemId: item?.itemId || item?.optionId || item?.option_id || item?.id || null,
        itemName: item?.itemName || item?.optionName || item?.name || item?.label || 'Item',
        technicalSnippet: item?.technicalSnippet || item?.technical_snippet || '',
        negativePrompt: item?.negativePrompt || item?.negative_prompt || '',
      }))
      .filter((item) => item.itemId || item.itemName)
  }

  if (selections && typeof selections === 'object') {
    return Object.entries(selections)
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          return {
            titleId: value.titleId || value.dimensionId || key,
            titleName: value.titleName || value.dimensionName || key,
            itemId: value.itemId || value.optionId || value.id || null,
            itemName: value.itemName || value.optionName || value.name || value.label || String(value.itemId || value.optionId || value.id || value),
            technicalSnippet: value.technicalSnippet || value.technical_snippet || '',
            negativePrompt: value.negativePrompt || value.negative_prompt || '',
          }
        }

        return {
          titleId: key,
          titleName: key,
          itemId: String(value || ''),
          itemName: String(value || ''),
          technicalSnippet: '',
          negativePrompt: '',
        }
      })
      .filter((item) => item.itemId || item.itemName)
  }

  return []
}

function buildProductSignature({ asset, companion, combination }) {
  const guidedSelections = normalizeGuidedSelections(combination?.guided_selections || combination?.metadata?.guidedSelections || [])
  const chips = guidedSelections.map((item) => ({
    titleId: item.titleId,
    titleName: item.titleName,
    itemId: item.itemId,
    itemName: item.itemName,
  }))

  return {
    companionId: companion?.id || asset.companion_id || combination?.companion_id || null,
    companionName: companion?.name || companion?.slug || null,
    mediaType: combination?.media_type || asset.media_type || null,
    combinationId: combination?.id || asset.combination_id || null,
    combinationKey: combination?.combination_key || null,
    assetId: asset.id,
    title: combination?.title || null,
    chips,
    path: chips.map((item) => `${item.titleName}: ${item.itemName}`),
  }
}

function getAssetPublicationMetadata(asset = {}, combination = {}) {
  const assetMetadata = safeObject(asset.metadata)
  const combinationMetadata = safeObject(combination?.metadata)

  return {
    asset: safeObject(assetMetadata.productPublication || assetMetadata.clientPublication),
    combination: safeObject(combinationMetadata.productPublication || combinationMetadata.publication),
  }
}

function isAssetPublishedForClient(asset = {}, combination = {}) {
  const publicationMetadata = getAssetPublicationMetadata(asset, combination)
  const publicationStatus = publicationMetadata.asset.status || publicationMetadata.combination.status || null

  if (publicationStatus === 'hidden') return false
  if (publicationStatus === 'published') return true

  return asset.status === 'available' && combination?.visible_to_client === true && combination?.admin_only !== true && combination?.is_active !== false
}

function mapPublishableProductRow({ asset, companion, combination }) {
  const signature = buildProductSignature({ asset, companion, combination })
  const published = isAssetPublishedForClient(asset, combination)
  const priceCredits = Number(combination?.price_credits || 0)
  const remainingAssignments = getRemainingAssignments(asset)
  const approvedForPublication = isAssetApprovedForPublication(asset)

  return {
    id: asset.id,
    assetId: asset.id,
    status: asset.status,
    mediaType: asset.media_type,
    variantNumber: asset.variant_number,
    createdAt: asset.created_at || null,
    publishedAt: asset.published_at || null,
    updatedAt: asset.updated_at || null,
    readiness: {
      approved: approvedForPublication,
      stockAvailable: approvedForPublication,
      priceConfigured: priceCredits > 0,
      publishable: approvedForPublication,
    },
    publication: {
      published,
      status: published ? 'published' : 'hidden',
      visibleToClient: Boolean(combination?.visible_to_client),
      adminOnly: combination?.admin_only ?? true,
      isActive: combination?.is_active ?? true,
      reason: published ? 'Produto disponível para os prompts dinâmicos.' : 'Produto aprovado, mas oculto do cliente.',
    },
    price: {
      credits: priceCredits,
      isConfigured: priceCredits > 0,
    },
    assignments: {
      current: Number(asset.current_assignments || 0),
      max: Number(asset.max_assignments || 1),
      remaining: remainingAssignments,
    },
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatarUrl: companion.avatar_url || null,
          thumbnailUrl: companion.thumbnail_url || null,
        }
      : {
          id: asset.companion_id,
        },
    combination: combination
      ? {
          id: combination.id,
          key: combination.combination_key || null,
          title: combination.title || null,
          mediaType: combination.media_type || asset.media_type,
          guidedSelections: normalizeGuidedSelections(combination.guided_selections || combination.metadata?.guidedSelections || []),
        }
      : {
          id: asset.combination_id,
          guidedSelections: [],
        },
    signature,
  }
}


function attachResolvedCommercialPrice(product, priceResolution = null) {
  if (!priceResolution?.price) return product

  const resolvedPrice = priceResolution.price || {}
  const credits = Number(resolvedPrice.credits || 0)
  const isConfigured = Boolean(resolvedPrice.isConfigured)

  return {
    ...product,
    readiness: {
      ...product.readiness,
      priceConfigured: isConfigured,
      publishable: Boolean(product.readiness?.approved && isConfigured),
    },
    price: {
      ...product.price,
      credits,
      isConfigured,
      sellable: Boolean(resolvedPrice.sellable),
      source: resolvedPrice.source || 'not_configured',
      sourceLabel: resolvedPrice.sourceLabel || 'Preço não configurado',
      note: resolvedPrice.note || null,
      configuredAt: resolvedPrice.configuredAt || null,
      configuredByProfileId: resolvedPrice.configuredByProfileId || null,
    },
    commercialPrice: {
      ...priceResolution,
      asset: undefined,
      companion: priceResolution.companion || product.companion || null,
      combination: priceResolution.combination || product.combination || null,
    },
  }
}

async function insertAdminAuditLogSoft(payload = {}) {
  const { error } = await supabaseAdmin
    .from('admin_audit_logs')
    .insert(payload)

  if (error) {
    console.warn('[factory-admin] Auditoria administrativa não registrada, sem bloquear operação.', {
      action: payload?.action,
      error: error.message,
    })
  }
}

async function getRowsByIds(table, ids, columns = '*') {
  const cleanIds = uniqueValues(ids)

  if (cleanIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .in('id', cleanIds)

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
      table,
      error: error.message,
    })
  }

  return new Map((data || []).map((row) => [row.id, row]))
}


function isImageMediaType(mediaType = '') {
  const normalized = String(mediaType || '').toLowerCase()
  return ['image', 'imagem', 'foto', 'photo', 'picture'].includes(normalized)
}

function isVideoMediaType(mediaType = '') {
  const normalized = String(mediaType || '').toLowerCase()
  return ['video', 'vídeo', 'short_video', 'live_action'].includes(normalized)
}

function isAudioMediaType(mediaType = '') {
  const normalized = String(mediaType || '').toLowerCase()
  return ['audio', 'áudio', 'live_audio', 'audio_live', 'voice', 'tts'].includes(normalized)
}

async function buildAssetMediaPreview(asset) {
  const bucket = asset.r2_bucket
  const mediaType = asset.media_type
  const thumbnailKey = asset.thumbnail_r2_key || null
  const previewKey = asset.preview_r2_key || null
  const originalKey = asset.r2_key || null
  const displayKey = thumbnailKey || previewKey || (isImageMediaType(mediaType) || isVideoMediaType(mediaType) || isAudioMediaType(mediaType) ? originalKey : null)

  if (!bucket || !displayKey) {
    return {
      url: null,
      thumbnailUrl: null,
      previewUrl: null,
      sourceKey: displayKey,
      expiresAt: null,
    }
  }

  try {
    const expiresIn = 600
    const displayUrl = await createSignedReadUrl(bucket, displayKey, expiresIn)
    const previewUrl = previewKey && previewKey !== displayKey
      ? await createSignedReadUrl(bucket, previewKey, expiresIn)
      : displayUrl
    const thumbnailUrl = thumbnailKey && thumbnailKey !== displayKey
      ? await createSignedReadUrl(bucket, thumbnailKey, expiresIn)
      : displayUrl

    return {
      url: displayUrl,
      thumbnailUrl,
      previewUrl,
      sourceKey: displayKey,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    }
  } catch (error) {
    console.warn('[factory-admin] Falha ao criar preview assinado para asset.', {
      assetId: asset.id,
      key: displayKey,
      error: error.message,
    })

    return {
      url: null,
      thumbnailUrl: null,
      previewUrl: null,
      sourceKey: displayKey,
      expiresAt: null,
      error: 'preview_unavailable',
    }
  }
}

function getRemainingAssignments(asset) {
  const currentAssignments = Number(asset.current_assignments || 0)
  const maxAssignments = Number(asset.max_assignments || 1)

  return Math.max(maxAssignments - currentAssignments, 0)
}

function mapAssetRow({ asset, companion, combination, mediaPreview = null }) {
  const remainingAssignments = getRemainingAssignments(asset)
  const priceCredits = Number(combination?.price_credits || 0)
  const stockAvailable = asset.status === 'available' && remainingAssignments > 0

  return {
    id: asset.id,
    status: asset.status,
    mediaType: asset.media_type,
    variantNumber: asset.variant_number,
    r2Bucket: asset.r2_bucket,
    r2Key: asset.r2_key,
    thumbnailR2Key: asset.thumbnail_r2_key || null,
    previewR2Key: asset.preview_r2_key || null,
    qualityScore: asset.quality_score || null,
    publishedAt: asset.published_at || null,
    createdAt: asset.created_at || null,
    updatedAt: asset.updated_at || null,
    cleanupAfter: asset.cleanup_after || null,
    rejectionReason: asset.rejection_reason || null,
    mediaPreview,
    assignments: {
      current: Number(asset.current_assignments || 0),
      max: Number(asset.max_assignments || 1),
      remaining: remainingAssignments,
      stockAvailable,
      soldOut: remainingAssignments <= 0,
    },
    price: {
      credits: priceCredits,
      isConfigured: priceCredits > 0,
      purchaseReady: stockAvailable && priceCredits > 0,
    },
    batch: {
      id: asset.batch_id || null,
      itemId: asset.batch_item_id || null,
    },
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatarUrl: companion.avatar_url || null,
          thumbnailUrl: companion.thumbnail_url || null,
        }
      : {
          id: asset.companion_id,
        },
    combination: combination
      ? {
          id: combination.id,
          key: combination.combination_key || null,
          title: combination.title || null,
          mediaType: combination.media_type || asset.media_type,
          priceCredits,
          visibleToClient: combination.visible_to_client ?? false,
          adminOnly: combination.admin_only ?? true,
          isActive: combination.is_active ?? true,
          guidedSelections: combination.guided_selections || [],
        }
      : {
          id: asset.combination_id,
          visibleToClient: false,
          adminOnly: true,
          isActive: true,
          guidedSelections: [],
        },
  }
}

function mapBatchRow(batch) {
  const metadata = batch.metadata || {}
  const requestedCount = Number(batch.requested_count || batch.total_items || metadata.totalCombinations || 0)
  const requestedVariants = Number(batch.requested_variants || metadata.requestedVariants || metadata.requested_variants || 0)

  return {
    id: batch.id,
    companionId: batch.companion_id || null,
    triggeredByProfileId: batch.triggered_by_profile_id || null,
    batchType: batch.batch_type || null,
    status: batch.status,
    title: batch.title || null,
    requestedCount,
    requestedVariants,
    totalPlannedVariants: requestedCount * Math.max(requestedVariants, 0),
    generatedCount: Number(batch.generated_count || 0),
    approvedCount: Number(batch.approved_count || 0),
    rejectedCount: Number(batch.rejected_count || 0),
    estimatedCostUsd: batch.estimated_cost_usd || null,
    actualCostUsd: batch.actual_cost_usd || null,
    engine: batch.engine || null,
    modelVersion: batch.model_version || null,
    safePlanningOnly: metadata.safePlanningOnly === true || metadata.enqueueJobs === false,
    queueJobsCreated: Number(metadata.queueJobsCreated || metadata.queue_jobs_created || 0),
    createdAt: batch.created_at || null,
    startedAt: batch.started_at || null,
    completedAt: batch.completed_at || null,
    updatedAt: batch.updated_at || null,
    metadata,
  }
}

function mapBatchItemRow(item, combination = null, productionAuthorization = null) {
  const metadata = item.metadata || {}
  const combinationTitle = combination?.title || combination?.name || combination?.combination_key || metadata.combinationTitle || metadata.title || null
  const resolvedCombinationId = item.combination_id || item.media_combination_id || metadata.combinationId || metadata.combination_id || null
  const guidedSelections = combination?.guided_selections || metadata.guidedSelections || metadata.guided_selections || []
  const businessMetadata = {
    ...metadata,
    combinationTitle,
    title: metadata.title || combinationTitle,
    contentTypeLabel: metadata.contentTypeLabel || metadata.content_type_label || combination?.media_type || null,
    guidedSelections,
    promptSummary: combination?.final_prompt || metadata.prompt_final || metadata.promptFinal || metadata.prompt || item.prompt_final || item.prompt || null,
  }

  return {
    id: item.id,
    batchId: item.batch_id,
    combinationId: resolvedCombinationId,
    status: item.status,
    requestedVariants: Number(item.requested_variants || 0),
    generatedVariants: Number(item.generated_variants || 0),
    approvedVariants: Number(item.approved_variants || 0),
    rejectedVariants: Number(item.rejected_variants || 0),
    createdAt: item.created_at || null,
    updatedAt: item.updated_at || null,
    metadata: {
      ...businessMetadata,
      productionAuthorization,
      productionAuthorizationId: productionAuthorization?.id || businessMetadata.productionAuthorizationId || businessMetadata.avatarProductionAuthorizationId || null,
      avatarProductionAuthorizationId: productionAuthorization?.id || businessMetadata.avatarProductionAuthorizationId || null,
      authorizationStatus: productionAuthorization?.status || businessMetadata.authorizationStatus || null,
    },
    productionAuthorization,
  }
}

function mapDeliveryRow({ delivery, profile, companion, combination, asset }) {
  return {
    id: delivery.id,
    profileId: delivery.profile_id,
    createdAt: delivery.created_at || null,
    deliverySource: delivery.delivery_source || null,
    idempotencyKey: delivery.idempotency_key || null,
    protectedViewUrl: `/media/deliveries/${delivery.id}/protected-view`,
    pricing: {
      totalPriceCredits: Number(delivery.total_price_credits || 0),
      companionCreditsUsed: Number(delivery.companion_credits_used || 0),
      universalCreditsUsed: Number(delivery.universal_credits_used || 0),
      companionCreditLedgerId: delivery.companion_credit_ledger_id || null,
      universalCreditLedgerId: delivery.universal_credit_ledger_id || null,
    },
    profile: profile
      ? {
          id: profile.id,
          email: profile.email || null,
          name: profile.name || null,
          role: profile.role || null,
        }
      : {
          id: delivery.profile_id,
        },
    asset: asset
      ? {
          id: asset.id,
          status: asset.status,
          mediaType: asset.media_type,
          variantNumber: asset.variant_number,
        }
      : {
          id: delivery.variant_id,
        },
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
        }
      : {
          id: delivery.companion_id,
        },
    combination: combination
      ? {
          id: combination.id,
          key: combination.combination_key || null,
          title: combination.title || null,
          mediaType: combination.media_type || null,
          priceCredits: Number(combination.price_credits || 0),
        }
      : {
          id: delivery.combination_id,
        },
  }
}

async function countTable(table, filters = []) {
  let query = supabaseAdmin
    .from(table)
    .select('id', { count: 'exact', head: true })

  for (const filter of filters) {
    query = query.eq(filter.column, filter.value)
  }

  const { count, error } = await query

  if (error) {
    throw new ApiError(500, `Erro ao contar ${table}.`, {
      table,
      error: error.message,
    })
  }

  return Number(count || 0)
}

export async function getFactoryAdminSummary() {
  const [
    assetsTotal,
    assetsQaPending,
    assetsAvailable,
    assetsSold,
    assetsRejected,
    batchesTotal,
    batchesRunning,
    batchesCompleted,
    deliveriesTotal,
  ] = await Promise.all([
    countTable(ASSETS_TABLE),
    countTable(ASSETS_TABLE, [{ column: 'status', value: 'qa_pending' }]),
    countTable(ASSETS_TABLE, [{ column: 'status', value: 'available' }]),
    countTable(ASSETS_TABLE, [{ column: 'status', value: 'sold' }]),
    countTable(ASSETS_TABLE, [{ column: 'status', value: 'rejected' }]),
    countTable(BATCHES_TABLE),
    countTable(BATCHES_TABLE, [{ column: 'status', value: 'running' }]),
    countTable(BATCHES_TABLE, [{ column: 'status', value: 'completed' }]),
    countTable(DELIVERIES_TABLE),
  ])

  const unpricedAvailable = await (async () => {
    const { data, error } = await supabaseAdmin
      .from(ASSETS_TABLE)
      .select('id, combination_id, current_assignments, max_assignments, media_combinations(price_credits)')
      .eq('status', 'available')
      .limit(500)

    if (error) {
      throw new ApiError(500, 'Erro ao calcular assets disponíveis sem preço.', error)
    }

    return (data || []).filter((asset) => {
      const remaining = getRemainingAssignments(asset)
      const price = Number(asset.media_combinations?.price_credits || 0)
      return remaining > 0 && price <= 0
    }).length
  })()

  return {
    assets: {
      total: assetsTotal,
      qaPending: assetsQaPending,
      available: assetsAvailable,
      sold: assetsSold,
      rejected: assetsRejected,
      unpricedAvailable,
    },
    batches: {
      total: batchesTotal,
      running: batchesRunning,
      completed: batchesCompleted,
    },
    deliveries: {
      total: deliveriesTotal,
    },
    health: {
      hasQaBacklog: assetsQaPending > 0,
      hasAvailableStock: assetsAvailable > 0,
      hasUnpricedAvailableStock: unpricedAvailable > 0,
    },
  }
}

export async function listFactoryAdminAssets({
  status = null,
  mediaType = null,
  companionId = null,
  actorProfileId = null,
  combinationId = null,
  limit = 30,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 30, 100)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select(`
      id,
      combination_id,
      batch_id,
      batch_item_id,
      companion_id,
      actor_profile_id,
      media_type,
      variant_number,
      r2_bucket,
      r2_key,
      thumbnail_r2_key,
      preview_r2_key,
      status,
      max_assignments,
      current_assignments,
      quality_score,
      rejection_reason,
      cleanup_after,
      created_at,
      published_at,
      updated_at
    `)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  const safeStatus = normalizeStatus(status)
  const safeMediaType = normalizeMediaType(mediaType)

  if (safeStatus) query = query.eq('status', safeStatus)
  if (safeMediaType) query = query.eq('media_type', safeMediaType)
  if (companionId) query = query.eq('companion_id', companionId)
  if (actorProfileId) query = query.eq('actor_profile_id', actorProfileId)
  if (combinationId) query = query.eq('combination_id', combinationId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar assets da fábrica.', error)
  }

  const assets = data || []
  const companionsById = await getRowsByIds(
    'companions',
    assets.map((asset) => asset.companion_id),
    'id, name, slug, avatar_url, thumbnail_url',
  )
  const combinationsById = await getRowsByIds(
    'media_combinations',
    assets.map((asset) => asset.combination_id),
    'id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections',
  )

  const mediaPreviewsByAssetId = new Map(
    await Promise.all(assets.map(async (asset) => [asset.id, await buildAssetMediaPreview(asset)])),
  )

  return {
    items: assets.map((asset) => mapAssetRow({
      asset,
      companion: companionsById.get(asset.companion_id),
      combination: combinationsById.get(asset.combination_id),
      mediaPreview: mediaPreviewsByAssetId.get(asset.id) || null,
    })),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: assets.length,
      hasMore: assets.length === safeLimit,
    },
  }
}

export async function listFactoryAdminBatches({
  status = null,
  companionId = null,
  limit = 30,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 30, 100)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(BATCHES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  const safeStatus = normalizeStatus(status)

  if (safeStatus) query = query.eq('status', safeStatus)
  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar batches da fábrica.', error)
  }

  return {
    items: (data || []).map(mapBatchRow),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: (data || []).length,
      hasMore: (data || []).length === safeLimit,
    },
  }
}

export async function listFactoryAdminBatchItems({
  batchId,
  status = null,
  limit = 50,
  offset = 0,
} = {}) {
  if (!batchId) {
    throw new ApiError(400, 'batchId obrigatório.')
  }

  const safeLimit = normalizePositiveInteger(limit, 50, 200)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(BATCH_ITEMS_TABLE)
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: true })
    .range(safeOffset, safeOffset + safeLimit - 1)

  const safeStatus = normalizeStatus(status)
  if (safeStatus) query = query.eq('status', safeStatus)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar itens do batch da fábrica.', error)
  }

  const items = data || []
  const combinationIds = items.map((item) => item.combination_id || item.media_combination_id).filter(Boolean)
  const combinationsById = await getRowsByIds(
    'media_combinations',
    combinationIds,
    'id, companion_id, combination_key, title, media_type, guided_selections, final_prompt, avatar_production_authorization_id',
  )
  const companionIds = uniqueValues(items.map((item) => {
    const combinationId = item.combination_id || item.media_combination_id
    const combination = combinationsById.get(combinationId)
    return item.companion_id || combination?.companion_id || item.metadata?.companionId || item.metadata?.companion_id || null
  }))
  const authorizationsByCompanion = await getProductionAuthorizationsByCompanionIds(companionIds)

  return {
    items: items.map((item) => {
      const combinationId = item.combination_id || item.media_combination_id
      const combination = combinationsById.get(combinationId)
      const productionAuthorization = resolveBatchItemProductionAuthorization({
        item,
        combination,
        authorizationsByCompanion,
      })

      return mapBatchItemRow(item, combination, productionAuthorization)
    }),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: items.length,
      hasMore: items.length === safeLimit,
    },
  }
}

export async function listFactoryAdminDeliveries({
  profileId = null,
  companionId = null,
  combinationId = null,
  mediaType = null,
  limit = 30,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 30, 100)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  if (profileId) query = query.eq('profile_id', profileId)
  if (companionId) query = query.eq('companion_id', companionId)
  if (combinationId) query = query.eq('combination_id', combinationId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar entregas administrativas.', error)
  }

  const deliveries = data || []
  const assetsById = await getRowsByIds(
    ASSETS_TABLE,
    deliveries.map((delivery) => delivery.variant_id),
    'id, status, media_type, variant_number',
  )

  const filteredDeliveries = mediaType
    ? deliveries.filter((delivery) => assetsById.get(delivery.variant_id)?.media_type === mediaType)
    : deliveries

  const profilesById = await getRowsByIds(
    'profiles',
    filteredDeliveries.map((delivery) => delivery.profile_id),
    'id, email, name, role',
  )
  const companionsById = await getRowsByIds(
    'companions',
    filteredDeliveries.map((delivery) => delivery.companion_id),
    'id, name, slug',
  )
  const combinationsById = await getRowsByIds(
    'media_combinations',
    filteredDeliveries.map((delivery) => delivery.combination_id),
    'id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections',
  )

  return {
    items: filteredDeliveries.map((delivery) => mapDeliveryRow({
      delivery,
      profile: profilesById.get(delivery.profile_id),
      companion: companionsById.get(delivery.companion_id),
      combination: combinationsById.get(delivery.combination_id),
      asset: assetsById.get(delivery.variant_id),
    })),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: filteredDeliveries.length,
      hasMore: deliveries.length === safeLimit,
    },
  }
}

// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_START
const ADMIN_IMAGE_CYCLE_SAFE_STATUS = new Set(['available', 'sold', 'qa_pending', 'rejected'])

// M4.9B2_ADMIN_IMAGE_CYCLE_ALIAS_AND_LEAK_HOTFIX_START
const ADMIN_IMAGE_CYCLE_IMAGE_ALIASES = new Set(['image', 'imagem', 'foto', 'photo', 'picture', 'img'])

function normalizeAdminImageCycleMediaType(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (ADMIN_IMAGE_CYCLE_IMAGE_ALIASES.has(raw)) return 'image'
  if (['audio_live', 'live_audio', 'audio-live', 'live-audio', 'audio', 'áudio'].includes(raw)) return 'audio_live'
  if (['live_action', 'live-action'].includes(raw)) return 'live_action'
  if (['video', 'vídeo', 'short_video'].includes(raw)) return 'video'
  return raw || 'unknown'
}

function isAdminImageCycleImage(value) {
  return normalizeAdminImageCycleMediaType(value) === 'image'
}
// M4.9B2_ADMIN_IMAGE_CYCLE_ALIAS_AND_LEAK_HOTFIX_END

function normalizeImageCycleStatus(value) {
  const status = String(value || '').trim().toLowerCase()
  if (!status || status === 'all') return null
  return ADMIN_IMAGE_CYCLE_SAFE_STATUS.has(status) ? status : null
}

function buildAdminImageCycleSafety() {
  return {
    runPodCalled: false,
    r2RealUpload: false,
    r2RealRead: false,
    r2RealDelete: false,
    workerCalled: false,
    redisCalled: false,
    upstashCalled: false,
    paymentExecuted: false,
    internalCreditDebitExecuted: false,
    walletChanged: false,
    creditLedgerCreated: false,
    galleryItemCreated: false,
    deliveryCreated: false,
    destructiveDelete: false,
    publicUrlCreated: false,
    databaseMutationAttempted: false,
    protectedViewStreamCalled: false,
    claimRpcCalled: false,
    realClaimAttempted: false,
    paidClaimExecuted: false,
  }
}

function imageCycleStateLabel(asset = {}) {
  const status = String(asset.status || '').trim().toLowerCase()
  const remaining = getRemainingAssignments(asset)
  const priceCredits = Number(asset?.combination?.priceCredits || asset?.price?.credits || 0)

  if (status === 'qa_pending') return 'Aguardando revisão'
  if (status === 'rejected') return 'Reprovado'
  if (status === 'sold' || remaining <= 0) return 'Já entregue ou esgotado'
  if (status === 'available' && priceCredits > 0) return 'Pronto para vender'
  if (status === 'available') return 'Falta preço'
  return 'Em análise'
}

function imageCycleActionLabel(asset = {}) {
  const status = String(asset.status || '').trim().toLowerCase()
  const remaining = getRemainingAssignments(asset)
  const priceCredits = Number(asset?.combination?.priceCredits || asset?.price?.credits || 0)

  if (status === 'qa_pending') return 'Revisar antes de liberar'
  if (status === 'rejected') return 'Manter fora da venda'
  if (status === 'sold' || remaining <= 0) return 'Consultar entrega'
  if (status === 'available' && priceCredits > 0) return 'Pode aparecer na prateleira'
  if (status === 'available') return 'Configurar preço antes de vender'
  return 'Conferir cadastro'
}

function sanitizeImageCycleAsset(asset = {}) {
  return {
    id: asset.id,
    status: asset.status,
    mediaType: asset.mediaType,
    variantNumber: asset.variantNumber || null,
    createdAt: asset.createdAt || null,
    publishedAt: asset.publishedAt || null,
    companion: asset.companion
      ? {
          id: asset.companion.id,
          name: asset.companion.name || null,
          slug: asset.companion.slug || null,
        }
      : null,
    combination: asset.combination
      ? {
          id: asset.combination.id,
          key: asset.combination.key || null,
          title: asset.combination.title || null,
          mediaType: asset.combination.mediaType || asset.mediaType || null,
          visibleToClient: Boolean(asset.combination.visibleToClient),
          adminOnly: Boolean(asset.combination.adminOnly),
          isActive: asset.combination.isActive !== false,
        }
      : null,
    price: asset.price || { credits: 0, isConfigured: false, purchaseReady: false },
    assignments: asset.assignments || {
      current: 0,
      max: 1,
      remaining: 0,
      stockAvailable: false,
      soldOut: false,
    },
    storage: {
      privateStorageReady: Boolean(asset.r2Bucket && asset.r2Key),
      publicPointerPresent: false,
      exposedStorageKey: false,
    },
    state: {
      label: imageCycleStateLabel(asset),
      actionLabel: imageCycleActionLabel(asset),
      clientVisible: Boolean(asset.combination?.visibleToClient && !asset.combination?.adminOnly && asset.combination?.isActive !== false),
    },
  }
}

function sanitizeImageCycleDelivery(delivery = {}) {
  return {
    id: delivery.id,
    createdAt: delivery.createdAt || null,
    deliverySource: delivery.deliverySource || null,
    protectedViewAvailable: Boolean(delivery.protectedViewUrl && String(delivery.protectedViewUrl).startsWith('/media/deliveries/')),
    profile: delivery.profile
      ? {
          id: delivery.profile.id,
          email: delivery.profile.email || null,
          name: delivery.profile.name || null,
          role: delivery.profile.role || null,
        }
      : null,
    companion: delivery.companion || null,
    asset: delivery.asset || null,
    combination: delivery.combination
      ? {
          id: delivery.combination.id,
          title: delivery.combination.title || null,
          mediaType: delivery.combination.mediaType || null,
          priceCredits: Number(delivery.combination.priceCredits || 0),
        }
      : null,
    pricing: delivery.pricing || {
      totalPriceCredits: 0,
      companionCreditsUsed: 0,
      universalCreditsUsed: 0,
    },
  }
}

async function countImageAssetsByStatus(status = null) {
  const safeStatus = status ? String(status).trim().toLowerCase() : null
  const { data, error } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, media_type, status')
    .limit(5000)

  if (error) {
    throw new ApiError(500, 'Erro ao contar imagens do ciclo Admin.', {
      error: error.message,
    })
  }

  return (data || []).filter((asset) => {
    const isImage = isAdminImageCycleImage(asset.media_type)
    const matchesStatus = !safeStatus || String(asset.status || '').trim().toLowerCase() === safeStatus
    return isImage && matchesStatus
  }).length
}

async function listUnpricedAvailableImages(limit = 1000) {
  const { data, error } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, media_type, status, current_assignments, max_assignments, media_combinations(price_credits, visible_to_client, admin_only, is_active)')
    .eq('status', 'available')
    .limit(limit)

  if (error) {
    throw new ApiError(500, 'Erro ao calcular imagens disponíveis sem preço.', {
      error: error.message,
    })
  }

  return (data || []).filter((asset) => {
    const remaining = getRemainingAssignments(asset)
    const combination = asset.media_combinations || {}
    const priceCredits = Number(combination.price_credits || 0)
    const clientVisible = combination.visible_to_client === true && combination.admin_only !== true && combination.is_active !== false
    return isAdminImageCycleImage(asset.media_type) && remaining > 0 && clientVisible && priceCredits <= 0
  })
}

async function listImageCycleAssets({ status = null, limit = 24, offset = 0 } = {}) {
  const rawLimit = Math.min(Math.max(Number(offset || 0) + Number(limit || 24) * 6, 160), 5000)

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, combination_id, batch_id, batch_item_id, companion_id, media_type, variant_number, r2_bucket, r2_key, status, max_assignments, current_assignments, quality_score, rejection_reason, cleanup_after, created_at, published_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(rawLimit)

  if (status) query = query.eq('status', status)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar ciclo de imagens do Admin.', {
      error: error.message,
    })
  }

  const assets = (data || [])
    .filter((asset) => isAdminImageCycleImage(asset.media_type))
    .slice(offset, offset + limit)

  const companionsById = await getRowsByIds(
    'companions',
    assets.map((asset) => asset.companion_id),
    'id, name, slug',
  )
  const combinationsById = await getRowsByIds(
    'media_combinations',
    assets.map((asset) => asset.combination_id),
    'id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections',
  )

  return assets.map((asset) => {
    const combination = combinationsById.get(asset.combination_id) || null
    const companion = companionsById.get(asset.companion_id) || null
    const remainingAssignments = getRemainingAssignments(asset)
    const priceCredits = Number(combination?.price_credits || 0)

    return {
      id: asset.id,
      status: asset.status,
      mediaType: normalizeAdminImageCycleMediaType(asset.media_type),
      variantNumber: asset.variant_number,
      r2Bucket: asset.r2_bucket || null,
      r2Key: asset.r2_key || null,
      createdAt: asset.created_at || null,
      publishedAt: asset.published_at || null,
      companion: companion
        ? {
            id: companion.id,
            name: companion.name || null,
            slug: companion.slug || null,
          }
        : {
            id: asset.companion_id,
          },
      combination: combination
        ? {
            id: combination.id,
            key: combination.combination_key || null,
            title: combination.title || null,
            mediaType: normalizeAdminImageCycleMediaType(combination.media_type || asset.media_type),
            priceCredits,
            visibleToClient: combination.visible_to_client ?? false,
            adminOnly: combination.admin_only ?? true,
            isActive: combination.is_active ?? true,
          }
        : {
            id: asset.combination_id,
            priceCredits: 0,
            visibleToClient: false,
            adminOnly: true,
            isActive: true,
          },
      price: {
        credits: priceCredits,
        isConfigured: priceCredits > 0,
        purchaseReady: asset.status === 'available' && remainingAssignments > 0 && priceCredits > 0,
      },
      assignments: {
        current: Number(asset.current_assignments || 0),
        max: Number(asset.max_assignments || 1),
        remaining: remainingAssignments,
        stockAvailable: asset.status === 'available' && remainingAssignments > 0,
        soldOut: remainingAssignments <= 0,
      },
    }
  })
}




export async function getFactoryAdminImageCycle({
  status = 'all',
  limit = 24,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 24, 80)
  const safeOffset = normalizeOffset(offset)
  const safeStatus = normalizeImageCycleStatus(status)

  const [
    totalImages,
    availableImages,
    qaPendingImages,
    soldImages,
    rejectedImages,
    unpricedAvailableImages,
    imageAssets,
    imageDeliveries,
  ] = await Promise.all([
    countImageAssetsByStatus(),
    countImageAssetsByStatus('available'),
    countImageAssetsByStatus('qa_pending'),
    countImageAssetsByStatus('sold'),
    countImageAssetsByStatus('rejected'),
    listUnpricedAvailableImages(),
    listImageCycleAssets({
      status: safeStatus,
      limit: safeLimit,
      offset: safeOffset,
    }),
    listFactoryAdminDeliveries({
      limit: Math.min(safeLimit * 4, 80),
      offset: 0,
    }),
  ])

  const sanitizedAssets = (imageAssets || []).map(sanitizeImageCycleAsset)
  const sanitizedDeliveries = (imageDeliveries.items || [])
    .filter((delivery) => isAdminImageCycleImage(delivery.asset?.mediaType || delivery.combination?.mediaType))
    .map(sanitizeImageCycleDelivery)

  return {
    readOnly: true,
    safety: buildAdminImageCycleSafety(),
    filters: {
      status: safeStatus || 'all',
      mediaType: 'image',
      limit: safeLimit,
      offset: safeOffset,
    },
    summary: {
      totalImages,
      availableImages,
      qaPendingImages,
      soldImages,
      rejectedImages,
      unpricedAvailableImages: unpricedAvailableImages.length,
      deliveredImageRows: sanitizedDeliveries.length,
    },
    operationalCards: [
      {
        id: 'available',
        label: 'Prontas para vender',
        value: availableImages,
        tone: 'emerald',
        helper: 'Imagens aprovadas e ainda disponíveis na prateleira.',
      },
      {
        id: 'qa_pending',
        label: 'Aguardando revisão',
        value: qaPendingImages,
        tone: qaPendingImages > 0 ? 'amber' : 'zinc',
        helper: 'Precisam de curadoria antes de aparecer para cliente.',
      },
      {
        id: 'sold',
        label: 'Já entregues',
        value: soldImages,
        tone: 'blue',
        helper: 'Imagens que já viraram entrega protegida ou esgotaram o limite.',
      },
      {
        id: 'unpriced',
        label: 'Sem preço',
        value: unpricedAvailableImages.length,
        tone: unpricedAvailableImages.length > 0 ? 'red' : 'zinc',
        helper: 'Disponíveis ao cliente mas sem preço configurado.',
      },
    ],
    assets: sanitizedAssets,
    deliveries: sanitizedDeliveries,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: sanitizedAssets.length,
      hasMore: sanitizedAssets.length === safeLimit,
    },
    operationalGuards: {
      noClientLayoutChange: true,
      noRealClaim: true,
      noCharge: true,
      noR2Operation: true,
      noRunPod: true,
      storageKeysHiddenFromResponse: true,
      clientUsesProtectedViewOnly: true,
    },
    nextActions: [
      'Conferir imagens prontas para vender.',
      'Corrigir preço quando houver item sem valor.',
      'Acompanhar imagens já entregues sem executar nova cobrança.',
      'Manter Live Action bloqueado até renderer protegido homologado.',
    ],
  }
}
// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_END



export async function listFactoryPublishableProducts({
  status = 'available',
  publicationStatus = 'all',
  mediaType = null,
  companionId = null,
  limit = 80,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 80, 200)
  const safeOffset = normalizeOffset(offset)
  const safePublicationStatus = normalizePublicationStatus(publicationStatus)
  const safeMediaType = normalizeMediaType(mediaType)
  const safeStatus = normalizeStatus(status)

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select(`
      id,
      combination_id,
      batch_id,
      batch_item_id,
      companion_id,
      actor_profile_id,
      media_type,
      variant_number,
      status,
      max_assignments,
      current_assignments,
      quality_score,
      published_at,
      created_at,
      updated_at,
      metadata
    `)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit * 2 - 1)

  if (safeStatus && safeStatus !== 'all') {
    if (safeStatus === 'available') query = query.in('status', ['available', 'sold'])
    else query = query.eq('status', safeStatus)
  }

  const mediaAliases = mediaTypeAliases(safeMediaType)
  if (mediaAliases.length === 1) query = query.eq('media_type', mediaAliases[0])
  if (mediaAliases.length > 1) query = query.in('media_type', mediaAliases)
  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar matriz de produtos publicáveis.', error)
  }

  const assets = data || []
  const companionsById = await getRowsByIds(
    'companions',
    assets.map((asset) => asset.companion_id),
    'id, name, slug, avatar_url, thumbnail_url',
  )
  const combinationsById = await getRowsByIds(
    'media_combinations',
    assets.map((asset) => asset.combination_id),
    'id, companion_id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections, metadata',
  )

  const mappedItems = await Promise.all(assets.map(async (asset) => {
    const baseProduct = mapPublishableProductRow({
      asset,
      companion: companionsById.get(asset.companion_id),
      combination: combinationsById.get(asset.combination_id),
    })

    try {
      const priceResolution = await resolveCommercialPriceForAsset({ assetId: asset.id })
      return attachResolvedCommercialPrice(baseProduct, priceResolution)
    } catch (error) {
      console.warn('[factory-admin] Falha ao resolver preço comercial da matriz publicável. Mantendo preço legado.', {
        assetId: asset.id,
        error: error.message,
      })
      return baseProduct
    }
  }))

  const filteredItems = mappedItems.filter((item) => {
    if (safePublicationStatus === 'published') return item.publication.published
    if (safePublicationStatus === 'hidden') return !item.publication.published
    return true
  }).slice(0, safeLimit)

  return {
    items: filteredItems,
    summary: {
      total: mappedItems.length,
      published: mappedItems.filter((item) => item.publication.published).length,
      hidden: mappedItems.filter((item) => !item.publication.published).length,
      approved: mappedItems.filter((item) => item.readiness.approved).length,
      missingPrice: mappedItems.filter((item) => !item.price.isConfigured).length,
    },
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: filteredItems.length,
      hasMore: assets.length > filteredItems.length,
    },
  }
}

export async function updateFactoryPublishableProductPublication(assetId, input = {}, { actorProfileId = null } = {}) {
  if (!assetId) {
    throw new ApiError(400, 'Produto obrigatório para publicação.')
  }

  const shouldPublish = Boolean(input.publish ?? input.visibleToClient ?? input.visible_to_client)
  const now = new Date().toISOString()

  const { data: asset, error: assetError } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (assetError) {
    throw new ApiError(500, 'Erro ao buscar produto para publicação.', assetError)
  }

  if (!asset) {
    throw new ApiError(404, 'Produto não encontrado para publicação.')
  }

  if (!asset.combination_id) {
    throw new ApiError(409, 'Produto ainda não possui assinatura de combinação. Refaça a produção guiada antes de publicar.')
  }

  if (shouldPublish && !isAssetApprovedForPublication(asset)) {
    throw new ApiError(409, 'Apenas produtos aprovados podem ser publicados para cliente.', {
      assetId,
      currentStatus: asset.status,
    })
  }

  const { data: combination, error: combinationError } = await supabaseAdmin
    .from('media_combinations')
    .select('*')
    .eq('id', asset.combination_id)
    .maybeSingle()

  if (combinationError) {
    throw new ApiError(500, 'Erro ao buscar assinatura do produto.', combinationError)
  }

  if (!combination) {
    throw new ApiError(404, 'Assinatura do produto não encontrada.')
  }

  const companion = asset.companion_id
    ? (await getRowsByIds('companions', [asset.companion_id], 'id, name, slug, avatar_url, thumbnail_url')).get(asset.companion_id)
    : null
  const signature = buildProductSignature({ asset, companion, combination })
  const priceCredits = input.priceCredits !== undefined ? Number(input.priceCredits || 0) : Number(combination.price_credits || 0)
  const publicationPayload = {
    status: shouldPublish ? 'published' : 'hidden',
    published: shouldPublish,
    visibleToClient: shouldPublish,
    updatedAt: now,
    updatedByProfileId: actorProfileId,
    assetId: asset.id,
    combinationId: combination.id,
    source: 'admin_publishable_product_matrix',
    signature,
    destination: input.destination || safeObject(safeObject(combination.metadata).productPublication).destination || 'premium',
    description: input.description || safeObject(safeObject(combination.metadata).productPublication).description || combination.description || combination.title || '',
    actorProfileId: input.actorProfileId || null,
    storefrontActorIds: Array.isArray(input.storefrontActorIds) ? input.storefrontActorIds : [],
    splitSummary: safeObject(input.splitSummary),
    note: shouldPublish
      ? 'Produto aprovado publicado para alimentar os prompts dinâmicos do cliente.'
      : 'Produto ocultado dos prompts dinâmicos do cliente.',
  }

  const { data: updatedCombination, error: updateCombinationError } = await supabaseAdmin
    .from('media_combinations')
    .update({
      visible_to_client: shouldPublish,
      admin_only: !shouldPublish,
      is_active: true,
      price_credits: priceCredits,
      updated_at: now,
      metadata: {
        ...safeObject(combination.metadata),
        productPublication: publicationPayload,
        publication: {
          ...safeObject(safeObject(combination.metadata).publication),
          ...publicationPayload,
        },
      },
    })
    .eq('id', combination.id)
    .select('*')
    .maybeSingle()

  if (updateCombinationError) {
    throw new ApiError(500, 'Erro ao atualizar publicação da assinatura do produto.', updateCombinationError)
  }

  const { data: updatedAsset, error: updateAssetError } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .update({
      metadata: {
        ...safeObject(asset.metadata),
        productPublication: publicationPayload,
      },
      updated_at: now,
    })
    .eq('id', asset.id)
    .select('*')
    .maybeSingle()

  if (updateAssetError) {
    throw new ApiError(500, 'Erro ao registrar publicação no produto.', updateAssetError)
  }

  await insertAdminAuditLogSoft({
    actor_profile_id: actorProfileId || null,
    action: shouldPublish ? 'factory.product.publish' : 'factory.product.hide',
    entity_type: ASSETS_TABLE,
    entity_id: asset.id,
    before_payload: {
      assetMetadata: asset.metadata || {},
      combinationVisibleToClient: combination.visible_to_client,
    },
    after_payload: {
      publication: publicationPayload,
      combinationVisibleToClient: updatedCombination?.visible_to_client,
      priceCredits,
    },
    reason: shouldPublish ? 'admin_publish_product_to_dynamic_prompts' : 'admin_hide_product_from_dynamic_prompts',
  })

  const mappedProduct = mapPublishableProductRow({
    asset: updatedAsset || asset,
    companion,
    combination: updatedCombination || combination,
  })

  try {
    const priceResolution = await resolveCommercialPriceForAsset({ assetId: asset.id })
    return attachResolvedCommercialPrice(mappedProduct, priceResolution)
  } catch (error) {
    console.warn('[factory-admin] Publicação atualizada, mas preço comercial resolvido não foi anexado ao retorno.', {
      assetId: asset.id,
      error: error.message,
    })
    return mappedProduct
  }
}


export async function grantFactoryAssetToProfile({
  actorProfileId,
  targetProfileId,
  assetId,
  deliverySource = 'admin_grant',
} = {}) {
  if (!actorProfileId) {
    throw new ApiError(401, 'Administrador autenticado obrigatório para concessão de mídia.')
  }

  if (!targetProfileId) {
    throw new ApiError(400, 'targetProfileId/profileId obrigatório para concessão de mídia.')
  }

  if (!assetId) {
    throw new ApiError(400, 'assetId obrigatório para concessão de mídia.')
  }

  const result = await claimAvailableAssetForProfile({
    profileId: targetProfileId,
    assetId,
    deliverySource,
    requireSubscription: false,
  })

  const { data: auditLog, error: auditError } = await supabaseAdmin
    .from('admin_audit_logs')
    .insert({
      actor_profile_id: actorProfileId,
      action: 'factory.asset.grant',
      entity_type: ASSETS_TABLE,
      entity_id: assetId,
      before_payload: null,
      after_payload: {
        targetProfileId,
        deliverySource,
        result,
      },
      reason: 'admin_grant_without_credit_charge',
    })
    .select('id, action, created_at')
    .maybeSingle()

  if (auditError) {
    throw new ApiError(500, 'Concessão criada, mas falhou ao registrar auditoria administrativa.', {
      assetId,
      targetProfileId,
      auditError: auditError.message,
    })
  }

  return {
    ...result,
    grantedByProfileId: actorProfileId,
    targetProfileId,
    auditLog: auditLog || null,
  }
}
