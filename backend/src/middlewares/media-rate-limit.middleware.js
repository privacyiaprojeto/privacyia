import crypto from 'node:crypto'
import { env } from '../config/env.js'
import { getRedisConnection } from '../config/redis.js'
import { ApiError } from '../utils/apiError.js'

const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
return { current, ttl }
`

function stableHash(value) {
  return crypto.createHash('sha256').update(String(value || 'anonymous')).digest('hex').slice(0, 24)
}

function resolveIdentity(req) {
  const profileId = req.auth?.profile?.id || req.auth?.user?.id || null
  if (profileId) return `profile:${profileId}`

  const ip = req.ip || req.socket?.remoteAddress || req.headers?.['x-forwarded-for'] || 'unknown'
  return `ip:${ip}`
}

function setRateLimitHeaders(res, { limit, remaining, resetMs }) {
  const resetSeconds = Math.max(Math.ceil(Number(resetMs || 0) / 1000), 1)
  res.setHeader('RateLimit-Limit', String(limit))
  res.setHeader('RateLimit-Remaining', String(Math.max(remaining, 0)))
  res.setHeader('RateLimit-Reset', String(resetSeconds))
  res.setHeader('X-RateLimit-Limit', String(limit))
  res.setHeader('X-RateLimit-Remaining', String(Math.max(remaining, 0)))
  res.setHeader('X-RateLimit-Reset', String(resetSeconds))
}

export function createMediaRateLimit({ scope, limit, windowMs } = {}) {
  const finalScope = String(scope || 'media').replace(/[^a-zA-Z0-9:_-]+/g, '-')
  const finalLimit = Math.max(Number(limit || 1), 1)
  const finalWindowMs = Math.max(Number(windowMs || 60000), 1000)

  return async function mediaRateLimitMiddleware(req, res, next) {
    try {
      const identityHash = stableHash(resolveIdentity(req))
      const redis = getRedisConnection('privacy-ia-media-rate-limit')
      const bucket = Math.floor(Date.now() / finalWindowMs)
      const key = `${env.REDIS_QUEUE_PREFIX}:rate-limit:${finalScope}:${identityHash}:${bucket}`
      const result = await redis.eval(RATE_LIMIT_SCRIPT, 1, key, String(finalWindowMs))
      const current = Number(Array.isArray(result) ? result[0] : 0)
      const ttl = Number(Array.isArray(result) ? result[1] : finalWindowMs)
      const remaining = finalLimit - current

      setRateLimitHeaders(res, {
        limit: finalLimit,
        remaining,
        resetMs: ttl > 0 ? ttl : finalWindowMs,
      })

      if (current > finalLimit) {
        const retryAfter = Math.max(Math.ceil((ttl > 0 ? ttl : finalWindowMs) / 1000), 1)
        res.setHeader('Retry-After', String(retryAfter))
        return res.status(429).json({
          success: false,
          error: 'Limite temporário de acesso à mídia excedido.',
          code: 'MEDIA_RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: retryAfter,
        })
      }

      return next()
    } catch (error) {
      if (env.NODE_ENV === 'production') {
        return next(new ApiError(503, 'Proteção distribuída de mídia temporariamente indisponível.', {
          code: 'MEDIA_RATE_LIMIT_UNAVAILABLE',
          scope: finalScope,
          error: error.message,
        }))
      }

      console.warn(`[media-rate-limit] Redis indisponível em ${finalScope}; liberando apenas fora de produção.`, error.message)
      return next()
    }
  }
}

export const mediaDeliveriesRateLimit = createMediaRateLimit({
  scope: 'deliveries',
  limit: env.MEDIA_RATE_LIMIT_DELIVERIES_MAX,
  windowMs: env.MEDIA_RATE_LIMIT_WINDOW_MS,
})

export const protectedMediaViewRateLimit = createMediaRateLimit({
  scope: 'protected-view',
  limit: env.MEDIA_RATE_LIMIT_PROTECTED_VIEW_MAX,
  windowMs: env.MEDIA_RATE_LIMIT_WINDOW_MS,
})
