import { api } from '@/shared/lib/axios'
import type { ClientMediaContract } from '@/features/cliente/atriz-perfil/types'

export interface MediaDeliveryListItem {
  id: string
  createdAt?: string | null
  deliverySource?: string | null
  protectedViewUrl?: string | null
  variantId?: string | null
  combinationId?: string | null
  companionId?: string | null
  mediaContract?: ClientMediaContract | null
  pricing?: {
    totalPriceCredits?: number | null
    companionCreditsUsed?: number | null
    universalCreditsUsed?: number | null
  } | null
  asset?: {
    id?: string | null
    variantId?: string | null
    mediaType?: string | null
    status?: string | null
    variantNumber?: number | null
    publishedAt?: string | null
  } | null
  companion?: {
    id?: string | null
    name?: string | null
    slug?: string | null
  } | null
  combination?: {
    id?: string | null
    key?: string | null
    title?: string | null
    mediaType?: string | null
    priceCredits?: number | null
  } | null
}

export interface MediaDeliveryListResponse {
  items: MediaDeliveryListItem[]
  pagination?: {
    limit?: number
    offset?: number
    returned?: number
    hasMore?: boolean
  }
}

type AnyRecord = Record<string, any>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? value as AnyRecord : {}
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }

  return null
}

function normalizeProtectedViewUrl(raw: AnyRecord) {
  const value = firstString(
    raw.protectedViewUrl,
    raw.protected_view_url,
    raw.protected_view,
    raw.protectedUrl,
    raw.view_url,
    raw.url,
  )

  if (!value) return null

  // Não aceitar URL pública/R2 aqui. O cliente só deve abrir rota protegida do backend.
  if (/^https?:\/\//i.test(value)) return null
  if (!value.includes('/protected-view')) return null

  return value.startsWith('/') ? value : `/${value}`
}

function normalizeMediaContract(rawValue: unknown): ClientMediaContract | null {
  const raw = asRecord(rawValue)

  if (Object.keys(raw).length === 0) return null

  const reasonCode = firstString(raw.reasonCode, raw.reason_code, raw.code)
  const severity = firstString(raw.severity, raw.level)
  const mediaType = firstString(raw.mediaType, raw.media_type)
  const protectedRenderer = firstString(raw.protectedRenderer, raw.protected_renderer, raw.renderer)
  const userMessage = firstString(raw.userMessage, raw.user_message, raw.message)
  const clientSupported = firstBoolean(raw.clientSupported, raw.client_supported)
  const clientOpenable = firstBoolean(raw.clientOpenable, raw.client_openable)
  const clientPurchasable = firstBoolean(raw.clientPurchasable, raw.client_purchasable)

  if (
    !reasonCode &&
    !severity &&
    !mediaType &&
    !protectedRenderer &&
    userMessage === null &&
    clientSupported === null &&
    clientOpenable === null &&
    clientPurchasable === null
  ) {
    return null
  }

  return {
    mediaType,
    clientSupported,
    clientOpenable,
    clientPurchasable,
    protectedRenderer,
    reasonCode,
    severity,
    userMessage,
  }
}

function normalizeDeliveryItem(rawValue: unknown): MediaDeliveryListItem | null {
  const raw = asRecord(rawValue)
  const asset = asRecord(raw.asset || raw.mediaAsset || raw.media_asset || raw.variant || raw.media_asset_variant)
  const companion = asRecord(raw.companion || raw.avatar || raw.atriz)
  const combination = asRecord(raw.combination || raw.mediaCombination || raw.media_combination)
  const pricing = asRecord(raw.pricing || raw.price || raw.finance)
  const mediaContract = normalizeMediaContract(raw.mediaContract || raw.media_contract || raw.contract)

  const id = firstString(raw.id, raw.deliveryId, raw.delivery_id)
  if (!id) return null

  const totalPriceCredits = firstNumber(
    pricing.totalPriceCredits,
    pricing.total_price_credits,
    raw.totalPriceCredits,
    raw.total_price_credits,
    combination.priceCredits,
    combination.price_credits,
  )

  return {
    id,
    createdAt: firstString(raw.createdAt, raw.created_at),
    deliverySource: firstString(raw.deliverySource, raw.delivery_source),
    protectedViewUrl: normalizeProtectedViewUrl(raw),
    variantId: firstString(raw.variantId, raw.variant_id, raw.assetVariantId, raw.asset_variant_id, raw.mediaAssetVariantId, raw.media_asset_variant_id, asset.variantId, asset.variant_id, asset.id),
    combinationId: firstString(raw.combinationId, raw.combination_id, combination.id),
    companionId: firstString(raw.companionId, raw.companion_id, raw.avatarId, raw.avatar_id, companion.id),
    mediaContract,
    pricing: {
      totalPriceCredits,
      companionCreditsUsed: firstNumber(pricing.companionCreditsUsed, pricing.companion_credits_used, raw.companionCreditsUsed, raw.companion_credits_used),
      universalCreditsUsed: firstNumber(pricing.universalCreditsUsed, pricing.universal_credits_used, raw.universalCreditsUsed, raw.universal_credits_used),
    },
    asset: {
      id: firstString(asset.id, raw.assetId, raw.asset_id, raw.variantId, raw.variant_id),
      variantId: firstString(asset.variantId, asset.variant_id, raw.variantId, raw.variant_id),
      mediaType: firstString(asset.mediaType, asset.media_type, raw.mediaType, raw.media_type, combination.mediaType, combination.media_type),
      status: firstString(asset.status, raw.status),
      variantNumber: firstNumber(asset.variantNumber, asset.variant_number),
      publishedAt: firstString(asset.publishedAt, asset.published_at),
    },
    companion: {
      id: firstString(companion.id, raw.companionId, raw.companion_id),
      name: firstString(companion.name, companion.nome, companion.title),
      slug: firstString(companion.slug),
    },
    combination: {
      id: firstString(combination.id, raw.combinationId, raw.combination_id),
      key: firstString(combination.key, combination.slug),
      title: firstString(combination.title, combination.publicTitle, combination.public_title, raw.title, raw.publicTitle, raw.public_title),
      mediaType: firstString(combination.mediaType, combination.media_type, raw.mediaType, raw.media_type),
      priceCredits: firstNumber(combination.priceCredits, combination.price_credits, totalPriceCredits),
    },
  }
}

function getArrayFromResponse(raw: unknown): unknown[] {
  const root = asRecord(raw)
  const data = root.data
  const dataRecord = asRecord(data)

  if (Array.isArray(data)) return data
  if (Array.isArray(root.items)) return root.items
  if (Array.isArray(root.deliveries)) return root.deliveries
  if (Array.isArray(root.results)) return root.results
  if (Array.isArray(dataRecord.items)) return dataRecord.items
  if (Array.isArray(dataRecord.deliveries)) return dataRecord.deliveries
  if (Array.isArray(dataRecord.results)) return dataRecord.results

  return []
}

function normalizeListResponse(raw: unknown): MediaDeliveryListResponse {
  const root = asRecord(raw)
  const dataRecord = asRecord(root.data)
  const items = getArrayFromResponse(raw)
    .map(normalizeDeliveryItem)
    .filter((item): item is MediaDeliveryListItem => Boolean(item))

  return {
    items,
    pagination: root.pagination || dataRecord.pagination,
  }
}

function mergeDeliveryResponses(...responses: MediaDeliveryListResponse[]): MediaDeliveryListResponse {
  const seen = new Set<string>()
  const items: MediaDeliveryListItem[] = []

  for (const response of responses) {
    for (const item of response.items || []) {
      const key = item.id || item.variantId || item.combinationId
      if (!key || seen.has(key)) continue
      seen.add(key)
      items.push(item)
    }
  }

  return { items }
}

function normalizeId(value: unknown) {
  return String(value || '').trim().toLowerCase()
}

function isSameId(a: unknown, b: unknown) {
  const left = normalizeId(a)
  const right = normalizeId(b)
  return Boolean(left && right && left === right)
}

function deliveryBelongsToCompanion(delivery: MediaDeliveryListItem, companionId: string) {
  const target = normalizeId(companionId)
  if (!target) return false

  return [
    delivery.companionId,
    delivery.companion?.id,
  ].some((value) => isSameId(value, target))
}

function normalizeMediaType(value: unknown) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isExplicitLiveAudioDelivery(delivery: MediaDeliveryListItem) {
  const mediaType = normalizeMediaType(
    delivery.mediaContract?.mediaType
    || delivery.asset?.mediaType
    || delivery.combination?.mediaType,
  )

  return mediaType === 'audio_live' || mediaType === 'live_audio'
}

function filterAudioLiveDeliveriesForCompanion(response: MediaDeliveryListResponse, companionId: string): MediaDeliveryListResponse {
  return {
    ...response,
    items: (response.items || []).filter((delivery) => (
      deliveryBelongsToCompanion(delivery, companionId) && isExplicitLiveAudioDelivery(delivery)
    )),
  }
}

export async function getLiveAudioDeliveries(companionId: string): Promise<MediaDeliveryListResponse> {
  const cleanCompanionId = String(companionId || '').trim()
  if (!cleanCompanionId) return { items: [] }

  const primary = await api.get('/media/deliveries', {
    params: {
      companionId: cleanCompanionId,
      companion_id: cleanCompanionId,
      mediaType: 'audio_live',
      media_type: 'audio_live',
      limit: 100,
    },
  })

  const normalizedPrimary = normalizeListResponse(primary.data)
  const scopedPrimary = filterAudioLiveDeliveriesForCompanion(normalizedPrimary, cleanCompanionId)
  if (scopedPrimary.items.length > 0) return scopedPrimary

  // Alguns backends ignoram companionId/mediaType e retornam entregas gerais do usuário.
  // O fallback continua permitido, mas NUNCA devolve entrega de outro avatar/personagem.
  try {
    const fallback = await api.get('/media/deliveries', {
      params: { limit: 100 },
    })

    const scopedFallback = filterAudioLiveDeliveriesForCompanion(normalizeListResponse(fallback.data), cleanCompanionId)
    return mergeDeliveryResponses(scopedPrimary, scopedFallback)
  } catch (error) {
    console.warn('Fallback de entregas Audio Live não retornou dados:', error)
    return scopedPrimary
  }
}
