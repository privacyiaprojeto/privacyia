import {
  getRealProductionPrepConfig,
  inspectRealProductionCandidate
} from '../services/real-production-prep.service.js'

function sendSuccess(res, payload) {
  return res.status(200).json({ success: true, ...payload })
}

function sendError(res, error) {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    success: false,
    error: error?.message || 'Erro ao executar preparação de produção real.'
  })
}

export async function getRealProductionPrepConfigController(req, res) {
  try {
    return sendSuccess(res, { data: getRealProductionPrepConfig() })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function inspectRealProductionCandidateController(req, res) {
  try {
    const payload = {
      companionId: req.body?.companionId || req.query?.companionId,
      combinationId: req.body?.combinationId || req.query?.combinationId,
      quantity: req.body?.quantity || req.query?.quantity || 1,
      confirmationPhrase: req.body?.confirmationPhrase || req.query?.confirmationPhrase || ''
    }

    const data = await inspectRealProductionCandidate(payload)
    return sendSuccess(res, { data })
  } catch (error) {
    return sendError(res, error)
  }
}
