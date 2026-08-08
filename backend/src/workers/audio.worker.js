import { Worker } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'
import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from '../queues/names.js'
import { processActorPipelineLiveAudioJob } from '../services/actor-pipeline-worker.service.js'
import { attachWorkerLogging, runWorkerJobWithTimeout } from './worker-runtime.js'

export function createAudioWorker() {
  const worker = new Worker(
    QUEUE_NAMES.AUDIO,
    (job) => runWorkerJobWithTimeout({
      job,
      timeoutMs: env.AUDIO_WORKER_JOB_TIMEOUT_MS,
      label: 'Audio Worker',
      handler: async (currentJob) => {
        if (currentJob.name !== JOB_NAMES.AUDIO_LIVE_ITEM) {
          throw new ApiError(400, `Job não suportado na fila de áudio: ${currentJob.name}`)
        }
        return processActorPipelineLiveAudioJob(currentJob)
      },
    }),
    {
      connection: createRedisConnection('privacy-ia-worker-audio'),
      prefix: env.REDIS_QUEUE_PREFIX,
      concurrency: env.AUDIO_WORKER_CONCURRENCY,
      lockDuration: 90000,
    },
  )

  return attachWorkerLogging(worker, 'audio')
}
