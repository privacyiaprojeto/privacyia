import { env } from '../config/env.js'
import { closeRedisConnection, describeRedisConnectionTarget } from '../config/redis.js'

let workersStarted = false
let workers = []

function resolveWorkerStartupGate() {
  if (!env.WORKERS_ENABLED) {
    return { allowed: false, reason: 'WORKERS_ENABLED=false' }
  }

  const redisTarget = describeRedisConnectionTarget()
  if (env.NODE_ENV !== 'production' && redisTarget.external && !env.ALLOW_EXTERNAL_REDIS_WORKERS) {
    return {
      allowed: false,
      reason: 'Redis externo detectado em desenvolvimento sem ALLOW_EXTERNAL_REDIS_WORKERS=true',
      redisTarget,
    }
  }

  return { allowed: true, redisTarget }
}

export function getWorkersRuntimeStatus() {
  const gate = resolveWorkerStartupGate()
  return {
    workersStarted,
    workersCount: workers.length,
    workerNames: workers.map((worker) => worker.name),
    workEnabled: env.WORKERS_ENABLED,
    externalRedisWorkersAllowed: env.ALLOW_EXTERNAL_REDIS_WORKERS,
    nodeEnv: env.NODE_ENV,
    gate,
    isolatedQueues: {
      image: true,
      videoShort: true,
      videoV2v: true,
      audio: true,
      rendition: env.RENDITION_QUEUE_ENABLED,
    },
  }
}

export async function startWorkers({ shutdownSignal = null } = {}) {
  const gate = resolveWorkerStartupGate()
  if (!gate.allowed) {
    console.log(`[workers] Workers não iniciados: ${gate.reason}.`)
    return []
  }

  if (workersStarted) return workers

  const [
    { createImageWorker },
    { createVideoShortWorker },
    { createVideoV2vWorker },
    { createAudioWorker },
  ] = await Promise.all([
    import('./image.worker.js'),
    import('./video-short.worker.js'),
    import('./video-v2v.worker.js'),
    import('./audio.worker.js'),
  ])

  workers = [
    createImageWorker(),
    createVideoShortWorker(),
    createVideoV2vWorker(),
    createAudioWorker(),
  ]

  if (env.RENDITION_QUEUE_ENABLED) {
    const { createRenditionWorker } = await import('./rendition.worker.js')
    workers.push(createRenditionWorker({ shutdownSignal }))
  }

  workersStarted = true
  console.log(`[workers] ${workers.length} workers BullMQ isolados iniciados.`)
  return workers
}

export async function stopWorkers() {
  await Promise.all(workers.map((worker) => worker.close()))

  const { closeAllMediaQueues } = await import('../queues/index.js')
  await closeAllMediaQueues()
  await closeRedisConnection()

  workers = []
  workersStarted = false
  console.log('[workers] Workers BullMQ encerrados.')
}
