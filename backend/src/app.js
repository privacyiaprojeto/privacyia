import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { env } from './config/env.js'
import { registerRoutes } from './routes/index.js'
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

  app.use(express.json({ limit: '2mb' }))
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'))

  registerRoutes(app)

  app.use(notFoundMiddleware)
  app.use(errorMiddleware)

  return app
}