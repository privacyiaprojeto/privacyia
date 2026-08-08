import { Queue } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'

export function createQueue({ name, connectionName, attempts = 3, backoffDelayMs = 5000 } = {}) {
  return new Queue(name, {
    connection: createRedisConnection(connectionName || `privacy-ia-queue-${name}`),
    prefix: env.REDIS_QUEUE_PREFIX,
    defaultJobOptions: {
      attempts,
      backoff: {
        type: 'exponential',
        delay: backoffDelayMs,
      },
      removeOnComplete: {
        age: 60 * 60 * 24,
        count: 1000,
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7,
        count: 5000,
      },
    },
  })
}

export function createLazyQueue({ name, connectionName, attempts, backoffDelayMs } = {}) {
  let instance = null

  function getQueue() {
    if (!instance) {
      instance = createQueue({ name, connectionName, attempts, backoffDelayMs })
    }
    return instance
  }

  const proxy = new Proxy({}, {
    get(_target, property) {
      const queue = getQueue()
      const value = queue[property]
      return typeof value === 'function' ? value.bind(queue) : value
    },
  })

  async function closeQueue() {
    if (!instance) return
    const queue = instance
    instance = null
    await queue.close()
  }

  return {
    getQueue,
    proxy,
    closeQueue,
    isInitialized: () => Boolean(instance),
  }
}
