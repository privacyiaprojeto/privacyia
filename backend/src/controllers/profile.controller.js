import {
  getCustomerProfile,
  updateCustomerProfile,
} from '../services/profile.service.js'
import { parseOrThrow } from '../utils/validators.js'
import { updateProfileSchema } from '../validators/profile.schemas.js'

export async function getProfileController(req, res) {
  const data = await getCustomerProfile(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function updateProfileController(req, res) {
  const input = parseOrThrow(updateProfileSchema, req.body)
  const data = await updateCustomerProfile(req.auth.profile.id, input)
  return res.status(200).json(data)
}
