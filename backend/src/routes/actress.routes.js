import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getActressProfileController,
  getActressPublicProfileController,
  getActressTimelineController,
  listActressesController,
  subscribeToActressController,
} from '../controllers/actress.controller.js'

const router = Router()

router.post('/:companionId/assinar', asyncHandler(subscribeToActressController))
router.get('/', asyncHandler(listActressesController))
router.get('/:slug', asyncHandler(getActressPublicProfileController))
router.get('/:atrizId/perfil', asyncHandler(getActressProfileController))
router.get('/:atrizId/timeline', asyncHandler(getActressTimelineController))

export { router as actressRoutes }
