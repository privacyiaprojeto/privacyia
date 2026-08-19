import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { fetchProtectedAssetPayload, fetchProtectedRenditionPayload } from './media-protection.service.js'
import { normalizeMediaProductType } from './media-product-type.service.js'
import { inspectProtectedVideoRendererReadiness } from './video-renderer-readiness.service.js'

const VALID_DESTINATIONS = new Set(['feed', 'premium', 'public_storefront'])
const APPROVED_ASSET_STATUSES = new Set(['available', 'sold', 'published'])
const STANDARD_VIDEO_TYPES = new Set(['short_video'])
const STANDARD_AUDIO_TYPES = new Set(['audio', 'audio_chat'])

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase()
}

function publicationFromCombination(combination) {
  const metadata = safeObject(combination?.metadata)
  return safeObject(metadata.productPublication || metadata.publication)
}

function assertPublishedCombination(combination) {
  if (!combination) throw new ApiError(404, 'Produto publicado não encontrado.')
  if (combination.visible_to_client !== true || combination.admin_only === true || combination.is_active === false) {
    throw new ApiError(404, 'Produto não está disponível para o Cliente.')
  }

  const publication = publicationFromCombination(combination)
  const destination = normalizeText(publication.destination)
  if (publication.status !== 'published' || publication.published === false || !VALID_DESTINATIONS.has(destination)) {
    throw new ApiError(404, 'Publicação do produto está incompleta ou inválida.')
  }

  return { publication, destination }
}

function isSimulated(asset) {
  const metadata = safeObject(asset?.metadata)
  return [
    metadata.simulatedOutput,
    metadata.simulated_output,
    metadata.placeholder,
    metadata.isPlaceholder,
    metadata.is_placeholder,
  ].some((value) => value === true)
}

async function loadProductContext(productId) {
  const { data: combination, error: combinationError } = await supabaseAdmin
    .from('media_combinations')
    .select('*')
    .eq('id', productId)
    .maybeSingle()

  if (combinationError) {
    throw new ApiError(500, 'Erro ao carregar publicação para preview.', combinationError)
  }

  const { publication, destination } = assertPublishedCombination(combination)
  const assetId = publication.assetId || publication.asset_id || null
  if (!assetId) {
    return { combination, publication, destination, asset: null, renditions: [] }
  }

  const { data: asset, error: assetError } = await supabaseAdmin
    .from('media_asset_variants')
    .select('*')
    .eq('id', assetId)
    .eq('combination_id', combination.id)
    .maybeSingle()

  if (assetError) {
    throw new ApiError(500, 'Erro ao carregar asset publicado.', assetError)
  }

  const masterAssetId = asset?.master_asset_id || null
  let renditions = []
  if (masterAssetId) {
    const { data, error } = await supabaseAdmin
      .from('media_asset_renditions')
      .select('*')
      .eq('master_asset_id', masterAssetId)
      .is('delivery_id', null)
      .eq('rendition_type', 'preview')
      .order('created_at', { ascending: false })

    if (error) {
      throw new ApiError(500, 'Erro ao carregar renditions do produto publicado.', error)
    }
    renditions = data || []
  }

  return { combination, publication, destination, asset, renditions }
}

function selectAvailableRendition(renditions, type) {
  return (renditions || []).find((item) => item.rendition_type === type && item.status === 'available') || null
}

function hasPendingRendition(renditions) {
  return (renditions || []).some((item) => ['queued', 'processing'].includes(item.status))
}

export async function getPublishedCatalogMediaDescriptor(productId) {
  const context = await loadProductContext(productId)
  const asset = context.asset
  const normalizedProduct = normalizeMediaProductType(asset, context.combination)
  const mediaType = normalizedProduct.mediaType === 'unknown' ? 'image' : normalizedProduct.mediaType

  const base = {
    productId: context.combination.id,
    assetId: asset?.id || null,
    masterAssetId: asset?.master_asset_id || null,
    mediaType,
    destination: context.destination,
    mediaStatus: 'unavailable',
    streamKind: null,
    rendition: null,
    asset,
    combination: context.combination,
    publication: context.publication,
    userMessage: 'Mídia indisponível.',
  }

  if (normalizedProduct.conflict) {
    return {
      ...base,
      userMessage: 'Mídia com configuração de tipo incompatível. Revisão necessária.',
    }
  }

  if (!asset || !APPROVED_ASSET_STATUSES.has(normalizeText(asset.status)) || isSimulated(asset)) {
    return base
  }

  if (!asset.r2_bucket || !asset.r2_key) {
    return { ...base, userMessage: 'Mídia aprovada sem armazenamento privado válido.' }
  }

  if (mediaType === 'live_action') {
    return {
      ...base,
      userMessage: 'Live Action interativo ainda não está disponível.',
    }
  }

  if (mediaType === 'audio_live') {
    return {
      ...base,
      userMessage: 'Live Audio audiovisual ainda não está disponível.',
    }
  }

  if (STANDARD_VIDEO_TYPES.has(mediaType)) {
    const rendererReadiness = inspectProtectedVideoRendererReadiness()
    if (!rendererReadiness.ready) {
      return {
        ...base,
        userMessage: rendererReadiness.userMessage,
      }
    }

    const preview = selectAvailableRendition(context.renditions, 'preview')
    if (preview) {
      return {
        ...base,
        mediaStatus: 'ready',
        streamKind: 'progressive',
        rendition: preview,
        userMessage: 'Disponível.',
      }
    }

    return {
      ...base,
      mediaStatus: hasPendingRendition(context.renditions) || asset ? 'processing' : 'unavailable',
      streamKind: null,
      userMessage: 'Preview de vídeo em preparação. O HLS completo permanece reservado às entregas protegidas.',
    }
  }

  if (STANDARD_AUDIO_TYPES.has(mediaType)) {
    const preview = selectAvailableRendition(context.renditions, 'preview')
    if (preview) {
      return {
        ...base,
        mediaStatus: 'ready',
        streamKind: 'progressive',
        rendition: preview,
        userMessage: 'Disponível.',
      }
    }

    return {
      ...base,
      mediaStatus: hasPendingRendition(context.renditions) || asset ? 'processing' : 'unavailable',
      streamKind: null,
      userMessage: 'Preview de áudio em preparação. O Master permanece reservado às entregas protegidas.',
    }
  }

  return {
    ...base,
    mediaStatus: 'ready',
    streamKind: 'image',
    userMessage: 'Disponível.',
  }
}

export async function streamPublishedCatalogProductPreview({ productId, profileId, range = null, requestContext = {} } = {}) {
  if (!profileId) throw new ApiError(401, 'Perfil autenticado obrigatório para preview publicado.')

  const descriptor = await getPublishedCatalogMediaDescriptor(productId)
  if (descriptor.mediaStatus !== 'ready') {
    throw new ApiError(descriptor.mediaStatus === 'processing' ? 409 : 404, descriptor.userMessage, {
      mediaStatus: descriptor.mediaStatus,
      productId,
    })
  }

  const common = {
    actorProfileId: profileId,
    range,
    requestContext,
    watermarkLabel: 'PRIVACY IA',
    expiresIn: requestContext.expiresIn || 120,
    asset: descriptor.asset,
  }

  if (descriptor.rendition) {
    return fetchProtectedRenditionPayload(descriptor.rendition, common)
  }

  return fetchProtectedAssetPayload(descriptor.asset.id, {
    ...common,
    allowedStatuses: ['available', 'sold', 'published'],
  })
}
