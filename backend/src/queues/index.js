export { QUEUE_NAMES, JOB_NAMES } from './names.js'

export {
  imageQueue,
  getImageQueue,
  addImageItemJob,
  addImageDryRunJob,
  addImageRealJob,
  closeImageQueue,
} from './image.queue.js'

export {
  videoShortQueue,
  getVideoShortQueue,
  addVideoShortJob,
  closeVideoShortQueue,
} from './video-short.queue.js'

export {
  videoV2vQueue,
  getVideoV2vQueue,
  addVideoV2vJob,
  closeVideoV2vQueue,
} from './video-v2v.queue.js'

export {
  audioQueue,
  getAudioQueue,
  addActorPipelineLiveAudioJob,
  closeAudioQueue,
} from './audio.queue.js'

export {
  renditionQueue,
  getRenditionQueue,
  addRenditionJob,
  closeRenditionQueue,
} from './rendition.queue.js'

import { closeImageQueue } from './image.queue.js'
import { closeVideoShortQueue } from './video-short.queue.js'
import { closeVideoV2vQueue } from './video-v2v.queue.js'
import { closeAudioQueue } from './audio.queue.js'
import { closeRenditionQueue } from './rendition.queue.js'

export async function closeAllMediaQueues() {
  await Promise.all([
    closeImageQueue(),
    closeVideoShortQueue(),
    closeVideoV2vQueue(),
    closeAudioQueue(),
    closeRenditionQueue(),
  ])
}
