import { pipeline } from 'node:stream/promises'
import { verifyMediaPlaybackToken } from '../services/media-playback-token.service.js'
import { streamProtectedDelivery } from '../services/media-delivery.service.js'
import { streamPublishedCatalogProductPreview } from '../services/client-catalog-media.service.js'

function setHeaders(res, headers = {}) {
  for (const [key, value] of Object.entries(headers || {})) {
    if (value !== null && value !== undefined) res.setHeader(key, value)
  }
}

async function sendProtectedPayload({ req, res, payload }) {
  setHeaders(res, payload.responseHeaders)
  res.status(payload.statusCode || 200)

  if (payload.kind === 'manifest') return res.send(payload.manifest)

  if (payload.kind === 'stream' && payload.bodyStream) {
    const abortUpstream = () => {
      if (!res.writableEnded) payload.abort?.()
    }
    req.once('aborted', abortUpstream)
    res.once('close', abortUpstream)
    try {
      await pipeline(payload.bodyStream, res)
    } finally {
      req.off('aborted', abortUpstream)
      res.off('close', abortUpstream)
    }
    return undefined
  }

  return res.send(payload.buffer)
}

function requestContext(req) {
  return {
    requestId: req.headers?.['x-request-id'] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers?.['user-agent'] || null,
    expiresIn: 120,
    watermarkLabel: 'PRIVACY IA',
  }
}

export async function deliveryPlaybackController(req, res, next) {
  let payload = null
  try {
    const { deliveryId, token } = req.params
    const claims = verifyMediaPlaybackToken(token, { scope: 'delivery', resourceId: deliveryId })
    payload = await streamProtectedDelivery({
      profileId: claims.profileId,
      deliveryId,
      range: req.headers?.range || null,
      requestContext: requestContext(req),
    })
    return await sendProtectedPayload({ req, res, payload })
  } catch (error) {
    payload?.abort?.()
    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }
    return next(error)
  }
}

export async function catalogPlaybackController(req, res, next) {
  let payload = null
  try {
    const { productId, token } = req.params
    const claims = verifyMediaPlaybackToken(token, { scope: 'catalog', resourceId: productId })
    payload = await streamPublishedCatalogProductPreview({
      productId,
      profileId: claims.profileId,
      range: req.headers?.range || null,
      requestContext: requestContext(req),
    })
    return await sendProtectedPayload({ req, res, payload })
  } catch (error) {
    payload?.abort?.()
    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }
    return next(error)
  }
}
