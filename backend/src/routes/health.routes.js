import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { healthController } from '../controllers/health.controller.js'

const router = Router()

router.get('/', asyncHandler(healthController))

export { router as healthRoutes }
