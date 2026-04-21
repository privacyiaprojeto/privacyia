import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getProfileController,
  updateProfileController,
} from '../controllers/profile.controller.js'

const router = Router()

router.get('/perfil', asyncHandler(getProfileController))
router.patch('/perfil', asyncHandler(updateProfileController))

export { router as profileRoutes }
