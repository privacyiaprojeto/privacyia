import { ApiError } from '../utils/apiError.js'

const DEFAULT_ABORT_GRACE_MS = 15_000

export async function runWorkerJobWithTimeout({
  job,
  timeoutMs,
  label,
  handler,
  shutdownSignal = null,
  abortGraceMs = DEFAULT_ABORT_GRACE_MS,
}) {
  if (typeof handler !== 'function') throw new ApiError(500, `${label}: handler ausente.`)

  const finalTimeoutMs = Math.max(Number(timeoutMs || 0), 1000)
  const finalAbortGraceMs = Math.max(Number(abortGraceMs || 0), 1000)
  const abortController = new AbortController()
  let timeoutHandle = null
  let abortGraceHandle = null
  let timedOut = false
  let timeoutError = null

  const abortFromShutdown = () => {
    if (!abortController.signal.aborted) {
      abortController.abort(shutdownSignal?.reason || new Error(`${label}: shutdown solicitado`))
    }
  }

  if (shutdownSignal) {
    if (shutdownSignal.aborted) abortFromShutdown()
    else shutdownSignal.addEventListener('abort', abortFromShutdown, { once: true })
  }

  const handlerPromise = Promise.resolve()
    .then(() => handler(job, { signal: abortController.signal }))
    .then((result) => {
      if (timedOut) throw timeoutError
      return result
    })
    .catch((error) => {
      if (timedOut) throw timeoutError
      throw error
    })

  const timeoutPromise = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true
      timeoutError = new ApiError(504, `${label} excedeu o timeout operacional de ${Math.round(finalTimeoutMs / 1000)}s.`)
      timeoutError.code = 'WORKER_JOB_TIMEOUT'

      if (!abortController.signal.aborted) {
        abortController.abort(timeoutError)
      }

      // Dá ao FFmpeg/handler uma janela curta para encerrar filhos e temporários
      // antes de devolver o job ao BullMQ como falha definitiva da tentativa.
      abortGraceHandle = setTimeout(() => reject(timeoutError), finalAbortGraceMs)
      abortGraceHandle.unref?.()
    }, finalTimeoutMs)
    timeoutHandle.unref?.()
  })

  try {
    return await Promise.race([handlerPromise, timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
    if (abortGraceHandle) clearTimeout(abortGraceHandle)
    shutdownSignal?.removeEventListener('abort', abortFromShutdown)
  }
}

export function attachWorkerLogging(worker, label) {
  worker.on('completed', (job) => {
    console.log(`[worker:${label}] job concluído: ${job.id}`)
  })

  worker.on('failed', (job, error) => {
    console.error(`[worker:${label}] job falhou: ${job?.id}`, error)
  })

  worker.on('error', (error) => {
    console.error(`[worker:${label}] erro de infraestrutura`, error)
  })

  return worker
}
