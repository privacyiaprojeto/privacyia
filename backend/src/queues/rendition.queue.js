import { ApiError } from '../utils/apiError.js'
import { JOB_NAMES, QUEUE_NAMES } from './names.js'
import { createLazyQueue } from './queue-runtime.js'

const lazy = createLazyQueue({
  name: QUEUE_NAMES.RENDITION,
  connectionName: 'privacy-ia-queue-rendition',
  attempts: 2,
  backoffDelayMs: 20000,
})

export const renditionQueue = lazy.proxy
export const getRenditionQueue = lazy.getQueue
export const closeRenditionQueue = lazy.closeQueue
export const isRenditionQueueInitialized = lazy.isInitialized

function resolveRenditionJobName(renditionType) {
  const type = String(renditionType || '').trim().toLowerCase()
  if (type === 'preview') return JOB_NAMES.RENDITION_PREVIEW
  if (type === 'hls_stream') return JOB_NAMES.RENDITION_HLS_STREAM
  throw new ApiError(422, 'Fila de rendition suporta apenas preview e hls_stream nesta etapa.')
}

export async function addRenditionJob({ renditionId, masterAssetId, renditionType, deliveryId = null } = {}) {
  if (!renditionId || !masterAssetId || !renditionType) {
    throw new ApiError(400, 'renditionId, masterAssetId e renditionType são obrigatórios.')
  }

  const jobName = resolveRenditionJobName(renditionType)
  return getRenditionQueue().add(
    jobName,
    { renditionId, masterAssetId, renditionType, deliveryId },
    { jobId: `rendition-${renditionId}` },
  )
}

export function addPreviewRenditionJob(input = {}) {
  return addRenditionJob({ ...input, renditionType: 'preview' })
}

export function addHlsStreamRenditionJob(input = {}) {
  return addRenditionJob({ ...input, renditionType: 'hls_stream' })
}
