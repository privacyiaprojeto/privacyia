import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { listDiscoverSectionsController } from '../controllers/discover.controller.js'

const router = Router()

router.get('/secoes', asyncHandler(listDiscoverSectionsController))

export { router as discoverRoutes }
