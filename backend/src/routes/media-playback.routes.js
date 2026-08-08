import { Router } from 'express'
import { protectedMediaViewRateLimit } from '../middlewares/media-rate-limit.middleware.js'
import {
  catalogPlaybackController,
  deliveryPlaybackController,
} from '../controllers/media-playback.controller.js'

export const mediaPlaybackRoutes = Router()

// URLs curtas, assinadas e vinculadas ao perfil. Não aceitam Bearer porque são consumidas
// diretamente por <video>, <audio>, HLS.js e <img>.
mediaPlaybackRoutes.get('/delivery/:deliveryId/:token', protectedMediaViewRateLimit, deliveryPlaybackController)
mediaPlaybackRoutes.get('/catalog/:productId/:token', protectedMediaViewRateLimit, catalogPlaybackController)
