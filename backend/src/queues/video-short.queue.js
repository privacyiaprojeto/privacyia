import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from './names.js'
import { createLazyQueue } from './queue-runtime.js'

const lazy = createLazyQueue({
  name: QUEUE_NAMES.VIDEO_SHORT,
  connectionName: 'privacy-ia-queue-video-short',
  attempts: 2,
  backoffDelayMs: 15000,
})

export const videoShortQueue = lazy.proxy
export const getVideoShortQueue = lazy.getQueue
export const closeVideoShortQueue = lazy.closeQueue
export const isVideoShortQueueInitialized = lazy.isInitialized

export async function addVideoShortJob({ directionId } = {}) {
  if (!directionId) throw new ApiError(400, 'directionId é obrigatório para enfileirar vídeo curto.')
  return getVideoShortQueue().add(
    JOB_NAMES.VIDEO_SHORT_SCENE_DIRECTION,
    { directionId, factoryMode: 'scene_direction_i2v', processingProfile: 'video_short' },
    { jobId: `video-short-${directionId}` },
  )
}
