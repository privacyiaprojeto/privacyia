import {
  applyNarrativeOutputQaDecision,
  getNarrativeOutputQaDecisionConfig,
  inspectNarrativeOutputQaDecision,
  previewNarrativeOutputQaDecision,
} from '../services/narrative-output-qa-decision.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function profileId(req) {
  return req.auth?.profile?.id || req.body?.adminProfileId || req.query?.adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null
}

function outputVariantIdFrom(req) {
  return req.body?.outputVariantId
    || req.query?.outputVariantId
    || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID
    || process.env.NARRATIVE_STUDIO_6_3P_OUTPUT_VARIANT_ID
    || null
}

export async function getNarrativeOutputQaDecisionConfigController(_req, res, next) {
  try {
    return ok(res, getNarrativeOutputQaDecisionConfig())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeOutputQaDecisionController(req, res, next) {
  try {
    return ok(res, await inspectNarrativeOutputQaDecision({ outputVariantId: outputVariantIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeOutputQaDecisionController(req, res, next) {
  try {
    return ok(res, await previewNarrativeOutputQaDecision({ outputVariantId: outputVariantIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function applyNarrativeOutputQaDecisionController(req, res, next) {
  try {
    const result = await applyNarrativeOutputQaDecision({
      outputVariantId: outputVariantIdFrom(req),
      action: req.body?.action,
      adminProfileId: profileId(req),
      confirmationPhrase: req.body?.confirmationPhrase,
      rejectionReason: req.body?.rejectionReason,
      dryRunOnly: req.body?.dryRunOnly !== false,
    })

    const created = ['NARRATIVE_OUTPUT_QA_APPROVED_CONTROLLED', 'NARRATIVE_OUTPUT_QA_REJECTED_CONTROLLED'].includes(result.status)
    return ok(res, result, created ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
