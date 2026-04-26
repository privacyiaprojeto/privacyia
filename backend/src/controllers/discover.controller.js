import { listDiscoverSections } from '../services/discover.service.js'

export async function listDiscoverSectionsController(req, res) {
  const data = await listDiscoverSections(req.auth.profile.id)
  return res.status(200).json(data)
}
