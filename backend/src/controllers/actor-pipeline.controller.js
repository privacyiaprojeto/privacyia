import { parseOrThrow } from '../utils/validators.js'
import {
  actorPipelineActorParamSchema,
  actorIdentityLoraReadinessSchema,
  actorIdentityPreparationAuthorizationSchema,
  actorIdentityDatasetRegistrationSchema,
  actorIdentityTrainingExecutionPlanSchema,
  actorIdentityTrainingStartSchema,
  actorIdentityPreviewStartSchema,
  actorIdentityVideoForensicAuditSchema,
  actorIdentityTrainingTargetAuditSchema,
  actorIdentityReviewDecisionSchema,
  actorPipelineProductParamSchema,
  actorPipelineProductionSchema,
  actorPipelineApproveSchema,
  actorPipelineRejectSchema,
  actorPipelinePublicationSchema,
} from '../validators/actor-pipeline.schemas.js'
import {
  approveActorPipelineProduct,
  createActorPipelineProduction,
  getActorPipelineSummary,
  listActorPipelinePublicationProducts,
  listActorPipelineReviewProducts,
  publishActorPipelineProduct,
  rejectActorPipelineProduct,
} from '../services/actor-pipeline.service.js'
import {
  createActorIdentityLoraReadiness,
  getActorIdentityLoraSummary,
} from '../services/actor-identity-lora.service.js'
import { auditActorIdentityDatasetReadiness } from '../services/actor-identity-dataset-readiness.service.js'
import { authorizeActorIdentityPreparation } from '../services/actor-identity-preparation.service.js'
import { registerActorIdentityDataset } from '../services/actor-identity-dataset-registration.service.js'
import { prepareActorIdentityTrainingExecutionPlan } from '../services/actor-identity-training-preflight.service.js'
import { startActorIdentityTraining, refreshActorIdentityTrainingStatus } from '../services/actor-identity-training-dispatch.service.js'
import { startActorIdentityPreview, refreshActorIdentityPreviewStatus, getActorIdentityPreviewMedia } from '../services/actor-identity-preview.service.js'
import { runActorIdentityVideoForensicAudit } from '../services/actor-identity-video-forensic.service.js'
import { runActorIdentityTrainingTargetAudit } from '../services/actor-identity-training-target-audit.service.js'
import { decideActorIdentityReview } from '../services/actor-identity-review-decision.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function adminProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function getActorPipelineSummaryController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await getActorPipelineSummary(actorId))
  } catch (error) {
    return next(error)
  }
}

export async function getActorIdentityLoraSummaryController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await getActorIdentityLoraSummary(actorId))
  } catch (error) {
    return next(error)
  }
}


export async function getActorIdentityDatasetReadinessController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await auditActorIdentityDatasetReadiness(actorId))
  } catch (error) {
    return next(error)
  }
}

export async function authorizeActorIdentityPreparationController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityPreparationAuthorizationSchema, req.body || {})
    return ok(res, await authorizeActorIdentityPreparation(actorId, input, {
      adminProfileId: adminProfileId(req),
    }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function registerActorIdentityDatasetController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityDatasetRegistrationSchema, req.body || {})
    return ok(res, await registerActorIdentityDataset(actorId, input, {
      requestedByProfileId: adminProfileId(req),
    }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function createActorIdentityLoraReadinessController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    parseOrThrow(actorIdentityLoraReadinessSchema, req.body || {})
    return ok(res, await createActorIdentityLoraReadiness(actorId, {
      requestedByProfileId: adminProfileId(req),
    }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function prepareActorIdentityTrainingExecutionPlanController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityTrainingExecutionPlanSchema, req.body || {})
    return ok(res, await prepareActorIdentityTrainingExecutionPlan(actorId, {
      requestedByProfileId: adminProfileId(req),
      confirmation: input.confirmation,
    }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function startActorIdentityTrainingController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityTrainingStartSchema, req.body || {})
    return ok(res, await startActorIdentityTraining(actorId, {
      requestedByProfileId: adminProfileId(req),
      confirmation: input.confirmation,
    }), 202)
  } catch (error) {
    return next(error)
  }
}

export async function refreshActorIdentityTrainingStatusController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await refreshActorIdentityTrainingStatus(actorId))
  } catch (error) {
    return next(error)
  }
}

export async function startActorIdentityPreviewController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityPreviewStartSchema, req.body || {})
    return ok(res, await startActorIdentityPreview(actorId, { requestedByProfileId: adminProfileId(req), confirmation: input.confirmation }), 202)
  } catch (error) { return next(error) }
}

export async function refreshActorIdentityPreviewStatusController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await refreshActorIdentityPreviewStatus(actorId))
  } catch (error) { return next(error) }
}

export async function runActorIdentityVideoForensicAuditController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityVideoForensicAuditSchema, req.body || {})
    return ok(res, await runActorIdentityVideoForensicAudit(actorId, {
      requestedByProfileId: adminProfileId(req),
      confirmation: input.confirmation,
      persist: true,
    }))
  } catch (error) { return next(error) }
}

export async function runActorIdentityTrainingTargetAuditController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityTrainingTargetAuditSchema, req.body || {})
    return ok(res, await runActorIdentityTrainingTargetAudit(actorId, {
      requestedByProfileId: adminProfileId(req),
      confirmation: input.confirmation,
      persist: true,
      verifyPrivate: true,
    }))
  } catch (error) { return next(error) }
}

export async function decideActorIdentityReviewController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorIdentityReviewDecisionSchema, req.body || {})
    return ok(res, await decideActorIdentityReview(actorId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) { return next(error) }
}

export async function getActorIdentityPreviewMediaController(req, res, next) {
  const abortController = new AbortController()
  res.on('close', () => abortController.abort())
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const media = await getActorIdentityPreviewMedia(actorId, String(req.query.asset || 'video_walk_turn_smile'), req.headers.range || null, abortController.signal)
    res.status(media.statusCode || 200)
    res.setHeader('Content-Type', media.contentType || 'video/mp4')
    res.setHeader('Cache-Control', 'private, no-store, max-age=0')
    res.setHeader('Accept-Ranges', media.acceptRanges || 'bytes')
    if (media.contentLength != null) res.setHeader('Content-Length', String(media.contentLength))
    if (media.contentRange) res.setHeader('Content-Range', media.contentRange)
    media.bodyStream.on('error', next)
    return media.bodyStream.pipe(res)
  } catch (error) { return next(error) }
}

export async function createActorPipelineProductionController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    const input = parseOrThrow(actorPipelineProductionSchema, req.body || {})
    return ok(res, await createActorPipelineProduction(actorId, input, { adminProfileId: adminProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function listActorPipelineReviewProductsController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await listActorPipelineReviewProducts(actorId))
  } catch (error) {
    return next(error)
  }
}


export async function approveActorPipelineProductController(req, res, next) {
  try {
    const { actorId, assetId } = parseOrThrow(actorPipelineProductParamSchema, req.params || {})
    const input = parseOrThrow(actorPipelineApproveSchema, req.body || {})
    return ok(res, await approveActorPipelineProduct(actorId, assetId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function rejectActorPipelineProductController(req, res, next) {
  try {
    const { actorId, assetId } = parseOrThrow(actorPipelineProductParamSchema, req.params || {})
    const input = parseOrThrow(actorPipelineRejectSchema, req.body || {})
    return ok(res, await rejectActorPipelineProduct(actorId, assetId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function listActorPipelinePublicationProductsController(req, res, next) {
  try {
    const { actorId } = parseOrThrow(actorPipelineActorParamSchema, req.params || {})
    return ok(res, await listActorPipelinePublicationProducts(actorId))
  } catch (error) {
    return next(error)
  }
}

export async function publishActorPipelineProductController(req, res, next) {
  try {
    const { actorId, assetId } = parseOrThrow(actorPipelineProductParamSchema, req.params || {})
    const input = parseOrThrow(actorPipelinePublicationSchema, req.body || {})
    return ok(res, await publishActorPipelineProduct(actorId, assetId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}
