import {
  applyRealProductionQaDecision,
  getRealProductionQaControlConfig,
  inspectRealProductionQaAsset,
} from '../services/real-production-qa-control.service.js'

function getAdminProfileId(req) {
  return req.auth?.profile?.id || req.auth?.user?.id || null
}

function buildQaInput(req) {
  return {
    assetId: req.body?.assetId ?? req.body?.asset_id ?? req.params?.assetId ?? req.query?.assetId ?? null,
    batchId: req.body?.batchId ?? req.body?.batch_id ?? req.query?.batchId ?? null,
    batchItemId: req.body?.batchItemId ?? req.body?.batch_item_id ?? req.query?.batchItemId ?? null,
    queueJobId: req.body?.queueJobId ?? req.body?.queue_job_id ?? req.query?.queueJobId ?? null,
    companionId: req.body?.companionId ?? req.body?.companion_id ?? req.query?.companionId ?? null,
    combinationId: req.body?.combinationId ?? req.body?.combination_id ?? req.query?.combinationId ?? null,
    headR2: req.body?.headR2 ?? req.query?.headR2 ?? false,
    securePreview: req.body?.securePreview ?? req.query?.securePreview ?? false,
    printSignedUrl: false,
    actorProfileId: getAdminProfileId(req),
  }
}

export async function getRealProductionQaControlConfigController(_req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: getRealProductionQaControlConfig(),
    })
  } catch (error) {
    return next(error)
  }
}

export async function inspectRealProductionQaAssetController(req, res, next) {
  try {
    const result = await inspectRealProductionQaAsset(buildQaInput(req))

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function decideRealProductionQaAssetController(req, res, next) {
  try {
    const result = await applyRealProductionQaDecision({
      ...buildQaInput(req),
      action: req.body?.action ?? req.query?.action ?? null,
      apply: req.body?.apply === true,
      allowMutation: req.body?.allowMutation === true,
      confirmationPhrase: req.body?.confirmationPhrase ?? req.body?.confirmation_phrase ?? '',
      reason: req.body?.reason ?? req.body?.rejectionReason ?? null,
      notes: req.body?.notes ?? null,
    })

    const statusCode = result.status?.startsWith('BLOCKED') ? 409 : 200

    return res.status(statusCode).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
