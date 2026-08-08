import { Router } from 'express'
import { protectedAssetViewController } from '../controllers/media-protection.controller.js'

const router = Router()

router.get('/api/admin/media/assets/:assetId/protected-view', protectedAssetViewController)

export default router
