import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from './names.js'
import { createLazyQueue } from './queue-runtime.js'

const lazy = createLazyQueue({
  name: QUEUE_NAMES.VIDEO_V2V,
  connectionName: 'privacy-ia-queue-video-v2v',
  attempts: 2,
  backoffDelayMs: 30000,
})

export const videoV2vQueue = lazy.proxy
export const getVideoV2vQueue = lazy.getQueue
export const closeVideoV2vQueue = lazy.closeQueue
export const isVideoV2vQueueInitialized = lazy.isInitialized

export async function addVideoV2vJob({ directionId } = {}) {
  if (!directionId) throw new ApiError(400, 'directionId é obrigatório para enfileirar V2V.')
  return getVideoV2vQueue().add(
    JOB_NAMES.VIDEO_V2V_SCENE_DIRECTION,
    { directionId, factoryMode: 'scene_direction_v2v', processingProfile: 'video_v2v' },
    { jobId: `video-v2v-${directionId}` },
  )
}
