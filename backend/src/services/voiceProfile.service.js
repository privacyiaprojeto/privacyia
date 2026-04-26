import axios from 'axios'
import { Buffer } from 'node:buffer'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

const referenceAudioCache = new Map()
const referenceAudioDownloadLocks = new Map()
const MAX_REFERENCE_AUDIO_CACHE_ITEMS = 50

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
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

function getMimeExtension(mimeType = 'audio/mpeg') {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('aac')) return 'aac'
  return 'mp3'
}

function buildDataUri({ mimeType, base64 }) {
  return `data:${mimeType || 'audio/mpeg'};base64,${base64}`
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

function pruneReferenceAudioCache() {
  while (referenceAudioCache.size > MAX_REFERENCE_AUDIO_CACHE_ITEMS) {
    const oldestKey = referenceAudioCache.keys().next().value
    referenceAudioCache.delete(oldestKey)
  }
}

function mapVoiceProfile(row) {
  return {
    id: row.id,
    companionId: row.companion_id,
    profileKey: row.profile_key,
    label: row.label,
    emotion: row.emotion || row.profile_key || 'neutral',
    language: row.language || env.TTS_DEFAULT_LANGUAGE || 'pt',
    referenceAudioUrl: row.reference_audio_url,
    referenceText: row.reference_text || '',
    provider: row.provider || 'runpod_fish_speech',
    model: row.model || 'fish-speech',
    isDefault: row.is_default === true,
  }
}

function getVoiceProfileFallbackKeys(preferredKey) {
  const fallbackMap = {
    soft_night: ['soft_night', 'caring', 'soft', 'whisper', 'neutral'],
    caring: ['caring', 'soft', 'soft_night', 'neutral'],
    whisper: ['whisper', 'soft_night', 'soft', 'neutral'],
    playful: ['playful', 'caring', 'neutral'],
    sad: ['sad', 'soft', 'caring', 'neutral'],
    serious: ['serious', 'neutral'],
    soft: ['soft', 'caring', 'neutral'],
    neutral: ['neutral'],
  }

  return [...new Set(fallbackMap[preferredKey] || [preferredKey, 'neutral'])].filter(Boolean)
}

export function detectVoiceProfileKey({ text, currentMood }) {
  const source = `${normalizeText(currentMood)} ${normalizeText(text)}`.toLowerCase()

  if (/\b(sussurr|voz baixa|baixinho|segredo|ao ouvido|whisper)\b/.test(source)) {
    return 'whisper'
  }

  // Perfil noturno/carinhoso: ideal para boa noite, acolhimento, pausas e voz mais calma.
  if (/\b(boa noite|durma bem|dormir bem|sono|cansad|cansativo|sil[eê]ncio|pertinho|lua|noite|estou aqui|ouvindo)\b/.test(source)) {
    return 'soft_night'
  }

  if (/\b(meu amor|te amo|carinh|fof|doce|calma|calmo|gentil|tranquil|acolh|cuidar|cuidado)\b/.test(source)) {
    return 'caring'
  }

  if (/\b(rindo|risada|gargalhada|kkkk|haha|divertid|brincalh|playful|provocador|provocadora)\b/.test(source)) {
    return 'playful'
  }

  if (/\b(triste|choro|chorando|saudade|emocionad|melancol|sad)\b/.test(source)) {
    return 'sad'
  }

  if (/\b(brav|irritad|ciument|séria|seria|sério|serio|angry|serious)\b/.test(source)) {
    return 'serious'
  }

  if (/\b(soft|suave|delicad)\b/.test(source)) {
    return 'soft'
  }

  return 'neutral'
}

async function findVoiceProfileByKey({ companionId, preferredKey }) {
  const keys = getVoiceProfileFallbackKeys(preferredKey)

  const { data, error } = await supabaseAdmin
    .from('companion_voice_profiles')
    .select(`
      id,
      companion_id,
      profile_key,
      label,
      emotion,
      language,
      reference_audio_url,
      reference_text,
      provider,
      model,
      is_default,
      sort_order
    `)
    .eq('companion_id', companionId)
    .eq('is_active', true)
    .in('profile_key', keys)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao buscar perfis de voz da atriz.', error)
  }

  const rows = data || []

  return keys.map((key) => rows.find((row) => row.profile_key === key)).find(Boolean) || null
}

async function findDefaultVoiceProfile({ companionId }) {
  const { data, error } = await supabaseAdmin
    .from('companion_voice_profiles')
    .select(`
      id,
      companion_id,
      profile_key,
      label,
      emotion,
      language,
      reference_audio_url,
      reference_text,
      provider,
      model,
      is_default,
      sort_order
    `)
    .eq('companion_id', companionId)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('sort_order', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar perfil de voz padrão da atriz.', error)
  }

  return data || null
}

async function findLegacyRunpodVoice({ companionId }) {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, runpod_voice_id')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar voz legada da atriz.', error)
  }

  if (!data?.runpod_voice_id) {
    return null
  }

  return {
    id: null,
    companion_id: data.id,
    profile_key: 'neutral',
    label: 'Neutral legado',
    emotion: 'neutral',
    language: env.TTS_DEFAULT_LANGUAGE || 'pt',
    reference_audio_url: data.runpod_voice_id,
    reference_text: '',
    provider: 'runpod_fish_speech',
    model: 'fish-speech',
    is_default: true,
  }
}

export async function selectVoiceProfile({ companionId, text, currentMood }) {
  const preferredKey = detectVoiceProfileKey({ text, currentMood })

  const profileRow =
    (await findVoiceProfileByKey({ companionId, preferredKey })) ||
    (await findDefaultVoiceProfile({ companionId })) ||
    (await findLegacyRunpodVoice({ companionId }))

  if (!profileRow) {
    throw new ApiError(400, 'Nenhum perfil de voz ativo foi configurado para esta atriz.')
  }

  return mapVoiceProfile(profileRow)
}

async function downloadReferenceAudio(url) {
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

  const buffer = Buffer.from(response.data)
  const base64 = buffer.toString('base64')

  return {
    base64,
    dataUri: buildDataUri({ mimeType, base64 }),
    mimeType,
    extension: getMimeExtension(mimeType),
    sizeBytes: buffer.length,
  }
}

export async function getReferenceAudioBase64(referenceAudioUrl) {
  const cleanReference = String(referenceAudioUrl || '').trim()

  if (!cleanReference) {
    throw new ApiError(400, 'URL do áudio de referência não informada.')
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
      sizeBytes: Buffer.byteLength(base64, 'base64'),
      source: 'data-uri',
    }
  }

  if (!/^https?:\/\//i.test(cleanReference)) {
    const base64 = cleanReference.replace(/^base64,/, '').replace(/\s/g, '')
    const mimeType = 'audio/mpeg'

    return {
      base64,
      dataUri: buildDataUri({ mimeType, base64 }),
      mimeType,
      extension: getMimeExtension(mimeType),
      sizeBytes: Buffer.byteLength(base64, 'base64'),
      source: 'raw-base64',
    }
  }

  if (referenceAudioCache.has(cleanReference)) {
    return referenceAudioCache.get(cleanReference)
  }

  if (referenceAudioDownloadLocks.has(cleanReference)) {
    return referenceAudioDownloadLocks.get(cleanReference)
  }

  const downloadPromise = (async () => {
    console.log('[TTS VoiceProfile] baixando referência R2 e convertendo para Base64.')

    const referenceAudio = await downloadReferenceAudio(cleanReference)

    referenceAudioCache.set(cleanReference, {
      ...referenceAudio,
      source: 'url-download',
    })
    pruneReferenceAudioCache()

    console.log(
      `[TTS VoiceProfile] referência cacheada | mime=${referenceAudio.mimeType} | bytes=${referenceAudio.sizeBytes}`,
    )

    return referenceAudioCache.get(cleanReference)
  })()

  referenceAudioDownloadLocks.set(cleanReference, downloadPromise)

  try {
    return await downloadPromise
  } catch (error) {
    console.error('[TTS VoiceProfile] erro ao baixar/converter referência:', {
      referenceAudioUrl: cleanReference,
      status: error?.response?.status,
      message: error?.message,
    })

    throw new ApiError(502, 'Falha ao baixar ou converter o áudio de referência da atriz.')
  } finally {
    referenceAudioDownloadLocks.delete(cleanReference)
  }
}
