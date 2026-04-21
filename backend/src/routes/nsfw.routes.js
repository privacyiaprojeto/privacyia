import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  createImageGenerationController,
  createVideoGenerationController,
  listGeneratedImagesController,
  listGeneratedVideosController,
  listImageOptionsController,
  listSubscribedActressesController,
  listVideoOptionsController,
  reportImageGenerationController,
  reportVideoGenerationController,
} from '../controllers/nsfw.controller.js'

const router = Router()

router.get('/atrizes-assinadas', asyncHandler(listSubscribedActressesController))

router.get('/imagem/opcoes', asyncHandler(listImageOptionsController))
router.post('/imagem/gerar', asyncHandler(createImageGenerationController))
router.get('/imagem/gerados', asyncHandler(listGeneratedImagesController))
router.post('/imagem/:id/denunciar', asyncHandler(reportImageGenerationController))

router.get('/video/opcoes', asyncHandler(listVideoOptionsController))
router.post('/video/gerar', asyncHandler(createVideoGenerationController))
router.get('/video/gerados', asyncHandler(listGeneratedVideosController))
router.post('/video/:id/denunciar', asyncHandler(reportVideoGenerationController))

export { router as nsfwRoutes }
