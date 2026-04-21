import { getActressProfile, getActressTimeline } from '../services/actress.service.js'

export async function getActressProfileController(req, res) {
  const data = await getActressProfile(req.params.atrizId)
  return res.status(200).json(data)
}

export async function getActressTimelineController(req, res) {
  const data = await getActressTimeline(req.params.atrizId)
  return res.status(200).json(data)
}
