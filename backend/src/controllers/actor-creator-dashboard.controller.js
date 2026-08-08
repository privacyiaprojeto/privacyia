import {
  getCreatorFinance,
  getCreatorMapping,
  getCreatorMappingRequirements,
  getCreatorOverview,
  getCreatorProducts,
  uploadCreatorMappingAsset,
} from '../services/actor-creator-dashboard.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function getCreatorMappingController(req, res, next) {
  try {
    return ok(res, await getCreatorMapping({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function getCreatorMappingRequirementsController(req, res, next) {
  try {
    return ok(res, await getCreatorMappingRequirements({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}


export async function getCreatorOverviewController(req, res, next) {
  try {
    return ok(res, await getCreatorOverview({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function getCreatorProductsController(req, res, next) {
  try {
    return ok(res, await getCreatorProducts({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function getCreatorFinanceController(req, res, next) {
  try {
    return ok(res, await getCreatorFinance({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function uploadCreatorMappingAssetController(req, res, next) {
  try {
    return ok(res, await uploadCreatorMappingAsset({
      profile: req.auth.profile,
      input: req.body || {},
    }), 201)
  } catch (error) {
    return next(error)
  }
}
