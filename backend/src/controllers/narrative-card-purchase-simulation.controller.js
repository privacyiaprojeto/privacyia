import {
  applyNarrativeCardPurchaseSimulation,
  getNarrativeCardPurchaseSimulationConfig,
  inspectNarrativeCardPurchaseSimulation,
  previewNarrativeCardPurchaseSimulation,
} from '../services/narrative-card-purchase-simulation.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function adminProfileId(req) {
  return req.auth?.profile?.id || req.body?.adminProfileId || req.query?.adminProfileId || process.env.NARRATIVE_STUDIO_ADMIN_PROFILE_ID || null
}

function clientProfileId(req) {
  return req.body?.clientProfileId || req.query?.clientProfileId || process.env.NARRATIVE_STUDIO_CLIENT_PROFILE_ID || null
}

function draftIdFrom(req) {
  return req.body?.draftId
    || req.query?.draftId
    || process.env.NARRATIVE_STUDIO_DRAFT_ID
    || process.env.NARRATIVE_STUDIO_6_3P5_DRAFT_ID
    || null
}

function outputVariantIdFrom(req) {
  return req.body?.outputVariantId
    || req.query?.outputVariantId
    || process.env.NARRATIVE_STUDIO_OUTPUT_VARIANT_ID
    || process.env.NARRATIVE_STUDIO_6_3P5_OUTPUT_VARIANT_ID
    || null
}

export async function getNarrativeCardPurchaseSimulationConfigController(_req, res, next) {
  try {
    return ok(res, getNarrativeCardPurchaseSimulationConfig())
  } catch (error) {
    return next(error)
  }
}

export async function inspectNarrativeCardPurchaseSimulationController(req, res, next) {
  try {
    return ok(res, await inspectNarrativeCardPurchaseSimulation({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
      clientProfileId: clientProfileId(req),
    }))
  } catch (error) {
    return next(error)
  }
}

export async function previewNarrativeCardPurchaseSimulationController(req, res, next) {
  try {
    return ok(res, await previewNarrativeCardPurchaseSimulation({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
      clientProfileId: clientProfileId(req),
    }))
  } catch (error) {
    return next(error)
  }
}

export async function applyNarrativeCardPurchaseSimulationController(req, res, next) {
  try {
    const result = await applyNarrativeCardPurchaseSimulation({
      draftId: draftIdFrom(req),
      outputVariantId: outputVariantIdFrom(req),
      clientProfileId: clientProfileId(req),
      adminProfileId: adminProfileId(req),
      confirmationPhrase: req.body?.confirmationPhrase,
      dryRunOnly: req.body?.dryRunOnly !== false,
    })

    const created = result.status === 'NARRATIVE_CARD_SIMULATED_DELIVERY_CREATED_CONTROLLED'
    return ok(res, result, created ? 201 : 200)
  } catch (error) {
    return next(error)
  }
}
