import { listGallery } from '../services/gallery.service.js'

export async function getGalleryController(req, res) {
  const data = await listGallery(req.auth.profile.id, String(req.query.q || ''))
  return res.status(200).json(data)
}
