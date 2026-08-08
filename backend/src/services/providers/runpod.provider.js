import axios from 'axios'
import { Buffer } from 'node:buffer'
import { env } from '../../config/env.js'
import { withRunPodWorkerLease } from '../runpod-worker-lease-guard-6-3R12.service.js'
import { compileImageProductionSpec, compileVideoProductionSpec } from '../production-compiler.service.js'
import {
  attachRunPodTelemetryToError,
  createRunPodTelemetryError,
  extractRunPodTelemetry,
} from '../runpod-telemetry.service.js'

const runpod = axios.create({
  baseURL: env.RUNPOD_BASE_URL,
  headers: {
    Authorization: env.RUNPOD_API_KEY ? `Bearer ${env.RUNPOD_API_KEY}` : undefined,
    'Content-Type': 'application/json',
  },
})

function getAudioEndpointId() {
  return env.RUNPOD_QWEN_TTS_ENDPOINT_ID
}

function getImageEndpointId() {
  return env.RUNPOD_IMAGE_ENDPOINT_ID
}

function getVideoEndpointId() {
  return env.RUNPOD_VIDEO_ENDPOINT_ID
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMimeExtension(mimeType = 'audio/mpeg') {
  const normalized = String(mimeType || '').toLowerCase()

  if (normalized.includes('wav')) return 'wav'
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('mp4')) return 'm4a'
  if (normalized.includes('aac')) return 'aac'
  if (normalized.includes('png')) return 'png'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'

  return 'mp3'
}

function guessMimeTypeFromUrl(url = '') {
  const cleanUrl = String(url).split('?')[0].toLowerCase()

  if (cleanUrl.endsWith('.wav')) return 'audio/wav'
  if (cleanUrl.endsWith('.ogg')) return 'audio/ogg'
  if (cleanUrl.endsWith('.webm')) return 'audio/webm'
  if (cleanUrl.endsWith('.m4a')) return 'audio/mp4'
  if (cleanUrl.endsWith('.aac')) return 'audio/aac'
  if (cleanUrl.endsWith('.mp3')) return 'audio/mpeg'
  if (cleanUrl.endsWith('.png')) return 'image/png'
  if (cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanUrl.endsWith('.webp')) return 'image/webp'

  return 'application/octet-stream'
}

function parseDataUri(value) {
  const match = String(value || '').match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2],
  }
}

function readFirstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
}

function redactPayloadForLog(value) {
  if (typeof value === 'string') {
    if (value.length > 300) {
      return `[string omitida no log | tamanho=${value.length} chars | inicio=${value.slice(0, 40)}...]`
    }

    return value
  }

  if (Array.isArray(value)) {
    return value.map(redactPayloadForLog)
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, redactPayloadForLog(entryValue)]),
    )
  }

  return value
}

function buildRunPodError(error) {
  return {
    status: error?.response?.status,
    data: error?.response?.data,
    message: error?.message || 'Erro desconhecido ao chamar RunPod.',
  }
}

function getRunPodErrorStatus(error) {
  return Number(error?.response?.status || error?.status || 0) || 0
}

function getRunPodErrorCode(error) {
  return String(error?.code || error?.cause?.code || '').toUpperCase()
}

function isTransientRunPodError(error) {
  const code = getRunPodErrorCode(error)
  const status = getRunPodErrorStatus(error)
  const message = String(error?.message || error?.cause?.message || '').toLowerCase()

  if ([
    'ECONNRESET',
    'ECONNABORTED',
    'ETIMEDOUT',
    'EAI_AGAIN',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EPIPE',
    'UND_ERR_SOCKET',
  ].includes(code)) {
    return true
  }

  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true
  }

  return (
    message.includes('socket hang up') ||
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('read econnreset') ||
    message.includes('connection reset')
  )
}

function buildSafeRunPodError(error) {
  return {
    status: getRunPodErrorStatus(error) || null,
    code: getRunPodErrorCode(error) || null,
    message: error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      'Erro desconhecido ao consultar RunPod.',
  }
}


function cleanBase64(value) {
  const dataUri = parseDataUri(value)
  const raw = dataUri?.base64 || String(value || '')

  return raw.replace(/^base64,/, '').replace(/\s/g, '')
}

async function downloadMediaBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: Number(env.RUNPOD_MEDIA_DOWNLOAD_MAX_BYTES || 300 * 1024 * 1024),
    maxBodyLength: Number(env.RUNPOD_MEDIA_DOWNLOAD_MAX_BYTES || 300 * 1024 * 1024),
    headers: {
      Accept: 'audio/*,image/*,video/*,application/octet-stream,*/*',
    },
  })

  const headerContentType = response.headers?.['content-type']
  const mimeType =
    headerContentType && !headerContentType.includes('application/octet-stream')
      ? headerContentType
      : guessMimeTypeFromUrl(url)

  return {
    buffer: Buffer.from(response.data),
    mimeType,
    extension: getMimeExtension(mimeType),
  }
}

function extractAudioCandidate(output) {
  if (!output) return null

  if (typeof output === 'string') {
    return output
  }

  if (Array.isArray(output)) {
    return output.map(extractAudioCandidate).find(Boolean) || null
  }

  if (typeof output === 'object') {
    const direct = readFirstString(
      output.audio_base64,
      output.audioBase64,
      output.base64,
      output.audio,
      output.audio_url,
      output.audioUrl,
      output.url,
      output.file_url,
      output.fileUrl,
      output.output_url,
      output.outputUrl,
      output.wav,
      output.wav_base64,
      output.wavBase64,
      output.mp3,
      output.mp3_base64,
      output.mp3Base64,
    )

    if (direct) return direct

    return extractAudioCandidate(
      output.output ||
        output.result ||
        output.data ||
        output.file ||
        output.audio_file ||
        output.audioFile,
    )
  }

  return null
}

function extractImageCandidate(output) {
  if (!output) return null

  if (typeof output === 'string') {
    return output
  }

  if (Array.isArray(output)) {
    return output.map(extractImageCandidate).find(Boolean) || null
  }

  if (typeof output === 'object') {
    const direct = readFirstString(
      output.image_base64,
      output.imageBase64,
      output.image,
      output.base64,
      output.url,
      output.image_url,
      output.imageUrl,
      output.file_url,
      output.fileUrl,
      output.output_url,
      output.outputUrl,
      output.png,
      output.png_base64,
      output.pngBase64,
      output.jpeg,
      output.jpg,
      output.webp,
    )

    if (direct) return direct

    return extractImageCandidate(
      output.output ||
        output.result ||
        output.data ||
        output.file ||
        output.images ||
        output.artifacts,
    )
  }

  return null
}


function extractVideoCandidate(output) {
  if (!output) return null

  if (typeof output === 'string') {
    return output
  }

  if (Array.isArray(output)) {
    return output.map(extractVideoCandidate).find(Boolean) || null
  }

  if (typeof output === 'object') {
    const direct = readFirstString(
      output.video_base64,
      output.videoBase64,
      output.video,
      output.base64,
      output.url,
      output.video_url,
      output.videoUrl,
      output.file_url,
      output.fileUrl,
      output.output_url,
      output.outputUrl,
      output.mp4,
      output.mp4_base64,
      output.mp4Base64,
      output.webm,
      output.webm_base64,
      output.webmBase64,
      output.mov,
    )

    if (direct) return direct

    return extractVideoCandidate(
      output.output ||
        output.result ||
        output.data ||
        output.file ||
        output.video_file ||
        output.videoFile ||
        output.videos ||
        output.artifacts,
    )
  }

  return null
}

async function normalizeAudioOutput(output) {
  const candidate = extractAudioCandidate(output)

  if (!candidate) {
    console.error('[RunPod Qwen3-TTS] output sem áudio reconhecível:', JSON.stringify(redactPayloadForLog(output), null, 2))
    throw new Error('RunPod não retornou áudio em base64 ou URL.')
  }

  if (/^https?:\/\//i.test(candidate)) {
    return downloadMediaBuffer(candidate)
  }

  const dataUri = parseDataUri(candidate)
  const mimeType = dataUri?.mimeType || output?.mime_type || output?.mimeType || 'audio/mpeg'
  const base64 = dataUri?.base64 || candidate
  const cleaned = cleanBase64(base64)

  return {
    buffer: Buffer.from(cleaned, 'base64'),
    mimeType,
    extension: output?.extension || getMimeExtension(mimeType),
  }
}

async function normalizeImageOutput(output) {
  const candidate = extractImageCandidate(output)

  if (!candidate) {
    console.error('[RunPod Image] output sem imagem reconhecível:', JSON.stringify(redactPayloadForLog(output), null, 2))
    throw new Error('RunPod não retornou imagem em base64 ou URL.')
  }

  if (/^https?:\/\//i.test(candidate)) {
    return downloadMediaBuffer(candidate)
  }

  const dataUri = parseDataUri(candidate)
  const mimeType = dataUri?.mimeType || output?.mime_type || output?.mimeType || 'image/png'
  const base64 = dataUri?.base64 || candidate
  const cleaned = cleanBase64(base64)

  return {
    buffer: Buffer.from(cleaned, 'base64'),
    mimeType,
    extension: output?.extension || getMimeExtension(mimeType),
  }
}


async function normalizeVideoOutput(output) {
  const candidate = extractVideoCandidate(output)

  if (!candidate) {
    console.error('[RunPod Video] output sem vídeo reconhecível:', JSON.stringify(redactPayloadForLog(output), null, 2))
    throw new Error('RunPod não retornou vídeo em base64 ou URL.')
  }

  if (/^https?:\/\//i.test(candidate)) {
    const downloaded = await downloadMediaBuffer(candidate)
    const mimeType = downloaded.mimeType?.startsWith('video/') ? downloaded.mimeType : 'video/mp4'

    return {
      ...downloaded,
      mimeType,
      extension: getMimeExtension(mimeType) === 'm4a' ? 'mp4' : getMimeExtension(mimeType),
    }
  }

  const dataUri = parseDataUri(candidate)
  const mimeType = dataUri?.mimeType || output?.mime_type || output?.mimeType || 'video/mp4'
  const base64 = dataUri?.base64 || candidate
  const cleaned = cleanBase64(base64)
  const finalMimeType = String(mimeType || '').startsWith('video/') ? mimeType : 'video/mp4'

  return {
    buffer: Buffer.from(cleaned, 'base64'),
    mimeType: finalMimeType,
    extension: getMimeExtension(finalMimeType) === 'm4a' ? 'mp4' : getMimeExtension(finalMimeType),
  }
}

async function submitRunPodJob({ endpointId, payload, label, mediaType = 'unknown' }) {
  if (!env.RUNPOD_API_KEY || !endpointId) {
    throw new Error(`${label} não configurado no RunPod.`)
  }

  try {
    const response = await runpod.post(`/${endpointId}/run`, {
      input: payload,
    })

    return response.data
  } catch (error) {
    const runpodError = buildRunPodError(error)
    const telemetry = extractRunPodTelemetry({
      payload: runpodError?.data || {},
      endpointId,
      mediaType,
      terminalStatus: 'SUBMISSION_FAILED',
      errorType: 'submission_failed',
    })

    console.error(`[${label}] falha ao criar job.`)
    console.error(`[${label}] payload enviado:`, JSON.stringify(redactPayloadForLog(payload), null, 2))
    console.error(`[${label}] resposta do RunPod:`, JSON.stringify(runpodError, null, 2))

    throw createRunPodTelemetryError(
      runpodError?.data?.error ||
        runpodError?.data?.message ||
        runpodError?.message ||
        `Erro ao criar job em ${label}.`,
      {
        telemetry,
        code: 'RUNPOD_SUBMISSION_FAILED',
        cause: error,
      },
    )
  }
}

async function getJobStatus({ endpointId, jobId, label, timeoutMs = 20000 }) {
  if (!env.RUNPOD_API_KEY || !endpointId) {
    throw new Error(`${label} não configurado no RunPod.`)
  }

  const response = await runpod.get(`/${endpointId}/status/${jobId}`, {
    timeout: Math.max(Number(timeoutMs || 0), 10000),
  })

  return response.data
}

export async function cancelRunPodJob({ endpointId, jobId, label = 'RunPod Job', reason = 'backend_timeout' } = {}) {
  if (!env.RUNPOD_API_KEY || !endpointId || !jobId) {
    return {
      attempted: false,
      cancelled: false,
      reason: 'missing_runpod_configuration_or_job_id',
    }
  }

  try {
    const response = await runpod.post(`/${endpointId}/cancel/${jobId}`, {
      reason,
      requested_by: 'privacy-ia-backend',
    }, {
      timeout: 30000,
    })

    console.warn(`[${label}] cancelamento solicitado no RunPod | job=${jobId} | reason=${reason}`)
    return {
      attempted: true,
      cancelled: true,
      status: response.status,
      providerStatus: response.data?.status || null,
      response: response.data || null,
    }
  } catch (error) {
    const status = getRunPodErrorStatus(error)
    const safeError = buildSafeRunPodError(error)
    const alreadyTerminal = [404, 409].includes(status)

    console.error(`[${label}] falha ao solicitar cancelamento no RunPod | job=${jobId}`, safeError)
    return {
      attempted: true,
      cancelled: alreadyTerminal,
      alreadyTerminal,
      status: status || null,
      error: safeError,
    }
  }
}

async function cancelRunPodJobAfterTimeout({ endpointId, jobId, label, reason }) {
  return cancelRunPodJob({ endpointId, jobId, label, reason })
}

async function waitForJobCompletion({
  endpointId,
  jobId,
  label,
  mediaType = 'unknown',
  timeoutMs,
  pollIntervalMs,
  queueTimeoutMs = 0,
  heartbeatIntervalMs = 30000,
  maxTransientStatusErrors = 20,
}) {
  const startedAt = Date.now()
  const finalTimeoutMs = Math.max(Number(timeoutMs || 0), 120000)
  const finalPollIntervalMs = Math.max(Number(pollIntervalMs || 0), 2500)
  const finalQueueTimeoutMs = Math.max(Number(queueTimeoutMs || 0), 0)
  const finalHeartbeatIntervalMs = Math.max(Number(heartbeatIntervalMs || 0), 10000)

  let lastStatus = ''
  let lastLogAt = 0
  let queueStartedAt = null
  let consecutiveTransientErrors = 0
  let lastStatusPayload = null

  while (Date.now() - startedAt < finalTimeoutMs) {
    let statusPayload = null

    try {
      statusPayload = await getJobStatus({
        endpointId,
        jobId,
        label,
        timeoutMs: Math.max(finalPollIntervalMs * 4, 15000),
      })

      lastStatusPayload = statusPayload
      consecutiveTransientErrors = 0
    } catch (error) {
      const safeError = buildSafeRunPodError(error)

      if (isTransientRunPodError(error) && consecutiveTransientErrors < maxTransientStatusErrors) {
        consecutiveTransientErrors += 1

        const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
        console.warn(
          `[${label}] polling de status falhou de forma transitória | job=${jobId} | tentativa=${consecutiveTransientErrors}/${maxTransientStatusErrors} | elapsed=${elapsedSeconds}s | code=${safeError.code || 'n/a'} | status=${safeError.status || 'n/a'} | message=${safeError.message}`,
        )

        await sleep(Math.min(finalPollIntervalMs * (consecutiveTransientErrors + 1), 30000))
        continue
      }

      const telemetry = extractRunPodTelemetry({
        payload: lastStatusPayload || {},
        endpointId,
        mediaType,
        providerJobId: jobId,
        terminalStatus: 'STATUS_POLL_FAILED',
        errorType: 'status_poll_failed',
      })

      throw createRunPodTelemetryError(
        `Falha ao consultar status do ${label} no RunPod. code=${safeError.code || 'n/a'} status=${safeError.status || 'n/a'} message=${safeError.message}`,
        {
          telemetry,
          code: 'RUNPOD_STATUS_POLL_FAILED',
          cause: error,
        },
      )
    }

    const status = String(statusPayload?.status || '').toUpperCase()
    const now = Date.now()
    const elapsedSeconds = Math.round((now - startedAt) / 1000)

    if (status === 'IN_QUEUE') {
      queueStartedAt = queueStartedAt || now
    } else {
      queueStartedAt = null
    }

    const statusChanged = status && status !== lastStatus
    const shouldHeartbeat = now - lastLogAt >= finalHeartbeatIntervalMs

    if (status && (statusChanged || shouldHeartbeat)) {
      const queueElapsed =
        queueStartedAt && status === 'IN_QUEUE'
          ? ` queue_elapsed=${Math.round((now - queueStartedAt) / 1000)}s`
          : ''

      console.log(`[${label}] job=${jobId} status=${status} elapsed=${elapsedSeconds}s${queueElapsed}`)

      lastStatus = status
      lastLogAt = now
    }

    if (
      finalQueueTimeoutMs > 0 &&
      status === 'IN_QUEUE' &&
      queueStartedAt &&
      now - queueStartedAt > finalQueueTimeoutMs
    ) {
      const cancellation = await cancelRunPodJobAfterTimeout({
        endpointId,
        jobId,
        label,
        reason: 'queue_timeout',
      })
      const telemetry = {
        ...extractRunPodTelemetry({
          payload: statusPayload,
          endpointId,
          mediaType,
          providerJobId: jobId,
          terminalStatus: 'QUEUE_TIMEOUT',
          errorType: 'queue_timeout',
        }),
        cancellation,
      }

      const timeoutError = createRunPodTelemetryError(
        `Tempo limite de fila excedido aguardando ${label} no RunPod após ${Math.round(finalQueueTimeoutMs / 1000)}s em IN_QUEUE. Cancelamento solicitado ao provedor.`,
        {
          telemetry,
          code: 'RUNPOD_QUEUE_TIMEOUT',
        },
      )
      timeoutError.runpodCancellation = cancellation
      throw timeoutError
    }

    if (status === 'COMPLETED') {
      return statusPayload
    }

    if (['FAILED', 'CANCELLED', 'CANCELED', 'TIMED_OUT'].includes(status)) {
      console.error(`[${label}] job finalizado com erro:`, JSON.stringify(statusPayload, null, 2))

      const telemetry = extractRunPodTelemetry({
        payload: statusPayload,
        endpointId,
        mediaType,
        providerJobId: jobId,
        terminalStatus: status,
        errorType: 'provider_terminal_failure',
      })

      throw createRunPodTelemetryError(
        statusPayload?.error ||
          statusPayload?.message ||
          statusPayload?.output?.error ||
          `RunPod finalizou com status ${status}.`,
        {
          telemetry,
          code: `RUNPOD_${status}`,
        },
      )
    }

    await sleep(finalPollIntervalMs)
  }

  const cancellation = await cancelRunPodJobAfterTimeout({
    endpointId,
    jobId,
    label,
    reason: 'client_timeout',
  })
  const telemetry = {
    ...extractRunPodTelemetry({
      payload: lastStatusPayload || {},
      endpointId,
      mediaType,
      providerJobId: jobId,
      terminalStatus: 'CLIENT_TIMEOUT',
      errorType: 'client_timeout',
    }),
    cancellation,
  }

  const timeoutError = createRunPodTelemetryError(
    `Tempo limite excedido aguardando ${label} no RunPod após ${Math.round(finalTimeoutMs / 1000)}s. Cancelamento solicitado ao provedor.`,
    {
      telemetry,
      code: 'RUNPOD_CLIENT_TIMEOUT',
    },
  )
  timeoutError.runpodCancellation = cancellation
  throw timeoutError
}

async function normalizeRunPodMediaWithTelemetry({
  statusPayload,
  endpointId,
  mediaType,
  providerJobId,
  normalizer,
}) {
  const telemetry = extractRunPodTelemetry({
    payload: statusPayload || {},
    endpointId,
    mediaType,
    providerJobId,
    terminalStatus: statusPayload?.status || 'COMPLETED',
  })

  try {
    const media = await normalizer(statusPayload?.output)

    return {
      ...media,
      runpodJobId: telemetry.providerJobId || providerJobId || null,
      runpodTelemetry: telemetry,
    }
  } catch (error) {
    throw attachRunPodTelemetryToError(error, {
      ...telemetry,
      status: 'OUTPUT_NORMALIZATION_FAILED',
      errorType: 'output_normalization_failed',
    }, 'RUNPOD_OUTPUT_NORMALIZATION_FAILED')
  }
}

function normalizeLanguage(value) {
  const raw = String(value || env.TTS_DEFAULT_LANGUAGE || 'pt').trim().toLowerCase()

  const map = {
    pt: 'Portuguese',
    'pt-br': 'Portuguese',
    portuguese: 'Portuguese',
    português: 'Portuguese',
    en: 'English',
    'en-us': 'English',
    english: 'English',
    es: 'Spanish',
    spanish: 'Spanish',
    it: 'Italian',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    ko: 'Korean',
    ru: 'Russian',
    zh: 'Chinese',
    auto: 'Auto',
  }

  return map[raw] || value || 'Portuguese'
}

function getMaxNewTokensForText(text) {
  const length = String(text || '').length

  if (length <= 80) return 384
  if (length <= 180) return 512
  return 768
}

function buildQwenTtsPayload({ text, voiceProfile, referenceAudio }) {
  const outputFormat = env.TTS_OUTPUT_FORMAT || 'mp3'
  const referenceUrl = String(referenceAudio?.url || voiceProfile.referenceAudioUrl || '').trim()
  const referenceText = String(referenceAudio?.referenceText || voiceProfile.referenceText || '').trim()

  if (!referenceUrl) {
    throw new Error('Perfil de voz sem referenceAudioUrl. Não é possível gerar áudio Qwen3-TTS.')
  }

  return {
    text,
    url_audio_referencia: referenceUrl,
    reference_text: referenceText,
    language: normalizeLanguage(voiceProfile.language),
    output_format: outputFormat,

    voice_profile_id: voiceProfile.id,
    voice_profile_key: voiceProfile.profileKey,
    companion_id: voiceProfile.companionId,

    x_vector_only_mode: !referenceText,

    temperature: 0.7,
    top_p: 0.8,
    max_new_tokens: getMaxNewTokensForText(text),
  }
}

export async function generateSpeechWithRunPod({ text, voiceProfile, referenceAudio }) {
  const cleanText = String(text || '').trim()

  if (!cleanText) {
    throw new Error('Texto vazio para geração TTS.')
  }

  const payload = buildQwenTtsPayload({
    text: cleanText,
    voiceProfile,
    referenceAudio,
  })

  const audioEndpointId = getAudioEndpointId()

  console.log(`[RunPod Qwen3-TTS] usando endpoint=${audioEndpointId}`)
  console.log(
    `[RunPod Qwen3-TTS] payload | text=${String(payload.text || '').length} chars | profile=${payload.voice_profile_key || 'n/a'} | refUrl=${payload.url_audio_referencia ? 'ok' : 'missing'}`,
  )

  const job = await submitRunPodJob({
    endpointId: audioEndpointId,
    payload,
    label: 'RunPod Qwen3-TTS',
    mediaType: 'audio',
  })

  const jobId = job?.id || job?.jobId || null

  if (job?.output) {
    return normalizeRunPodMediaWithTelemetry({
      statusPayload: job,
      endpointId: audioEndpointId,
      mediaType: 'audio',
      providerJobId: jobId,
      normalizer: normalizeAudioOutput,
    })
  }

  if (!jobId) {
    console.error('[RunPod Qwen3-TTS] resposta sem job id:', JSON.stringify(job, null, 2))
    const telemetry = extractRunPodTelemetry({
      payload: job || {},
      endpointId: audioEndpointId,
      mediaType: 'audio',
      terminalStatus: 'MISSING_JOB_ID',
      errorType: 'missing_job_id',
    })
    throw createRunPodTelemetryError('RunPod não retornou id do job de áudio.', {
      telemetry,
      code: 'RUNPOD_MISSING_JOB_ID',
    })
  }

  console.log(`[RunPod Qwen3-TTS] job=${jobId} enviado | perfil=${voiceProfile.profileKey}`)

  const statusPayload = await waitForJobCompletion({
    endpointId: audioEndpointId,
    jobId,
    label: 'RunPod Qwen3-TTS',
    mediaType: 'audio',
    timeoutMs: Math.max(Number(env.RUNPOD_AUDIO_TIMEOUT_MS || 0), 120000),
    pollIntervalMs: Math.max(Number(env.RUNPOD_AUDIO_POLL_INTERVAL_MS || 0), 2500),
    queueTimeoutMs: Math.max(Number(env.RUNPOD_AUDIO_QUEUE_TIMEOUT_MS || 0), 0),
  })

  return normalizeRunPodMediaWithTelemetry({
    statusPayload,
    endpointId: audioEndpointId,
    mediaType: 'audio',
    providerJobId: jobId,
    normalizer: normalizeAudioOutput,
  })
}

function getOptionLabel(options = {}, key) {
  const value = options?.[key]
  return typeof value?.label === 'string' ? value.label.trim() : ''
}

function buildImagePrompt({ companion, options = {}, promptPayload = {} }) {
  const name = String(companion?.name || companion?.slug || 'modelo adulta').trim()
  const roupa = getOptionLabel(options, 'roupaId')
  const posicao = getOptionLabel(options, 'posicaoId')
  const ambiente = getOptionLabel(options, 'ambienteId')
  const acessorio = getOptionLabel(options, 'acessorioId')

  const promptParts = [
    `photorealistic editorial portrait of ${name}, adult woman`,
    posicao ? `composition and pose: ${posicao}` : 'composition: elegant portrait',
    ambiente ? `scene and background: ${ambiente}` : 'scene: premium indoor editorial setting',
    roupa ? `wardrobe: ${roupa}` : 'wardrobe: tasteful modern outfit',
    acessorio ? `accessory: ${acessorio}` : '',
    'cinematic natural light',
    'high detail',
    'realistic skin texture',
    'professional photography',
    'consented adult subject',
  ]

  const prompt = readFirstString(promptPayload?.prompt, promptPayload?.prompt_text, promptPayload?.promptText)

  return prompt || promptParts.filter(Boolean).join(', ')
}

function buildImageNegativePrompt(promptPayload = {}) {
  const negativePrompt = readFirstString(
    promptPayload?.negative_prompt,
    promptPayload?.negativePrompt,
    promptPayload?.negative,
  )

  return (
    negativePrompt ||
    'low quality, blurry, distorted face, bad anatomy, extra fingers, missing fingers, deformed hands, watermark, text, logo, duplicate person, bad proportions, jpeg artifacts'
  )
}

export function buildImageRunPodPayload({ companion, options = {}, promptPayload = {} }) {
  const prompt = buildImagePrompt({ companion, options, promptPayload })
  const negativePrompt = buildImageNegativePrompt(promptPayload)
  const config = promptPayload?.generationConfig || promptPayload?.generation_config || {}

  return compileImageProductionSpec({
    requestId: promptPayload?.mediaJobId || promptPayload?.batchItemId || promptPayload?.requestId || null,
    companion,
    prompt,
    negativePrompt,
    dictionarySelections: promptPayload?.guidedSelections || promptPayload?.guided_selections || Object.values(options || {}),
    identityReferences: promptPayload?.identityReferences || promptPayload?.identity_references || [],
    camera: promptPayload?.camera || {},
    action: promptPayload?.action || {},
    generation: {
      width: promptPayload?.width || config?.width || 1024,
      height: promptPayload?.height || config?.height || 1024,
      steps: promptPayload?.steps || promptPayload?.num_inference_steps || config?.steps || config?.num_inference_steps || 25,
      guidanceScale: promptPayload?.guidance_scale || config?.guidance_scale || 3.5,
      seed: promptPayload?.seed ?? config?.seed ?? null,
    },
    workflow: promptPayload?.workflow || {},
    metadata: {
      actorProfileId: promptPayload?.actorProfileId || promptPayload?.actor_profile_id || null,
      combinationId: promptPayload?.combinationId || promptPayload?.combination_id || null,
      source: promptPayload?.source || 'canonical_image_queue',
    },
  })
}

async function generateImageWithRunPodCore({ companion, options, promptPayload }) {
  const imageEndpointId = getImageEndpointId()

  if (!imageEndpointId) {
    throw new Error('RunPod de imagem não configurado. Defina RUNPOD_IMAGE_ENDPOINT_ID antes de gerar imagens reais.')
  }

  const payload = buildImageRunPodPayload({ companion, options, promptPayload })

  console.log(`[RunPod Image] usando endpoint=${imageEndpointId}`)
  console.log(
    `[RunPod Image] payload | companion=${companion?.slug || companion?.id || 'n/a'} | engine=${payload.engine} | contract=${payload.contract_version} | options=${Object.keys(options || {}).length} | prompt=${String(payload.prompt?.positive || '').length} chars`,
  )

  const job = await submitRunPodJob({
    endpointId: imageEndpointId,
    payload,
    label: 'RunPod Image',
    mediaType: 'image',
  })

  const jobId = job?.id || job?.jobId || null

  if (job?.output) {
    return normalizeRunPodMediaWithTelemetry({
      statusPayload: job,
      endpointId: imageEndpointId,
      mediaType: 'image',
      providerJobId: jobId,
      normalizer: normalizeImageOutput,
    })
  }

  if (!jobId) {
    console.error('[RunPod Image] resposta sem job id:', JSON.stringify(job, null, 2))
    const telemetry = extractRunPodTelemetry({
      payload: job || {},
      endpointId: imageEndpointId,
      mediaType: 'image',
      terminalStatus: 'MISSING_JOB_ID',
      errorType: 'missing_job_id',
    })
    throw createRunPodTelemetryError('RunPod não retornou id do job de imagem.', {
      telemetry,
      code: 'RUNPOD_MISSING_JOB_ID',
    })
  }

  console.log(`[RunPod Image] job=${jobId} enviado | companion=${companion?.slug || companion?.id || 'n/a'}`)

  const statusPayload = await waitForJobCompletion({
    endpointId: imageEndpointId,
    jobId,
    label: 'RunPod Image',
    mediaType: 'image',
    timeoutMs: Math.max(Number(env.RUNPOD_IMAGE_TIMEOUT_MS || 0), 120000),
    pollIntervalMs: Math.max(Number(env.RUNPOD_IMAGE_POLL_INTERVAL_MS || 0), 3000),
    queueTimeoutMs: Math.max(Number(env.RUNPOD_IMAGE_QUEUE_TIMEOUT_MS || 0), 0),
    heartbeatIntervalMs: 30000,
    maxTransientStatusErrors: 20,
  })

  return normalizeRunPodMediaWithTelemetry({
    statusPayload,
    endpointId: imageEndpointId,
    mediaType: 'image',
    providerJobId: jobId,
    normalizer: normalizeImageOutput,
  })
}


export function buildVideoRunPodPayload({ companion = {}, baseVideoUrl = '', promptPayload = {} } = {}) {
  const productionMode = String(promptPayload?.productionMode || promptPayload?.production_mode || (baseVideoUrl ? 'v2v' : 'i2v')).toLowerCase()
  let castSlots = promptPayload?.castSlots || promptPayload?.cast_slots || []

  if (!Array.isArray(castSlots) || castSlots.length === 0) {
    const references = promptPayload?.identityReferences || promptPayload?.identity_references || []
    castSlots = [{
      slotIndex: 1,
      participantType: 'actor',
      actorProfileId: promptPayload?.actorProfileId || promptPayload?.actor_profile_id || null,
      companionId: companion?.id || null,
      authorizationId: promptPayload?.authorizationId || promptPayload?.authorization_id || null,
      referenceImageUrl: references.find((item) => String(item?.mediaType || item?.media_type || '').toLowerCase() === 'image')?.url || references[0]?.url || null,
      referenceMedia: references,
      referenceSource: 'approved_mapping_vault',
    }]
  }

  return compileVideoProductionSpec({
    requestId: promptPayload?.mediaJobId || promptPayload?.directionId || promptPayload?.requestId || null,
    productionMode,
    prompt: readFirstString(promptPayload?.prompt, promptPayload?.prompt_text, promptPayload?.scene_prompt),
    negativePrompt: readFirstString(promptPayload?.negative_prompt, promptPayload?.negativePrompt),
    baseVideoUrl: promptPayload?.baseVideoUrl || promptPayload?.base_video_url || baseVideoUrl || null,
    castSlots,
    camera: promptPayload?.camera || {},
    action: promptPayload?.action || {},
    generation: promptPayload?.generationConfig || promptPayload?.generation_config || {},
    workflow: promptPayload?.workflow || {},
    metadata: {
      companionId: companion?.id || null,
      source: promptPayload?.source || 'canonical_video_queue',
    },
  })
}

async function generateVideoWithRunPodCore({ companion, baseVideoUrl, promptPayload }) {
  const videoEndpointId = getVideoEndpointId()
  if (!videoEndpointId) {
    throw new Error('RunPod de vídeo não configurado. Defina RUNPOD_VIDEO_ENDPOINT_ID antes de gerar vídeos reais.')
  }

  const payload = buildVideoRunPodPayload({ companion, baseVideoUrl, promptPayload })
  console.log(`[RunPod Video] usando endpoint=${videoEndpointId} | engine=${payload.engine} | contract=${payload.contract_version}`)

  const job = await submitRunPodJob({
    endpointId: videoEndpointId,
    payload,
    label: 'RunPod Video Workflow',
    mediaType: 'video',
  })

  const jobId = job?.id || job?.jobId || null
  if (job?.output) {
    return normalizeRunPodMediaWithTelemetry({ statusPayload: job, endpointId: videoEndpointId, mediaType: 'video', providerJobId: jobId, normalizer: normalizeVideoOutput })
  }
  if (!jobId) throw new Error('RunPod não retornou id do job de vídeo.')

  const isV2v = payload.production_mode === 'v2v'
  const statusPayload = await waitForJobCompletion({
    endpointId: videoEndpointId,
    jobId,
    label: isV2v ? 'RunPod Wan V2V' : 'RunPod Wan I2V',
    mediaType: 'video',
    timeoutMs: isV2v
      ? Number(env.RUNPOD_VIDEO_V2V_TIMEOUT_MS || env.RUNPOD_VIDEO_TIMEOUT_MS || 3600000)
      : Number(env.RUNPOD_VIDEO_SHORT_TIMEOUT_MS || env.RUNPOD_VIDEO_TIMEOUT_MS || 1200000),
    pollIntervalMs: Number(env.RUNPOD_VIDEO_POLL_INTERVAL_MS || 5000),
    queueTimeoutMs: isV2v
      ? Number(env.RUNPOD_VIDEO_V2V_QUEUE_TIMEOUT_MS || env.RUNPOD_VIDEO_QUEUE_TIMEOUT_MS || 900000)
      : Number(env.RUNPOD_VIDEO_SHORT_QUEUE_TIMEOUT_MS || env.RUNPOD_VIDEO_QUEUE_TIMEOUT_MS || 300000),
  })

  return normalizeRunPodMediaWithTelemetry({ statusPayload, endpointId: videoEndpointId, mediaType: 'video', providerJobId: jobId, normalizer: normalizeVideoOutput })
}


// O compilador preserva reference_media e system_tag dentro de identity.actors;
// licensed_or_consented_assets_only permanece obrigatório no contrato versionado.
export function buildDirectedScenePayload({ productionMode = 'v2v', baseVideoUrl = '', castSlots = [], prompt = '', directionId = null, camera = {}, action = {}, generation = {}, workflow = {} }) {
  return compileVideoProductionSpec({
    requestId: directionId,
    productionMode,
    prompt,
    baseVideoUrl,
    castSlots,
    camera,
    action,
    generation,
    workflow,
    metadata: {
      directionId,
      source: 'scene_direction_studio',
    },
  })
}

async function generateDirectedSceneVideoWithRunPodCore(args = {}) {
  const videoEndpointId = getVideoEndpointId()
  if (!videoEndpointId) {
    throw new Error('RunPod de vídeo não configurado. Defina RUNPOD_VIDEO_ENDPOINT_ID.')
  }

  const payload = buildDirectedScenePayload(args)
  const job = await submitRunPodJob({
    endpointId: videoEndpointId,
    payload,
    label: 'RunPod Directed Scene',
    mediaType: 'video',
  })

  const jobId = job?.id || job?.jobId || null
  if (job?.output) {
    return normalizeRunPodMediaWithTelemetry({
      statusPayload: job,
      endpointId: videoEndpointId,
      mediaType: 'video',
      providerJobId: jobId,
      normalizer: normalizeVideoOutput,
    })
  }

  if (!jobId) {
    throw new Error('RunPod não retornou id para a Direção de Cena.')
  }

  const isV2v = String(args.productionMode || args.production_mode || 'v2v').toLowerCase() === 'v2v'
  const statusPayload = await waitForJobCompletion({
    endpointId: videoEndpointId,
    jobId,
    label: isV2v ? 'RunPod Directed Scene V2V' : 'RunPod Directed Scene I2V',
    mediaType: 'video',
    timeoutMs: isV2v
      ? Number(env.RUNPOD_VIDEO_V2V_TIMEOUT_MS || env.RUNPOD_VIDEO_TIMEOUT_MS || 3600000)
      : Number(env.RUNPOD_VIDEO_SHORT_TIMEOUT_MS || env.RUNPOD_VIDEO_TIMEOUT_MS || 1200000),
    pollIntervalMs: Number(env.RUNPOD_VIDEO_POLL_INTERVAL_MS || 5000),
    queueTimeoutMs: isV2v
      ? Number(env.RUNPOD_VIDEO_V2V_QUEUE_TIMEOUT_MS || env.RUNPOD_VIDEO_QUEUE_TIMEOUT_MS || 900000)
      : Number(env.RUNPOD_VIDEO_SHORT_QUEUE_TIMEOUT_MS || env.RUNPOD_VIDEO_QUEUE_TIMEOUT_MS || 300000),
  })

  return normalizeRunPodMediaWithTelemetry({
    statusPayload,
    endpointId: videoEndpointId,
    mediaType: 'video',
    providerJobId: jobId,
    normalizer: normalizeVideoOutput,
  })
}

export async function generateDirectedSceneVideoWithRunPod(args) {
  const endpointId = getVideoEndpointId()
  return withRunPodWorkerLease({
    productionName: 'factory-directed-scene-video-provider',
    mediaType: 'video',
    endpointId,
    runProduction: () => generateDirectedSceneVideoWithRunPodCore(args),
  })
}


// R12 worker/provider lease wrapper: imagem e vídeo reais passam por lease + cooldown obrigatório.
export async function generateImageWithRunPod(args) {
  const endpointId = getImageEndpointId()
  return withRunPodWorkerLease({
    productionName: 'factory-image-runpod-provider',
    mediaType: 'image',
    endpointId,
    runProduction: () => generateImageWithRunPodCore(args),
  })
}

export async function generateVideoWithRunPod(args) {
  const endpointId = getVideoEndpointId()
  return withRunPodWorkerLease({
    productionName: 'factory-video-runpod-provider',
    mediaType: 'video',
    endpointId,
    runProduction: () => generateVideoWithRunPodCore(args),
  })
}
