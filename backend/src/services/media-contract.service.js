import { inspectProtectedVideoRendererReadiness } from './video-renderer-readiness.service.js'
import { normalizeMediaProductType } from './media-product-type.service.js'

const PLACEHOLDER_WORDS = [
  'placeholder',
  'simulated',
  'simulado',
  'mock',
  'fake',
  'dry_run',
  'dry-run',
  'preview_only',
  'preview-only',
  'admin_only',
  'admin-only'
]

const BLOCKED_STATUSES = new Set([
  'qa_pending',
  'pending_qa',
  'rejected',
  'blocked',
  'draft',
  'archived',
  'hidden',
  'quarantine',
  'deleted'
])

const OPENABLE_IMAGE_STATUSES = new Set([
  'sold',
  'available',
  'published',
  'approved',
  'ready',
  'active'
])

const OPENABLE_AUDIO_STATUSES = new Set([
  'sold',
  'available',
  'published',
  'approved',
  'ready',
  'active'
])

const OPENABLE_VIDEO_STATUSES = new Set([
  'sold',
  'available',
  'published',
  'approved',
  'ready',
  'active'
])

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '')
}

function normalizeText(value) {
  if (value === undefined || value === null) return ''
  return String(value).trim().toLowerCase()
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === false) return value
  if (value === 1 || value === '1') return true
  if (value === 0 || value === '0') return false
  const text = normalizeText(value)
  if (['true', 'yes', 'sim', 'y', 's'].includes(text)) return true
  if (['false', 'no', 'nao', 'não', 'n'].includes(text)) return false
  return fallback
}

function getMetadataValue(source, ...keys) {
  const metadata = source?.metadata || source?.meta || source?.display_payload || source?.displayPayload
  if (!metadata || typeof metadata !== 'object') return undefined

  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      return metadata[key]
    }
  }

  return undefined
}

function hasPublicUrlLeak(...sources) {
  return sources.some((source) => {
    if (!source || typeof source !== 'object') return false

    const directCandidates = [
      source.public_url,
      source.publicUrl,
      source.url,
      source.media_url,
      source.mediaUrl,
      source.file_url,
      source.fileUrl,
      source.asset_url,
      source.assetUrl,
      source.preview_url,
      source.previewUrl,
      getMetadataValue(source, 'public_url', 'publicUrl', 'url', 'media_url', 'mediaUrl', 'file_url', 'fileUrl', 'asset_url', 'assetUrl')
    ]

    return directCandidates.some((candidate) => {
      const text = normalizeText(candidate)
      return text.startsWith('http://') || text.startsWith('https://')
    })
  })
}

function hasPrivateStoragePointer(...sources) {
  return sources.some((source) => {
    if (!source || typeof source !== 'object') return false

    const bucket = firstValue(
      source.r2_bucket,
      source.r2Bucket,
      source.bucket,
      source.storage_bucket,
      source.storageBucket,
      getMetadataValue(source, 'r2_bucket', 'r2Bucket', 'bucket', 'storage_bucket', 'storageBucket')
    )

    const key = firstValue(
      source.r2_key,
      source.r2Key,
      source.storage_key,
      source.storageKey,
      source.object_key,
      source.objectKey,
      source.path,
      getMetadataValue(source, 'r2_key', 'r2Key', 'storage_key', 'storageKey', 'object_key', 'objectKey', 'path')
    )

    return Boolean(bucket && key) || Boolean(key)
  })
}

function hasProtectedViewUrl(delivery) {
  if (!delivery) return false

  const persisted = firstValue(
    delivery.protected_view_url,
    delivery.protectedViewUrl,
    delivery.protected_url,
    delivery.protectedUrl,
    getMetadataValue(delivery, 'protected_view_url', 'protectedViewUrl', 'protected_url', 'protectedUrl')
  )

  if (persisted) {
    return {
      hasProtectedViewUrl: true,
      hasPersistedProtectedViewUrl: true,
      hasDerivedProtectedViewUrl: false,
      protectedViewUrlSource: 'persisted_field'
    }
  }

  if (delivery.id) {
    return {
      hasProtectedViewUrl: true,
      hasPersistedProtectedViewUrl: false,
      hasDerivedProtectedViewUrl: true,
      protectedViewUrlSource: 'derived_route'
    }
  }

  return {
    hasProtectedViewUrl: false,
    hasPersistedProtectedViewUrl: false,
    hasDerivedProtectedViewUrl: false,
    protectedViewUrlSource: null
  }
}

function isSimulatedOrPlaceholder(...sources) {
  return sources.some((source) => {
    if (!source || typeof source !== 'object') return false

    const booleanFlags = [
      source.simulated_output,
      source.simulatedOutput,
      source.is_simulated,
      source.isSimulated,
      source.placeholder,
      source.is_placeholder,
      source.isPlaceholder,
      getMetadataValue(source, 'simulated_output', 'simulatedOutput', 'is_simulated', 'isSimulated', 'placeholder', 'is_placeholder', 'isPlaceholder')
    ]

    if (booleanFlags.some((flag) => normalizeBoolean(flag, false))) return true

    const textCandidates = [
      source.media_origin,
      source.mediaOrigin,
      source.source,
      source.delivery_source,
      source.deliverySource,
      source.status,
      source.production_status,
      source.productionStatus,
      source.publication_status,
      source.publicationStatus,
      getMetadataValue(source, 'media_origin', 'mediaOrigin', 'source', 'delivery_source', 'deliverySource', 'status', 'production_status', 'productionStatus')
    ]

    return textCandidates.some((candidate) => {
      const text = normalizeText(candidate)
      return PLACEHOLDER_WORDS.some((word) => text.includes(word))
    })
  })
}

function resolveAssetStatus(asset, combination, delivery) {
  return normalizeText(firstValue(
    asset?.status,
    asset?.asset_status,
    asset?.assetStatus,
    asset?.publication_status,
    asset?.publicationStatus,
    asset?.production_status,
    asset?.productionStatus,
    combination?.status,
    combination?.publication_status,
    combination?.publicationStatus,
    delivery?.status,
    getMetadataValue(asset, 'status', 'asset_status', 'assetStatus', 'publication_status', 'publicationStatus', 'production_status', 'productionStatus')
  ))
}

function buildBlockedContract(base, reasonCode, userMessage, severity = 'BLOCKED', extraReasons = []) {
  return {
    ...base,
    clientSupported: base.clientSupported ?? false,
    clientOpenable: false,
    clientPurchasable: false,
    protectedRenderer: null,
    reasonCode,
    severity,
    userMessage,
    reasons: [...base.reasons, ...extraReasons]
  }
}

export function buildClientMediaContract({
  delivery = null,
  asset = null,
  combination = null,
  videoRendererReadiness = null,
  videoPlaybackReadiness = null,
} = {}) {
  const normalizedProduct = normalizeMediaProductType(asset, delivery, combination)
  const { raw: mediaTypeRaw, mediaType } = normalizedProduct
  const assetStatus = resolveAssetStatus(asset, combination, delivery)
  const publicUrlLeak = hasPublicUrlLeak(asset, delivery, combination)
  const privateStoragePointer = hasPrivateStoragePointer(asset, delivery, combination)
  const protectedView = hasProtectedViewUrl(delivery)
  const hasDelivery = Boolean(delivery?.id)
  const simulatedOrPlaceholder = isSimulatedOrPlaceholder(asset, delivery, combination)
  const combinationAdminOnly = normalizeBoolean(firstValue(
    combination?.admin_only,
    combination?.adminOnly,
    getMetadataValue(combination, 'admin_only', 'adminOnly')
  ), false)
  const visibleToClient = normalizeBoolean(firstValue(
    combination?.visible_to_client,
    combination?.visibleToClient,
    getMetadataValue(combination, 'visible_to_client', 'visibleToClient')
  ), false)

  const base = {
    mediaTypeRaw: mediaTypeRaw || null,
    mediaType,
    assetStatus: assetStatus || null,
    combinationAdminOnly,
    visibleToClient,
    assetPublicUrlLeak: hasPublicUrlLeak(asset),
    deliveryPublicUrlLeak: hasPublicUrlLeak(delivery),
    combinationPublicUrlLeak: hasPublicUrlLeak(combination),
    anyPublicUrlLeak: publicUrlLeak,
    hasPrivateStoragePointer: privateStoragePointer,
    hasDelivery,
    ...protectedView,
    simulatedOutput: simulatedOrPlaceholder,
    clientSupported: false,
    clientOpenable: false,
    clientPurchasable: false,
    protectedRenderer: null,
    reasonCode: 'UNKNOWN_MEDIA_TYPE',
    severity: 'BLOCKED',
    userMessage: 'Esta mídia ainda não está disponível para abertura protegida.',
    reasons: []
  }

  if (combinationAdminOnly || !visibleToClient) {
    base.reasons.push('Combinação invisível/adminOnly para Cliente.')
  }

  if (normalizedProduct.conflict) {
    return buildBlockedContract(
      base,
      normalizedProduct.reasonCode || 'MEDIA_PRODUCT_SEMANTIC_CONFLICT',
      'Esta mídia possui uma configuração de tipo incompatível e precisa ser revisada.',
      'BLOCKED',
      [`Semânticas incompatíveis: ${(normalizedProduct.semanticTypes || []).join(', ') || 'desconhecidas'}.`]
    )
  }

  if (publicUrlLeak) {
    return buildBlockedContract(
      base,
      'PUBLIC_URL_LEAK_BLOCKED',
      'Esta mídia precisa ser revisada antes de ser aberta.',
      'BLOCKED',
      ['Possível URL pública detectada.']
    )
  }

  const audioLooksProtectedAndReady = (mediaType === 'audio' || mediaType === 'audio_chat')
    && hasDelivery
    && protectedView.hasProtectedViewUrl
    && privateStoragePointer
    && (!assetStatus || OPENABLE_AUDIO_STATUSES.has(assetStatus))

  if (simulatedOrPlaceholder && !audioLooksProtectedAndReady) {
    return buildBlockedContract(
      base,
      'SIMULATED_OR_PLACEHOLDER_MEDIA',
      'Esta mídia ainda está em preparação.',
      'BLOCKED',
      ['Mídia simulada, placeholder ou somente Admin.']
    )
  }

  if (simulatedOrPlaceholder && audioLooksProtectedAndReady) {
    base.reasons.push('Áudio com flag legada de simulado/placeholder, mas possui entrega protegida, storage privado e status abrível.')
  }

  if (assetStatus && BLOCKED_STATUSES.has(assetStatus)) {
    return buildBlockedContract(
      base,
      'MEDIA_STATUS_NOT_CLIENT_READY',
      'Esta mídia ainda não foi liberada.',
      'BLOCKED',
      [`Status não liberado para Cliente: ${assetStatus}.`]
    )
  }

  if (mediaType === 'image') {
    const imageBase = {
      ...base,
      clientSupported: true,
      protectedRenderer: 'image'
    }

    if (!hasDelivery || !protectedView.hasProtectedViewUrl || !privateStoragePointer) {
      return buildBlockedContract(
        imageBase,
        'IMAGE_MISSING_PROTECTED_DELIVERY_OR_STORAGE',
        'Esta imagem ainda não está disponível para abertura protegida.',
        'REVIEW',
        ['Imagem reconhecida, mas falta delivery protegido, rota protegida ou ponteiro privado.']
      )
    }

    if (assetStatus && !OPENABLE_IMAGE_STATUSES.has(assetStatus)) {
      return buildBlockedContract(
        imageBase,
        'IMAGE_STATUS_NOT_OPENABLE',
        'Esta imagem ainda não foi liberada.',
        'REVIEW',
        [`Status de imagem não confirmado como abrível: ${assetStatus}.`]
      )
    }

    return {
      ...imageBase,
      clientOpenable: true,
      clientPurchasable: false,
      reasonCode: 'OPENABLE_IMAGE_PROTECTED_DELIVERY',
      severity: 'OK',
      userMessage: null
    }
  }

  if (mediaType === 'audio_live') {
    return buildBlockedContract(
      {
        ...base,
        clientSupported: true,
      },
      'LIVE_AUDIO_AUDIOVISUAL_RENDERER_NOT_READY',
      'Live Audio audiovisual ainda não está disponível.',
      'BLOCKED',
      ['O áudio isolado não comprova presença visual da personagem, sincronização labial ou expressão facial.']
    )
  }

  if (mediaType === 'audio' || mediaType === 'audio_chat') {
    const audioBase = {
      ...base,
      clientSupported: true,
      protectedRenderer: 'audio'
    }

    if (!hasDelivery || !protectedView.hasProtectedViewUrl || !privateStoragePointer) {
      return buildBlockedContract(
        audioBase,
        'AUDIO_MISSING_PROTECTED_DELIVERY_OR_STORAGE',
        'Este áudio ainda não está disponível para abertura protegida.',
        'REVIEW',
        ['Áudio reconhecido, mas falta delivery protegido, rota protegida ou ponteiro privado.']
      )
    }

    if (assetStatus && !OPENABLE_AUDIO_STATUSES.has(assetStatus)) {
      return buildBlockedContract(
        audioBase,
        'AUDIO_STATUS_NOT_OPENABLE',
        'Este áudio ainda não foi liberado.',
        'REVIEW',
        [`Status de áudio não confirmado como abrível: ${assetStatus}.`]
      )
    }

    return {
      ...audioBase,
      clientOpenable: true,
      clientPurchasable: false,
      reasonCode: 'OPENABLE_AUDIO_PROTECTED_DELIVERY',
      severity: 'OK',
      userMessage: null
    }
  }

  if (mediaType === 'live_action') {
    return buildBlockedContract(
      {
        ...base,
        clientSupported: true,
      },
      'LIVE_ACTION_INTERACTIVE_RENDERER_NOT_READY',
      'Live Action interativo ainda não está disponível.',
      'BLOCKED',
      ['O renderer de vídeo genérico não comprova idle visual, ciclo de ação interativa ou resultado audiovisual de Live Action.']
    )
  }

  if (mediaType === 'short_video') {
    const videoBase = {
      ...base,
      clientSupported: true,
      protectedRenderer: 'video'
    }
    const rendererReadiness = videoRendererReadiness || inspectProtectedVideoRendererReadiness()

    if (!rendererReadiness.ready) {
      return buildBlockedContract(
        videoBase,
        rendererReadiness.reasonCode || 'VIDEO_RENDERER_NOT_READY',
        rendererReadiness.userMessage || 'Esta mídia de vídeo ainda não está disponível para abertura protegida.',
        'BLOCKED',
        (rendererReadiness.blockers || []).map((blocker) => `Renderer de vídeo bloqueado: ${blocker}.`)
      )
    }

    if (!hasDelivery || !protectedView.hasProtectedViewUrl || !privateStoragePointer) {
      return buildBlockedContract(
        videoBase,
        'VIDEO_MISSING_PROTECTED_DELIVERY_OR_STORAGE',
        'Este vídeo ainda não está disponível para abertura protegida.',
        'REVIEW',
        ['Vídeo reconhecido, mas falta delivery protegido, rota protegida ou ponteiro privado.']
      )
    }

    if (assetStatus && !OPENABLE_VIDEO_STATUSES.has(assetStatus)) {
      return buildBlockedContract(
        videoBase,
        'VIDEO_STATUS_NOT_OPENABLE',
        'Este vídeo ainda não foi liberado.',
        'REVIEW',
        [`Status de vídeo não confirmado como abrível: ${assetStatus}.`]
      )
    }

    const hlsPlaybackReady = videoPlaybackReadiness?.ready === true
      && normalizeText(videoPlaybackReadiness?.renditionType) === 'hls_stream'

    if (!hlsPlaybackReady) {
      return buildBlockedContract(
        videoBase,
        videoPlaybackReadiness?.reasonCode || 'VIDEO_HLS_RENDITION_NOT_READY',
        videoPlaybackReadiness?.userMessage || 'Vídeo em preparação. O streaming HLS protegido ainda não está disponível.',
        'REVIEW',
        ['A abertura de vídeo exige uma rendition HLS available comprovada pelo serviço de delivery.']
      )
    }

    return {
      ...videoBase,
      clientOpenable: true,
      clientPurchasable: false,
      reasonCode: 'OPENABLE_VIDEO_PROTECTED_DELIVERY',
      severity: 'OK',
      userMessage: null
    }
  }

  return buildBlockedContract(
    base,
    'UNKNOWN_MEDIA_TYPE',
    'Esta mídia ainda não está disponível para abertura protegida.',
    'BLOCKED',
    ['Tipo de mídia desconhecido ou incompatível.']
  )
}

export function buildVideoPlaybackReadiness(rendition = null) {
  const renditionType = normalizeText(rendition?.rendition_type || rendition?.renditionType)
  const renditionStatus = normalizeText(rendition?.status)
  const ready = renditionType === 'hls_stream' && renditionStatus === 'available'

  return {
    ready,
    status: ready ? 'AVAILABLE' : 'PROCESSING',
    renditionId: rendition?.id || null,
    renditionType: renditionType || null,
    reasonCode: ready ? 'VIDEO_HLS_RENDITION_AVAILABLE' : 'VIDEO_HLS_RENDITION_NOT_READY',
    userMessage: ready ? null : 'Vídeo em preparação. O streaming HLS protegido ainda não está disponível.',
  }
}

export function sanitizeClientMediaContract(contract) {
  return {
    mediaType: contract?.mediaType || 'unknown',
    clientSupported: Boolean(contract?.clientSupported),
    clientOpenable: Boolean(contract?.clientOpenable),
    clientPurchasable: Boolean(contract?.clientPurchasable),
    protectedRenderer: contract?.protectedRenderer || null,
    reasonCode: contract?.reasonCode || 'UNKNOWN_MEDIA_TYPE',
    severity: contract?.severity || 'BLOCKED',
    userMessage: contract?.userMessage || null
  }
}

export default {
  buildClientMediaContract,
  buildVideoPlaybackReadiness,
  sanitizeClientMediaContract
}
