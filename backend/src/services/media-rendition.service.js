import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtemp,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'
import { addRenditionJob } from '../queues/rendition.queue.js'
import { ApiError } from '../utils/apiError.js'
import {
  registerMediaRendition,
} from './media-asset-master.service.js'
import {
  deleteObject,
  downloadPrivateObjectToFile,
  uploadPrivateFileToR2,
} from './storage.service.js'

const MASTERS_TABLE = 'media_assets'
const RENDITIONS_TABLE = 'media_asset_renditions'
const P3_SUPPORTED_TYPES = new Set(['preview', 'hls_stream'])
const PASSTHROUGH_PREVIEW_MEDIA_TYPES = new Set(['image', 'imagem', 'audio', 'live_audio'])

function nowIso() {
  return new Date().toISOString()
}

function cleanText(value) {
  return String(value || '').trim()
}

function normalizeRenditionType(value) {
  const type = cleanText(value).toLowerCase()

  if (!P3_SUPPORTED_TYPES.has(type)) {
    throw new ApiError(422, 'P3 suporta apenas renditions preview e hls_stream.', {
      renditionType: type || null,
    })
  }

  return type
}

function sanitizePathSegment(value, fallback = 'unknown') {
  const normalized = cleanText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()

  return normalized || fallback
}

function extensionFromMaster(master) {
  const keyExtension = path.extname(cleanText(master?.master_r2_key)).toLowerCase()
  if (['.mp4', '.mov', '.webm', '.mkv'].includes(keyExtension)) return keyExtension

  const contentType = cleanText(master?.content_type).toLowerCase()
  if (contentType.includes('quicktime')) return '.mov'
  if (contentType.includes('webm')) return '.webm'
  if (contentType.includes('matroska')) return '.mkv'
  return '.mp4'
}

function buildRenditionTarget({ masterAssetId, renditionId, renditionType }) {
  const master = sanitizePathSegment(masterAssetId, 'master')
  const rendition = sanitizePathSegment(renditionId, 'rendition')

  if (renditionType === 'preview') {
    return {
      key: path.posix.join('private', 'renditions', master, 'preview', rendition, 'preview.mp4'),
      contentType: 'video/mp4',
    }
  }

  return {
    key: path.posix.join('private', 'renditions', master, 'hls', rendition, 'index.m3u8'),
    contentType: 'application/vnd.apple.mpegurl',
  }
}

function assertVideoMaster(master) {
  if (!master) throw new ApiError(404, 'Master Limpo não encontrado para gerar rendition.')

  if (['rejected', 'failed', 'archived'].includes(cleanText(master.status).toLowerCase())) {
    throw new ApiError(409, 'Master Limpo não está elegível para gerar rendition.', {
      masterAssetId: master.id,
      status: master.status,
    })
  }

  if (!cleanText(master.master_r2_bucket) || !cleanText(master.master_r2_key)) {
    throw new ApiError(409, 'Master Limpo não possui ponteiro privado completo no R2.', {
      masterAssetId: master.id,
    })
  }

  const mediaType = cleanText(master.media_type).toLowerCase()
  const contentType = cleanText(master.content_type).toLowerCase()
  const key = cleanText(master.master_r2_key).toLowerCase()
  const videoLike = mediaType.includes('video') || contentType.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/.test(key)

  if (!videoLike) {
    throw new ApiError(422, 'P3 aceita apenas Master Limpo de vídeo.', {
      masterAssetId: master.id,
      mediaType: master.media_type || null,
      contentType: master.content_type || null,
    })
  }
}

async function getMasterAsset(masterAssetId, { requireVideo = false } = {}) {
  const { data, error } = await supabaseAdmin
    .from(MASTERS_TABLE)
    .select('*')
    .eq('id', masterAssetId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Falha ao consultar Master Limpo para rendition.', error)
  if (!data) throw new ApiError(404, 'Master Limpo não encontrado para gerar rendition.')
  if (requireVideo) assertVideoMaster(data)
  return data
}

function classifyMaster(master) {
  const mediaType = cleanText(master?.media_type).toLowerCase()
  const contentType = cleanText(master?.content_type).toLowerCase()
  const key = cleanText(master?.master_r2_key).toLowerCase()
  const video = mediaType.includes('video') || contentType.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/.test(key)
  if (video) return 'video'
  if (mediaType.includes('image') || mediaType === 'imagem' || contentType.startsWith('image/')) return 'image'
  if (mediaType.includes('audio') || contentType.startsWith('audio/')) return 'audio'
  return mediaType || 'unknown'
}

function renditionQueueAllowed() {
  return Boolean(env.WORKERS_ENABLED && env.RENDITION_QUEUE_ENABLED)
}

async function registerPassthroughPreview(master, { requestedByProfileId = null } = {}) {
  const existing = await findReusableRendition({ masterAssetId: master.id, renditionType: 'preview', deliveryId: null })
  if (existing) return { rendition: existing, reused: true, enqueued: false, passthrough: true }

  const rendition = await registerMediaRendition({
    masterAssetId: master.id,
    renditionType: 'preview',
    bucket: master.master_r2_bucket,
    key: master.master_r2_key,
    status: 'available',
    metadata: {
      p3: true,
      passthroughPreview: true,
      requestedByProfileId,
      sourceContentType: master.content_type || null,
      requestedAt: nowIso(),
    },
  })

  return { rendition, reused: false, enqueued: false, passthrough: true }
}

async function getRendition(renditionId) {
  const { data, error } = await supabaseAdmin
    .from(RENDITIONS_TABLE)
    .select('*')
    .eq('id', renditionId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Falha ao consultar registro de rendition.', error)
  if (!data) throw new ApiError(404, 'Rendition não encontrada.')
  return data
}

async function updateRendition(rendition, patch = {}) {
  const payload = {
    ...patch,
    metadata: {
      ...(rendition.metadata || {}),
      ...(patch.metadata || {}),
    },
    updated_at: nowIso(),
  }

  const { data, error } = await supabaseAdmin
    .from(RENDITIONS_TABLE)
    .update(payload)
    .eq('id', rendition.id)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Falha ao atualizar estado da rendition.', error)
  return data
}

async function findReusableRendition({ masterAssetId, renditionType, deliveryId }) {
  let query = supabaseAdmin
    .from(RENDITIONS_TABLE)
    .select('*')
    .eq('master_asset_id', masterAssetId)
    .eq('rendition_type', renditionType)
    .in('status', ['queued', 'processing', 'available'])
    .order('created_at', { ascending: false })
    .limit(1)

  query = deliveryId ? query.eq('delivery_id', deliveryId) : query.is('delivery_id', null)

  const { data, error } = await query.maybeSingle()
  if (error) throw new ApiError(500, 'Falha ao procurar rendition reutilizável.', error)
  return data || null
}

function buildQueuedRenditionKey({ masterAssetId, renditionType, deliveryId }) {
  const seed = `${masterAssetId}:${renditionType}:${deliveryId || 'shared'}`
  const suffix = createHash('sha256').update(seed).digest('hex').slice(0, 20)
  return buildRenditionTarget({
    masterAssetId,
    renditionType,
    renditionId: suffix,
  })
}

export async function requestMediaRendition({
  masterAssetId,
  renditionType,
  deliveryId = null,
  requestedByProfileId = null,
} = {}) {
  if (!masterAssetId) throw new ApiError(422, 'masterAssetId é obrigatório.')
  const type = normalizeRenditionType(renditionType)
  const master = await getMasterAsset(masterAssetId, { requireVideo: type === 'hls_stream' })
  const masterKind = classifyMaster(master)

  if (type === 'preview' && PASSTHROUGH_PREVIEW_MEDIA_TYPES.has(masterKind)) {
    return registerPassthroughPreview(master, { requestedByProfileId })
  }

  if (masterKind !== 'video') {
    throw new ApiError(422, 'Esta rendition exige Master Limpo de vídeo.', { masterAssetId, renditionType: type, masterKind })
  }

  const reusable = await findReusableRendition({ masterAssetId, renditionType: type, deliveryId })
  if (reusable) {
    const shouldEnqueue = reusable.status === 'queued' && renditionQueueAllowed()
    if (shouldEnqueue) {
      await addRenditionJob({
        renditionId: reusable.id,
        masterAssetId,
        renditionType: type,
        deliveryId,
      })
    }

    return {
      rendition: reusable,
      reused: true,
      enqueued: shouldEnqueue,
      deferred: reusable.status === 'queued' && !shouldEnqueue,
    }
  }

  const target = buildQueuedRenditionKey({ masterAssetId, renditionType: type, deliveryId })
  const rendition = await registerMediaRendition({
    masterAssetId,
    renditionType: type,
    deliveryId,
    bucket: env.R2_BUCKET_NAME,
    key: target.key,
    status: 'queued',
    metadata: {
      p3: true,
      requestedByProfileId,
      targetContentType: target.contentType,
      requestedAt: nowIso(),
    },
  })

  const shouldEnqueue = renditionQueueAllowed()
  if (shouldEnqueue) {
    await addRenditionJob({
      renditionId: rendition.id,
      masterAssetId,
      renditionType: type,
      deliveryId,
    })
  }

  return {
    rendition,
    reused: false,
    enqueued: shouldEnqueue,
    deferred: !shouldEnqueue,
  }
}

export async function requestDefaultRenditionsForMaster({
  masterAssetId,
  mediaType = null,
  requestedByProfileId = null,
} = {}) {
  if (!masterAssetId) throw new ApiError(422, 'masterAssetId é obrigatório para auto-rendition.')
  const normalized = cleanText(mediaType).toLowerCase()
  const preview = await requestMediaRendition({ masterAssetId, renditionType: 'preview', requestedByProfileId })

  if (!normalized.includes('video')) {
    return { masterAssetId, preview, hls: null }
  }

  const hls = await requestMediaRendition({ masterAssetId, renditionType: 'hls_stream', requestedByProfileId })
  return { masterAssetId, preview, hls }
}

export async function enqueuePendingMediaRenditions({ limit = 200 } = {}) {
  if (!renditionQueueAllowed()) return { enqueued: 0, skipped: true, reason: 'rendition_queue_disabled' }

  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000)
  const { data, error } = await supabaseAdmin
    .from(RENDITIONS_TABLE)
    .select('id, master_asset_id, rendition_type, delivery_id, status')
    .eq('status', 'queued')
    .in('rendition_type', ['preview', 'hls_stream'])
    .order('created_at', { ascending: true })
    .limit(safeLimit)

  if (error) throw new ApiError(500, 'Falha ao carregar backlog de renditions.', error)
  let enqueued = 0
  for (const row of data || []) {
    await addRenditionJob({
      renditionId: row.id,
      masterAssetId: row.master_asset_id,
      renditionType: row.rendition_type,
      deliveryId: row.delivery_id || null,
    })
    enqueued += 1
  }
  return { enqueued, skipped: false }
}

function runProcess(command, args, { label, signal, maxOutputBytes = 1024 * 1024 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })

    let stdout = ''
    let stderr = ''
    let settled = false
    let killTimer = null

    const appendLimited = (current, chunk) => {
      const next = current + chunk.toString('utf8')
      return next.length > maxOutputBytes ? next.slice(-maxOutputBytes) : next
    }

    const cleanup = () => {
      if (killTimer) clearTimeout(killTimer)
      signal?.removeEventListener('abort', abortHandler)
    }

    const finishReject = (error) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    const abortHandler = () => {
      if (settled) return
      child.kill('SIGTERM')
      killTimer = setTimeout(() => child.kill('SIGKILL'), 5000)
      killTimer.unref?.()
    }

    child.stdout.on('data', (chunk) => {
      stdout = appendLimited(stdout, chunk)
    })

    child.stderr.on('data', (chunk) => {
      stderr = appendLimited(stderr, chunk)
    })

    child.once('error', (error) => {
      const message = error.code === 'ENOENT'
        ? `${label}: binário não encontrado em ${command}.`
        : `${label}: falha ao iniciar processo.`
      finishReject(new ApiError(500, message, { command, error: error.message }))
    })

    child.once('close', (code, terminationSignal) => {
      if (settled) return
      settled = true
      cleanup()

      if (signal?.aborted) {
        reject(new ApiError(499, `${label} cancelado pelo timeout do worker.`, {
          command,
          terminationSignal,
        }))
        return
      }

      if (code !== 0) {
        reject(new ApiError(500, `${label} terminou com erro.`, {
          command,
          code,
          terminationSignal,
          stderr: stderr.slice(-8000),
        }))
        return
      }

      resolve({ stdout, stderr, code })
    })

    if (signal) {
      if (signal.aborted) {
        abortHandler()
      } else {
        signal.addEventListener('abort', abortHandler, { once: true })
      }
    }
  })
}

async function probeVideo(inputPath, signal) {
  const result = await runProcess(env.FFPROBE_PATH, [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    inputPath,
  ], {
    label: 'FFprobe da rendition',
    signal,
  })

  let parsed
  try {
    parsed = JSON.parse(result.stdout || '{}')
  } catch {
    throw new ApiError(500, 'FFprobe retornou JSON inválido.')
  }

  const video = (parsed.streams || []).find((stream) => stream.codec_type === 'video')
  if (!video) throw new ApiError(422, 'Master Limpo não contém trilha de vídeo válida.')

  return {
    durationSeconds: Number(parsed.format?.duration || video.duration || 0) || null,
    width: Number(video.width || 0) || null,
    height: Number(video.height || 0) || null,
    codecName: video.codec_name || null,
    hasAudio: (parsed.streams || []).some((stream) => stream.codec_type === 'audio'),
  }
}

async function createPlatformWatermark(filePath, label = 'PRIVACY IA • PREVIEW') {
  const svg = `
    <svg width="260" height="64" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="256" height="60" rx="14" fill="rgba(0,0,0,0.45)" stroke="rgba(255,255,255,0.35)" stroke-width="2"/>
      <text x="130" y="40" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="rgba(255,255,255,0.92)">${label}</text>
    </svg>`

  await sharp(Buffer.from(svg)).png().toFile(filePath)
}

function buildVideoFilter(maxWidth) {
  return [
    `[0:v]scale=w='min(${maxWidth}\\,iw)':h=-2:force_original_aspect_ratio=decrease,setsar=1[base]`,
    '[1:v]format=rgba,colorchannelmixer=aa=0.72[wm]',
    '[base][wm]overlay=x=W-w-24:y=H-h-24:format=auto[vout]',
  ].join(';')
}

async function renderPreview({ inputPath, watermarkPath, outputPath, signal }) {
  await runProcess(env.FFMPEG_PATH, [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', inputPath,
    '-loop', '1',
    '-i', watermarkPath,
    '-filter_complex', buildVideoFilter(env.RENDITION_PREVIEW_MAX_WIDTH),
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(env.RENDITION_PREVIEW_CRF),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '96k',
    '-movflags', '+faststart',
    '-shortest',
    outputPath,
  ], {
    label: 'FFmpeg preview',
    signal,
  })
}

async function renderHls({ inputPath, watermarkPath, outputDirectory, signal }) {
  const segmentPattern = path.join(outputDirectory, 'segment-%05d.ts')
  const manifestPath = path.join(outputDirectory, 'index.m3u8')
  const segmentSeconds = env.RENDITION_HLS_SEGMENT_SECONDS

  await runProcess(env.FFMPEG_PATH, [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', inputPath,
    '-loop', '1',
    '-i', watermarkPath,
    '-filter_complex', buildVideoFilter(env.RENDITION_HLS_MAX_WIDTH),
    '-map', '[vout]',
    '-map', '0:a?',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', String(env.RENDITION_HLS_CRF),
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ac', '2',
    '-ar', '48000',
    '-force_key_frames', `expr:gte(t,n_forced*${segmentSeconds})`,
    '-hls_time', String(segmentSeconds),
    '-hls_list_size', '0',
    '-hls_playlist_type', 'vod',
    '-hls_segment_type', 'mpegts',
    '-hls_flags', 'independent_segments+temp_file',
    '-hls_segment_filename', segmentPattern,
    '-shortest',
    '-f', 'hls',
    manifestPath,
  ], {
    label: 'FFmpeg HLS',
    signal,
  })

  return manifestPath
}

async function uploadPreview({ rendition, outputPath, probe, signal }) {
  const file = await stat(outputPath)
  const upload = await uploadPrivateFileToR2({
    filePath: outputPath,
    bucket: rendition.r2_bucket,
    key: rendition.r2_key,
    contentType: 'video/mp4',
    contentLength: file.size,
    metadata: {
      protected: true,
      rendition_type: 'preview',
      master_asset_id: rendition.master_asset_id,
      rendition_id: rendition.id,
      public_url: false,
    },
    abortSignal: signal,
  })

  return {
    upload,
    metadata: {
      contentType: 'video/mp4',
      byteSize: file.size,
      previewMaxWidth: env.RENDITION_PREVIEW_MAX_WIDTH,
      watermark: 'platform_visual',
      probe,
    },
  }
}

async function uploadHls({ rendition, outputDirectory, manifestPath, probe, signal }) {
  const files = (await readdir(outputDirectory)).sort()
  const segmentFiles = files.filter((name) => /^segment-\d{5}\.ts$/.test(name))

  if (segmentFiles.length === 0) {
    throw new ApiError(500, 'FFmpeg não gerou segmentos HLS.')
  }

  const manifestKey = rendition.r2_key
  const prefix = path.posix.dirname(manifestKey)
  const uploadedKeys = []
  const segmentKeys = []

  try {
    for (const filename of segmentFiles) {
      const localPath = path.join(outputDirectory, filename)
      const info = await stat(localPath)
      const key = path.posix.join(prefix, filename)

      await uploadPrivateFileToR2({
        filePath: localPath,
        bucket: rendition.r2_bucket,
        key,
        contentType: 'video/mp2t',
        contentLength: info.size,
        metadata: {
          protected: true,
          rendition_type: 'hls_segment',
          master_asset_id: rendition.master_asset_id,
          rendition_id: rendition.id,
          public_url: false,
        },
        abortSignal: signal,
      })

      uploadedKeys.push(key)
      segmentKeys.push(key)
    }

    const manifestInfo = await stat(manifestPath)
    const manifestUpload = await uploadPrivateFileToR2({
      filePath: manifestPath,
      bucket: rendition.r2_bucket,
      key: manifestKey,
      contentType: 'application/vnd.apple.mpegurl',
      contentLength: manifestInfo.size,
      metadata: {
        protected: true,
        rendition_type: 'hls_stream',
        master_asset_id: rendition.master_asset_id,
        rendition_id: rendition.id,
        segment_count: segmentKeys.length,
        public_url: false,
      },
      abortSignal: signal,
    })

    uploadedKeys.push(manifestKey)

    return {
      upload: manifestUpload,
      uploadedKeys,
      metadata: {
        contentType: 'application/vnd.apple.mpegurl',
        manifestKey,
        segmentPrefix: prefix,
        segmentKeys,
        segmentCount: segmentKeys.length,
        segmentDurationSeconds: env.RENDITION_HLS_SEGMENT_SECONDS,
        signedUrlTtlSeconds: env.RENDITION_SIGNED_URL_TTL_SECONDS,
        watermark: 'platform_visual',
        probe,
      },
    }
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => deleteObject(rendition.r2_bucket, key)))
    throw error
  }
}

export async function processMediaRenditionJob(jobData = {}, { signal = null } = {}) {
  const renditionId = cleanText(jobData.renditionId)
  const masterAssetId = cleanText(jobData.masterAssetId)
  const requestedType = normalizeRenditionType(jobData.renditionType)

  if (!renditionId || !masterAssetId) {
    throw new ApiError(422, 'Job de rendition sem renditionId ou masterAssetId.')
  }

  let rendition = await getRendition(renditionId)
  const master = await getMasterAsset(masterAssetId)

  if (rendition.master_asset_id !== master.id) {
    throw new ApiError(409, 'Job de rendition não pertence ao Master Limpo informado.', {
      renditionId,
      expectedMasterAssetId: rendition.master_asset_id,
      receivedMasterAssetId: master.id,
    })
  }

  if (rendition.rendition_type !== requestedType) {
    throw new ApiError(409, 'Tipo do job diverge do registro da rendition.', {
      renditionId,
      recordType: rendition.rendition_type,
      jobType: requestedType,
    })
  }

  if (rendition.status === 'available') {
    return {
      rendition,
      idempotent: true,
      processed: false,
    }
  }

  const tempRoot = cleanText(env.RENDITION_TEMP_ROOT) || tmpdir()
  await mkdir(tempRoot, { recursive: true })
  const workDirectory = await mkdtemp(path.join(tempRoot, 'privacy-rendition-'))
  const inputPath = path.join(workDirectory, `master${extensionFromMaster(master)}`)
  const watermarkPath = path.join(workDirectory, 'platform-watermark.png')

  rendition = await updateRendition(rendition, {
    status: 'processing',
    metadata: {
      processingStartedAt: nowIso(),
      worker: 'rendition.worker',
      ffmpegPath: env.FFMPEG_PATH,
      ffprobePath: env.FFPROBE_PATH,
    },
  })

  try {
    const download = await downloadPrivateObjectToFile({
      bucket: master.master_r2_bucket,
      key: master.master_r2_key,
      filePath: inputPath,
      abortSignal: signal,
    })

    const probe = await probeVideo(inputPath, signal)
    await createPlatformWatermark(
      watermarkPath,
      requestedType === 'preview' ? 'PRIVACY IA • PREVIEW' : 'PRIVACY IA',
    )

    let result

    if (requestedType === 'preview') {
      const outputPath = path.join(workDirectory, 'preview.mp4')
      await renderPreview({ inputPath, watermarkPath, outputPath, signal })
      result = await uploadPreview({ rendition, outputPath, probe, signal })
    } else {
      const outputDirectory = path.join(workDirectory, 'hls')
      await mkdir(outputDirectory, { recursive: true })
      const manifestPath = await renderHls({ inputPath, watermarkPath, outputDirectory, signal })
      result = await uploadHls({ rendition, outputDirectory, manifestPath, probe, signal })
    }

    const available = await updateRendition(rendition, {
      status: 'available',
      metadata: {
        ...result.metadata,
        sourceMaster: {
          bucket: master.master_r2_bucket,
          keyHash: createHash('sha256').update(master.master_r2_key).digest('hex').slice(0, 16),
          contentType: download.contentType || master.content_type || null,
          contentLength: download.contentLength || master.byte_size || null,
        },
        processingCompletedAt: nowIso(),
        privateStorage: true,
        publicUrl: false,
      },
    })

    return {
      rendition: available,
      idempotent: false,
      processed: true,
      output: {
        bucket: available.r2_bucket,
        key: available.r2_key,
        type: available.rendition_type,
      },
    }
  } catch (error) {
    try {
      rendition = await updateRendition(rendition, {
        status: 'failed',
        metadata: {
          processingFailedAt: nowIso(),
          errorCode: error.code || null,
          errorMessage: error.message,
        },
      })
    } catch (updateError) {
      console.error('[rendition] Falha adicional ao persistir status failed.', updateError)
    }

    throw error
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

export async function writeRenditionRuntimeProbeFile(filePath) {
  const payload = {
    ffmpegPath: env.FFMPEG_PATH,
    ffprobePath: env.FFPROBE_PATH,
    previewMaxWidth: env.RENDITION_PREVIEW_MAX_WIDTH,
    hlsMaxWidth: env.RENDITION_HLS_MAX_WIDTH,
    hlsSegmentSeconds: env.RENDITION_HLS_SEGMENT_SECONDS,
  }
  await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  return payload
}
