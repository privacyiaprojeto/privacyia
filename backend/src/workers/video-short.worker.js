import { Worker } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'
import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from '../queues/names.js'
import { processSceneDirectionJob } from '../services/scene-direction-worker.service.js'
import { attachWorkerLogging, runWorkerJobWithTimeout } from './worker-runtime.js'

export function createVideoShortWorker() {
  const worker = new Worker(
    QUEUE_NAMES.VIDEO_SHORT,
    (job) => runWorkerJobWithTimeout({
      job,
      timeoutMs: env.VIDEO_SHORT_WORKER_JOB_TIMEOUT_MS,
      label: 'Video Short Worker',
      handler: async (currentJob) => {
        if (currentJob.name !== JOB_NAMES.VIDEO_SHORT_SCENE_DIRECTION) {
          throw new ApiError(400, `Job não suportado na fila de vídeo curto: ${currentJob.name}`)
        }
        return processSceneDirectionJob(currentJob)
      },
    }),
    {
      connection: createRedisConnection('privacy-ia-worker-video-short'),
      prefix: env.REDIS_QUEUE_PREFIX,
      concurrency: env.VIDEO_SHORT_WORKER_CONCURRENCY,
      lockDuration: 120000,
    },
  )

  return attachWorkerLogging(worker, 'video-short')
}
