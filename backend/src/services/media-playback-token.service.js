import crypto from 'node:crypto'
import { ApiError } from '../utils/apiError.js'

const DEFAULT_TTL_SECONDS = 120
const MIN_TTL_SECONDS = 30
const MAX_TTL_SECONDS = 300
const TOKEN_VERSION = 1

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64url')
}

function base64UrlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8')
}

function playbackSecret() {
  const secret = String(
    process.env.MEDIA_PLAYBACK_TOKEN_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '',
  ).trim()

  if (secret.length < 24) {
    throw new ApiError(503, 'Segredo de playback protegido não configurado.')
  }

  return secret
}

function normalizeTtl(value) {
  const parsed = Number(value || DEFAULT_TTL_SECONDS)
  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS
  return Math.min(Math.max(Math.trunc(parsed), MIN_TTL_SECONDS), MAX_TTL_SECONDS)
}

function signPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', playbackSecret())
    .update(encodedPayload)
    .digest('base64url')
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''))
  const rightBuffer = Buffer.from(String(right || ''))
  if (leftBuffer.length !== rightBuffer.length) return false
  return crypto.timingSafeEqual(leftBuffer, rightBuffer)
}

export function createMediaPlaybackToken({ scope, resourceId, profileId, ttlSeconds = DEFAULT_TTL_SECONDS } = {}) {
  if (!['delivery', 'catalog'].includes(scope)) {
    throw new ApiError(400, 'Escopo de playback inválido.')
  }
  if (!resourceId || !profileId) {
    throw new ApiError(400, 'Recurso e perfil são obrigatórios para playback protegido.')
  }

  const ttl = normalizeTtl(ttlSeconds)
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    v: TOKEN_VERSION,
    scope,
    resourceId: String(resourceId),
    profileId: String(profileId),
    iat: now,
    exp: now + ttl,
    nonce: crypto.randomBytes(12).toString('base64url'),
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)

  return {
    token: `${encodedPayload}.${signature}`,
    expiresIn: ttl,
    expiresAt: new Date((now + ttl) * 1000).toISOString(),
  }
}

export function verifyMediaPlaybackToken(token, { scope, resourceId } = {}) {
  const [encodedPayload, receivedSignature, extra] = String(token || '').split('.')
  if (!encodedPayload || !receivedSignature || extra) {
    throw new ApiError(401, 'Token de playback inválido.')
  }

  const expectedSignature = signPayload(encodedPayload)
  if (!safeEqual(receivedSignature, expectedSignature)) {
    throw new ApiError(401, 'Assinatura do playback inválida.')
  }

  let payload
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload))
  } catch {
    throw new ApiError(401, 'Payload de playback inválido.')
  }

  const now = Math.floor(Date.now() / 1000)
  if (payload?.v !== TOKEN_VERSION || Number(payload?.exp || 0) <= now) {
    throw new ApiError(401, 'Token de playback expirado.')
  }
  if (scope && payload.scope !== scope) {
    throw new ApiError(403, 'Token de playback não pertence a este escopo.')
  }
  if (resourceId && String(payload.resourceId) !== String(resourceId)) {
    throw new ApiError(403, 'Token de playback não pertence a este recurso.')
  }
  if (!payload.profileId) {
    throw new ApiError(401, 'Token de playback sem perfil vinculado.')
  }

  return payload
}
