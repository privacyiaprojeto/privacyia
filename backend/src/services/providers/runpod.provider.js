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

async function submitRunPodJob({ endpointId, payload, label }) {
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

    console.error(`[${label}] falha ao criar job.`)
    console.error(`[${label}] payload enviado:`, JSON.stringify(redactPayloadForLog(payload), null, 2))
    console.error(`[${label}] resposta do RunPod:`, JSON.stringify(runpodError, null, 2))

    throw new Error(
      runpodError?.data?.error ||
        runpodError?.data?.message ||
        runpodError?.message ||
        `Erro ao criar job em ${label}.`,
    )
  }
}

async function getJobStatus({ endpointId, jobId, label }) {
  if (!env.RUNPOD_API_KEY || !endpointId) {
    throw new Error(`${label} não configurado no RunPod.`)
  }

  const response = await runpod.get(`/${endpointId}/status/${jobId}`)
  return response.data
}

async function waitForJobCompletion({ endpointId, jobId, label, timeoutMs, pollIntervalMs }) {
  const startedAt = Date.now()
  const finalTimeoutMs = Math.max(Number(timeoutMs || 0), 120000)
  const finalPollIntervalMs = Math.max(Number(pollIntervalMs || 0), 2500)
  let lastStatus = ''

  while (Date.now() - startedAt < finalTimeoutMs) {
    const statusPayload = await getJobStatus({ endpointId, jobId, label })
    const status = String(statusPayload?.status || '').toUpperCase()

    if (status && status !== lastStatus) {
      const elapsedSeconds = Math.round((Date.now() - startedAt) / 1000)
      console.log(`[${label}] job=${jobId} status=${status} elapsed=${elapsedSeconds}s`)
      lastStatus = status
    }

    if (status === 'COMPLETED') {
      return statusPayload
    }

    if (['FAILED', 'CANCELLED', 'CANCELED', 'TIMED_OUT'].includes(status)) {
      console.error(`[${label}] job finalizado com erro:`, JSON.stringify(statusPayload, null, 2))

      throw new Error(
        statusPayload?.error ||
          statusPayload?.message ||
          statusPayload?.output?.error ||
          `RunPod finalizou com status ${status}.`,
      )
    }

    await sleep(finalPollIntervalMs)
  }

  throw new Error(`Tempo limite excedido aguardando ${label} no RunPod após ${Math.round(finalTimeoutMs / 1000)}s.`)
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
  })

  if (job?.output) {
    return normalizeAudioOutput(job.output)
  }

  const jobId = job?.id || job?.jobId

  if (!jobId) {
    console.error('[RunPod Qwen3-TTS] resposta sem job id:', JSON.stringify(job, null, 2))
    throw new Error('RunPod não retornou id do job de áudio.')
  }

  console.log(`[RunPod Qwen3-TTS] job=${jobId} enviado | perfil=${voiceProfile.profileKey}`)

  const statusPayload = await waitForJobCompletion({
    endpointId: audioEndpointId,
    jobId,
    label: 'RunPod Qwen3-TTS',
    timeoutMs: Math.max(Number(env.RUNPOD_AUDIO_TIMEOUT_MS || 0), 600000),
    pollIntervalMs: Math.max(Number(env.RUNPOD_AUDIO_POLL_INTERVAL_MS || 0), 2500),
  })

  return normalizeAudioOutput(statusPayload.output)
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
    'non-explicit',
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
  const width = Number(promptPayload?.width || config?.width || 1024)
  const height = Number(promptPayload?.height || config?.height || 1024)
  const steps = Number(
    promptPayload?.steps ||
      promptPayload?.num_inference_steps ||
      config?.steps ||
      config?.num_inference_steps ||
      25,
  )

  return {
    prompt,
    negative_prompt: negativePrompt,
    width,
    height,
    steps,
    num_inference_steps: steps,
    guidance_scale: Number(promptPayload?.guidance_scale || config?.guidance_scale || 6.5),
    seed: promptPayload?.seed ?? config?.seed ?? null,
    companion: {
      id: companion?.id,
      slug: companion?.slug,
      name: companion?.name,
      age: companion?.age,
      bio: companion?.bio,
      avatar_url: companion?.avatar_url,
      banner_url: companion?.banner_url,
      thumbnail_url: companion?.thumbnail_url,
    },
    options,
    prompt_payload: promptPayload,
    output_format: 'png',
    safety_mode: 'adult_platform_consented_model',
  }
}

export async function generateImageWithRunPod({ companion, options, promptPayload }) {
  const imageEndpointId = getImageEndpointId()

  if (!imageEndpointId) {
    throw new Error('RunPod de imagem não configurado. Defina RUNPOD_IMAGE_ENDPOINT_ID antes de gerar imagens reais.')
  }

  const payload = buildImageRunPodPayload({ companion, options, promptPayload })

  console.log(`[RunPod Image] usando endpoint=${imageEndpointId}`)
  console.log(
    `[RunPod Image] payload | companion=${companion?.slug || companion?.id || 'n/a'} | options=${Object.keys(options || {}).length} | prompt=${String(payload.prompt || '').length} chars`,
  )

  const job = await submitRunPodJob({
    endpointId: imageEndpointId,
    payload,
    label: 'RunPod Image',
  })

  if (job?.output) {
    return normalizeImageOutput(job.output)
  }

  const jobId = job?.id || job?.jobId

  if (!jobId) {
    console.error('[RunPod Image] resposta sem job id:', JSON.stringify(job, null, 2))
    throw new Error('RunPod não retornou id do job de imagem.')
  }

  console.log(`[RunPod Image] job=${jobId} enviado | companion=${companion?.slug || companion?.id || 'n/a'}`)

  const statusPayload = await waitForJobCompletion({
    endpointId: imageEndpointId,
    jobId,
    label: 'RunPod Image',
    timeoutMs: 600000,
    pollIntervalMs: 3000,
  })

  const image = await normalizeImageOutput(statusPayload.output)

  return {
    ...image,
    runpodJobId: jobId,
  }
}


function buildVideoFaceSwapPayload({ companion, baseVideoUrl, promptPayload = {} }) {
  const sourceImageUrl = String(
    promptPayload?.sourceImageUrl ||
      promptPayload?.source_image_url ||
      promptPayload?.referenceImageUrl ||
      promptPayload?.reference_image_url ||
      companion?.avatar_url ||
      companion?.thumbnail_url ||
      companion?.banner_url ||
      '',
  ).trim()

  const targetVideoUrl = String(
    promptPayload?.baseVideoUrl ||
      promptPayload?.base_video_url ||
      promptPayload?.targetVideoUrl ||
      promptPayload?.target_video_url ||
      baseVideoUrl ||
      env.FACESWAP_BASE_VIDEO_URL ||
      '',
  ).trim()

  if (!sourceImageUrl) {
    throw new Error('Imagem de referência da atriz não encontrada para FaceSwap.')
  }

  if (!targetVideoUrl) {
    throw new Error('Vídeo base não configurado para FaceSwap.')
  }

  return {
    source_image_url: sourceImageUrl,
    reference_image_url: sourceImageUrl,
    face_image_url: sourceImageUrl,

    target_video_url: targetVideoUrl,
    input_video_url: targetVideoUrl,
    video_url: targetVideoUrl,

    output_format: 'mp4',
    mode: 'faceswap_zero_shot',

    companion: {
      id: companion?.id,
      slug: companion?.slug,
      name: companion?.name,
      avatar_url: companion?.avatar_url,
      thumbnail_url: companion?.thumbnail_url,
      banner_url: companion?.banner_url,
    },

    prompt_payload: promptPayload,
    safety_mode: 'licensed_or_consented_assets_only',
  }
}

export async function generateVideoWithRunPod({ companion, baseVideoUrl, promptPayload }) {
  const videoEndpointId = getVideoEndpointId()

  if (!videoEndpointId) {
    throw new Error('RunPod de vídeo não configurado. Defina RUNPOD_VIDEO_ENDPOINT_ID antes de gerar vídeos reais.')
  }

  const payload = buildVideoFaceSwapPayload({
    companion,
    baseVideoUrl,
    promptPayload,
  })

  console.log(`[RunPod Video] usando endpoint=${videoEndpointId}`)
  console.log(
    `[RunPod Video] payload | companion=${companion?.slug || companion?.id || 'n/a'} | source=${payload.source_image_url ? 'ok' : 'missing'} | video=${payload.target_video_url ? 'ok' : 'missing'}`,
  )

  const job = await submitRunPodJob({
    endpointId: videoEndpointId,
    payload,
    label: 'RunPod Video',
  })

  if (job?.output) {
    const directVideo = await normalizeVideoOutput(job.output)

    return {
      ...directVideo,
      runpodJobId: job?.id || job?.jobId || null,
    }
  }

  const jobId = job?.id || job?.jobId

  if (!jobId) {
    console.error('[RunPod Video] resposta sem job id:', JSON.stringify(job, null, 2))
    throw new Error('RunPod não retornou id do job de vídeo.')
  }

  console.log(`[RunPod Video] job=${jobId} enviado | companion=${companion?.slug || companion?.id || 'n/a'}`)

  const statusPayload = await waitForJobCompletion({
    endpointId: videoEndpointId,
    jobId,
    label: 'RunPod Video',
    timeoutMs: Number(env.RUNPOD_VIDEO_TIMEOUT_MS || 900000),
    pollIntervalMs: Number(env.RUNPOD_VIDEO_POLL_INTERVAL_MS || 5000),
  })

  const video = await normalizeVideoOutput(statusPayload.output)

  return {
    ...video,
    runpodJobId: jobId,
  }
}

