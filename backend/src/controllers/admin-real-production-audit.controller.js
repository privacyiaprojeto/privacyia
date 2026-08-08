import {
  auditRealProductionBeforeRun,
  auditRealProductionAfterJob,
  pollRealProductionAfterJobAudit,
  getRealProductionAuditConfig
} from '../services/real-production-audit.service.js'

const sendOk = (res, data) => res.status(200).json({
  success: true,
  data
})

const sendError = (res, error) => {
  console.error('[admin-real-production-audit]', error)

  return res.status(500).json({
    success: false,
    message: error?.message ?? 'Erro inesperado na auditoria de produção real'
  })
}

export const getRealProductionAuditConfigController = async (_req, res) => {
  try {
    return sendOk(res, getRealProductionAuditConfig())
  } catch (error) {
    return sendError(res, error)
  }
}

export const preRunRealProductionAuditController = async (req, res) => {
  try {
    const result = await auditRealProductionBeforeRun({
      companionId: req.body?.companionId ?? req.query?.companionId ?? null,
      actorId: req.body?.actorId ?? req.query?.actorId ?? null,
      combinationId: req.body?.combinationId ?? req.query?.combinationId ?? null,
      requestedQuantity: Number(req.body?.requestedQuantity ?? req.query?.requestedQuantity ?? 1),
      confirmationPhrase: req.body?.confirmationPhrase ?? req.query?.confirmationPhrase ?? '',
      includeRecentSnapshot: req.body?.includeRecentSnapshot ?? true
    })

    return sendOk(res, result)
  } catch (error) {
    return sendError(res, error)
  }
}

export const postJobRealProductionAuditController = async (req, res) => {
  try {
    const result = await auditRealProductionAfterJob({
      batchId: req.body?.batchId ?? req.query?.batchId ?? null,
      batchItemId: req.body?.batchItemId ?? req.query?.batchItemId ?? null,
      queueJobId: req.body?.queueJobId ?? req.query?.queueJobId ?? null,
      companionId: req.body?.companionId ?? req.query?.companionId ?? null,
      combinationId: req.body?.combinationId ?? req.query?.combinationId ?? null
    })

    return sendOk(res, result)
  } catch (error) {
    return sendError(res, error)
  }
}

export const watchPostJobRealProductionAuditController = async (req, res) => {
  try {
    const result = await pollRealProductionAfterJobAudit({
      batchId: req.body?.batchId ?? req.query?.batchId ?? null,
      batchItemId: req.body?.batchItemId ?? req.query?.batchItemId ?? null,
      queueJobId: req.body?.queueJobId ?? req.query?.queueJobId ?? null,
      companionId: req.body?.companionId ?? req.query?.companionId ?? null,
      combinationId: req.body?.combinationId ?? req.query?.combinationId ?? null,
      timeoutMs: Number(req.body?.timeoutMs ?? req.query?.timeoutMs ?? 180000),
      intervalMs: Number(req.body?.intervalMs ?? req.query?.intervalMs ?? 5000)
    })

    return sendOk(res, result)
  } catch (error) {
    return sendError(res, error)
  }
}
