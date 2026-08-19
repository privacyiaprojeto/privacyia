import { ApiError } from '../utils/apiError.js'

const IMAGE_TYPES = new Set([
  'image',
  'imagem',
  'photo',
  'foto',
  'picture',
  'png',
  'jpg',
  'jpeg',
  'webp',
])

const STANDARD_AUDIO_TYPES = new Set([
  'audio',
  'chat_audio',
  'audio_chat',
  'tts',
  'voice',
  'voz',
])

const LIVE_AUDIO_TYPES = new Set([
  'audio_live',
  'live_audio',
  'audio_live_card',
  'audio_story',
  'historia_audio',
])

const STANDARD_VIDEO_TYPES = new Set([
  'video',
  'short_video',
  'video_curto',
  'reel',
  'clip',
])

const LIVE_ACTION_TYPES = new Set([
  'live_action',
  'live_action_v2v',
  'video_live',
  'live_action_card',
])

function normalizeToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')
}

function asObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function semanticValues(source) {
  const metadata = asObject(source?.metadata || source?.meta)
  const displayPayload = asObject(source?.display_payload || source?.displayPayload)

  return [
    source?.product_type,
    source?.productType,
    source?.contentType,
    source?.factory_mode,
    source?.factoryMode,
    metadata.product_type,
    metadata.productType,
    metadata.content_type,
    metadata.contentType,
    metadata.media_kind,
    metadata.mediaKind,
    metadata.factory_mode,
    metadata.factoryMode,
    metadata.card_kind,
    metadata.cardKind,
    displayPayload.product_type,
    displayPayload.productType,
    displayPayload.content_type,
    displayPayload.contentType,
    displayPayload.card_kind,
    displayPayload.cardKind,
  ].filter((value) => value !== undefined && value !== null && value !== '')
}

function mediaValues(source) {
  if (source === undefined || source === null) return []
  if (typeof source !== 'object' || Array.isArray(source)) return [source]

  const metadata = asObject(source.metadata || source.meta)
  const displayPayload = asObject(source.display_payload || source.displayPayload)

  return [
    source.media_type,
    source.mediaType,
    source.content_type,
    source.type,
    source.asset_type,
    source.assetType,
    source.delivery_type,
    source.deliveryType,
    metadata.media_type,
    metadata.mediaType,
    metadata.type,
    metadata.asset_type,
    metadata.assetType,
    displayPayload.media_type,
    displayPayload.mediaType,
  ].filter((value) => value !== undefined && value !== null && value !== '')
}

function classify(value) {
  const normalized = normalizeToken(value)
  if (LIVE_ACTION_TYPES.has(normalized)) return 'live_action'
  if (LIVE_AUDIO_TYPES.has(normalized)) return 'audio_live'
  if (IMAGE_TYPES.has(normalized)) return 'image'
  if (STANDARD_AUDIO_TYPES.has(normalized)) return normalized.includes('chat') ? 'audio_chat' : 'audio'
  if (STANDARD_VIDEO_TYPES.has(normalized)) return 'short_video'
  return null
}

function classifiedCandidates(values) {
  return values
    .map((raw) => ({ raw, mediaType: classify(raw) }))
    .filter((candidate) => Boolean(candidate.mediaType))
}

function buildConflict(candidates, source) {
  return {
    raw: candidates[0]?.raw ?? null,
    mediaType: 'conflict',
    conflict: true,
    reasonCode: 'MEDIA_PRODUCT_SEMANTIC_CONFLICT',
    source,
    semanticTypes: [...new Set(candidates.map((candidate) => candidate.mediaType))],
  }
}

function mediaFamily(mediaType) {
  if (mediaType === 'live_action' || mediaType === 'short_video') return 'video'
  if (mediaType === 'audio_live' || mediaType === 'audio' || mediaType === 'audio_chat') return 'audio'
  if (mediaType === 'image') return 'image'
  return 'unknown'
}

export function normalizeMediaProductType(...sources) {
  const semanticValuesFound = sources.flatMap(semanticValues)
  const semanticCandidates = classifiedCandidates(semanticValuesFound)
  const semanticTypes = new Set(semanticCandidates.map((candidate) => candidate.mediaType))
  const mediaValuesFound = sources.flatMap(mediaValues)
  const mediaCandidates = classifiedCandidates(mediaValuesFound)
  const mediaTypes = new Set(mediaCandidates.map((candidate) => candidate.mediaType))
  const mediaFamilies = new Set(mediaCandidates.map((candidate) => mediaFamily(candidate.mediaType)))

  if (semanticTypes.size > 1) {
    return buildConflict(semanticCandidates, 'explicit_semantics')
  }

  if (mediaFamilies.size > 1) {
    return buildConflict(mediaCandidates, 'media_transport')
  }

  if (semanticCandidates.length > 0) {
    const semanticFamily = mediaFamily(semanticCandidates[0].mediaType)
    const incompatibleTransportCandidates = mediaCandidates.filter((candidate) => (
      mediaFamily(candidate.mediaType) !== semanticFamily
    ))

    if (incompatibleTransportCandidates.length > 0) {
      return buildConflict(
        [...semanticCandidates, ...incompatibleTransportCandidates],
        'product_transport_family',
      )
    }

    return {
      ...semanticCandidates[0],
      conflict: false,
      reasonCode: null,
      source: 'explicit_semantics',
      semanticTypes: [...semanticTypes],
    }
  }

  const explicitLiveCandidates = mediaCandidates.filter((candidate) => (
    candidate.mediaType === 'live_action' || candidate.mediaType === 'audio_live'
  ))
  const explicitLiveTypes = new Set(explicitLiveCandidates.map((candidate) => candidate.mediaType))

  if (explicitLiveTypes.size > 1) {
    return buildConflict(explicitLiveCandidates, 'media_transport')
  }

  if (explicitLiveCandidates.length > 0) {
    return {
      ...explicitLiveCandidates[0],
      conflict: false,
      reasonCode: null,
      source: 'explicit_media_type',
      semanticTypes: [...explicitLiveTypes],
    }
  }

  if (mediaCandidates.length > 0) {
    return {
      ...mediaCandidates[0],
      conflict: false,
      reasonCode: null,
      source: 'media_transport',
      semanticTypes: [...mediaTypes],
    }
  }

  const raw = mediaValuesFound[0] ?? semanticValuesFound[0] ?? null
  return {
    raw,
    mediaType: normalizeToken(raw) || 'unknown',
    conflict: false,
    reasonCode: null,
    source: 'unrecognized',
    semanticTypes: [],
  }
}

export function isExplicitLiveActionProduct(product = {}) {
  const result = normalizeMediaProductType(product?.asset, product?.combination, product)
  return result.conflict !== true && result.mediaType === 'live_action'
}

export function isExplicitLiveAudioProduct(product = {}) {
  const result = normalizeMediaProductType(product?.asset, product?.combination, product)
  return result.conflict !== true && result.mediaType === 'audio_live'
}

export function filterExplicitLiveActionProducts(products = []) {
  return (products || []).filter(isExplicitLiveActionProduct)
}

export function filterExplicitLiveAudioProducts(products = []) {
  return (products || []).filter(isExplicitLiveAudioProduct)
}

export function resolveSceneDirectionProductType(direction = {}) {
  const metadata = asObject(direction.metadata)
  const providerPayload = asObject(direction.provider_payload || direction.providerPayload)
  const normalizedProduct = normalizeMediaProductType(
    direction,
    metadata.requestContext,
    providerPayload.requestContext,
    metadata,
    providerPayload,
  )

  if (normalizedProduct.conflict) return 'conflict'
  return normalizedProduct.mediaType === 'live_action' ? 'live_action' : 'short_video'
}

export function assertSceneDirectionProductType(direction = {}) {
  const productType = resolveSceneDirectionProductType(direction)

  if (productType === 'conflict') {
    throw new ApiError(422, 'A Direção de Cena possui intenções semânticas de produto incompatíveis.', {
      reasonCode: 'MEDIA_PRODUCT_SEMANTIC_CONFLICT',
      productType: 'conflict',
    })
  }

  return productType
}

export default {
  normalizeMediaProductType,
  isExplicitLiveActionProduct,
  isExplicitLiveAudioProduct,
  filterExplicitLiveActionProducts,
  filterExplicitLiveAudioProducts,
  resolveSceneDirectionProductType,
  assertSceneDirectionProductType,
}
