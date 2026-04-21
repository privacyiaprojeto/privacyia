import { env } from '../config/env.js'

export async function healthController(_req, res) {
  return res.status(200).json({
    ok: true,
    service: 'privacy-rpg-backend',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  })
}
