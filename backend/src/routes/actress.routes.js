import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getActressProfileController,
  getActressPublicProfileController,
  getActressTimelineController,
} from '../controllers/actress.controller.js'

const router = Router()

router.get('/:slug', asyncHandler(getActressPublicProfileController))
router.get('/:atrizId/perfil', asyncHandler(getActressProfileController))
router.get('/:atrizId/timeline', asyncHandler(getActressTimelineController))

export { router as actressRoutes }
