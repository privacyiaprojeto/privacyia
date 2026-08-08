import { Worker } from 'bullmq'
import { env } from '../config/env.js'
import { createRedisConnection } from '../config/redis.js'
import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from '../queues/names.js'
import { processFactoryDryRunItem, processFactoryRealImageItem } from '../services/factory.service.js'
import { processActorPipelineImageStageJob } from '../services/actor-pipeline.service.js'
import { attachWorkerLogging, runWorkerJobWithTimeout } from './worker-runtime.js'

function truthy(value) {
  if (typeof value === 'boolean') return value
  return ['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'].includes(String(value || '').trim().toLowerCase())
}

export function getFactoryRealImageJobName() {
  return String(process.env.FACTORY_REAL_IMAGE_JOB_NAME || JOB_NAMES.IMAGE_REAL_ITEM).trim()
}

export function isFactoryRealImageJob(job = {}) {
  return [getFactoryRealImageJobName(), JOB_NAMES.IMAGE_REAL_ITEM].includes(String(job?.name || '').trim())
}

function shouldProcessRealImage(data = {}) {
  const mode = String(data.factoryMode || data.factory_mode || data.mode || data.jobType || data.job_type || data.pipeline || '').trim().toLowerCase()
  if (['real_image', 'real-image', 'image', 'factory_image', 'generate_image', 'real_single_item_controlled', 'admin_real_production_6_3a'].includes(mode)) return true
  return truthy(data.generateRealImage) || truthy(data.generate_real_image) || truthy(data.realImageWorker) || truthy(data.runPodAllowed) || truthy(data.uploadToR2)
}

export function resolveImageJobKind(job = {}) {
  if (job.name === JOB_NAMES.ACTOR_PIPELINE_IMAGE_STAGE) return 'actor_pipeline_stage'
  if (isFactoryRealImageJob(job)) return 'real_image'
  if ([JOB_NAMES.IMAGE_DRY_RUN_ITEM, JOB_NAMES.FACTORY_MOCK_ITEM].includes(job.name)) {
    return shouldProcessRealImage(job.data || {}) ? 'real_image' : 'dry_run'
  }
  return 'unsupported'
}

export function createImageWorker() {
  const worker = new Worker(
    QUEUE_NAMES.IMAGE,
    (job) => runWorkerJobWithTimeout({
      job,
      timeoutMs: env.IMAGE_WORKER_JOB_TIMEOUT_MS,
      label: 'Image Worker',
      handler: async (currentJob) => {
        const kind = resolveImageJobKind(currentJob)
        if (kind === 'actor_pipeline_stage') return processActorPipelineImageStageJob(currentJob.data || {})
        if (kind === 'real_image') return processFactoryRealImageItem(currentJob)
        if (kind === 'dry_run') return processFactoryDryRunItem(currentJob)
        throw new ApiError(400, `Job não suportado na fila de imagem: ${currentJob.name}`)
      },
    }),
    {
      connection: createRedisConnection('privacy-ia-worker-image'),
      prefix: env.REDIS_QUEUE_PREFIX,
      concurrency: env.IMAGE_WORKER_CONCURRENCY,
      lockDuration: 60000,
    },
  )

  return attachWorkerLogging(worker, 'image')
}
