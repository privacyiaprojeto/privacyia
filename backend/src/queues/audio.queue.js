import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from './names.js'
import { createLazyQueue } from './queue-runtime.js'

const lazy = createLazyQueue({
  name: QUEUE_NAMES.AUDIO,
  connectionName: 'privacy-ia-queue-audio',
  attempts: 3,
  backoffDelayMs: 10000,
})

export const audioQueue = lazy.proxy
export const getAudioQueue = lazy.getQueue
export const closeAudioQueue = lazy.closeQueue
export const isAudioQueueInitialized = lazy.isInitialized

export async function addActorPipelineLiveAudioJob({
  batchItemId,
  batchId = null,
  combinationId = null,
  actorProfileId = null,
  companionId = null,
} = {}) {
  if (!batchItemId) throw new ApiError(400, 'batchItemId é obrigatório para enfileirar Live Audio.')

  return getAudioQueue().add(
    JOB_NAMES.AUDIO_LIVE_ITEM,
    {
      batchItemId,
      batchId,
      combinationId,
      actorProfileId,
      companionId,
      factoryMode: 'actor_pipeline_live_audio',
    },
    { jobId: `audio-live-${batchItemId}` },
  )
}
