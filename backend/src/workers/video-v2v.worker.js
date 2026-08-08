import { Worker } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'
import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from '../queues/names.js'
import { processSceneDirectionJob } from '../services/scene-direction-worker.service.js'
import { attachWorkerLogging, runWorkerJobWithTimeout } from './worker-runtime.js'

export function createVideoV2vWorker() {
  const worker = new Worker(
    QUEUE_NAMES.VIDEO_V2V,
    (job) => runWorkerJobWithTimeout({
      job,
      timeoutMs: env.VIDEO_V2V_WORKER_JOB_TIMEOUT_MS,
      label: 'Video V2V Worker',
      handler: async (currentJob) => {
        if (currentJob.name !== JOB_NAMES.VIDEO_V2V_SCENE_DIRECTION) {
          throw new ApiError(400, `Job não suportado na fila V2V: ${currentJob.name}`)
        }
        return processSceneDirectionJob(currentJob)
      },
    }),
    {
      connection: createRedisConnection('privacy-ia-worker-video-v2v'),
      prefix: env.REDIS_QUEUE_PREFIX,
      concurrency: env.VIDEO_V2V_WORKER_CONCURRENCY,
      lockDuration: 180000,
    },
  )

  return attachWorkerLogging(worker, 'video-v2v')
}
