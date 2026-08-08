import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from './names.js'
import { createLazyQueue } from './queue-runtime.js'

const lazy = createLazyQueue({
  name: QUEUE_NAMES.IMAGE,
  connectionName: 'privacy-ia-queue-image',
  attempts: 3,
  backoffDelayMs: 5000,
})

export const imageQueue = lazy.proxy
export const getImageQueue = lazy.getQueue
export const closeImageQueue = lazy.closeQueue
export const isImageQueueInitialized = lazy.isInitialized

export async function addImageItemJob({
  batchItemId,
  batchId = null,
  combinationId = null,
  requestedVariants = 1,
  nextStatus = 'qa_pending',
  delayMs = 0,
  metadata = {},
  jobPayload = {},
  real = false,
} = {}) {
  if (!batchItemId) throw new ApiError(400, 'batchItemId é obrigatório para enfileirar imagem.')

  const jobName = real ? JOB_NAMES.IMAGE_REAL_ITEM : JOB_NAMES.IMAGE_DRY_RUN_ITEM
  return getImageQueue().add(jobName, {
    batchItemId,
    batchId,
    combinationId,
    requestedVariants,
    nextStatus,
    delayMs,
    metadata,
    ...jobPayload,
  }, {
    jobId: `${real ? 'image-real' : 'image-dry-run'}-${batchItemId}`,
  })
}

export async function addImageDryRunJob(input = {}) {
  return addImageItemJob({ ...input, real: false })
}

export async function addImageRealJob(input = {}) {
  return addImageItemJob({ ...input, real: true })
}

export async function addActorPipelineImageStageJob({
  requestId,
  actorId,
  adminProfileId = null,
  dictionarySelectionIds = [],
  variations = 1,
  notes = null,
  stageNumber = 1,
  expectedStageCount = 1,
  requestedFreshProductCount = 0,
  requestedOutputCount = 0,
} = {}) {
  if (!requestId) throw new ApiError(400, 'requestId é obrigatório para organizar a produção combinatória.')
  if (!actorId) throw new ApiError(400, 'actorId é obrigatório para organizar a produção combinatória.')
  if (!Array.isArray(dictionarySelectionIds) || !dictionarySelectionIds.length) {
    throw new ApiError(400, 'dictionarySelectionIds é obrigatório para organizar a produção combinatória.')
  }

  return getImageQueue().add(JOB_NAMES.ACTOR_PIPELINE_IMAGE_STAGE, {
    requestId,
    actorId,
    adminProfileId,
    dictionarySelectionIds,
    variations,
    notes,
    stageNumber,
    expectedStageCount,
    requestedFreshProductCount,
    requestedOutputCount,
  }, {
    jobId: `image-actor-pipeline-stage-${requestId}-${stageNumber}`,
    attempts: 1,
  })
}
