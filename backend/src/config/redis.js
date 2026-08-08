import IORedis from 'ioredis'
import { env } from './env.js'
import { ApiError } from '../utils/apiError.js'

let sharedRedisConnection = null

function buildRedisOptions(connectionName = 'privacy-ia') {
  const options = {
    connectionName,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
  }

  if (env.REDIS_TLS) {
    options.tls = {}
  }

  return options
}

export function createRedisConnection(connectionName = 'privacy-ia') {
  try {
    if (env.REDIS_URL) {
      return new IORedis(env.REDIS_URL, buildRedisOptions(connectionName))
    }

    return new IORedis({
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      username: env.REDIS_USERNAME || undefined,
      password: env.REDIS_PASSWORD || undefined,
      ...buildRedisOptions(connectionName),
    })
  } catch (error) {
    throw new ApiError(500, 'Falha ao criar conexão Redis.', {
      error: error.message,
    })
  }
}

export function getRedisConnection(connectionName = 'privacy-ia-queues') {
  if (!sharedRedisConnection) {
    sharedRedisConnection = createRedisConnection(connectionName)
  }

  return sharedRedisConnection
}

export async function closeRedisConnection() {
  if (!sharedRedisConnection) return

  const connection = sharedRedisConnection
  sharedRedisConnection = null

  try {
    await connection.quit()
  } catch {
    await connection.disconnect()
  }
}

export function isExternalRedisUrl(redisUrl = env.REDIS_URL) {
  const value = String(redisUrl || '').trim().toLowerCase()

  if (!value) return false

  return (
    value.includes('upstash.io') ||
    value.includes('upstashredis.com') ||
    value.includes('redis-cloud.com') ||
    value.includes('redislabs.com') ||
    value.startsWith('rediss://')
  )
}

export function describeRedisConnectionTarget() {
  if (env.REDIS_URL) {
    return {
      mode: 'url',
      external: isExternalRedisUrl(env.REDIS_URL),
      maskedUrl: env.REDIS_URL.replace(/:\/\/.*@/, '://***@'),
    }
  }

  return {
    mode: 'host',
    external: false,
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  }
}
