import {
  createNarrativeProductDraft,
  getNarrativeStudioSpec,
  inspectNarrativeDraftsReadiness,
  listNarrativeProductDrafts,
  inspectNarrativeStudioReadiness,
  previewNarrativeProduct,
} from '../services/narrative-studio.service.js'
import { parseOrThrow } from '../utils/validators.js'
import {
  narrativeStudioCreateDraftSchema,
  narrativeStudioPreviewSchema,
} from '../validators/narrative-studio.schemas.js'

function actorProfileId(req) {
  return req.auth?.profile?.id || null
}

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function getNarrativeStudioSpecController(_req, res, next) {
  try {
    return ok(res, getNarrativeStudioSpec())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeStudioController(_req, res, next) {
  try {
    return ok(res, await inspectNarrativeStudioReadiness())
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeProductController(req, res, next) {
  try {
    const input = parseOrThrow(narrativeStudioPreviewSchema, req.body || {})
    return ok(res, await previewNarrativeProduct(input))
  } catch (error) {
    return next(error)
  }
}


export async function listNarrativeDraftsController(req, res, next) {
  try {
    const result = await listNarrativeProductDrafts({
      limit: req.query?.limit,
      companionId: req.query?.companionId,
      contentType: req.query?.contentType,
      status: req.query?.status,
    })
    return ok(res, result)
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeDraftsController(_req, res, next) {
  try {
    return ok(res, await inspectNarrativeDraftsReadiness())
  } catch (error) {
    return next(error)
  }
}

export async function createNarrativeDraftController(req, res, next) {
  try {
    const input = parseOrThrow(narrativeStudioCreateDraftSchema, req.body || {})
    const result = await createNarrativeProductDraft(input, { actorProfileId: actorProfileId(req) })
    return ok(res, result, result.status === 'NARRATIVE_DRAFT_CREATED_CONTROLLED' ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
