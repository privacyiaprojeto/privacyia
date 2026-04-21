import { authRoutes } from './auth.routes.js'
import { chatRoutes } from './chat.routes.js'
import { actressRoutes } from './actress.routes.js'
import { feedRoutes } from './feed.routes.js'
import { galleryRoutes } from './gallery.routes.js'
import { walletRoutes } from './wallet.routes.js'
import { notificationsRoutes } from './notifications.routes.js'
import { healthRoutes } from './health.routes.js'
import { profileRoutes } from './profile.routes.js'
import { nsfwRoutes } from './nsfw.routes.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'

export function registerRoutes(app) {
  app.use('/health', healthRoutes)
  app.use('/auth', authRoutes)

  app.use('/chat', authMiddleware, chatRoutes)
  app.use('/atrizes', authMiddleware, actressRoutes)
  app.use('/feed', authMiddleware, feedRoutes)
  app.use('/galeria', authMiddleware, galleryRoutes)
  app.use('/carteira', authMiddleware, walletRoutes)
  app.use('/notificacoes', authMiddleware, notificationsRoutes)
  app.use('/cliente', authMiddleware, profileRoutes)
  app.use('/nsfw', authMiddleware, nsfwRoutes)
}
