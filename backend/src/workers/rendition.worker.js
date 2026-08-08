import { Worker } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'
import { JOB_NAMES, QUEUE_NAMES } from '../queues/names.js'
import { processMediaRenditionJob } from '../services/media-rendition.service.js'
import { ApiError } from '../utils/apiError.js'
import { attachWorkerLogging, runWorkerJobWithTimeout } from './worker-runtime.js'

export function createRenditionWorker({ shutdownSignal = null } = {}) {
  const worker = new Worker(
    QUEUE_NAMES.RENDITION,
    (job) => runWorkerJobWithTimeout({
      job,
      timeoutMs: env.RENDITION_WORKER_JOB_TIMEOUT_MS,
      label: 'Rendition Worker',
      shutdownSignal,
      handler: async (currentJob, { signal }) => {
        const supportedJobs = new Set([
          JOB_NAMES.RENDITION_CREATE,
          JOB_NAMES.RENDITION_PREVIEW,
          JOB_NAMES.RENDITION_HLS_STREAM,
        ])

        if (!supportedJobs.has(currentJob.name)) {
          throw new ApiError(400, `Job não suportado na fila de rendition: ${currentJob.name}`)
        }

        const renditionType = currentJob.name === JOB_NAMES.RENDITION_PREVIEW
          ? 'preview'
          : currentJob.name === JOB_NAMES.RENDITION_HLS_STREAM
            ? 'hls_stream'
            : currentJob.data?.renditionType

        return processMediaRenditionJob({
          ...currentJob.data,
          renditionType,
        }, { signal })
      },
    }),
    {
      connection: createRedisConnection('privacy-ia-worker-rendition'),
      prefix: env.REDIS_QUEUE_PREFIX,
      concurrency: env.RENDITION_WORKER_CONCURRENCY,
      lockDuration: 120000,
    },
  )

  return attachWorkerLogging(worker, 'rendition')
}
