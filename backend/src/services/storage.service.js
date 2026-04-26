import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
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

export async function uploadAudioBuffer({ buffer, key, contentType = 'audio/mpeg' }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Buffer de áudio inválido para upload no R2.')
  }

  if (!key) {
    throw new Error('Chave do objeto R2 não informada.')
  }

  const client = getR2Client()

  await client.send(new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))

  return buildPublicUrl(key)
}
