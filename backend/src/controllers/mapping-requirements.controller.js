import {
  createMappingRequirement,
  inactivateMappingRequirement,
  listAdminMappingRequirements,
  updateMappingRequirement,
} from '../services/mapping-requirements.service.js'
import { parseOrThrow } from '../utils/validators.js'
import {
  createMappingRequirementSchema,
  listMappingRequirementsQuerySchema,
  updateMappingRequirementSchema,
} from '../validators/mapping-requirements.schemas.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function listMappingRequirementsAdminController(req, res, next) {
  try {
    const query = parseOrThrow(listMappingRequirementsQuerySchema, req.query || {})
    return ok(res, await listAdminMappingRequirements(query))
  } catch (error) {
    return next(error)
  }
}

export async function createMappingRequirementController(req, res, next) {
  try {
    const input = parseOrThrow(createMappingRequirementSchema, req.body || {})
    return ok(res, await createMappingRequirement(input), 201)
  } catch (error) {
    return next(error)
  }
}

export async function updateMappingRequirementController(req, res, next) {
  try {
    const input = parseOrThrow(updateMappingRequirementSchema, req.body || {})
    return ok(res, await updateMappingRequirement(req.params.requirementId, input))
  } catch (error) {
    return next(error)
  }
}

export async function inactivateMappingRequirementController(req, res, next) {
  try {
    return ok(res, await inactivateMappingRequirement(req.params.requirementId))
  } catch (error) {
    return next(error)
  }
}
