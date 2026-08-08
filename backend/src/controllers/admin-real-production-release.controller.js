import {
  applyRealProductionReleaseDecision,
  getRealProductionReleaseConfig,
  inspectRealProductionRelease,
} from '../services/real-production-release.service.js'

function getAdminProfileId(req) {
  return req.auth?.profile?.id || req.auth?.user?.id || null
}

function buildReleaseInput(req) {
  return {
    assetId: req.body?.assetId ?? req.body?.asset_id ?? req.params?.assetId ?? req.query?.assetId ?? null,
    batchId: req.body?.batchId ?? req.body?.batch_id ?? req.query?.batchId ?? null,
    batchItemId: req.body?.batchItemId ?? req.body?.batch_item_id ?? req.query?.batchItemId ?? null,
    queueJobId: req.body?.queueJobId ?? req.body?.queue_job_id ?? req.query?.queueJobId ?? null,
    companionId: req.body?.companionId ?? req.body?.companion_id ?? req.query?.companionId ?? null,
    combinationId: req.body?.combinationId ?? req.body?.combination_id ?? req.query?.combinationId ?? null,
  }
}

export async function getRealProductionReleaseConfigController(_req, res, next) {
  try {
    return res.status(200).json({
      success: true,
      data: getRealProductionReleaseConfig(),
    })
  } catch (error) {
    return next(error)
  }
}

export async function inspectRealProductionReleaseController(req, res, next) {
  try {
    const result = await inspectRealProductionRelease(buildReleaseInput(req))

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function decideRealProductionReleaseController(req, res, next) {
  try {
    const result = await applyRealProductionReleaseDecision({
      ...buildReleaseInput(req),
      action: req.body?.action ?? req.query?.action ?? null,
      confirmationPhrase: req.body?.confirmationPhrase ?? req.body?.confirmation_phrase ?? '',
      actorProfileId: getAdminProfileId(req),
      notes: req.body?.notes ?? null,
      apply: req.body?.apply === true,
      allowMutation: req.body?.allowMutation === true,
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
