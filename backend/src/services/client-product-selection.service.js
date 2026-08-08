import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { getDynamicPromptCascadeOptions } from './dynamic-prompt.service.js'
import { resolveCommercialPriceForAsset } from './commercial-pricing.service.js'
import { claimAvailableAssetForProfileWithCredits } from './media-delivery.service.js'

const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'
const DELIVERIES_TABLE = 'user_media_deliveries'

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizePositiveInteger(value, fallback = 200, max = 500) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function mediaTypeAliases(value) {
  const normalized = normalizeText(value)
  if (!normalized || normalized === 'all') return []
  if (['image', 'imagem', 'foto', 'photo', 'picture', 'img'].includes(normalized)) return ['image', 'imagem', 'foto', 'photo', 'picture', 'img']
  if (['audio', 'áudio', 'live_audio', 'voice'].includes(normalized)) return ['audio', 'áudio', 'live_audio', 'voice']
  if (['video', 'vídeo', 'short_video', 'live_action'].includes(normalized)) return ['video', 'vídeo', 'short_video', 'live_action']
  return [String(value || '').trim()]
}

function normalizeSelectedInput(selections) {
  if (!selections) return []

  if (typeof selections === 'string') {
    try {
      return normalizeSelectedInput(JSON.parse(selections))
    } catch {
      return []
    }
  }

  if (Array.isArray(selections)) {
    return selections
      .map((item) => ({
        titleId: item?.titleId || item?.dimensionId || item?.dimension_id || null,
        titleName: item?.titleName || item?.dimensionName || item?.title || item?.category || null,
        itemId: item?.itemId || item?.optionId || item?.option_id || item?.id || null,
        itemName: item?.itemName || item?.optionName || item?.name || item?.label || null,
      }))
      .filter((item) => (item.titleId || item.titleName) && (item.itemId || item.itemName))
  }

  if (selections && typeof selections === 'object') {
    return Object.entries(selections)
      .map(([key, value]) => {
        if (value && typeof value === 'object') {
          return {
            titleId: value.titleId || value.dimensionId || key,
            titleName: value.titleName || value.dimensionName || key,
            itemId: value.itemId || value.optionId || value.id || null,
            itemName: value.itemName || value.optionName || value.name || value.label || null,
          }
        }

        return {
          titleId: null,
          titleName: key,
          itemId: null,
          itemName: String(value || ''),
        }
      })
      .filter((item) => (item.titleId || item.titleName) && (item.itemId || item.itemName))
  }

  return []
}

function normalizeGuidedSelections(selections) {
  if (Array.isArray(selections)) {
    return selections
      .map((item) => ({
        titleId: item?.titleId || item?.dimensionId || item?.dimension_id || null,
        titleName: item?.titleName || item?.dimensionName || item?.title || item?.category || 'Título',
        itemId: item?.itemId || item?.optionId || item?.option_id || item?.id || null,
        itemName: item?.itemName || item?.optionName || item?.name || item?.label || 'Item',
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
          }
        }

        return {
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

function getPublicationMetadata(asset = {}, combination = {}) {
  const assetMetadata = safeObject(asset.metadata)
  const combinationMetadata = safeObject(combination.metadata)

  return {
    asset: safeObject(assetMetadata.productPublication || assetMetadata.clientPublication),
    combination: safeObject(combinationMetadata.productPublication || combinationMetadata.publication),
  }
}

function isPublishedForClient(asset = {}, combination = {}) {
  const publicationMetadata = getPublicationMetadata(asset, combination)
  const publicationStatus = publicationMetadata.asset.status || publicationMetadata.combination.status || null

  if (publicationStatus === 'hidden') return false
  if (publicationStatus === 'published') return true

  return combination?.visible_to_client === true && combination?.admin_only !== true && combination?.is_active !== false
}

function signatureFromCombination(combination = {}) {
  return normalizeGuidedSelections(combination.guided_selections || combination.metadata?.guidedSelections || [])
    .map((item) => ({
      titleId: item.titleId,
      titleName: item.titleName,
      itemId: item.itemId,
      itemName: item.itemName,
    }))
}

function containsForbiddenPrivateFields(value) {
  const serialized = JSON.stringify(value || {}).toLowerCase()
  return [
    'assetid',
    'asset_id',
    'variant_id',
    'r2_key',
    'r2key',
    'bucket',
    'publicurl',
    'signedurl',
    'downloadurl',
    'viewurl',
    'protectedviewurl',
  ].some((term) => serialized.includes(term))
}

function pickDeterministicVariation(assets = [], seed = '') {
  if (assets.length === 0) return null
  if (assets.length === 1) return assets[0]

  const hash = createHash('sha256').update(seed || `${Date.now()}`).digest('hex')
  const index = Number.parseInt(hash.slice(0, 8), 16) % assets.length
  return assets[index]
}

async function getCombination(combinationId) {
  if (!combinationId) throw new ApiError(400, 'Combinação obrigatória para preparar entrega.')

  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select('id, companion_id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections, metadata')
    .eq('id', combinationId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao buscar combinação para preparação de entrega.', error)
  if (!data) throw new ApiError(404, 'Combinação não encontrada para preparação de entrega.')

  return data
}

async function getPublishedAssetsForCombination({ combination, mediaType = null, limit = 100, statuses = ['available', 'sold'] } = {}) {
  const mediaAliases = mediaTypeAliases(mediaType || combination?.media_type)
  const safeLimit = normalizePositiveInteger(limit, 100, 300)

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, combination_id, companion_id, media_type, status, variant_number, max_assignments, current_assignments, metadata, created_at')
    .eq('combination_id', combination.id)
    .in('status', statuses)
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (mediaAliases.length === 1) query = query.eq('media_type', mediaAliases[0])
  if (mediaAliases.length > 1) query = query.in('media_type', mediaAliases)

  const { data, error } = await query
  if (error) throw new ApiError(500, 'Erro ao buscar variações publicadas da combinação.', error)

  return (data || []).filter((asset) => isPublishedForClient(asset, combination))
}

async function getExistingDelivery({ profileId, combinationId, companionId }) {
  if (!profileId || !combinationId) return null

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('id, created_at, delivery_source, total_price_credits, companion_id, combination_id')
    .eq('profile_id', profileId)
    .eq('combination_id', combinationId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query.maybeSingle()

  if (error) {
    console.warn('[client-product-selection] Falha ao verificar entrega existente. Seguindo como nova compra.', {
      profileId,
      combinationId,
      error: error.message,
    })
    return null
  }

  return data || null
}


function buildProtectedDeliveryUrl(deliveryId) {
  return `/media/deliveries/${deliveryId}/protected-view`
}

function containsForbiddenClaimFields(value) {
  const serialized = JSON.stringify(value || {}).toLowerCase()
  return [
    'assetid',
    'asset_id',
    'variant_id',
    'r2_key',
    'r2key',
    'bucket',
    'publicurl',
    'signedurl',
    'downloadurl',
  ].some((term) => serialized.includes(term))
}

function isRetryableAssetClaimError(error) {
  const message = String(error?.message || error?.details?.message || '')

  return /asset n[aã]o est[aá] dispon[ií]vel|sem saldo|status atual|assignments/i.test(message)
}

function orderAssetsDeterministically(assets = [], seed = '') {
  if (assets.length <= 1) return assets

  const hash = createHash('sha256').update(seed || 'privacy-ia').digest('hex')
  const startIndex = Number.parseInt(hash.slice(0, 8), 16) % assets.length

  return [...assets.slice(startIndex), ...assets.slice(0, startIndex)]
}

function mapExistingDeliveryResult({ delivery, combination, price = null, signature = [] }) {
  return {
    ok: true,
    charged: false,
    alreadyDelivered: true,
    deliveryId: delivery.id,
    protectedViewUrl: buildProtectedDeliveryUrl(delivery.id),
    companionId: delivery.companion_id || combination?.companion_id || null,
    mediaType: combination?.media_type || null,
    combinationId: delivery.combination_id || combination?.id || null,
    price: {
      credits: Number(delivery.total_price_credits || price?.credits || 0),
      source: price?.source || 'previous_delivery',
      sourceLabel: 'Entrega já comprada anteriormente',
    },
    signature,
    guidance: 'Cliente já possui esta combinação. A mídia foi liberada sem nova cobrança.',
  }
}

function mapClaimResult({ claim, combination, selectedAsset, price, signature = [] }) {
  const result = {
    ok: true,
    charged: Boolean(claim?.charged),
    alreadyDelivered: Boolean(claim?.alreadyDelivered),
    deliveryId: claim?.deliveryId || null,
    galleryItemId: claim?.galleryItemId || null,
    protectedViewUrl: claim?.deliveryId ? buildProtectedDeliveryUrl(claim.deliveryId) : null,
    companionId: combination?.companion_id || selectedAsset?.companion_id || null,
    mediaType: combination?.media_type || selectedAsset?.media_type || null,
    combinationId: combination?.id || selectedAsset?.combination_id || null,
    price: {
      credits: Number(claim?.priceCredits || price?.credits || 0),
      source: price?.source || 'not_configured',
      sourceLabel: price?.sourceLabel || null,
    },
    balance: {
      before: claim?.balanceBefore ?? null,
      after: claim?.balanceAfter ?? null,
    },
    signature,
    guidance: claim?.charged
      ? 'Compra concluída. A mídia foi adicionada à biblioteca do cliente.'
      : 'Mídia já estava disponível para este cliente. Nenhuma nova cobrança foi feita.',
  }

  if (containsForbiddenClaimFields(result)) {
    throw new ApiError(500, 'Entrega dinâmica tentou expor asset interno ou storage privado.', {
      reason: 'private_field_guard',
    })
  }

  return result
}

async function getClaimablePublishedAssetsForCombination({ combination, mediaType = null, limit = 100 } = {}) {
  const assets = await getPublishedAssetsForCombination({
    combination,
    mediaType,
    limit,
    statuses: ['available'],
  })

  return assets.filter((asset) => Number(asset.current_assignments || 0) < Number(asset.max_assignments || 1))
}

async function resolveCombinationFromCascade({ companionId, mediaType, selections, limit }) {
  const cascade = await getDynamicPromptCascadeOptions({ companionId, mediaType, selections, limit })

  if (!cascade.selectionComplete) {
    return {
      cascade,
      combinationId: null,
      ready: false,
      reason: 'selection_incomplete',
    }
  }

  if (cascade.completedCombinations.length !== 1) {
    return {
      cascade,
      combinationId: null,
      ready: false,
      reason: cascade.completedCombinations.length > 1 ? 'ambiguous_selection' : 'no_combination',
    }
  }

  return {
    cascade,
    combinationId: cascade.completedCombinations[0].combinationId,
    ready: true,
    reason: 'complete',
  }
}

export async function prepareDynamicPromptProductSelection({
  profileId = null,
  companionId = null,
  mediaType = null,
  selections = [],
  combinationId = null,
  limit = 300,
} = {}) {
  const selected = normalizeSelectedInput(selections)
  const cascadeResolution = combinationId
    ? { cascade: null, combinationId, ready: true, reason: 'direct_combination' }
    : await resolveCombinationFromCascade({ companionId, mediaType, selections: selected, limit })

  if (!cascadeResolution.ready) {
    return {
      readyToContinue: false,
      readyToBuy: false,
      reason: cascadeResolution.reason,
      cascade: cascadeResolution.cascade,
      guidance: cascadeResolution.reason === 'selection_incomplete'
        ? 'A escolha ainda não está completa. Continue preenchendo os quadradinhos.'
        : 'Não foi possível preparar uma entrega única para esse caminho.',
    }
  }

  const combination = await getCombination(cascadeResolution.combinationId)
  const effectiveCompanionId = companionId || combination.companion_id || null

  if (effectiveCompanionId && combination.companion_id && effectiveCompanionId !== combination.companion_id) {
    throw new ApiError(409, 'Combinação não pertence ao avatar selecionado.')
  }

  const assets = await getPublishedAssetsForCombination({ combination, mediaType, limit })
  if (assets.length === 0) {
    return {
      readyToContinue: false,
      readyToBuy: false,
      reason: 'no_published_variation',
      combinationId: combination.id,
      guidance: 'A combinação existe, mas não possui variação aprovada e publicada para venda.',
    }
  }

  const existingDelivery = await getExistingDelivery({
    profileId,
    combinationId: combination.id,
    companionId: effectiveCompanionId,
  })

  const selectedAsset = existingDelivery
    ? assets[0]
    : pickDeterministicVariation(assets, `${profileId || 'anonymous'}:${combination.id}:${selected.map((item) => `${item.titleName}:${item.itemName}`).join('|')}`)

  const priceResolution = await resolveCommercialPriceForAsset({ assetId: selectedAsset.id })
  const price = priceResolution.price || {}
  const signature = signatureFromCombination(combination)

  const result = {
    readyToContinue: true,
    readyToBuy: Boolean(price.sellable),
    reason: price.sellable ? 'ready' : 'price_not_configured',
    companionId: effectiveCompanionId,
    mediaType: combination.media_type || mediaType || null,
    combinationId: combination.id,
    alreadyDeliveredToClient: Boolean(existingDelivery),
    previousDelivery: existingDelivery
      ? {
          id: existingDelivery.id,
          createdAt: existingDelivery.created_at || null,
          totalPriceCredits: Number(existingDelivery.total_price_credits || 0),
        }
      : null,
    price: {
      credits: Number(price.credits || 0),
      isConfigured: Boolean(price.isConfigured),
      sellable: Boolean(price.sellable),
      source: price.source || 'not_configured',
      sourceLabel: price.sourceLabel || 'Preço não configurado',
    },
    signature,
    variationPool: {
      availableVariations: assets.length,
      selectionMode: 'deterministic_random_after_payment',
      selectedVariationNumber: selectedAsset.variant_number || null,
      note: 'O asset interno só será usado na cobrança/entrega definitiva. Ele não é exposto nesta preparação.',
    },
    guidance: existingDelivery
      ? 'Cliente já possui uma entrega desta combinação. A próxima etapa deve abrir a biblioteca, sem cobrar novamente.'
      : price.sellable
        ? 'Combinação pronta para a etapa de cobrança/entrega definitiva.'
        : 'Combinação pronta, mas venda bloqueada porque o preço não está configurado.',
  }

  if (containsForbiddenPrivateFields(result)) {
    throw new ApiError(500, 'Preparação de entrega tentou expor campo interno ou storage privado.', {
      reason: 'private_field_guard',
    })
  }

  return result
}


export async function claimDynamicPromptProductSelection({
  profileId,
  companionId = null,
  mediaType = null,
  selections = [],
  combinationId = null,
  deliverySource = 'button',
  limit = 300,
  requireSubscription = true,
} = {}) {
  if (!profileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para compra da mídia.')
  }

  const selected = normalizeSelectedInput(selections)
  const cascadeResolution = combinationId
    ? { cascade: null, combinationId, ready: true, reason: 'direct_combination' }
    : await resolveCombinationFromCascade({ companionId, mediaType, selections: selected, limit })

  if (!cascadeResolution.ready) {
    return {
      ok: false,
      charged: false,
      alreadyDelivered: false,
      readyToBuy: false,
      reason: cascadeResolution.reason,
      cascade: cascadeResolution.cascade,
      guidance: cascadeResolution.reason === 'selection_incomplete'
        ? 'A escolha ainda não está completa. Continue preenchendo os quadradinhos.'
        : 'Não foi possível encontrar uma combinação única para compra.',
    }
  }

  const combination = await getCombination(cascadeResolution.combinationId)
  const effectiveCompanionId = companionId || combination.companion_id || null

  if (effectiveCompanionId && combination.companion_id && effectiveCompanionId !== combination.companion_id) {
    throw new ApiError(409, 'Combinação não pertence ao avatar selecionado.')
  }

  const signature = signatureFromCombination(combination)
  const existingDelivery = await getExistingDelivery({
    profileId,
    combinationId: combination.id,
    companionId: effectiveCompanionId,
  })

  if (existingDelivery) {
    return mapExistingDeliveryResult({
      delivery: existingDelivery,
      combination,
      signature,
    })
  }

  const assets = await getClaimablePublishedAssetsForCombination({
    combination,
    mediaType,
    limit,
  })

  if (assets.length === 0) {
    throw new ApiError(409, 'Não há variação aprovada e publicada disponível para esta combinação no momento.', {
      reason: 'no_claimable_variation',
      combinationId: combination.id,
    })
  }

  const orderedAssets = orderAssetsDeterministically(
    assets,
    `${profileId}:${combination.id}:${selected.map((item) => `${item.titleName}:${item.itemName}`).join('|')}`,
  )
  let lastRetryableError = null

  for (const asset of orderedAssets) {
    const priceResolution = await resolveCommercialPriceForAsset({ assetId: asset.id })
    const price = priceResolution.price || {}

    if (!price.sellable) {
      throw new ApiError(409, 'Preço não configurado para venda desta combinação.', {
        reason: 'price_not_configured',
        combinationId: combination.id,
      })
    }

    try {
      const claim = await claimAvailableAssetForProfileWithCredits({
        profileId,
        assetId: asset.id,
        deliverySource,
        requireSubscription,
        priceOverrideCredits: Number(price.credits || 0),
      })

      return mapClaimResult({
        claim,
        combination,
        selectedAsset: asset,
        price,
        signature,
      })
    } catch (error) {
      if (isRetryableAssetClaimError(error)) {
        lastRetryableError = error
        continue
      }

      throw error
    }
  }

  throw new ApiError(409, 'Todas as variações publicadas desta combinação foram ocupadas antes da entrega.', {
    reason: 'variation_pool_busy_or_empty',
    lastError: lastRetryableError?.message || null,
  })
}
