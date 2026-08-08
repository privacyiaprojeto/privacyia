import {
  auditAvatarComplianceTables,
  configureRealProductionAvatarCompliance,
  getRealProductionAvatarComplianceConfig
} from '../services/real-production-avatar-compliance.service.js'

function sendSuccess(res, payload) {
  return res.status(200).json({ success: true, ...payload })
}

function sendError(res, error) {
  const status = error?.statusCode || error?.status || 500
  return res.status(status).json({
    success: false,
    error: error?.message || 'Erro ao configurar conformidade controlada do avatar real.'
  })
}

export async function getRealProductionAvatarComplianceConfigController(req, res) {
  try {
    return sendSuccess(res, { data: getRealProductionAvatarComplianceConfig() })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function auditRealProductionAvatarComplianceController(req, res) {
  try {
    const data = await auditAvatarComplianceTables()
    return sendSuccess(res, { data })
  } catch (error) {
    return sendError(res, error)
  }
}

export async function configureRealProductionAvatarComplianceController(req, res) {
  try {
    const data = await configureRealProductionAvatarCompliance({
      companionId: req.body?.companionId || req.query?.companionId,
      combinationId: req.body?.combinationId || req.query?.combinationId,
      quantity: req.body?.quantity || req.query?.quantity || 1,
      apply: req.body?.apply === true || req.query?.apply === 'true',
      dryRun: req.body?.dryRun !== undefined ? Boolean(req.body.dryRun) : undefined,
      confirmationPhrase: req.body?.confirmationPhrase || req.query?.confirmationPhrase || '',
      approvedBy: req.body?.approvedBy || req.query?.approvedBy,
      note: req.body?.note || req.query?.note
    })

    return sendSuccess(res, { data })
  } catch (error) {
    return sendError(res, error)
  }
}
