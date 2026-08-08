import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { registerRoutes } from './routes/index.js'
import { authMiddleware } from './middlewares/auth.middleware.js'
import { adminMiddleware } from './middlewares/admin.middleware.js'
import factoryQaRoutes from './routes/factory-qa.routes.js'
import factoryAdminRoutes from './routes/factory-admin.routes.js'
import mediaSecureAccessRoutes from './routes/media-secure-access.routes.js'
import mediaSecureStreamRoutes from './routes/media-secure-stream.routes.js'
import mediaProtectionRoutes from './routes/media-protection.routes.js'
import creationAdminRoutes from './routes/creation-admin.routes.js'
import actorAdminRoutes from './routes/actor-admin.routes.js'
import narrativeStudioRoutes from './routes/admin/narrative-studio.routes.js'
import adminRealProductionRoutes from './routes/admin/real-production.routes.js'
import sceneDirectionRoutes from './routes/admin/scene-direction.routes.js'
import intelligenceCenterRoutes from './routes/admin/intelligence-center.routes.js'
import actorPipelineRoutes from './routes/admin/actor-pipeline.routes.js'
import apiDocsRoutes from './routes/api-docs.routes.js'
import { notFoundMiddleware } from './middlewares/notFound.middleware.js'
import { errorMiddleware } from './middlewares/error.middleware.js'

export function createApp() {
  const app = express()

  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:5173',
    'http://localhost:5174',
  ]

  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true)
        }
        return callback(new Error(`Origin não permitida: ${origin}`))
      },
      credentials: true,
    }),
  )

  app.use(express.json({ limit: '35mb' }))
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  if (env.ENABLE_SWAGGER) {
    app.use(apiDocsRoutes)
  }

  registerRoutes(app)

  app.use(authMiddleware, adminMiddleware, factoryQaRoutes)
  app.use(authMiddleware, adminMiddleware, factoryAdminRoutes)
  app.use(authMiddleware, adminMiddleware, creationAdminRoutes)
  app.use(authMiddleware, adminMiddleware, actorAdminRoutes)
  app.use(authMiddleware, adminMiddleware, narrativeStudioRoutes)
  app.use(authMiddleware, adminMiddleware, adminRealProductionRoutes)
  app.use(authMiddleware, adminMiddleware, sceneDirectionRoutes)
  app.use(authMiddleware, adminMiddleware, intelligenceCenterRoutes)
  app.use(authMiddleware, adminMiddleware, actorPipelineRoutes)
  app.use(authMiddleware, adminMiddleware, mediaSecureAccessRoutes)
  app.use(authMiddleware, adminMiddleware, mediaSecureStreamRoutes)
  app.use(authMiddleware, adminMiddleware, mediaProtectionRoutes)

  app.use(notFoundMiddleware)
  app.use(errorMiddleware)

  return app
}
