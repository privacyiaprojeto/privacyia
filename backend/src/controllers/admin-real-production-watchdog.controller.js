import {
  getRealProductionWatchdogConfig,
  inspectRealProductionStuckJob,
  markRealProductionStuckJobFailed
} from '../services/real-production-watchdog.service.js'

const sendOk = (res, data) => res.status(200).json({
  success: true,
  data
})

const sendError = (res, error) => {
  console.error('[admin-real-production-watchdog]', error)

  return res.status(500).json({
    success: false,
    message: error?.message ?? 'Erro inesperado no watchdog de produção real'
  })
}

export const getRealProductionWatchdogConfigController = async (_req, res) => {
  try {
    return sendOk(res, getRealProductionWatchdogConfig())
  } catch (error) {
    return sendError(res, error)
  }
}

export const inspectRealProductionStuckJobController = async (req, res) => {
  try {
    const result = await inspectRealProductionStuckJob({
      batchId: req.body?.batchId ?? req.query?.batchId ?? null,
      batchItemId: req.body?.batchItemId ?? req.query?.batchItemId ?? null,
      queueJobId: req.body?.queueJobId ?? req.query?.queueJobId ?? null,
      companionId: req.body?.companionId ?? req.query?.companionId ?? null,
      combinationId: req.body?.combinationId ?? req.query?.combinationId ?? null,
      stuckThresholdMinutes: Number(req.body?.stuckThresholdMinutes ?? req.query?.stuckThresholdMinutes ?? process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES ?? 10)
    })

    return sendOk(res, result)
  } catch (error) {
    return sendError(res, error)
  }
}

export const markRealProductionStuckJobFailedController = async (req, res) => {
  try {
    const result = await markRealProductionStuckJobFailed({
      batchId: req.body?.batchId ?? req.query?.batchId ?? null,
      batchItemId: req.body?.batchItemId ?? req.query?.batchItemId ?? null,
      queueJobId: req.body?.queueJobId ?? req.query?.queueJobId ?? null,
      companionId: req.body?.companionId ?? req.query?.companionId ?? null,
      combinationId: req.body?.combinationId ?? req.query?.combinationId ?? null,
      confirmationPhrase: req.body?.confirmationPhrase ?? req.query?.confirmationPhrase ?? '',
      apply: Boolean(req.body?.apply ?? false),
      stuckThresholdMinutes: Number(req.body?.stuckThresholdMinutes ?? req.query?.stuckThresholdMinutes ?? process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES ?? 10),
      note: req.body?.note ?? null
    })

    return sendOk(res, result)
  } catch (error) {
    return sendError(res, error)
  }
}
