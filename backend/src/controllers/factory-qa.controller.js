import { approveAssetVariant, rejectAssetVariant } from '../services/factory-qa.service.js'

function resolveActorProfileId(req) {
  return req.auth?.profile?.id || null
}

function buildRequestContext(req) {
  return {
    actorProfileId: resolveActorProfileId(req),
    source: 'admin_factory_qa_route',
    requestId: req.headers?.['x-request-id'] || null,
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: req.headers?.['user-agent'] || null,
  }
}

export async function approveAssetVariantController(req, res, next) {
  try {
    const { assetId } = req.params

    const result = await approveAssetVariant(assetId, {
      ...buildRequestContext(req),
      notes: req.body?.notes || req.body?.observacao || null,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function rejectAssetVariantController(req, res, next) {
  try {
    const { assetId } = req.params

    const result = await rejectAssetVariant(assetId, {
      ...buildRequestContext(req),
      reason: req.body?.reason || req.body?.rejectionReason || req.body?.motivo || req.body?.observacao || null,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
