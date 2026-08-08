import { Router } from 'express'
import { proxyAdminSecureAssetPreviewController } from '../controllers/media-secure-stream.controller.js'

const router = Router()

router.get('/api/admin/media/assets/:assetId/proxy-preview', proxyAdminSecureAssetPreviewController)

export default router
