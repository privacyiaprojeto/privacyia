import { fetchSecureAssetProxyPayload } from '../services/media-secure-stream.service.js'

function resolveActorProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function proxyAdminSecureAssetPreviewController(req, res, next) {
  try {
    const { assetId } = req.params

    const result = await fetchSecureAssetProxyPayload(assetId, {
      actorProfileId: resolveActorProfileId(req),
      expiresIn: req.query?.expiresIn || req.body?.expiresIn || req.body?.expires_in || 120,
      source: 'admin_secure_asset_proxy_route',
    })

    res.setHeader('Content-Type', result.responseHeaders.contentType)
    res.setHeader('Cache-Control', result.responseHeaders.cacheControl)
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', result.responseHeaders.contentSecurityPolicy)
    res.setHeader('Content-Disposition', result.responseHeaders.contentDisposition)

    if (result.responseHeaders.contentLength) {
      res.setHeader('Content-Length', result.responseHeaders.contentLength)
    }

    if (result.responseHeaders.etag) {
      res.setHeader('ETag', result.responseHeaders.etag)
    }

    if (result.responseHeaders.lastModified) {
      res.setHeader('Last-Modified', result.responseHeaders.lastModified)
    }

    return res.status(200).send(result.buffer)
  } catch (error) {
    return next(error)
  }
}
