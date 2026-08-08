import {
  getNarrativeProductionConfig,
  inspectNarrativeProduction,
  previewNarrativeProductionRequest,
  requestNarrativeProduction,
} from '../services/narrative-production.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function profileId(req) {
  return req.auth?.profile?.id || req.body?.adminProfileId || req.query?.adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null
}

function draftIdFrom(req) {
  return req.body?.draftId || req.query?.draftId || process.env.NARRATIVE_STUDIO_DRAFT_ID || process.env.NARRATIVE_STUDIO_6_3O_DRAFT_ID || null
}

export async function getNarrativeProductionConfigController(_req, res, next) {
  try {
    return ok(res, getNarrativeProductionConfig())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeProductionController(req, res, next) {
  try {
    return ok(res, await inspectNarrativeProduction({ draftId: draftIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeProductionController(req, res, next) {
  try {
    return ok(res, await previewNarrativeProductionRequest({ draftId: draftIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function requestNarrativeProductionController(req, res, next) {
  try {
    const result = await requestNarrativeProduction({
      draftId: draftIdFrom(req),
      adminProfileId: profileId(req),
      confirmationPhrase: req.body?.confirmationPhrase,
      dryRunOnly: req.body?.dryRunOnly !== false,
    })

    return ok(res, result, result.status === 'NARRATIVE_PRODUCTION_REQUEST_CREATED_CONTROLLED' ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
