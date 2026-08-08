import { Router } from 'express'
import {
  approveAssetVariantController,
  rejectAssetVariantController,
} from '../controllers/factory-qa.controller.js'

const router = Router()

router.post('/api/admin/factory/qa/:assetId/approve', approveAssetVariantController)
router.post('/api/admin/factory/qa/:assetId/reject', rejectAssetVariantController)

export default router
