import {
  auditRealSingleItemProduction,
  executeRealSingleItemProduction,
  previewRealSingleItemExecution
} from '../services/real-production-execution.service.js'

const getAdminProfileId = (req) => (
  req.auth?.profile?.id ||
  req.auth?.user?.id ||
  req.user?.id ||
  req.user?.profile_id ||
  req.profile?.id ||
  req.admin?.id ||
  null
)

export const previewRealProductionExecutionController = async (req, res, next) => {
  try {
    const result = await previewRealSingleItemExecution({
      batchId: req.body?.batchId ?? req.body?.batch_id ?? null,
      batchItemId: req.body?.batchItemId ?? req.body?.batch_item_id ?? null,
      companionId: req.body?.companionId ?? req.body?.companion_id ?? null,
      actorId: req.body?.actorId ?? req.body?.actor_id ?? null,
      combinationId: req.body?.combinationId ?? req.body?.combination_id ?? null,
      confirmationPhrase: req.body?.confirmationPhrase ?? req.body?.confirmation_phrase ?? '',
      requestedQuantity: req.body?.requestedQuantity ?? req.body?.quantity ?? 1
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

export const startRealProductionExecutionController = async (req, res, next) => {
  try {
    const result = await executeRealSingleItemProduction({
      batchId: req.body?.batchId ?? req.body?.batch_id ?? null,
      batchItemId: req.body?.batchItemId ?? req.body?.batch_item_id ?? null,
      companionId: req.body?.companionId ?? req.body?.companion_id ?? null,
      actorId: req.body?.actorId ?? req.body?.actor_id ?? null,
      combinationId: req.body?.combinationId ?? req.body?.combination_id ?? null,
      confirmationPhrase: req.body?.confirmationPhrase ?? req.body?.confirmation_phrase ?? '',
      requestedQuantity: req.body?.requestedQuantity ?? req.body?.quantity ?? 1,
      adminProfileId: getAdminProfileId(req),
      executeQueue: req.body?.executeQueue === true,
      metadata: {
        requestedFrom: 'admin_route',
        ip: req.ip ?? null,
        userAgent: req.get?.('user-agent') ?? null
      }
    })

    const statusCode = result.queued ? 202 : result.status?.startsWith('BLOCKED') ? 409 : 200

    return res.status(statusCode).json(result)
  } catch (error) {
    return next(error)
  }
}

export const auditRealProductionExecutionController = async (req, res, next) => {
  try {
    const result = await auditRealSingleItemProduction({
      batchId: req.params?.batchId ?? req.query?.batchId ?? null,
      batchItemId: req.query?.batchItemId ?? null
    })

    return res.json(result)
  } catch (error) {
    return next(error)
  }
}
