import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { resolveCommercialPriceForAsset } from './commercial-pricing.service.js'

const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'

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

function normalizeMediaType(value) {
  const mediaType = String(value || '').trim()
  return mediaType || null
}

function mediaTypeAliases(value) {
  const normalized = normalizeText(value)
  if (!normalized || normalized === 'all') return []
  if (['image', 'imagem', 'foto', 'photo', 'picture', 'img'].includes(normalized)) return ['image', 'imagem', 'foto', 'photo', 'picture', 'img']
  if (['audio', 'áudio', 'live_audio', 'voice'].includes(normalized)) return ['audio', 'áudio', 'live_audio', 'voice']
  if (['video', 'vídeo', 'short_video', 'live_action'].includes(normalized)) return ['video', 'vídeo', 'short_video', 'live_action']
  return [String(value || '').trim()]
}

function normalizePositiveInteger(value, fallback = 200, max = 500) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
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

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
      table,
      error: error.message,
    })
  }

  return new Map((data || []).map((row) => [row.id, row]))
}

function normalizeGuidedSelections(selections) {
  if (Array.isArray(selections)) {
    return selections
      .map((item, index) => ({
        stepIndex: index,
        titleId: item?.titleId || item?.dimensionId || item?.dimension_id || null,
        titleName: item?.titleName || item?.dimensionName || item?.title || item?.category || 'Título',
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
            itemName: value.itemName || value.optionName || value.name || value.label || String(value.itemId || value.optionId || value.id || value),
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

function titleKey(selection = {}) {
  return selection.titleId ? `id:${selection.titleId}` : `name:${normalizeText(selection.titleName)}`
}

function itemKey(selection = {}) {
  return selection.itemId ? `id:${selection.itemId}` : `name:${normalizeText(selection.itemName)}`
}

function titleMatches(left = {}, right = {}) {
  if (left.titleId && right.titleId) return left.titleId === right.titleId
  if (left.titleName && right.titleName) return normalizeText(left.titleName) === normalizeText(right.titleName)
  return false
}

function itemMatches(left = {}, right = {}) {
  if (left.itemId && right.itemId) return left.itemId === right.itemId
  if (left.itemName && right.itemName) return normalizeText(left.itemName) === normalizeText(right.itemName)
  return false
}

function productMatchesSelections(product, selected = []) {
  if (selected.length === 0) return true

  return selected.every((choice) => product.selections.some((selection) => (
    titleMatches(selection, choice) && itemMatches(selection, choice)
  )))
}

function getProductSelectionForTitle(product, wantedTitle = {}) {
  return product.selections.find((selection) => titleMatches(selection, wantedTitle)) || null
}

function isAssetApprovedForPrompt(asset = {}) {
  return ['available', 'sold'].includes(String(asset.status || '').trim().toLowerCase())
}

function getPublicationMetadata(asset = {}, combination = {}) {
  const assetMetadata = safeObject(asset.metadata)
  const combinationMetadata = safeObject(combination.metadata)

  return {
    asset: safeObject(assetMetadata.productPublication || assetMetadata.clientPublication),
    combination: safeObject(combinationMetadata.productPublication || combinationMetadata.publication),
  }
}

function isPublishedForDynamicPrompt(asset = {}, combination = {}) {
  if (!isAssetApprovedForPrompt(asset)) return false

  const publicationMetadata = getPublicationMetadata(asset, combination)
  const publicationStatus = publicationMetadata.asset.status || publicationMetadata.combination.status || null

  if (publicationStatus === 'hidden') return false
  if (publicationStatus === 'published') return true

  return combination?.visible_to_client === true && combination?.admin_only !== true && combination?.is_active !== false
}

function buildPublishedProduct({ asset, combination, companion }) {
  const selections = normalizeGuidedSelections(combination?.guided_selections || combination?.metadata?.guidedSelections || [])

  return {
    assetId: asset.id,
    combinationId: combination.id,
    companionId: asset.companion_id || combination.companion_id || null,
    mediaType: combination.media_type || asset.media_type || null,
    priceCredits: Number(combination.price_credits || 0),
    selections,
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatarUrl: companion.avatar_url || null,
          thumbnailUrl: companion.thumbnail_url || null,
        }
      : null,
  }
}

async function loadPublishedProducts({ companionId, mediaType = null, limit = 300 } = {}) {
  if (!companionId) {
    throw new ApiError(400, 'Avatar obrigatório para montar prompts dinâmicos.')
  }

  const safeLimit = normalizePositiveInteger(limit, 300, 500)
  const mediaAliases = mediaTypeAliases(normalizeMediaType(mediaType))

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, combination_id, companion_id, media_type, status, metadata, created_at')
    .eq('companion_id', companionId)
    .in('status', ['available', 'sold'])
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (mediaAliases.length === 1) query = query.eq('media_type', mediaAliases[0])
  if (mediaAliases.length > 1) query = query.in('media_type', mediaAliases)

  const { data: assets, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao carregar produtos publicados para prompts dinâmicos.', error)
  }

  const combinationsById = await getRowsByIds(
    COMBINATIONS_TABLE,
    (assets || []).map((asset) => asset.combination_id),
    'id, companion_id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections, metadata',
  )

  const companionsById = await getRowsByIds(
    'companions',
    [companionId],
    'id, name, slug, avatar_url, thumbnail_url',
  )

  const products = await Promise.all((assets || []).map(async (asset) => {
    const combination = combinationsById.get(asset.combination_id)
    if (!combination) return null
    if (!isPublishedForDynamicPrompt(asset, combination)) return null

    let priceResolution = null
    try {
      priceResolution = await resolveCommercialPriceForAsset({ assetId: asset.id })
    } catch (error) {
      console.warn('[dynamic-prompt] Falha ao resolver preço comercial. Produto ocultado dos prompts dinâmicos.', {
        assetId: asset.id,
        error: error.message,
      })
      return null
    }

    if (!priceResolution?.price?.sellable) return null

    const product = buildPublishedProduct({
      asset,
      combination: {
        ...combination,
        price_credits: Number(priceResolution.price.credits || 0),
      },
      companion: companionsById.get(companionId),
    })

    if (product.selections.length === 0) return null
    return product
  }))

  return products.filter(Boolean)
}

function deduplicateByCombination(products = []) {
  const byCombination = new Map()

  for (const product of products) {
    const key = product.combinationId
    const existing = byCombination.get(key)

    if (!existing) {
      byCombination.set(key, {
        ...product,
        productCount: 1,
        assetIds: [product.assetId],
      })
      continue
    }

    existing.productCount += 1
    existing.assetIds.push(product.assetId)
  }

  return [...byCombination.values()]
}

function getOrderedTitles(products = []) {
  const titleMap = new Map()

  for (const product of products) {
    for (const selection of product.selections) {
      const key = titleKey(selection)
      if (!titleMap.has(key)) {
        titleMap.set(key, {
          titleId: selection.titleId,
          titleName: selection.titleName,
          stepIndex: titleMap.size,
        })
      }
    }
  }

  return [...titleMap.values()].sort((a, b) => a.stepIndex - b.stepIndex)
}

function buildBreadcrumbs(selected = [], orderedTitles = []) {
  return selected.map((choice) => {
    const title = orderedTitles.find((item) => titleMatches(item, choice))
    return {
      titleId: choice.titleId || title?.titleId || null,
      titleName: choice.titleName || title?.titleName || 'Título',
      itemId: choice.itemId || null,
      itemName: choice.itemName || 'Item',
    }
  })
}

function sanitizeResultCombination(product) {
  return {
    combinationId: product.combinationId,
    mediaType: product.mediaType,
    priceCredits: product.priceCredits,
    signature: product.selections.map((selection) => ({
      titleId: selection.titleId,
      titleName: selection.titleName,
      itemId: selection.itemId,
      itemName: selection.itemName,
    })),
    availableVariations: product.productCount,
  }
}

function buildNextStep({ filteredProducts, orderedTitles, selected }) {
  const selectedTitleKeys = new Set(selected.map(titleKey))
  const nextTitle = orderedTitles.find((title) => !selectedTitleKeys.has(titleKey(title))) || null

  if (!nextTitle) return null

  const optionsMap = new Map()

  for (const product of filteredProducts) {
    const selection = getProductSelectionForTitle(product, nextTitle)
    if (!selection) continue

    const key = itemKey(selection)
    const existing = optionsMap.get(key)

    if (!existing) {
      optionsMap.set(key, {
        itemId: selection.itemId,
        itemName: selection.itemName,
        titleId: nextTitle.titleId,
        titleName: nextTitle.titleName,
        availableCombinations: 0,
        availableVariations: 0,
      })
    }

    const option = optionsMap.get(key)
    option.availableCombinations += 1
    option.availableVariations += Number(product.productCount || 1)
  }

  const options = [...optionsMap.values()].sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || ''), 'pt-BR'))

  return {
    titleId: nextTitle.titleId,
    titleName: nextTitle.titleName,
    stepIndex: nextTitle.stepIndex,
    options,
  }
}

function containsForbiddenPrivateFields(value) {
  const serialized = JSON.stringify(value || {}).toLowerCase()
  return [
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

export async function getDynamicPromptCascadeOptions({
  companionId,
  mediaType = null,
  selections = [],
  limit = 300,
} = {}) {
  const selected = normalizeSelectedInput(selections)
  const loadedProducts = await loadPublishedProducts({ companionId, mediaType, limit })
  const products = deduplicateByCombination(loadedProducts)
  const orderedTitles = getOrderedTitles(products)
  const filteredProducts = products.filter((product) => productMatchesSelections(product, selected))
  const nextStep = buildNextStep({ filteredProducts, orderedTitles, selected })
  const isComplete = filteredProducts.length > 0 && !nextStep
  const companion = products[0]?.companion || null

  const result = {
    companion,
    mediaType: mediaType || products[0]?.mediaType || null,
    selected: buildBreadcrumbs(selected, orderedTitles),
    progress: {
      selectedSteps: selected.length,
      totalSteps: orderedTitles.length,
      isComplete,
    },
    currentStep: nextStep,
    selectionComplete: isComplete,
    available: {
      combinations: filteredProducts.length,
      variations: filteredProducts.reduce((sum, item) => sum + Number(item.productCount || 1), 0),
    },
    completedCombinations: isComplete
      ? filteredProducts.map(sanitizeResultCombination)
      : [],
    guidance: isComplete
      ? 'Combinação disponível. O próximo sprint poderá ligar esta escolha à entrega do produto publicado.'
      : nextStep
        ? `Escolha uma opção em ${nextStep.titleName}.`
        : 'Nenhuma combinação publicada encontrada para este caminho.',
  }

  if (containsForbiddenPrivateFields(result)) {
    throw new ApiError(500, 'Resposta de prompts dinâmicos tentou expor campo privado do cofre.', {
      reason: 'private_field_guard',
    })
  }

  return result
}
