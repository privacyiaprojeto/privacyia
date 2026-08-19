import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { fetchProtectedAssetPayload, fetchProtectedRenditionPayload } from './media-protection.service.js'
import {
  buildClientMediaContract,
  buildVideoPlaybackReadiness,
  sanitizeClientMediaContract,
} from './media-contract.service.js'
import { buildProtectedPurchaseContract, sanitizeClientPurchaseContract } from './media-purchase-contract.service.js'

const ASSET_VARIANTS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'
const SUBSCRIPTIONS_TABLE = 'companion_subscriptions'
const RENDITIONS_TABLE = 'media_asset_renditions'

function normalizeRpcResult(value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch {
      return { raw: value }
    }
  }

  return value
}

function normalizeDeliverySource(value) {
  const source = String(value || '').trim()

  if (['button', 'album', 'chat', 'admin_grant', 'premium_studio'].includes(source)) {
    return source
  }

  return 'button'
}

function buildClaimIdempotencyKey(profileId, assetId) {
  return `stock-claim:${profileId}:${assetId}`
}

function isMissingRpcError(error) {
  const message = String(error?.message || '')

  return (
    error?.code === 'PGRST202' ||
    /function .*claim_media_asset_without_credits/i.test(message) ||
    /function .*claim_media_asset_with_universal_credits/i.test(message) ||
    /claim_media_asset_without_credits/i.test(message) ||
    /claim_media_asset_with_universal_credits/i.test(message) ||
    /Could not find the function/i.test(message)
  )
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
    throw new ApiError(500, 'Erro ao buscar asset para entrega.', {
      assetId,
      error: error.message,
    })
  }

  if (!data) {
    throw new ApiError(404, 'Asset não encontrado.')
  }

  return data
}

async function getCombinationById(combinationId) {
  if (!combinationId) return null

  const { data, error } = await supabaseAdmin
    .from('media_combinations')
    .select('*')
    .eq('id', combinationId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar combinação da mídia.', {
      combinationId,
      error: error.message,
    })
  }

  return data || null
}

function buildDeliveryMediaContract({ delivery, asset, combination, rendition = null }) {
  return buildClientMediaContract({
    delivery,
    asset,
    combination,
    videoPlaybackReadiness: buildVideoPlaybackReadiness(rendition),
  })
}

function buildSafeDeliveryMediaContract({ delivery, asset, combination, rendition = null }) {
  return sanitizeClientMediaContract(buildDeliveryMediaContract({ delivery, asset, combination, rendition }))
}

function assertDeliveryOpenableByContract({ delivery, asset, combination, rendition = null }) {
  const mediaContract = buildDeliveryMediaContract({ delivery, asset, combination, rendition })

  if (!mediaContract.clientOpenable) {
    throw new ApiError(409, mediaContract.userMessage || 'Esta mídia ainda não está disponível para abertura protegida.', {
      reasonCode: mediaContract.reasonCode,
      severity: mediaContract.severity,
      mediaType: mediaContract.mediaType,
      protectedRenderer: mediaContract.protectedRenderer,
      deliveryId: delivery?.id || null,
      assetId: asset?.id || null,
    })
  }

  return mediaContract
}

async function requireActiveSubscription(profileId, companionId) {
  const { data, error } = await supabaseAdmin
    .from(SUBSCRIPTIONS_TABLE)
    .select('id, status')
    .eq('profile_id', profileId)
    .eq('companion_id', companionId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar assinatura para entrega da mídia.', {
      profileId,
      companionId,
      error: error.message,
    })
  }

  if (!data) {
    throw new ApiError(403, 'Assinatura ativa obrigatória para receber esta mídia.')
  }

  return data
}

async function getDeliveryForProfile(profileId, deliveryId) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório.')
  }

  if (!deliveryId) {
    throw new ApiError(400, 'deliveryId obrigatório.')
  }

  const { data, error } = await supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .eq('id', deliveryId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar entrega de mídia.', {
      profileId,
      deliveryId,
      error: error.message,
    })
  }

  if (!data) {
    throw new ApiError(404, 'Entrega não encontrada para este usuário.')
  }

  return data
}


async function getRenditionForProtectedDelivery({ delivery, asset }) {
  const directRenditionId = delivery.rendition_id || null

  if (directRenditionId) {
    const { data, error } = await supabaseAdmin
      .from(RENDITIONS_TABLE)
      .select('*')
      .eq('id', directRenditionId)
      .eq('status', 'available')
      .maybeSingle()

    if (error) {
      throw new ApiError(500, 'Erro ao buscar rendition vinculada à entrega.', {
        deliveryId: delivery.id,
        renditionId: directRenditionId,
        error: error.message,
      })
    }

    if (data) {
      const expectedMasterAssetId = delivery.master_asset_id || asset.master_asset_id || null

      if (expectedMasterAssetId && data.master_asset_id !== expectedMasterAssetId) {
        throw new ApiError(409, 'Rendition vinculada não pertence ao Master da entrega.', {
          deliveryId: delivery.id,
          renditionId: data.id,
          expectedMasterAssetId,
          receivedMasterAssetId: data.master_asset_id,
        })
      }

      if (data.delivery_id && data.delivery_id !== delivery.id) {
        throw new ApiError(403, 'Rendition vinculada pertence a outra entrega protegida.', {
          deliveryId: delivery.id,
          renditionId: data.id,
        })
      }

      return data
    }
  }

  const masterAssetId = delivery.master_asset_id || asset.master_asset_id || null
  if (!masterAssetId) return null

  const lookup = async (deliveryId = null) => {
    let query = supabaseAdmin
      .from(RENDITIONS_TABLE)
      .select('*')
      .eq('master_asset_id', masterAssetId)
      .eq('rendition_type', 'hls_stream')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .limit(1)

    query = deliveryId ? query.eq('delivery_id', deliveryId) : query.is('delivery_id', null)

    const { data, error } = await query.maybeSingle()
    if (error) {
      throw new ApiError(500, 'Erro ao buscar rendition HLS disponível para entrega.', {
        deliveryId: delivery.id,
        masterAssetId,
        error: error.message,
      })
    }

    return data || null
  }

  return (await lookup(delivery.id)) || (await lookup(null))
}

async function getExistingDeliveryForProfileAsset(profileId, assetId) {
  if (!profileId || !assetId) return null

  const { data, error } = await supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .eq('profile_id', profileId)
    .eq('variant_id', assetId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new ApiError(500, 'Erro ao verificar entrega existente desta mídia.', {
      profileId,
      assetId,
      error: error.message,
    })
  }

  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

function isM48BRealPaidClaimGateOpen() {
  return (
    process.env.ALLOW_M4_8B_EXECUTE_PAID_CLAIM === 'true' &&
    process.env.M4_8B_CONFIRMATION_PHRASE === 'EXECUTAR CLAIM PAGO REAL M4.8B'
  )
}

export async function previewProtectedPurchaseForProfile({
  profileId,
  assetId,
  deliverySource = 'button',
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para prévia de compra de mídia.')
  }

  const asset = await getAssetVariant(assetId)
  const combination = await getCombinationById(asset.combination_id)
  const existingDelivery = await getExistingDeliveryForProfileAsset(profileId, asset.id)

  const purchaseContract = buildProtectedPurchaseContract({
    profileId,
    asset,
    combination,
    existingDelivery,
  })

  const safePurchaseContract = sanitizeClientPurchaseContract(purchaseContract)

  return {
    preview: true,
    deliverySource: normalizeDeliverySource(deliverySource),
    assetId: asset.id,
    combinationId: combination?.id || asset.combination_id || null,
    companionId: asset.companion_id || combination?.companion_id || null,
    existingDeliveryId: existingDelivery?.id || null,
    protectedViewUrl: existingDelivery?.id ? buildProtectedDeliveryUrl(existingDelivery.id) : null,
    purchaseContract: safePurchaseContract,
  }
}

export async function claimAvailableAssetForProfile({
  profileId,
  assetId,
  deliverySource = 'button',
  requireSubscription = true,
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para claim de mídia.')
  }

  const asset = await getAssetVariant(assetId)

  if (requireSubscription) {
    await requireActiveSubscription(profileId, asset.companion_id)
  }

  const { data, error } = await supabaseAdmin.rpc('claim_media_asset_without_credits', {
    p_profile_id: profileId,
    p_variant_id: asset.id,
    p_delivery_source: normalizeDeliverySource(deliverySource),
    p_idempotency_key: buildClaimIdempotencyKey(profileId, asset.id),
    p_media_url: null,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      throw new ApiError(
        500,
        'RPC claim_media_asset_without_credits não instalada. Execute src/db/sql/20260617_claim_media_asset_without_credits.sql no Supabase SQL Editor.',
        error,
      )
    }

    throw new ApiError(500, 'Erro ao executar claim controlado da mídia.', error)
  }

  return normalizeRpcResult(data)
}


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

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

async function getRowsByIds(table, ids, columns = '*') {
  const cleanIds = uniqueValues(ids)

  if (cleanIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .in('id', cleanIds)

  if (!error) {
    return new Map((data || []).map((row) => [row.id, row]))
  }

  // Alguns ambientes antigos não têm todas as colunas opcionais.
  // Para a biblioteca do Cliente, preferimos degradar com segurança em vez de derrubar a tela.
  if (columns !== '*') {
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from(table)
      .select('*')
      .in('id', cleanIds)

    if (!fallbackError) {
      return new Map((fallbackData || []).map((row) => [row.id, row]))
    }
  }

  throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
    table,
    error: error.message,
  })
}

function normalizeGuidedSelections(selections) {
  if (Array.isArray(selections)) {
    return selections
      .map((item, index) => ({
        stepIndex: Number.isInteger(item?.stepIndex) ? item.stepIndex : index,
        titleId: item?.titleId || item?.dimensionId || item?.dimension_id || null,
        titleName: item?.titleName || item?.dimensionName || item?.title || item?.category || 'Opção',
        itemId: item?.itemId || item?.optionId || item?.option_id || item?.id || null,
        itemName: item?.itemName || item?.optionName || item?.name || item?.label || 'Item',
      }))
      .filter((item) => item.itemId || item.itemName)
  }

  if (selections && typeof selections === 'object') {
    return Object.entries(selections)
      .map(([key, value], index) => {
        if (value && typeof value === 'object') {
          return {
            stepIndex: index,
            titleId: value.titleId || value.dimensionId || key,
            titleName: value.titleName || value.dimensionName || key,
            itemId: value.itemId || value.optionId || value.id || null,
            itemName: value.itemName || value.optionName || value.name || value.label || String(value.itemId || value.optionId || value.id || ''),
          }
        }

        return {
          stepIndex: index,
          titleId: key,
          titleName: key,
          itemId: String(value || ''),
          itemName: String(value || ''),
        }
      })
      .filter((item) => item.itemId || item.itemName)
  }

  return []
}

function getCombinationSignature(combination = {}) {
  return normalizeGuidedSelections(combination?.guided_selections || combination?.metadata?.guidedSelections || [])
}

function getSignaturePath(combination = {}) {
  return getCombinationSignature(combination).map((item) => `${item.titleName}: ${item.itemName}`)
}

function buildProtectedDeliveryUrl(deliveryId) {
  return `/media/deliveries/${deliveryId}/protected-view`
}

function buildDeliveryPlaybackState({ delivery, asset, combination, rendition }) {
  const contract = buildDeliveryMediaContract({ delivery, asset, combination, rendition })
  const renderer = String(contract.protectedRenderer || '').toLowerCase()
  const mediaType = String(contract.mediaType || asset?.media_type || combination?.media_type || '').toLowerCase()
  const isVideo = renderer === 'video' || renderer === 'live_action' || mediaType.includes('video') || mediaType.includes('live_action')
  const isAudio = renderer === 'audio' || mediaType.includes('audio')

  if (!contract.clientOpenable) {
    if (contract.reasonCode === 'VIDEO_HLS_RENDITION_NOT_READY') {
      return {
        mediaStatus: 'processing',
        streamKind: null,
        userMessage: contract.userMessage || 'Vídeo em preparação. A rendition HLS ainda não está disponível.',
      }
    }

    return {
      mediaStatus: 'unavailable',
      streamKind: null,
      userMessage: contract.userMessage || 'Mídia indisponível.',
    }
  }

  if (isVideo && !rendition) {
    return {
      mediaStatus: 'processing',
      streamKind: null,
      userMessage: 'Vídeo em preparação. A rendition HLS ainda não está disponível.',
    }
  }

  return {
    mediaStatus: 'ready',
    streamKind: rendition?.rendition_type === 'hls_stream' ? 'hls' : isAudio ? 'audio' : 'image',
    userMessage: 'Disponível.',
  }
}

function mapAssetCatalogItem({ asset, companion, combination }) {
  const currentAssignments = Number(asset.current_assignments || 0)
  const maxAssignments = Number(asset.max_assignments || 1)
  const remainingAssignments = Math.max(maxAssignments - currentAssignments, 0)
  const priceCredits = Number(combination?.price_credits || 0)
  const stockAvailable = asset.status === 'available' && remainingAssignments > 0
  const priceConfigured = priceCredits > 0

  return {
    id: asset.id,
    mediaType: asset.media_type,
    status: asset.status,
    variantNumber: asset.variant_number,
    qualityScore: asset.quality_score || null,
    publishedAt: asset.published_at || null,
    createdAt: asset.created_at || null,
    availability: {
      currentAssignments,
      maxAssignments,
      remainingAssignments,
      stockAvailable,
      claimable: stockAvailable && priceConfigured,
      requiresPricing: stockAvailable && !priceConfigured,
    },
    price: {
      credits: priceCredits,
      isConfigured: priceConfigured,
      purchaseReady: stockAvailable && priceConfigured,
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
          priceCredits: Number(combination.price_credits || 0),
        }
      : {
          id: asset.combination_id,
        },
  }
}

function mapDeliveryItem({ delivery, asset, companion, combination, galleryItem, rendition = null }) {
  return {
    id: delivery.id,
    createdAt: delivery.created_at || null,
    deliverySource: delivery.delivery_source || null,
    protectedViewUrl: buildProtectedDeliveryUrl(delivery.id),
    pricing: {
      totalPriceCredits: Number(delivery.total_price_credits || 0),
      companionCreditsUsed: Number(delivery.companion_credits_used || 0),
      universalCreditsUsed: Number(delivery.universal_credits_used || 0),
    },
    asset: asset
      ? {
          mediaType: asset.media_type,
          status: asset.status,
          variantNumber: asset.variant_number,
          publishedAt: asset.published_at || null,
        }
      : {
          mediaType: null,
          status: null,
          variantNumber: null,
          publishedAt: null,
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
          id: delivery.companion_id,
        },
    combination: combination
      ? {
          id: combination.id,
          key: combination.combination_key || null,
          title: combination.title || null,
          mediaType: combination.media_type || asset?.media_type || null,
          priceCredits: Number(combination.price_credits || 0),
          signature: getCombinationSignature(combination),
          signaturePath: getSignaturePath(combination),
        }
      : {
          id: delivery.combination_id,
        },
    galleryItem: galleryItem
      ? {
          id: galleryItem.id,
          source: galleryItem.source || null,
          createdAt: galleryItem.created_at || null,
        }
      : null,
    mediaPlayback: buildDeliveryPlaybackState({
      delivery,
      asset,
      combination,
      rendition,
    }),
    mediaContract: buildSafeDeliveryMediaContract({
      delivery,
      asset,
      combination,
      rendition,
    }),
  }
}

export async function listAvailableMediaAssets({
  profileId,
  companionId = null,
  mediaType = null,
  limit = 30,
  offset = 0,
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para listar mídias disponíveis.')
  }

  const safeLimit = normalizePositiveInteger(limit, 30, 100)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .select('id, combination_id, companion_id, media_type, variant_number, status, max_assignments, current_assignments, quality_score, published_at, created_at')
    .eq('status', 'available')
    .order('published_at', { ascending: false, nullsFirst: false })
    .range(safeOffset, safeOffset + safeLimit * 3 - 1)

  if (companionId) {
    query = query.eq('companion_id', companionId)
  }

  if (mediaType) {
    query = query.eq('media_type', mediaType)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar mídias disponíveis.', error)
  }

  const claimableAssets = (data || [])
    .filter((asset) => Number(asset.current_assignments || 0) < Number(asset.max_assignments || 1))
    .slice(0, safeLimit)

  const companionsById = await getRowsByIds(
    'companions',
    claimableAssets.map((asset) => asset.companion_id),
    'id, name, slug, avatar_url, thumbnail_url',
  )

  const combinationsById = await getRowsByIds(
    'media_combinations',
    claimableAssets.map((asset) => asset.combination_id),
    'id, combination_key, title, media_type, price_credits, guided_selections, metadata',
  )

  return {
    items: claimableAssets.map((asset) => mapAssetCatalogItem({
      asset,
      companion: companionsById.get(asset.companion_id),
      combination: combinationsById.get(asset.combination_id),
    })),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: claimableAssets.length,
      hasMore: (data || []).length > claimableAssets.length,
    },
  }
}

async function getAvailableDeliveryRenditions(deliveries = [], assetsById = new Map()) {
  const directIds = uniqueValues(deliveries.map((delivery) => delivery.rendition_id))
  const masterIds = uniqueValues(deliveries.map((delivery) => (
    delivery.master_asset_id || assetsById.get(delivery.variant_id)?.master_asset_id || null
  )))
  const byId = new Map()
  const byMaster = new Map()

  if (directIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from(RENDITIONS_TABLE)
      .select('*')
      .in('id', directIds)
      .eq('status', 'available')
    if (error) throw new ApiError(500, 'Erro ao carregar renditions diretas das entregas.', error)
    for (const item of data || []) byId.set(item.id, item)
  }

  if (masterIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from(RENDITIONS_TABLE)
      .select('*')
      .in('master_asset_id', masterIds)
      .eq('rendition_type', 'hls_stream')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
    if (error) throw new ApiError(500, 'Erro ao carregar renditions HLS das entregas.', error)
    for (const item of data || []) {
      const key = `${item.master_asset_id}:${item.delivery_id || 'shared'}`
      if (!byMaster.has(key)) byMaster.set(key, item)
    }
  }

  return new Map(deliveries.map((delivery) => {
    const asset = assetsById.get(delivery.variant_id)
    const masterId = delivery.master_asset_id || asset?.master_asset_id || null
    const direct = delivery.rendition_id ? byId.get(delivery.rendition_id) || null : null
    const deliverySpecific = masterId ? byMaster.get(`${masterId}:${delivery.id}`) || null : null
    const shared = masterId ? byMaster.get(`${masterId}:shared`) || null : null
    return [delivery.id, direct || deliverySpecific || shared]
  }))
}

export async function listProfileMediaDeliveries({
  profileId,
  companionId = null,
  mediaType = null,
  limit = 30,
  offset = 0,
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para listar entregas.')
  }

  const safeLimit = normalizePositiveInteger(limit, 30, 100)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('id, profile_id, companion_id, combination_id, variant_id, master_asset_id, rendition_id, total_price_credits, companion_credits_used, universal_credits_used, companion_credit_ledger_id, universal_credit_ledger_id, delivery_source, created_at')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  if (companionId) {
    query = query.eq('companion_id', companionId)
  }

  const { data: deliveries, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar entregas de mídia.', error)
  }

  const assetIds = (deliveries || []).map((delivery) => delivery.variant_id)
  const assetsById = await getRowsByIds(
    ASSET_VARIANTS_TABLE,
    assetIds,
    '*',
  )

  const filteredDeliveries = mediaType
    ? (deliveries || []).filter((delivery) => assetsById.get(delivery.variant_id)?.media_type === mediaType)
    : (deliveries || [])

  const renditionsByDeliveryId = await getAvailableDeliveryRenditions(filteredDeliveries, assetsById)

  const companionsById = await getRowsByIds(
    'companions',
    filteredDeliveries.map((delivery) => delivery.companion_id),
    'id, name, slug, avatar_url, thumbnail_url',
  )

  const combinationsById = await getRowsByIds(
    'media_combinations',
    filteredDeliveries.map((delivery) => delivery.combination_id),
    '*',
  )

  const deliveryIds = filteredDeliveries.map((delivery) => delivery.id)
  let galleryByDeliveryId = new Map()

  if (deliveryIds.length > 0) {
    const { data: galleryItems, error: galleryError } = await supabaseAdmin
      .from('gallery_items')
      .select('id, delivery_id, media_url, source, created_at')
      .in('delivery_id', deliveryIds)

    if (galleryError) {
      throw new ApiError(500, 'Erro ao listar itens da galeria vinculados às entregas.', galleryError)
    }

    galleryByDeliveryId = new Map((galleryItems || []).map((item) => [item.delivery_id, item]))
  }

  return {
    items: filteredDeliveries.map((delivery) => {
      const asset = assetsById.get(delivery.variant_id)

      return mapDeliveryItem({
        delivery,
        asset,
        companion: companionsById.get(delivery.companion_id),
        combination: combinationsById.get(delivery.combination_id),
        galleryItem: galleryByDeliveryId.get(delivery.id),
        rendition: renditionsByDeliveryId.get(delivery.id) || null,
      })
    }),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: filteredDeliveries.length,
      hasMore: (deliveries || []).length === safeLimit,
    },
  }
}

export async function claimAvailableAssetForProfileWithCredits({
  profileId,
  assetId,
  deliverySource = 'button',
  requireSubscription = true,
  priceOverrideCredits = null,
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para claim pago de mídia.')
  }

  const purchasePreview = await previewProtectedPurchaseForProfile({
    profileId,
    assetId,
    deliverySource,
  })

  const purchaseContract = purchasePreview.purchaseContract

  if (purchaseContract.alreadyDelivered) {
    return {
      alreadyDelivered: true,
      preview: false,
      paymentAction: purchaseContract.paymentAction,
      purchaseContract,
      deliveryId: purchasePreview.existingDeliveryId,
      protectedViewUrl: purchasePreview.protectedViewUrl,
      assetId: purchasePreview.assetId,
      combinationId: purchasePreview.combinationId,
      companionId: purchasePreview.companionId,
    }
  }

  if (!purchaseContract.canCharge || !purchaseContract.clientPurchasable) {
    throw new ApiError(409, purchaseContract.userMessage || 'Esta mídia ainda não está disponível para compra.', {
      reasonCode: purchaseContract.reasonCode,
      severity: purchaseContract.severity,
      purchaseContract,
    })
  }

  if (!isM48BRealPaidClaimGateOpen()) {
    throw new ApiError(409, 'Compra real ainda está em validação segura. Use preview=true para validar antes de cobrar.', {
      reasonCode: 'PURCHASE_REAL_CLAIM_GATED_M4_8B',
      requiredEnv: 'ALLOW_M4_8B_EXECUTE_PAID_CLAIM=true',
      requiredPhrase: 'EXECUTAR CLAIM PAGO REAL M4.8B',
      purchaseContract,
    })
  }

  const asset = await getAssetVariant(assetId)

  if (requireSubscription) {
    await requireActiveSubscription(profileId, asset.companion_id)
  }

  const priceOverride =
    priceOverrideCredits === null || priceOverrideCredits === undefined || priceOverrideCredits === ''
      ? null
      : Number(priceOverrideCredits)

  if (priceOverride !== null && (!Number.isInteger(priceOverride) || priceOverride < 0)) {
    throw new ApiError(400, 'priceOverrideCredits inválido para claim pago.')
  }

  if (priceOverride !== null && priceOverride !== purchaseContract.priceCredits) {
    throw new ApiError(409, 'Preço informado não confere com o contrato de compra atual.', {
      reasonCode: 'PRICE_OVERRIDE_MISMATCH',
      expectedPriceCredits: purchaseContract.priceCredits,
      receivedPriceCredits: priceOverride,
    })
  }

  const { data, error } = await supabaseAdmin.rpc('claim_media_asset_with_universal_credits', {
    p_profile_id: profileId,
    p_variant_id: asset.id,
    p_delivery_source: normalizeDeliverySource(deliverySource),
    p_idempotency_key: purchaseContract.idempotencyKey || `paid-${buildClaimIdempotencyKey(profileId, asset.id)}`,
    p_media_url: null,
    p_price_override_credits: priceOverride,
  })

  if (error) {
    if (isMissingRpcError(error)) {
      throw new ApiError(
        500,
        'RPC claim_media_asset_with_universal_credits não instalada. Execute src/db/sql/20260617_claim_media_asset_with_universal_credits.sql no Supabase SQL Editor.',
        error,
      )
    }

    if (/pre[cç]o .*n[aã]o configurado|pre[cç]o .*inv[aá]lido|pre[cç]o .*cr[eé]ditos/i.test(String(error.message || ''))) {
      throw new ApiError(409, 'Preço da mídia não configurado para venda. Ajuste media_combinations.price_credits antes de liberar o claim pago.', error)
    }

    if (/cr[eé]ditos insuficientes/i.test(String(error.message || ''))) {
      throw new ApiError(409, 'Créditos insuficientes para receber esta mídia.', error)
    }

    throw new ApiError(500, 'Erro ao executar claim pago da mídia.', error)
  }

  return normalizeRpcResult(data)
}

export async function getProtectedDeliveryMediaDescriptor({
  profileId,
  deliveryId,
} = {}) {
  const delivery = await getDeliveryForProfile(profileId, deliveryId)
  const asset = await getAssetVariant(delivery.variant_id)
  const combination = await getCombinationById(delivery.combination_id || asset.combination_id)
  const rendition = await getRenditionForProtectedDelivery({ delivery, asset })
  const mediaContract = buildDeliveryMediaContract({ delivery, asset, combination, rendition })

  if (mediaContract.reasonCode === 'VIDEO_HLS_RENDITION_NOT_READY') {
    return {
      deliveryId: delivery.id,
      assetId: asset.id,
      masterAssetId: delivery.master_asset_id || asset.master_asset_id || null,
      mediaStatus: 'processing',
      streamKind: null,
      mediaType: mediaContract.mediaType || asset.media_type || combination?.media_type || null,
      protectedRenderer: 'video',
      userMessage: mediaContract.userMessage,
    }
  }

  assertDeliveryOpenableByContract({ delivery, asset, combination, rendition })

  if (['rejected', 'deleted', 'archived'].includes(asset.status)) {
    return {
      deliveryId: delivery.id,
      assetId: asset.id,
      mediaStatus: 'unavailable',
      streamKind: null,
      mediaType: mediaContract.mediaType || asset.media_type || combination?.media_type || null,
      protectedRenderer: mediaContract.protectedRenderer || null,
      userMessage: 'Esta mídia não está mais disponível.',
    }
  }

  const renderer = String(mediaContract.protectedRenderer || '').toLowerCase()
  const isVideo = renderer === 'video' || renderer === 'live_action' || String(asset.media_type || '').toLowerCase().includes('video')
  const isAudio = renderer === 'audio' || String(asset.media_type || '').toLowerCase().includes('audio')

  if (isVideo && !rendition) {
    return {
      deliveryId: delivery.id,
      assetId: asset.id,
      masterAssetId: delivery.master_asset_id || asset.master_asset_id || null,
      mediaStatus: 'processing',
      streamKind: null,
      mediaType: mediaContract.mediaType || asset.media_type || combination?.media_type || null,
      protectedRenderer: 'video',
      userMessage: 'Vídeo em preparação. O streaming HLS será liberado quando a rendition estiver pronta.',
    }
  }

  return {
    deliveryId: delivery.id,
    assetId: asset.id,
    masterAssetId: delivery.master_asset_id || asset.master_asset_id || null,
    renditionId: rendition?.id || null,
    mediaStatus: 'ready',
    streamKind: rendition?.rendition_type === 'hls_stream' ? 'hls' : isAudio ? 'audio' : 'image',
    mediaType: mediaContract.mediaType || asset.media_type || combination?.media_type || null,
    protectedRenderer: mediaContract.protectedRenderer || (isAudio ? 'audio' : 'image'),
    userMessage: 'Disponível.',
  }
}

export async function streamProtectedDelivery({
  profileId,
  deliveryId,
  requestContext = {},
  range = null,
} = {}) {
  const delivery = await getDeliveryForProfile(profileId, deliveryId)
  const asset = await getAssetVariant(delivery.variant_id)
  const combination = await getCombinationById(delivery.combination_id || asset.combination_id)
  const rendition = await getRenditionForProtectedDelivery({ delivery, asset })

  assertDeliveryOpenableByContract({
    delivery,
    asset,
    combination,
    rendition,
  })

  if (['rejected', 'deleted', 'archived'].includes(asset.status)) {
    throw new ApiError(409, 'Asset não está disponível para visualização protegida.', {
      assetId: asset.id,
      status: asset.status,
    })
  }

  const commonInput = {
    actorProfileId: profileId,
    requestId: requestContext.requestId || null,
    ip: requestContext.ip || null,
    userAgent: requestContext.userAgent || null,
    range,
    expiresIn: requestContext.expiresIn || 120,
    watermarkLabel: requestContext.watermarkLabel || 'PRIVACY IA',
    source: 'media_delivery_protected_view',
    asset,
    delivery,
  }

  if (rendition) {
    return fetchProtectedRenditionPayload(rendition, commonInput)
  }

  const protectedRenderer = String(buildDeliveryMediaContract({ delivery, asset, combination, rendition }).protectedRenderer || '').toLowerCase()
  const isVideoDelivery = protectedRenderer === 'video' || protectedRenderer === 'live_action' || String(asset.media_type || '').toLowerCase().includes('video')
  if (isVideoDelivery) {
    throw new ApiError(409, 'Vídeo em preparação. A rendition HLS protegida ainda não está disponível.', {
      code: 'HLS_RENDITION_PROCESSING',
      mediaStatus: 'processing',
      deliveryId: delivery.id,
      assetId: asset.id,
    })
  }

  return fetchProtectedAssetPayload(asset.id, {
    ...commonInput,
    allowedStatuses: ['available', 'reserved', 'sold'],
  })
}
