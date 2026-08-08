import { Router } from 'express'
import {
  createActorMappingAssetController,
  createActorMappingCaseController,
  getActorDashboardController,
  getActorMappingController,
  getActorMeController,
} from '../controllers/actor-auth.controller.js'
import {
  getCreatorFinanceController,
  getCreatorMappingController,
  getCreatorMappingRequirementsController,
  getCreatorOverviewController,
  getCreatorProductsController,
  uploadCreatorMappingAssetController,
} from '../controllers/actor-creator-dashboard.controller.js'
import { asyncHandler } from '../utils/asyncHandler.js'

const router = Router()

router.get('/me', asyncHandler(getActorMeController))
router.get('/dashboard', asyncHandler(getActorDashboardController))
router.get('/creator/overview', asyncHandler(getCreatorOverviewController))
router.get('/creator/mapping', asyncHandler(getCreatorMappingController))
router.get('/mapping/requirements', asyncHandler(getCreatorMappingRequirementsController))
router.get('/creator/products', asyncHandler(getCreatorProductsController))
router.get('/creator/finance', asyncHandler(getCreatorFinanceController))
router.get('/mapping', asyncHandler(getActorMappingController))
router.post('/mapping/cases', asyncHandler(createActorMappingCaseController))
router.post('/mapping/assets', asyncHandler(createActorMappingAssetController))
router.post('/mapping/assets/upload', asyncHandler(uploadCreatorMappingAssetController))

export default router
