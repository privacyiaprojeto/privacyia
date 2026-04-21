import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { getGalleryController } from '../controllers/gallery.controller.js'

const router = Router()

router.get('/', asyncHandler(getGalleryController))

export { router as galleryRoutes }
