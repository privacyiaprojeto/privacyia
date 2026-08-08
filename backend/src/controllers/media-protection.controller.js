import { fetchProtectedAssetPayload } from '../services/media-protection.service.js'

function resolveActorProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function protectedAssetViewController(req, res, next) {
  try {
    const { assetId } = req.params

    const result = await fetchProtectedAssetPayload(assetId, {
      actorProfileId: resolveActorProfileId(req),
      requestId: req.headers?.['x-request-id'] || null,
      ip: req.ip || req.socket?.remoteAddress || null,
      userAgent: req.headers?.['user-agent'] || null,
      expiresIn: req.query?.expiresIn || req.body?.expiresIn || 120,
      watermarkLabel: req.query?.watermarkLabel || req.body?.watermarkLabel || 'PRIVACY IA',
      range: req.headers?.range || null,
      source: 'protected_asset_view_route',
    })

    for (const [key, value] of Object.entries(result.responseHeaders)) {
      if (value !== null && value !== undefined) {
        res.setHeader(key, value)
      }
    }

    return res.status(result.statusCode || 200).send(result.buffer)
  } catch (error) {
    return next(error)
  }
}
