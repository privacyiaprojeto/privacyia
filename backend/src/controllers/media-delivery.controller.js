import { pipeline } from 'node:stream/promises'
import {
  claimAvailableAssetForProfile,
  claimAvailableAssetForProfileWithCredits,
  listAvailableMediaAssets,
  listProfileMediaDeliveries,
  previewProtectedPurchaseForProfile,
  getProtectedDeliveryMediaDescriptor,
  streamProtectedDelivery,
} from '../services/media-delivery.service.js'
import { getPublishedCatalogMediaDescriptor } from '../services/client-catalog-media.service.js'
import { createMediaPlaybackToken } from '../services/media-playback-token.service.js'

function getProfileId(req) {
  return req.auth?.profile?.id || null
}

function setProtectedHeaders(res, headers = {}) {
  for (const [key, value] of Object.entries(headers || {})) {
    if (value !== null && value !== undefined) {
      res.setHeader(key, value)
    }
  }
}

function isPreviewRequest(req) {
  const value = req.query?.preview ?? req.body?.preview ?? req.body?.dryRun ?? req.body?.previewOnly
  return value === true || value === 'true' || value === 1 || value === '1' || value === 'preview'
}

export async function listAvailableMediaAssetsController(req, res, next) {
  try {
    const profileId = getProfileId(req)

    const result = await listAvailableMediaAssets({
      profileId,
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 30,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listMyMediaDeliveriesController(req, res, next) {
  try {
    const profileId = getProfileId(req)

    const result = await listProfileMediaDeliveries({
      profileId,
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 30,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function previewMediaAssetClaimController(req, res, next) {
  try {
    const profileId = getProfileId(req)
    const { assetId } = req.params

    const result = await previewProtectedPurchaseForProfile({
      profileId,
      assetId,
      deliverySource: req.body?.deliverySource || req.query?.deliverySource || 'button',
    })

    return res.status(200).json({
      success: true,
      mode: 'preview',
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function claimMediaAssetController(req, res, next) {
  try {
    const profileId = getProfileId(req)
    const { assetId } = req.params

    if (isPreviewRequest(req)) {
      const result = await previewProtectedPurchaseForProfile({
        profileId,
        assetId,
        deliverySource: req.body?.deliverySource || 'button',
      })

      return res.status(200).json({
        success: true,
        mode: 'preview',
        data: result,
      })
    }

    const result = await claimAvailableAssetForProfileWithCredits({
      profileId,
      assetId,
      deliverySource: req.body?.deliverySource || 'button',
      // M4.8F2B: mídia de estoque comprada com créditos universais não deve exigir assinatura ativa.
      // A compra paga já é protegida por contrato, saldo, RPC idempotente e entrega protegida.
      requireSubscription: false,
      priceOverrideCredits: null,
    })

    return res.status(result?.alreadyDelivered ? 200 : 201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function claimMediaAssetWithoutCreditsController(req, res, next) {
  try {
    const profileId = getProfileId(req)
    const { assetId } = req.params

    const result = await claimAvailableAssetForProfile({
      profileId,
      assetId,
      deliverySource: req.body?.deliverySource || 'admin_grant',
      requireSubscription: true,
    })

    return res.status(result?.alreadyDelivered ? 200 : 201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function createDeliveryPlaybackAccessController(req, res, next) {
  try {
    const profileId = getProfileId(req)
    const { deliveryId } = req.params
    const descriptor = await getProtectedDeliveryMediaDescriptor({ profileId, deliveryId })

    if (descriptor.mediaStatus !== 'ready') {
      return res.status(descriptor.mediaStatus === 'processing' ? 202 : 409).json({
        success: true,
        data: descriptor,
      })
    }

    const access = createMediaPlaybackToken({ scope: 'delivery', resourceId: deliveryId, profileId })
    return res.status(200).json({
      success: true,
      data: {
        ...descriptor,
        playbackUrl: `/media-playback/delivery/${deliveryId}/${access.token}`,
        expiresAt: access.expiresAt,
        expiresIn: access.expiresIn,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function createCatalogProductPlaybackAccessController(req, res, next) {
  try {
    const profileId = getProfileId(req)
    const { productId } = req.params
    const descriptor = await getPublishedCatalogMediaDescriptor(productId)

    if (descriptor.mediaStatus !== 'ready') {
      return res.status(descriptor.mediaStatus === 'processing' ? 202 : 409).json({
        success: true,
        data: {
          productId,
          mediaStatus: descriptor.mediaStatus,
          streamKind: descriptor.streamKind,
          mediaType: descriptor.mediaType,
          userMessage: descriptor.userMessage,
        },
      })
    }

    const access = createMediaPlaybackToken({ scope: 'catalog', resourceId: productId, profileId })
    return res.status(200).json({
      success: true,
      data: {
        productId,
        mediaStatus: descriptor.mediaStatus,
        streamKind: descriptor.streamKind,
        mediaType: descriptor.mediaType,
        userMessage: descriptor.userMessage,
        playbackUrl: `/media-playback/catalog/${productId}/${access.token}`,
        expiresAt: access.expiresAt,
        expiresIn: access.expiresIn,
      },
    })
  } catch (error) {
    return next(error)
  }
}

export async function protectedDeliveryViewController(req, res, next) {
  let result = null

  try {
    const profileId = getProfileId(req)
    const { deliveryId } = req.params

    result = await streamProtectedDelivery({
      profileId,
      deliveryId,
      range: req.headers?.range || null,
      requestContext: {
        requestId: req.headers?.['x-request-id'] || null,
        ip: req.ip || req.socket?.remoteAddress || null,
        userAgent: req.headers?.['user-agent'] || null,
        expiresIn: req.query?.expiresIn || 120,
        watermarkLabel: req.query?.watermarkLabel || 'PRIVACY IA',
      },
    })

    setProtectedHeaders(res, result.responseHeaders)
    res.status(result.statusCode || 200)

    if (result.kind === 'manifest') {
      return res.send(result.manifest)
    }

    if (result.kind === 'stream' && result.bodyStream) {
      const abortUpstream = () => {
        if (!res.writableEnded) result.abort?.()
      }

      req.once('aborted', abortUpstream)
      res.once('close', abortUpstream)

      try {
        await pipeline(result.bodyStream, res)
      } finally {
        req.off('aborted', abortUpstream)
        res.off('close', abortUpstream)
      }

      return undefined
    }

    return res.send(result.buffer)
  } catch (error) {
    result?.abort?.()

    if (res.headersSent) {
      res.destroy(error)
      return undefined
    }

    return next(error)
  }
}
