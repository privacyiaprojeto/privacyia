import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Buffer } from 'node:buffer'
import { env } from '../config/env.js'

function assertR2Configured() {
  const missing = [
    ['R2_ACCOUNT_ID', env.R2_ACCOUNT_ID],
    ['R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET_NAME', env.R2_BUCKET_NAME],
    ['R2_PUBLIC_BASE_URL', env.R2_PUBLIC_BASE_URL],
  ].filter(([, value]) => !String(value || '').trim())

  if (missing.length > 0) {
    throw new Error(`Cloudflare R2 não configurado: ${missing.map(([key]) => key).join(', ')}.`)
  }
}

function getR2Client() {
  assertR2Configured()

  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  })
}

function buildPublicUrl(key) {
  const baseUrl = env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')
  return `${baseUrl}/${String(key || '').replace(/^\//, '')}`
}

function parseDataUri(value) {
  const match = String(value || '').match(/^data:(.+?);base64,(.+)$/)

  if (!match) return null

  return {
    mimeType: match[1] || 'application/octet-stream',
    base64: match[2],
  }
}

function normalizeBase64(value) {
  const dataUri = parseDataUri(value)
  return String(dataUri?.base64 || value || '')
    .replace(/^base64,/, '')
    .replace(/\s/g, '')
}

function guessMimeTypeFromKey(key, fallback = 'application/octet-stream') {
  const cleanKey = String(key || '').split('?')[0].toLowerCase()

  if (cleanKey.endsWith('.png')) return 'image/png'
  if (cleanKey.endsWith('.jpg') || cleanKey.endsWith('.jpeg')) return 'image/jpeg'
  if (cleanKey.endsWith('.webp')) return 'image/webp'
  if (cleanKey.endsWith('.gif')) return 'image/gif'
  if (cleanKey.endsWith('.mp4')) return 'video/mp4'
  if (cleanKey.endsWith('.webm')) return 'video/webm'
  if (cleanKey.endsWith('.mov')) return 'video/quicktime'
  if (cleanKey.endsWith('.wav')) return 'audio/wav'
  if (cleanKey.endsWith('.mp3')) return 'audio/mpeg'

  return fallback
}

export function getExtensionFromContentType(contentType = 'application/octet-stream') {
  const normalized = String(contentType || '').toLowerCase()

  if (normalized.includes('png')) return 'png'
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg'
  if (normalized.includes('webp')) return 'webp'
  if (normalized.includes('gif')) return 'gif'
  if (normalized.includes('mp4')) return 'mp4'
  if (normalized.includes('webm')) return 'webm'
  if (normalized.includes('quicktime')) return 'mov'
  if (normalized.includes('wav')) return 'wav'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'

  return 'bin'
}

export async function uploadBufferToR2({ buffer, key, contentType = 'application/octet-stream', cacheControl }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Buffer inválido para upload no R2.')
  }

  if (!key) {
    throw new Error('Chave do objeto R2 não informada.')
  }

  const client = getR2Client()

  await client.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType || guessMimeTypeFromKey(key),
    CacheControl: cacheControl || 'public, max-age=31536000, immutable',
  }))

  return buildPublicUrl(key)
}

export async function uploadAudioBuffer({ buffer, key, contentType = 'audio/mpeg' }) {
  return uploadBufferToR2({
    buffer,
    key,
    contentType,
  })
}

export async function uploadMediaBase64({ base64, key, contentType }) {
  if (!base64) {
    throw new Error('Base64 de mídia não informado para upload no R2.')
  }

  const dataUri = parseDataUri(base64)
  const finalContentType = contentType || dataUri?.mimeType || guessMimeTypeFromKey(key)
  const buffer = Buffer.from(normalizeBase64(base64), 'base64')

  return uploadBufferToR2({
    buffer,
    key,
    contentType: finalContentType,
  })
}

export async function uploadImageBuffer({ buffer, key, contentType = 'image/png' }) {
  return uploadBufferToR2({
    buffer,
    key,
    contentType,
  })
}

export async function uploadVideoBuffer({ buffer, key, contentType = 'video/mp4' }) {
  return uploadBufferToR2({
    buffer,
    key,
    contentType,
  })
}
