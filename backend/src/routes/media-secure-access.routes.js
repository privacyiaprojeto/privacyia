import { Router } from 'express'
import { createAdminSecureAssetPreviewController } from '../controllers/media-secure-access.controller.js'

const router = Router()

router.post('/api/admin/media/assets/:assetId/secure-preview', createAdminSecureAssetPreviewController)

export default router
