import { api } from '@/shared/lib/axios'

export type MediaPurchasePaymentAction =
  | 'CHARGE_UNIVERSAL_CREDITS_THEN_CREATE_PROTECTED_DELIVERY'
  | 'NO_CHARGE_ALREADY_DELIVERED'
  | 'BLOCKED'
  | string

export interface MediaPurchaseContract {
  mediaType?: string | null
  clientPurchasable: boolean
  canCharge: boolean
  alreadyDelivered: boolean
  paymentAction: MediaPurchasePaymentAction
  priceCredits: number
  reasonCode: string
  severity: 'OK' | 'BLOCKED' | 'REVIEW' | string
  userMessage?: string | null
}

export interface MediaPurchasePreviewResponse {
  mode?: 'preview' | string
  preview?: boolean
  deliverySource?: string | null
  assetId?: string | null
  combinationId?: string | null
  companionId?: string | null
  existingDeliveryId?: string | null
  protectedViewUrl?: string | null
  purchaseContract: MediaPurchaseContract
}

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
}

type AnyRecord = Record<string, unknown>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? value as AnyRecord : {}
}

function unwrapEnvelope<T>(value: T | ApiEnvelope<T>): T {
  const root = asRecord(value)
  if ('data' in root && root.data && typeof root.data === 'object') return root.data as T
  return value as T
}

function toBool(value: unknown) {
  return value === true
}

function toNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizeProtectedViewUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null
  const trimmed = value.trim()

  // Cliente só deve consumir rota protegida do backend, nunca URL pública/storage direto.
  if (/^https?:\/\//i.test(trimmed)) return null
  if (!trimmed.includes('/protected-view')) return null

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

function normalizeContract(rawValue: unknown): MediaPurchaseContract {
  const raw = asRecord(rawValue)

  return {
    mediaType: typeof raw.mediaType === 'string' ? raw.mediaType : null,
    clientPurchasable: toBool(raw.clientPurchasable),
    canCharge: toBool(raw.canCharge),
    alreadyDelivered: toBool(raw.alreadyDelivered),
    paymentAction: String(raw.paymentAction || 'BLOCKED'),
    priceCredits: toNumber(raw.priceCredits),
    reasonCode: String(raw.reasonCode || 'PURCHASE_PREVIEW_UNAVAILABLE'),
    severity: String(raw.severity || 'BLOCKED'),
    userMessage: typeof raw.userMessage === 'string' ? raw.userMessage : null,
  }
}

function normalizePreview(rawValue: unknown): MediaPurchasePreviewResponse {
  const raw = asRecord(unwrapEnvelope(rawValue as MediaPurchasePreviewResponse | ApiEnvelope<MediaPurchasePreviewResponse>))

  return {
    mode: typeof raw.mode === 'string' ? raw.mode : 'preview',
    preview: raw.preview === true || raw.mode === 'preview',
    deliverySource: typeof raw.deliverySource === 'string' ? raw.deliverySource : null,
    assetId: typeof raw.assetId === 'string' ? raw.assetId : null,
    combinationId: typeof raw.combinationId === 'string' ? raw.combinationId : null,
    companionId: typeof raw.companionId === 'string' ? raw.companionId : null,
    existingDeliveryId: typeof raw.existingDeliveryId === 'string' ? raw.existingDeliveryId : null,
    protectedViewUrl: normalizeProtectedViewUrl(raw.protectedViewUrl),
    purchaseContract: normalizeContract(raw.purchaseContract),
  }
}

export async function getMediaPurchasePreview(assetId: string): Promise<MediaPurchasePreviewResponse> {
  const cleanAssetId = String(assetId || '').trim()
  if (!cleanAssetId) throw new Error('Asset obrigatório para consultar preview de compra.')

  const { data } = await api.get(`/media/assets/${encodeURIComponent(cleanAssetId)}/claim-preview`)
  return normalizePreview(data)
}

export async function postMediaPurchasePreview(
  assetId: string,
  input?: { deliverySource?: string | null; expectedPriceCredits?: number | null },
): Promise<MediaPurchasePreviewResponse> {
  const cleanAssetId = String(assetId || '').trim()
  if (!cleanAssetId) throw new Error('Asset obrigatório para consultar preview de compra.')

  const { data } = await api.post(`/media/assets/${encodeURIComponent(cleanAssetId)}/claim?preview=true`, {
    deliverySource: input?.deliverySource || 'button',
    expectedPriceCredits: input?.expectedPriceCredits ?? undefined,
  })

  return normalizePreview(data)
}
