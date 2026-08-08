import {
  applyNarrativeCardPublication,
  getNarrativeCardPublicationConfig,
  inspectNarrativeCardPublication,
  previewNarrativeCardPublication,
} from '../services/narrative-card-publication.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function profileId(req) {
  return req.auth?.profile?.id || req.body?.adminProfileId || req.query?.adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null
}

function draftIdFrom(req) {
  return req.body?.draftId
    || req.query?.draftId
    || process.env.NARRATIVE_STUDIO_DRAFT_ID
    || process.env.NARRATIVE_STUDIO_6_3P3_DRAFT_ID
    || null
}

function outputVariantIdFrom(req) {
  return req.body?.outputVariantId
    || req.query?.outputVariantId
    || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID
    || process.env.NARRATIVE_STUDIO_6_3P3_OUTPUT_VARIANT_ID
    || null
}

export async function getNarrativeCardPublicationConfigController(_req, res, next) {
  try {
    return ok(res, getNarrativeCardPublicationConfig())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeCardPublicationController(req, res, next) {
  try {
    return ok(res, await inspectNarrativeCardPublication({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
    }))
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeCardPublicationController(req, res, next) {
  try {
    return ok(res, await previewNarrativeCardPublication({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
    }))
  } catch (error) {
    return next(error)
  }
}

export async function applyNarrativeCardPublicationController(req, res, next) {
  try {
    const result = await applyNarrativeCardPublication({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
      action: req.body?.action,
      adminProfileId: profileId(req),
      confirmationPhrase: req.body?.confirmationPhrase,
      dryRunOnly: req.body?.dryRunOnly !== false,
    })

    const created = ['NARRATIVE_CARD_PUBLISHED_CONTROLLED', 'NARRATIVE_CARD_HIDDEN_CONTROLLED'].includes(result.status)
    return ok(res, result, created ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
