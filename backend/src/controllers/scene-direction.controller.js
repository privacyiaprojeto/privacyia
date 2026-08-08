import { parseOrThrow } from '../utils/validators.js'
import {
  createBaseSceneUploadSchema,
  createSceneDirectionSchema,
  listBaseScenesQuerySchema,
  listSceneDirectionsQuerySchema,
  productIdParamSchema,
  replaceProductSplitsSchema,
  sceneIdParamSchema,
  updateBaseSceneSchema,
} from '../validators/scene-direction.schemas.js'
import {
  completeBaseSceneUpload,
  createBaseScenePreview,
  createBaseSceneUploadSession,
  createSceneDirection,
  getProductSplits,
  listBaseScenes,
  listSceneCastingCandidates,
  listSceneDirections,
  listSplitBeneficiaries,
  replaceProductSplits,
  updateBaseScene,
} from '../services/scene-direction.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function adminProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function listBaseScenesController(req, res, next) {
  try {
    const query = parseOrThrow(listBaseScenesQuerySchema, req.query || {})
    return ok(res, await listBaseScenes(query))
  } catch (error) {
    return next(error)
  }
}

export async function createBaseSceneUploadController(req, res, next) {
  try {
    const input = parseOrThrow(createBaseSceneUploadSchema, req.body || {})
    return ok(res, await createBaseSceneUploadSession(input, { adminProfileId: adminProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function completeBaseSceneUploadController(req, res, next) {
  try {
    const { sceneId } = parseOrThrow(sceneIdParamSchema, req.params || {})
    return ok(res, await completeBaseSceneUpload(sceneId, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function updateBaseSceneController(req, res, next) {
  try {
    const { sceneId } = parseOrThrow(sceneIdParamSchema, req.params || {})
    const input = parseOrThrow(updateBaseSceneSchema, req.body || {})
    return ok(res, await updateBaseScene(sceneId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function createBaseScenePreviewController(req, res, next) {
  try {
    const { sceneId } = parseOrThrow(sceneIdParamSchema, req.params || {})
    return ok(res, await createBaseScenePreview(sceneId))
  } catch (error) {
    return next(error)
  }
}

export async function listSceneCastingCandidatesController(_req, res, next) {
  try {
    return ok(res, await listSceneCastingCandidates())
  } catch (error) {
    return next(error)
  }
}

export async function createSceneDirectionController(req, res, next) {
  try {
    const input = parseOrThrow(createSceneDirectionSchema, req.body || {})
    return ok(res, await createSceneDirection(input, { adminProfileId: adminProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function listSceneDirectionsController(req, res, next) {
  try {
    const query = parseOrThrow(listSceneDirectionsQuerySchema, req.query || {})
    return ok(res, await listSceneDirections(query))
  } catch (error) {
    return next(error)
  }
}

export async function listSplitBeneficiariesController(_req, res, next) {
  try {
    return ok(res, await listSplitBeneficiaries())
  } catch (error) {
    return next(error)
  }
}

export async function getProductSplitsController(req, res, next) {
  try {
    const { productId } = parseOrThrow(productIdParamSchema, req.params || {})
    return ok(res, await getProductSplits(productId))
  } catch (error) {
    return next(error)
  }
}

export async function replaceProductSplitsController(req, res, next) {
  try {
    const { productId } = parseOrThrow(productIdParamSchema, req.params || {})
    const { splits } = parseOrThrow(replaceProductSplitsSchema, req.body || {})
    return ok(res, await replaceProductSplits(productId, splits, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}
