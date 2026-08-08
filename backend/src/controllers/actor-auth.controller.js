import {
  createActorMappingAsset,
  createActorMappingCase,
  getActorDashboard,
  getActorMapping,
  getActorMe,
  registerActorAuthByInvite,
} from '../services/actor-auth.service.js'
import { parseOrThrow } from '../utils/validators.js'
import { registerActorAuthByInviteSchema } from '../validators/actor-auth.schemas.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function registerActorAuthByInviteController(req, res, next) {
  try {
    const input = parseOrThrow(registerActorAuthByInviteSchema, req.body || {})
    return ok(res, await registerActorAuthByInvite(req.params.inviteToken, input), 201)
  } catch (error) {
    return next(error)
  }
}

export async function getActorMeController(req, res, next) {
  try {
    return ok(res, await getActorMe({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function getActorDashboardController(req, res, next) {
  try {
    return ok(res, await getActorDashboard({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function getActorMappingController(req, res, next) {
  try {
    return ok(res, await getActorMapping({ profile: req.auth.profile }))
  } catch (error) {
    return next(error)
  }
}

export async function createActorMappingCaseController(req, res, next) {
  try {
    return ok(res, await createActorMappingCase({ profile: req.auth.profile, input: req.body || {} }), 201)
  } catch (error) {
    return next(error)
  }
}


export async function createActorMappingAssetController(req, res, next) {
  try {
    return ok(res, await createActorMappingAsset({ profile: req.auth.profile, input: req.body || {} }), 201)
  } catch (error) {
    return next(error)
  }
}
