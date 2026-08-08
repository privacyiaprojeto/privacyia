import {
  createRealProductionCombination,
  getRealProductionCombinationCreateConfig,
  planRealProductionCombinationCreate
} from '../services/real-production-combination-create.service.js'

export async function getRealProductionCombinationCreateConfigController(req, res, next) {
  try {
    const result = getRealProductionCombinationCreateConfig()
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

export async function previewRealProductionCombinationCreateController(req, res, next) {
  try {
    const result = await planRealProductionCombinationCreate({ dryRun: true })
    return res.json(result)
  } catch (error) {
    return next(error)
  }
}

export async function createRealProductionCombinationController(req, res, next) {
  try {
    const apply = req.body?.apply === true
    const result = await createRealProductionCombination({ dryRun: !apply, apply })
    const status = result.status?.startsWith('BLOCKED') ? 409 : 200
    return res.status(status).json(result)
  } catch (error) {
    return next(error)
  }
}
