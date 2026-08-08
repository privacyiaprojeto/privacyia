const IMAGE_TYPES = new Set(['image', 'imagem', 'photo', 'foto', 'picture', 'png', 'jpg', 'jpeg', 'webp'])
const AUDIO_TYPES = new Set(['audio', 'audio_live', 'live_audio', 'audio-live', 'live-audio', 'chat_audio', 'audio_chat', 'tts', 'voice', 'voz'])
const VIDEO_TYPES = new Set(['video', 'vídeo', 'short_video', 'short-video', 'live_action', 'live-action', 'reel', 'clip'])

const PURCHASE_READY_STATUSES = new Set(['available', 'published', 'approved', 'ready', 'active'])
const BLOCKED_STATUSES = new Set(['sold', 'reserved', 'qa_pending', 'pending_qa', 'rejected', 'blocked', 'draft', 'archived', 'hidden', 'quarantine', 'deleted'])
const PLACEHOLDER_WORDS = ['placeholder', 'simulated', 'simulado', 'mock', 'fake', 'dry_run', 'dry-run', 'preview_only', 'preview-only', 'admin_only', 'admin-only']

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
  if (['true', 'yes', 'sim', 'y', 's', 'on'].includes(text)) return true
  if (['false', 'no', 'nao', 'não', 'n', 'off'].includes(text)) return false

  return fallback
}

function normalizeInteger(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function normalizePriceCredits(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed)) return 0
  return parsed
}

function getMetadata(source) {
  const metadata = source?.metadata || source?.meta || source?.display_payload || source?.displayPayload || source?.qa_payload || source?.qaPayload
  return metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {}
}

function getMetadataValue(source, ...keys) {
  const metadata = getMetadata(source)

  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') {
      return metadata[key]
    }
  }

  return undefined
}

function normalizeMediaType(...sources) {
  const raw = firstValue(
    ...sources.flatMap((source) => [
      source?.media_type,
      source?.mediaType,
      source?.content_type,
      source?.contentType,
      source?.type,
      source?.asset_type,
      source?.assetType,
      source?.delivery_type,
      source?.deliveryType,
      getMetadataValue(source, 'media_type', 'mediaType', 'content_type', 'contentType', 'type', 'asset_type', 'assetType')
    ])
  )

  const normalized = normalizeText(raw)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')

  if (IMAGE_TYPES.has(normalized)) return { raw: raw || null, mediaType: 'image' }
  if (AUDIO_TYPES.has(normalized)) return { raw: raw || null, mediaType: normalized.includes('chat') ? 'audio_chat' : 'audio_live' }
  if (VIDEO_TYPES.has(normalized)) return { raw: raw || null, mediaType: normalized.includes('live_action') || normalized.includes('live-action') ? 'live_action' : 'short_video' }

  return { raw: raw || null, mediaType: normalized || 'unknown' }
}

function hasPublicUrlLeak(...sources) {
  return sources.some((source) => {
    if (!source || typeof source !== 'object') return false

    const candidates = [
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

    return candidates.some((candidate) => {
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

    return Boolean(key) || Boolean(bucket && key)
  })
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

function getAssetStatus(asset, combination) {
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
    getMetadataValue(asset, 'status', 'asset_status', 'assetStatus', 'publication_status', 'publicationStatus', 'production_status', 'productionStatus')
  ))
}

function resolveIds({ profileId = null, asset = null, combination = null } = {}) {
  return {
    profileId: profileId || null,
    assetId: asset?.id || asset?.variant_id || asset?.variantId || null,
    combinationId: firstValue(asset?.combination_id, asset?.combinationId, asset?.media_combination_id, asset?.mediaCombinationId, combination?.id) || null,
    companionId: firstValue(asset?.companion_id, asset?.companionId, combination?.companion_id, combination?.companionId) || null,
  }
}

function buildBlockedContract(base, reasonCode, userMessage, severity = 'BLOCKED', reasons = []) {
  return {
    ...base,
    clientPurchasable: false,
    canCharge: false,
    canCreateDeliveryAfterCharge: false,
    paymentAction: 'BLOCKED',
    reasonCode,
    severity,
    userMessage,
    reasons: [...base.reasons, ...reasons],
  }
}

export function buildProtectedPurchaseContract({
  profileId = null,
  asset = null,
  combination = null,
  existingDelivery = null,
  clientMediaContract = null,
} = {}) {
  const { raw: mediaTypeRaw, mediaType } = normalizeMediaType(asset, combination)
  const ids = resolveIds({ profileId, asset, combination })
  const assetStatus = getAssetStatus(asset, combination)
  const priceCredits = normalizePriceCredits(firstValue(
    combination?.price_credits,
    combination?.priceCredits,
    asset?.price_credits,
    asset?.priceCredits,
    getMetadataValue(combination, 'price_credits', 'priceCredits')
  ))

  const maxAssignments = normalizeInteger(firstValue(asset?.max_assignments, asset?.maxAssignments), 1)
  const currentAssignments = normalizeInteger(firstValue(asset?.current_assignments, asset?.currentAssignments), 0)
  const assignmentAvailable = maxAssignments <= 0 ? true : currentAssignments < maxAssignments

  const adminOnly = normalizeBoolean(firstValue(
    combination?.admin_only,
    combination?.adminOnly,
    getMetadataValue(combination, 'admin_only', 'adminOnly')
  ), false)

  const visibleToClient = normalizeBoolean(firstValue(
    combination?.visible_to_client,
    combination?.visibleToClient,
    getMetadataValue(combination, 'visible_to_client', 'visibleToClient')
  ), false)

  const isActive = normalizeBoolean(firstValue(
    combination?.is_active,
    combination?.isActive,
    combination?.active,
    getMetadataValue(combination, 'is_active', 'isActive', 'active')
  ), false)

  const publicUrlLeak = hasPublicUrlLeak(asset, combination, existingDelivery)
  const privateStoragePointer = hasPrivateStoragePointer(asset, combination)
  const simulatedOrPlaceholder = isSimulatedOrPlaceholder(asset, combination)
  const alreadyDelivered = Boolean(existingDelivery?.id)

  const base = {
    ...ids,
    mediaTypeRaw,
    mediaType,
    assetStatus: assetStatus || null,
    priceCredits,
    adminOnly,
    visibleToClient,
    isActive,
    currentAssignments,
    maxAssignments,
    assignmentAvailable,
    hasPrivateStoragePointer: privateStoragePointer,
    anyPublicUrlLeak: publicUrlLeak,
    simulatedOutput: simulatedOrPlaceholder,
    alreadyDelivered,
    existingDeliveryId: existingDelivery?.id || null,
    clientOpenableAfterDelivery: Boolean(clientMediaContract?.clientOpenable),
    protectedRendererAfterDelivery: clientMediaContract?.protectedRenderer || null,
    clientPurchasable: false,
    canCharge: false,
    canCreateDeliveryAfterCharge: false,
    paymentAction: 'BLOCKED',
    debitWalletType: 'universal',
    requiredLedgerReferenceType: 'media_asset_variant',
    requiredClaimRpc: 'claim_media_asset_with_universal_credits',
    idempotencyKey: ids.profileId && ids.assetId ? `paid-stock-claim:${ids.profileId}:${ids.assetId}` : null,
    reasonCode: 'UNKNOWN_PURCHASE_STATE',
    severity: 'BLOCKED',
    userMessage: 'Esta mídia ainda não está disponível para compra.',
    reasons: [],
  }

  if (!ids.profileId) {
    return buildBlockedContract(base, 'MISSING_PROFILE_ID', 'Faça login para comprar esta mídia.', 'BLOCKED', ['profileId ausente.'])
  }

  if (!ids.assetId) {
    return buildBlockedContract(base, 'MISSING_ASSET_ID', 'Esta mídia ainda não está disponível para compra.', 'BLOCKED', ['assetId ausente.'])
  }

  if (!ids.combinationId) {
    return buildBlockedContract(base, 'MISSING_COMBINATION_ID', 'Produto sem configuração de venda.', 'BLOCKED', ['combinationId ausente.'])
  }

  if (alreadyDelivered) {
    return {
      ...base,
      clientPurchasable: false,
      canCharge: false,
      canCreateDeliveryAfterCharge: false,
      paymentAction: 'NO_CHARGE_ALREADY_DELIVERED',
      reasonCode: 'ALREADY_DELIVERED_REOPEN_WITHOUT_CHARGE',
      severity: 'OK',
      userMessage: null,
      reasons: ['Cliente já possui entrega protegida; reabrir sem nova cobrança.'],
    }
  }

  if (publicUrlLeak) {
    return buildBlockedContract(base, 'PUBLIC_URL_LEAK_BLOCKED', 'Esta mídia precisa ser revisada antes da compra.', 'BLOCKED', ['Possível URL pública detectada.'])
  }

  if (simulatedOrPlaceholder) {
    return buildBlockedContract(base, 'SIMULATED_OR_PLACEHOLDER_NOT_PURCHASABLE', 'Esta mídia ainda está em preparação.', 'BLOCKED', ['Mídia simulada/placeholder não pode ser vendida.'])
  }

  if (assetStatus && BLOCKED_STATUSES.has(assetStatus)) {
    return buildBlockedContract(base, 'ASSET_STATUS_NOT_PURCHASABLE', 'Esta mídia ainda não está disponível para compra.', 'BLOCKED', [`Status não vendável: ${assetStatus}.`])
  }

  if (assetStatus && !PURCHASE_READY_STATUSES.has(assetStatus)) {
    return buildBlockedContract(base, 'ASSET_STATUS_NOT_CONFIRMED_PURCHASABLE', 'Esta mídia ainda precisa ser liberada.', 'REVIEW', [`Status não confirmado para venda: ${assetStatus}.`])
  }

  if (!privateStoragePointer) {
    return buildBlockedContract(base, 'MISSING_PRIVATE_STORAGE_POINTER', 'Esta mídia ainda não está pronta para entrega protegida.', 'BLOCKED', ['Ponteiro privado de entrega ausente.'])
  }

  if (!assignmentAvailable) {
    return buildBlockedContract(base, 'ASSET_SOLD_OUT', 'Esta mídia não está mais disponível.', 'BLOCKED', ['currentAssignments atingiu maxAssignments.'])
  }

  if (!isActive) {
    return buildBlockedContract(base, 'COMBINATION_NOT_ACTIVE', 'Produto indisponível no momento.', 'BLOCKED', ['Combinação inativa.'])
  }

  if (!visibleToClient || adminOnly) {
    return buildBlockedContract(base, 'COMBINATION_NOT_VISIBLE_TO_CLIENT', 'Produto ainda não está disponível para compra.', 'BLOCKED', ['Combinação invisível/adminOnly.'])
  }

  if (!Number.isInteger(priceCredits) || priceCredits <= 0) {
    return buildBlockedContract(base, 'PRICE_NOT_CONFIGURED', 'Preço da mídia não configurado para venda.', 'BLOCKED', ['price_credits precisa ser inteiro maior que zero.'])
  }

  if (mediaType === 'short_video' || mediaType === 'live_action') {
    return buildBlockedContract(base, 'VIDEO_PURCHASE_NOT_ENABLED_YET', 'Esta mídia de vídeo ainda não está disponível para compra.', 'BLOCKED', ['Vídeo/Live Action não tem renderer protegido homologado para compra.'])
  }

  if (!(mediaType === 'image' || mediaType === 'audio_live' || mediaType === 'audio_chat')) {
    return buildBlockedContract(base, 'UNSUPPORTED_MEDIA_TYPE_FOR_PURCHASE', 'Esta mídia ainda não está disponível para compra.', 'BLOCKED', [`Tipo não suportado para compra: ${mediaType}.`])
  }

  return {
    ...base,
    clientPurchasable: true,
    canCharge: true,
    canCreateDeliveryAfterCharge: true,
    paymentAction: 'CHARGE_UNIVERSAL_CREDITS_THEN_CREATE_PROTECTED_DELIVERY',
    reasonCode: mediaType === 'image' ? 'PURCHASABLE_IMAGE_PROTECTED_DELIVERY' : 'PURCHASABLE_AUDIO_PROTECTED_DELIVERY',
    severity: 'OK',
    userMessage: null,
    reasons: ['Mídia elegível para compra protegida com créditos universais.'],
  }
}

const CLIENT_SAFE_REASON_CODE_MAP = {
  PUBLIC_URL_LEAK_BLOCKED: 'ASSET_REVIEW_REQUIRED',
  MISSING_PRIVATE_STORAGE_POINTER: 'MEDIA_NOT_READY_FOR_PROTECTED_DELIVERY',
}

function sanitizeReasonCodeForClient(reasonCode) {
  const normalized = reasonCode || 'UNKNOWN_PURCHASE_STATE'
  return CLIENT_SAFE_REASON_CODE_MAP[normalized] || normalized
}

export function sanitizeClientPurchaseContract(contract) {
  return {
    mediaType: contract?.mediaType || 'unknown',
    clientPurchasable: Boolean(contract?.clientPurchasable),
    canCharge: Boolean(contract?.canCharge),
    alreadyDelivered: Boolean(contract?.alreadyDelivered),
    paymentAction: contract?.paymentAction || 'BLOCKED',
    priceCredits: Number.isInteger(Number(contract?.priceCredits)) ? Number(contract.priceCredits) : 0,
    reasonCode: sanitizeReasonCodeForClient(contract?.reasonCode),
    severity: contract?.severity || 'BLOCKED',
    userMessage: contract?.userMessage || null,
  }
}

export default {
  buildProtectedPurchaseContract,
  sanitizeClientPurchaseContract,
}
