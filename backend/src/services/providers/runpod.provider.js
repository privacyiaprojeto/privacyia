import axios from 'axios'
import { Buffer } from 'node:buffer'
import { env } from '../../config/env.js'

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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMimeExtension(mimeType = 'audio/mpeg') {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('aac')) return 'aac'
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

  return 'audio/mpeg'
}

function parseDataUri(value) {
  const match = String(value || '').match(/^data:(.+?);base64,(.+)$/)

  if (!match) {
    return null
  }

  return {
    mimeType: match[1] || 'audio/mpeg',
    base64: match[2],
  }
}

function readFirstString(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) || ''
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

function cleanBase64(value) {
  const dataUri = parseDataUri(value)
  const raw = dataUri?.base64 || String(value || '')

  return raw.replace(/^base64,/, '').replace(/\s/g, '')
}

async function downloadAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
    headers: {
      Accept: 'audio/*,application/octet-stream,*/*',
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

async function normalizeAudioOutput(output) {
  const candidate = extractAudioCandidate(output)

  if (!candidate) {
    console.error('[RunPod Qwen3-TTS] output sem áudio reconhecível:', JSON.stringify(redactPayloadForLog(output), null, 2))
    throw new Error('RunPod não retornou áudio em base64 ou URL.')
  }

  if (/^https?:\/\//i.test(candidate)) {
    return downloadAudioBuffer(candidate)
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

async function submitJob(payload) {
  const audioEndpointId = getAudioEndpointId()

  if (!env.RUNPOD_API_KEY || !audioEndpointId) {
    throw new Error('RunPod de áudio Qwen3-TTS não configurado.')
  }

  try {
    console.log(`[RunPod Qwen3-TTS] usando endpoint=${audioEndpointId}`)
    console.log(
      `[RunPod Qwen3-TTS] payload | text=${String(payload.text || '').length} chars | profile=${payload.voice_profile_key || 'n/a'} | refUrl=${payload.url_audio_referencia ? 'ok' : 'missing'}`,
    )

    const response = await runpod.post(`/${audioEndpointId}/run`, {
      input: payload,
    })

    return response.data
  } catch (error) {
    const runpodError = buildRunPodError(error)

    console.error('[RunPod Qwen3-TTS] falha ao criar job de TTS.')
    console.error('[RunPod Qwen3-TTS] payload enviado:', JSON.stringify(redactPayloadForLog(payload), null, 2))
    console.error('[RunPod Qwen3-TTS] resposta do RunPod:', JSON.stringify(runpodError, null, 2))

    throw new Error(
      runpodError?.data?.error ||
        runpodError?.data?.message ||
        runpodError?.message ||
        'Erro ao criar job de áudio Qwen3-TTS no RunPod.',
    )
  }
}

async function getJobStatus(jobId) {
  const audioEndpointId = getAudioEndpointId()

  if (!env.RUNPOD_API_KEY || !audioEndpointId) {
    throw new Error('RunPod de áudio Qwen3-TTS não configurado.')
  }

  const response = await runpod.get(`/${audioEndpointId}/status/${jobId}`)
  return response.data
}

async function waitForJobCompletion(jobId) {
  const startedAt = Date.now()
  const timeoutMs = Math.max(Number(env.RUNPOD_AUDIO_TIMEOUT_MS || 0), 600000)
  const pollIntervalMs = Math.max(Number(env.RUNPOD_AUDIO_POLL_INTERVAL_MS || 0), 2500)
  let lastStatus = ''

  while (Date.now() - startedAt < timeoutMs) {
    const statusPayload = await getJobStatus(jobId)
    const status = String(statusPayload?.status || '').toUpperCase()

    if (status && status !== lastStatus) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
      console.log(`[RunPod Qwen3-TTS] job=${jobId} status=${status} elapsed=${elapsedSeconds}s`)
      lastStatus = status
    }

    if (status === 'COMPLETED') {
      return statusPayload
    }

    if (['FAILED', 'CANCELLED', 'CANCELED', 'TIMED_OUT'].includes(status)) {
      console.error('[RunPod Qwen3-TTS] job finalizado com erro:', JSON.stringify(statusPayload, null, 2))

      throw new Error(
        statusPayload?.error ||
          statusPayload?.message ||
          statusPayload?.output?.error ||
          `RunPod finalizou com status ${status}.`,
      )
    }

    await sleep(pollIntervalMs)
  }

  throw new Error(`Tempo limite excedido aguardando geração de áudio Qwen3-TTS no RunPod após ${Math.round(timeoutMs / 1000)}s.`)
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

    // Metadados úteis para log no worker.
    voice_profile_id: voiceProfile.id,
    voice_profile_key: voiceProfile.profileKey,
    companion_id: voiceProfile.companionId,

    // Se referenceText estiver vazio, o worker usa x_vector_only_mode.
    // Funciona, mas o ideal é cadastrar transcript do áudio de referência no Supabase.
    x_vector_only_mode: !referenceText,

    // Parâmetros conservadores para chat: boa estabilidade e latência aceitável.
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

  const job = await submitJob(payload)

  if (job?.output) {
    return normalizeAudioOutput(job.output)
  }

  const jobId = job?.id || job?.jobId

  if (!jobId) {
    console.error('[RunPod Qwen3-TTS] resposta sem ID de job:', JSON.stringify(job, null, 2))
    throw new Error('RunPod não retornou ID do job de áudio.')
  }

  console.log(`[RunPod Qwen3-TTS] job=${jobId} enviado | perfil=${voiceProfile.profileKey}`)

  const completedJob = await waitForJobCompletion(jobId)
  return normalizeAudioOutput(completedJob.output)
}
