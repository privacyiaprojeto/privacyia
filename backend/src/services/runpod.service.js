import axios from 'axios'
import { Buffer } from 'node:buffer'
import { env } from '../config/env.js'

const runpod = axios.create({
  baseURL: env.RUNPOD_BASE_URL,
  headers: {
    Authorization: env.RUNPOD_API_KEY ? `Bearer ${env.RUNPOD_API_KEY}` : undefined,
    'Content-Type': 'application/json',
  },
})

/**
 * Cache simples em memória para evitar baixar o mesmo áudio de referência
 * do Cloudflare R2 a cada geração de mensagem da mesma atriz.
 *
 * Chave: URL pública do áudio de referência.
 * Valor: { base64, dataUri, mimeType, extension }
 */
const referenceAudioBase64Cache = new Map()

/**
 * Evita downloads simultâneos duplicados da mesma URL.
 * Se duas mensagens da mesma atriz pedirem áudio ao mesmo tempo,
 * a segunda aguarda a primeira conversão terminar.
 */
const referenceAudioDownloadLocks = new Map()

const MAX_REFERENCE_AUDIO_CACHE_ITEMS = 50

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getMimeExtension(mimeType = 'audio/mpeg') {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('x-m4a')) return 'm4a'
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

function buildDataUri({ mimeType, base64 }) {
  return `data:${mimeType || 'audio/mpeg'};base64,${base64}`
}

function isHttpUrl(value) {
  return /^https?:\/\/.+/i.test(String(value || '').trim())
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
      output.wav,
      output.wav_base64,
      output.wavBase64,
      output.output_url,
      output.outputUrl,
    )

    if (direct) return direct

    return extractAudioCandidate(
      output.output ||
        output.result ||
        output.data ||
        output.file ||
        output.audio ||
        output.audio_file ||
        output.audioFile,
    )
  }

  return null
}

function buildRunPodError(error) {
  const status = error?.response?.status
  const data = error?.response?.data
  const message = error?.message || 'Erro desconhecido ao chamar RunPod.'

  return {
    status,
    data,
    message,
  }
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

function pruneReferenceAudioCache() {
  while (referenceAudioBase64Cache.size > MAX_REFERENCE_AUDIO_CACHE_ITEMS) {
    const oldestKey = referenceAudioBase64Cache.keys().next().value
    referenceAudioBase64Cache.delete(oldestKey)
  }
}

async function downloadAudioBuffer(url) {
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 120000,
    maxContentLength: 30 * 1024 * 1024,
    maxBodyLength: 30 * 1024 * 1024,
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
    console.error('[RunPod áudio] output sem áudio reconhecível:', JSON.stringify(redactPayloadForLog(output), null, 2))
    throw new Error('RunPod não retornou áudio em base64 ou URL.')
  }

  if (/^https?:\/\//i.test(candidate)) {
    return downloadAudioBuffer(candidate)
  }

  const dataUri = parseDataUri(candidate)
  const mimeType = dataUri?.mimeType || output?.mime_type || output?.mimeType || 'audio/mpeg'
  const base64 = dataUri?.base64 || candidate
  const cleanBase64 = base64.replace(/^base64,/, '').replace(/\s/g, '')

  return {
    buffer: Buffer.from(cleanBase64, 'base64'),
    mimeType,
    extension: getMimeExtension(mimeType),
  }
}

async function convertReferenceAudioToBase64(referenceAudioValue) {
  const cleanReference = String(referenceAudioValue || '').trim()

  if (!cleanReference) {
    throw new Error('Áudio de referência da atriz não configurado em companions.runpod_voice_id.')
  }

  const dataUri = parseDataUri(cleanReference)

  if (dataUri) {
    const base64 = dataUri.base64.replace(/\s/g, '')
    const mimeType = dataUri.mimeType || 'audio/mpeg'

    return {
      base64,
      dataUri: buildDataUri({ mimeType, base64 }),
      mimeType,
      extension: getMimeExtension(mimeType),
      source: 'data-uri',
    }
  }

  /**
   * Segurança extra:
   * Se futuramente o banco guardar o Base64 puro em vez da URL,
   * o serviço ainda funciona sem precisar baixar nada.
   */
  if (!isHttpUrl(cleanReference)) {
    const base64 = cleanReference.replace(/^base64,/, '').replace(/\s/g, '')
    const mimeType = 'audio/mpeg'

    return {
      base64,
      dataUri: buildDataUri({ mimeType, base64 }),
      mimeType,
      extension: getMimeExtension(mimeType),
      source: 'raw-base64',
    }
  }

  if (referenceAudioBase64Cache.has(cleanReference)) {
    return referenceAudioBase64Cache.get(cleanReference)
  }

  if (referenceAudioDownloadLocks.has(cleanReference)) {
    return referenceAudioDownloadLocks.get(cleanReference)
  }

  const downloadPromise = (async () => {
    console.log('[RunPod áudio] baixando áudio de referência da atriz e convertendo para Base64.')

    const downloadedAudio = await downloadAudioBuffer(cleanReference)
    const base64 = downloadedAudio.buffer.toString('base64')
    const mimeType = downloadedAudio.mimeType || guessMimeTypeFromUrl(cleanReference)
    const result = {
      base64,
      dataUri: buildDataUri({ mimeType, base64 }),
      mimeType,
      extension: downloadedAudio.extension || getMimeExtension(mimeType),
      source: 'url-download',
    }

    referenceAudioBase64Cache.set(cleanReference, result)
    pruneReferenceAudioCache()

    console.log(
      `[RunPod áudio] áudio de referência cacheado | mime=${result.mimeType} | base64=${result.base64.length} chars`,
    )

    return result
  })()

  referenceAudioDownloadLocks.set(cleanReference, downloadPromise)

  try {
    return await downloadPromise
  } catch (error) {
    console.error('[RunPod áudio] falha ao baixar/converter áudio de referência:', {
      referenceAudioUrl: cleanReference,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    })

    throw new Error('Falha ao baixar ou converter o áudio de referência da atriz para Base64.')
  } finally {
    referenceAudioDownloadLocks.delete(cleanReference)
  }
}

export async function submitImageJob(payload) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_IMAGE_ENDPOINT_ID) {
    throw new Error('RunPod de imagem não configurado.')
  }

  const response = await runpod.post(`/${env.RUNPOD_IMAGE_ENDPOINT_ID}/run`, {
    input: payload,
  })

  return response.data
}

export async function submitAudioJob(payload) {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_AUDIO_ENDPOINT_ID) {
    throw new Error('RunPod de áudio não configurado.')
  }

  try {
    const response = await runpod.post(`/${env.RUNPOD_AUDIO_ENDPOINT_ID}/run`, {
      input: payload,
    })

    return response.data
  } catch (error) {
    const runpodError = buildRunPodError(error)

    console.error('[RunPod áudio] falha ao criar job de TTS.')
    console.error('[RunPod áudio] payload enviado:', JSON.stringify(redactPayloadForLog(payload), null, 2))
    console.error('[RunPod áudio] resposta do RunPod:', JSON.stringify(runpodError, null, 2))

    throw new Error(
      runpodError?.data?.error ||
        runpodError?.data?.message ||
        runpodError?.message ||
        'Erro ao criar job de áudio no RunPod.',
    )
  }
}

export async function getJobStatus(endpointId, jobId) {
  if (!env.RUNPOD_API_KEY || !endpointId) {
    throw new Error('RunPod não configurado.')
  }

  const response = await runpod.get(`/${endpointId}/status/${jobId}`)
  return response.data
}

export async function waitForJobCompletion({ endpointId, jobId }) {
  const startedAt = Date.now()
  const timeoutMs = Math.max(Number(env.RUNPOD_AUDIO_TIMEOUT_MS || 0), 300000)
  const pollIntervalMs = Math.max(Number(env.RUNPOD_AUDIO_POLL_INTERVAL_MS || 0), 3000)
  let lastStatus = ''

  while (Date.now() - startedAt < timeoutMs) {
    const statusPayload = await getJobStatus(endpointId, jobId)
    const status = String(statusPayload?.status || '').toUpperCase()

    if (status && status !== lastStatus) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
      console.log(`[RunPod áudio] job=${jobId} status=${status} elapsed=${elapsedSeconds}s`)
      lastStatus = status
    }

    if (status === 'COMPLETED') {
      return statusPayload
    }

    if (['FAILED', 'CANCELLED', 'CANCELED', 'TIMED_OUT'].includes(status)) {
      console.error('[RunPod áudio] job finalizado com erro:', JSON.stringify(statusPayload, null, 2))

      throw new Error(
        statusPayload?.error ||
          statusPayload?.message ||
          statusPayload?.output?.error ||
          `RunPod finalizou com status ${status}.`,
      )
    }

    await sleep(pollIntervalMs)
  }

  throw new Error(`Tempo limite excedido aguardando geração de áudio no RunPod após ${Math.round(timeoutMs / 1000)}s.`)
}

async function buildChatterboxTtsPayload({ text, voiceId }) {
  const cleanText = String(text || '').trim()

  /**
   * companions.runpod_voice_id agora é a URL pública direta do MP3 no R2.
   * O Worker Chatterbox/XTTS não baixa URL externa sozinho.
   * Por isso baixamos aqui no backend, convertemos para Base64 e cacheamos em memória.
   */
  const referenceAudio = await convertReferenceAudioToBase64(voiceId)

  /**
   * Payload Chatterbox / XTTS v2.
   *
   * IMPORTANTE:
   * - O idioma fica fixo como 'pt'.
   * - Os campos principais recebem Base64 puro, pois o worker informou
   *   que não consegue baixar URL diretamente.
   * - Também enviamos variações com data URI para cobrir templates que exigem
   *   o prefixo data:audio/mp3;base64,...
   *
   * Se o template reclamar de campo inesperado, o console.error em submitAudioJob
   * vai mostrar o payload com Base64 redigido e a resposta completa do RunPod.
   */
  return {
    text: cleanText,
    language: 'pt',

    // Campos principais em Base64 puro.
    speaker_wav: referenceAudio.base64,
    voice_file: referenceAudio.base64,
    reference_audio: referenceAudio.base64,

    // Aliases comuns em handlers XTTS/Chatterbox.
    speaker_wav_base64: referenceAudio.base64,
    voice_file_base64: referenceAudio.base64,
    reference_audio_base64: referenceAudio.base64,

    // Alguns templates preferem data URI em vez de Base64 puro.
    speaker_wav_data_uri: referenceAudio.dataUri,
    voice_file_data_uri: referenceAudio.dataUri,
    reference_audio_data_uri: referenceAudio.dataUri,

    // Metadados úteis para o handler, caso ele valide mime/extension.
    reference_audio_mime_type: referenceAudio.mimeType,
    reference_audio_extension: referenceAudio.extension,
  }
}

export async function generateAudioFromText({ text, voiceId }) {
  const cleanText = String(text || '').trim()
  const referenceAudioValue = String(voiceId || '').trim()

  if (!cleanText) {
    throw new Error('Texto da mensagem vazio para geração de áudio.')
  }

  if (!referenceAudioValue) {
    throw new Error('Áudio de referência da atriz não configurado em companions.runpod_voice_id.')
  }

  const chatterboxPayload = await buildChatterboxTtsPayload({
    text: cleanText,
    voiceId: referenceAudioValue,
  })

  const job = await submitAudioJob(chatterboxPayload)

  if (job?.output) {
    return normalizeAudioOutput(job.output)
  }

  const jobId = job?.id || job?.jobId

  if (!jobId) {
    console.error('[RunPod áudio] resposta sem ID de job:', JSON.stringify(job, null, 2))
    throw new Error('RunPod não retornou ID do job de áudio.')
  }

  console.log(`[RunPod áudio] job=${jobId} enviado para geração Chatterbox/XTTS com referência Base64`)

  const completedJob = await waitForJobCompletion({
    endpointId: env.RUNPOD_AUDIO_ENDPOINT_ID,
    jobId,
  })

  return normalizeAudioOutput(completedJob.output)
}