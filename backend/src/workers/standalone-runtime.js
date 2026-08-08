import { spawnSync } from 'node:child_process'
import { env } from '../config/env.js'
import {
  closeRedisConnection,
  describeRedisConnectionTarget,
} from '../config/redis.js'
import { closeAllMediaQueues } from '../queues/index.js'
import { ApiError } from '../utils/apiError.js'

const DEFAULT_SHUTDOWN_GRACE_MS = 45_000

function firstOutputLine(result) {
  return String(result?.stdout || result?.stderr || '')
    .split(/\r?\n/)
    .find(Boolean) || ''
}

function verifyExecutable(command, label) {
  const result = spawnSync(command, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.error || result.status !== 0) {
    throw new ApiError(500, `${label} não está disponível no runtime do worker.`, {
      command,
      status: result.status,
      error: result.error?.message || null,
      output: firstOutputLine(result),
    })
  }

  console.log(`[worker-runtime] ${label}: ${firstOutputLine(result)}`)
}

export function verifyMediaRuntimeBinaries() {
  verifyExecutable(env.FFMPEG_PATH, 'FFmpeg')
  verifyExecutable(env.FFPROBE_PATH, 'FFprobe')
}

export function assertStandaloneWorkerStartup({ requireRendition = false } = {}) {
  if (!env.WORKERS_ENABLED) {
    throw new ApiError(503, 'Worker standalone bloqueado: WORKERS_ENABLED=false.')
  }

  if (requireRendition && !env.RENDITION_QUEUE_ENABLED) {
    throw new ApiError(503, 'Rendition worker bloqueado: RENDITION_QUEUE_ENABLED=false.')
  }

  const redisTarget = describeRedisConnectionTarget()
  if (env.NODE_ENV !== 'production' && redisTarget.external && !env.ALLOW_EXTERNAL_REDIS_WORKERS) {
    throw new ApiError(503, 'Redis externo bloqueado em desenvolvimento sem autorização explícita.', {
      redisTarget,
    })
  }

  return redisTarget
}

function delay(ms) {
  return new Promise((resolve) => {
    const handle = setTimeout(resolve, ms)
    handle.unref?.()
  })
}

async function closeWorkersWithGrace(workers, graceMs) {
  const gracefulClose = Promise.allSettled(workers.map((worker) => worker.close(false)))
  const result = await Promise.race([
    gracefulClose.then(() => 'closed'),
    delay(graceMs).then(() => 'timeout'),
  ])

  if (result === 'timeout') {
    console.error(`[worker-runtime] Graceful shutdown excedeu ${graceMs}ms; desconectando conexões BullMQ restantes.`)
    await Promise.allSettled(workers.map((worker) => worker.disconnect()))
    await Promise.race([
      gracefulClose,
      delay(5_000),
    ])
  }
}

export async function runStandaloneWorkerProcess({
  name,
  requireRendition = false,
  verifyMediaBinaries = false,
  start,
  shutdownGraceMs = DEFAULT_SHUTDOWN_GRACE_MS,
} = {}) {
  if (!name) throw new ApiError(500, 'Nome do worker standalone ausente.')
  if (typeof start !== 'function') throw new ApiError(500, `Worker ${name}: função start ausente.`)

  const redisTarget = assertStandaloneWorkerStartup({ requireRendition })
  if (verifyMediaBinaries) verifyMediaRuntimeBinaries()

  const shutdownController = new AbortController()
  let workerInstances = []
  let shutdownPromise = null
  let resolveFinished
  const finished = new Promise((resolve) => {
    resolveFinished = resolve
  })

  const signalHandlers = new Map()

  const removeProcessHandlers = () => {
    for (const [eventName, handler] of signalHandlers.entries()) {
      process.removeListener(eventName, handler)
    }
  }

  const shutdown = async ({ reason, exitCode = 0 } = {}) => {
    if (shutdownPromise) return shutdownPromise

    shutdownPromise = (async () => {
      console.log(`[worker-runtime] Encerrando ${name}. Motivo: ${reason || 'shutdown solicitado'}.`)
      shutdownController.abort(new Error(`${name}: ${reason || 'shutdown solicitado'}`))

      try {
        await closeWorkersWithGrace(workerInstances, shutdownGraceMs)
      } finally {
        await Promise.allSettled([
          closeAllMediaQueues(),
          closeRedisConnection(),
        ])
        removeProcessHandlers()
        process.exitCode = exitCode
        resolveFinished()
        console.log(`[worker-runtime] ${name} encerrado com segurança.`)
      }
    })()

    return shutdownPromise
  }

  const registerHandler = (eventName, handler) => {
    signalHandlers.set(eventName, handler)
    process.on(eventName, handler)
  }

  registerHandler('SIGTERM', () => {
    void shutdown({ reason: 'SIGTERM', exitCode: 0 })
  })

  registerHandler('SIGINT', () => {
    void shutdown({ reason: 'SIGINT', exitCode: 0 })
  })

  registerHandler('uncaughtException', (error) => {
    console.error(`[worker-runtime] ${name}: exceção não tratada.`, error)
    void shutdown({ reason: 'uncaughtException', exitCode: 1 })
  })

  registerHandler('unhandledRejection', (error) => {
    console.error(`[worker-runtime] ${name}: rejeição não tratada.`, error)
    void shutdown({ reason: 'unhandledRejection', exitCode: 1 })
  })

  try {
    const started = await start({ shutdownSignal: shutdownController.signal })
    workerInstances = Array.isArray(started) ? started.filter(Boolean) : [started].filter(Boolean)

    if (!workerInstances.length) {
      throw new ApiError(503, `Worker ${name} não iniciou nenhuma instância BullMQ.`)
    }

    console.log(`[worker-runtime] ${name} iniciado com ${workerInstances.length} instância(s).`, {
      redisTarget,
      pid: process.pid,
    })
  } catch (error) {
    console.error(`[worker-runtime] Falha ao iniciar ${name}.`, error)
    await shutdown({ reason: 'startup failure', exitCode: 1 })
  }

  await finished
}
