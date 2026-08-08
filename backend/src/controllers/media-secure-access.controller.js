import { createAdminSecureAssetPreview } from '../services/media-secure-access.service.js'

function resolveActorProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function createAdminSecureAssetPreviewController(req, res, next) {
  try {
    const { assetId } = req.params

    const result = await createAdminSecureAssetPreview(assetId, {
      actorProfileId: resolveActorProfileId(req),
      expiresIn: req.body?.expiresIn || req.body?.expires_in || req.query?.expiresIn || null,
      source: 'admin_secure_asset_preview_route',
    })

    res.setHeader('Cache-Control', result.protection.cacheControl)
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', result.protection.contentSecurityPolicy)

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
