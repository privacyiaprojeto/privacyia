import {
  getNarrativeOutputQaConfig,
  inspectNarrativeOutputQa,
  previewNarrativeOutputQa,
  processNarrativeOutputQa,
} from '../services/narrative-output-qa.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function profileId(req) {
  return req.auth?.profile?.id || req.body?.adminProfileId || req.query?.adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null
}

function batchItemIdFrom(req) {
  return req.body?.batchItemId || req.query?.batchItemId || process.env.NARRATIVE_STUDIO_BATCH_ITEM_ID || process.env.NARRATIVE_STUDIO_6_3P_BATCH_ITEM_ID || null
}

export async function getNarrativeOutputQaConfigController(_req, res, next) {
  try {
    return ok(res, getNarrativeOutputQaConfig())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeOutputQaController(req, res, next) {
  try {
    return ok(res, await inspectNarrativeOutputQa({ batchItemId: batchItemIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeOutputQaController(req, res, next) {
  try {
    return ok(res, await previewNarrativeOutputQa({ batchItemId: batchItemIdFrom(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function processNarrativeOutputQaController(req, res, next) {
  try {
    const result = await processNarrativeOutputQa({
      batchItemId: batchItemIdFrom(req),
      adminProfileId: profileId(req),
      confirmationPhrase: req.body?.confirmationPhrase,
      dryRunOnly: req.body?.dryRunOnly !== false,
    })

    return ok(res, result, result.status === 'NARRATIVE_OUTPUT_SIMULATED_QA_CREATED_CONTROLLED' ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
