import { getRealProductionReadiness } from '../services/real-production-readiness.service.js'

export const getAdminRealProductionReadiness = async (req, res, next) => {
  try {
    const result = await getRealProductionReadiness({
      mode: req.query.mode ?? 'safe_preflight',
      requestedQuantity: req.query.quantity ? Number(req.query.quantity) : 1,
      companionId: req.query.companionId ?? req.query.avatarId ?? null,
      actorId: req.query.actorId ?? null,
      combinationId: req.query.combinationId ?? null,
      confirmationPhrase: req.query.confirmationPhrase ?? ''
    })

    return res.json({
      success: true,
      data: result
    })
  } catch (error) {
    if (next) return next(error)

    return res.status(500).json({
      success: false,
      message: 'Falha ao consultar readiness de produção real',
      error: error?.message ?? 'Erro inesperado'
    })
  }
}
