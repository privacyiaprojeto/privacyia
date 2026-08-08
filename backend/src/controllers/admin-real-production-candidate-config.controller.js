import {
  configureRealProductionCandidate,
  getRealProductionCandidateConfig
} from '../services/real-production-candidate-config.service.js'

function sendSuccess(res, payload) {
  return res.status(200).json({ success: true, ...payload })
}

function sendError(res, error) {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    success: false,
    error: error?.message || 'Erro ao configurar candidato real de produção.'
  })
}

export async function getRealProductionCandidateConfigController(req, res) {
  try {
    return sendSuccess(res, { data: getRealProductionCandidateConfig() })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function configureRealProductionCandidateController(req, res) {
  try {
    const data = await configureRealProductionCandidate({
      companionId: req.body?.companionId || req.query?.companionId,
      combinationId: req.body?.combinationId || req.query?.combinationId,
      priceCredits: req.body?.priceCredits || req.query?.priceCredits,
      operationalCostCredits: req.body?.operationalCostCredits || req.query?.operationalCostCredits,
      payoutPercent: req.body?.payoutPercent || req.query?.payoutPercent,
      quantity: req.body?.quantity || req.query?.quantity || 1,
      apply: req.body?.apply === true || req.query?.apply === 'true',
      dryRun: req.body?.dryRun !== undefined ? Boolean(req.body.dryRun) : undefined,
      confirmationPhrase: req.body?.confirmationPhrase || req.query?.confirmationPhrase || ''
    })

    return sendSuccess(res, { data })
  } catch (error) {
    return sendError(res, error)
  }
}
