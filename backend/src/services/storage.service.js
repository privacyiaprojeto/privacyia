import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

function assertR2Configured({ requirePublicBaseUrl = true } = {}) {
  const missing = [
    ['R2_ACCOUNT_ID', env.R2_ACCOUNT_ID],
    ['R2_ACCESS_KEY_ID', env.R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', env.R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET_NAME', env.R2_BUCKET_NAME],
    ...(requirePublicBaseUrl ? [['R2_PUBLIC_BASE_URL', env.R2_PUBLIC_BASE_URL]] : []),
  ].filter(([, value]) => !String(value || '').trim())

  if (missing.length > 0) {
    throw new ApiError(
      500,
      `Cloudflare R2 não configurado: ${missing.map(([key]) => key).join(', ')}.`
    )
  }
}

function getR2Client(options = {}) {
  assertR2Configured(options)

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
  if (cleanKey.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (cleanKey.endsWith('.ts')) return 'video/mp2t'

  return fallback
}

function assertBucketAndKey(bucket, key) {
  if (!String(bucket || '').trim()) {
    throw new ApiError(400, 'Bucket do R2 não informado.')
  }

  if (!String(key || '').trim()) {
    throw new ApiError(400, 'Chave do objeto R2 não informada.')
  }

  if (String(key).startsWith('/')) {
    throw new ApiError(400, 'Chave do objeto R2 não deve começar com "/".')
  }
}

function normalizeBodyStream(bodyStream) {
  if (!bodyStream) {
    throw new ApiError(400, 'Stream de upload não informado.')
  }

  if (typeof bodyStream.pipe === 'function') {
    return bodyStream
  }

  if (
    typeof Readable.fromWeb === 'function' &&
    typeof bodyStream.getReader === 'function'
  ) {
    return Readable.fromWeb(bodyStream)
  }

  return bodyStream
}

function sanitizeMetadataValue(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1024)
}

function sanitizeMetadata(metadata = {}) {
  const clean = {}

  for (const [key, value] of Object.entries(metadata || {})) {
    if (value === undefined || value === null) continue

    const safeKey = String(key)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 128)

    if (!safeKey) continue
    clean[safeKey] = sanitizeMetadataValue(value)
  }

  return clean
}

function encodeCopySource(bucket, key) {
  return `${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`
}

function normalizeExpiresIn(expiresIn) {
  const value = Number(expiresIn || 3600)

  if (!Number.isFinite(value) || value <= 0) {
    return 3600
  }

  return Math.floor(value)
}

function wrapStorageError(operation, error, details = {}) {
  if (error instanceof ApiError) return error

  return new ApiError(
    500,
    `Falha no storage R2 durante ${operation}: ${error.message}`,
    {
      operation,
      ...details,
      originalErrorName: error.name,
    }
  )
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

export function sanitizeStoragePathSegment(value, fallback = 'unknown') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .toLowerCase()

  return normalized || fallback
}

export function getMediaFolderByKind(mediaKind = '') {
  const normalized = String(mediaKind || '').trim().toLowerCase()

  if (['imagem', 'image', 'img', 'photo', 'picture'].includes(normalized)) {
    return 'images'
  }

  if (['video', 'videos', 'movie'].includes(normalized)) {
    return 'videos'
  }

  if (['audio', 'voice', 'speech', 'tts'].includes(normalized)) {
    return 'audio'
  }

  return sanitizeStoragePathSegment(normalized || 'media', 'media')
}

export function buildOrganizedMediaKey({
  companionSlug,
  companionId,
  mediaKind = 'image',
  source = 'factory',
  batchId,
  batchItemId,
  variantIndex = 1,
  extension = 'bin',
  createdAt = new Date().toISOString(),
}) {
  const date = new Date(createdAt)
  const year = String(Number.isNaN(date.getTime()) ? new Date().getUTCFullYear() : date.getUTCFullYear())
  const month = String(Number.isNaN(date.getTime()) ? new Date().getUTCMonth() + 1 : date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(Number.isNaN(date.getTime()) ? new Date().getUTCDate() : date.getUTCDate()).padStart(2, '0')

  const companionSegment = sanitizeStoragePathSegment(companionSlug || companionId || 'unknown-companion', 'unknown-companion')
  const mediaFolder = getMediaFolderByKind(mediaKind)
  const sourceSegment = sanitizeStoragePathSegment(source || 'factory', 'factory')
  const batchSegment = sanitizeStoragePathSegment(batchId || 'no-batch', 'no-batch')
  const itemSegment = sanitizeStoragePathSegment(batchItemId || 'no-item', 'no-item')
  const variantSegment = String(Math.max(Number(variantIndex || 1), 1)).padStart(3, '0')
  const finalExtension = sanitizeStoragePathSegment(extension || 'bin', 'bin')

  return [
    'media',
    'companions',
    companionSegment,
    mediaFolder,
    sourceSegment,
    year,
    month,
    day,
    `batch-${batchSegment}`,
    `item-${itemSegment}`,
    `variant-${variantSegment}.${finalExtension}`,
  ].join('/')
}


export function buildKycVaultKey({
  actorProfileId,
  kycCaseId,
  assetType = 'reference_asset',
  extension = 'bin',
  createdAt = new Date().toISOString(),
}) {
  const date = new Date(createdAt)
  const year = String(Number.isNaN(date.getTime()) ? new Date().getUTCFullYear() : date.getUTCFullYear())
  const month = String(Number.isNaN(date.getTime()) ? new Date().getUTCMonth() + 1 : date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(Number.isNaN(date.getTime()) ? new Date().getUTCDate() : date.getUTCDate()).padStart(2, '0')

  const actorSegment = sanitizeStoragePathSegment(actorProfileId || 'actor', 'actor')
  const caseSegment = sanitizeStoragePathSegment(kycCaseId || 'case', 'case')
  const typeSegment = sanitizeStoragePathSegment(assetType || 'reference_asset', 'reference_asset')
  const finalExtension = sanitizeStoragePathSegment(extension || 'bin', 'bin')

  return [
    'vault',
    'actor-mapping',
    year,
    month,
    day,
    `actor-${actorSegment}`,
    `case-${caseSegment}`,
    `${typeSegment}-${randomUUID()}.${finalExtension}`,
  ].join('/')
}


export async function headKycVaultObject({ bucket, key }) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return {
      exists: true,
      bucket,
      key,
      contentType: result.ContentType || null,
      contentLength: result.ContentLength ?? null,
      etag: result.ETag || null,
      lastModified: result.LastModified ? result.LastModified.toISOString() : null,
      metadata: result.Metadata || {},
      publicAccess: false,
    }
  } catch (error) {
    const statusCode = error?.$metadata?.httpStatusCode
    const name = String(error?.name || '').toLowerCase()

    if (statusCode === 404 || name === 'notfound' || name === 'nosuchkey') {
      return {
        exists: false,
        bucket,
        key,
        contentType: null,
        contentLength: null,
        etag: null,
        lastModified: null,
        metadata: {},
        publicAccess: false,
      }
    }

    throw wrapStorageError('headKycVaultObject', error, { bucket, key })
  }
}


export async function getKycVaultObject({ bucket, key }) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return {
      bucket,
      key,
      bodyStream: normalizeBodyStream(result.Body),
      contentType: result.ContentType || guessMimeTypeFromKey(key),
      contentLength: result.ContentLength ?? null,
      etag: result.ETag || null,
      lastModified: result.LastModified ? result.LastModified.toISOString() : null,
      metadata: result.Metadata || {},
      publicAccess: false,
    }
  } catch (error) {
    throw wrapStorageError('getKycVaultObject', error, { bucket, key })
  }
}

export async function uploadKycAssetToVault({
  base64,
  buffer,
  key,
  actorProfileId,
  kycCaseId,
  assetType = 'reference_asset',
  contentType = 'application/octet-stream',
  metadata = {},
  dryRunOnly = false,
}) {
  const dataUri = base64 ? parseDataUri(base64) : null
  const finalContentType = contentType || dataUri?.mimeType || 'application/octet-stream'
  const finalBuffer = Buffer.isBuffer(buffer)
    ? buffer
    : base64
      ? Buffer.from(normalizeBase64(base64), 'base64')
      : Buffer.alloc(0)

  if (!dryRunOnly && finalBuffer.length === 0) {
    throw new ApiError(400, 'Arquivo de mapeamento não informado para guardar no cofre privado.')
  }

  const finalKey = key || buildKycVaultKey({
    actorProfileId,
    kycCaseId,
    assetType,
    extension: getExtensionFromContentType(finalContentType),
  })

  const bucket = env.R2_BUCKET_NAME || metadata.bucket || 'privacy-media'
  const vaultMetadata = sanitizeMetadata({
    ...metadata,
    privacy: 'private',
    scope: 'actor_mapping_vault',
    actor_profile_id: actorProfileId,
    kyc_case_id: kycCaseId,
    asset_type: assetType,
  })

  if (dryRunOnly) {
    return {
      bucket,
      key: finalKey,
      contentType: finalContentType,
      byteSize: finalBuffer.length,
      metadata: vaultMetadata,
      dryRun: true,
    }
  }

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: finalKey,
      Body: finalBuffer,
      ContentType: finalContentType,
      CacheControl: 'private, no-store',
      Metadata: vaultMetadata,
    }))

    return {
      bucket,
      key: finalKey,
      contentType: finalContentType,
      byteSize: finalBuffer.length,
      metadata: vaultMetadata,
      etag: result.ETag || null,
      versionId: result.VersionId || null,
      dryRun: false,
    }
  } catch (error) {
    throw wrapStorageError('uploadKycAssetToVault', error, { bucket, key: finalKey })
  }
}

export async function uploadPrivateBufferToR2({
  buffer,
  key,
  contentType = 'application/octet-stream',
  metadata = {},
}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(400, 'Buffer inválido para upload privado no R2.')
  }

  assertBucketAndKey(env.R2_BUCKET_NAME, key)

  const finalContentType = contentType || guessMimeTypeFromKey(key)
  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: finalContentType,
      CacheControl: 'private, no-store',
      Metadata: sanitizeMetadata(metadata),
    }))

    return {
      bucket: env.R2_BUCKET_NAME,
      key,
      contentType: finalContentType,
      byteSize: buffer.length,
      etag: result.ETag || null,
      versionId: result.VersionId || null,
      private: true,
    }
  } catch (error) {
    throw wrapStorageError('uploadPrivateBufferToR2', error, {
      bucket: env.R2_BUCKET_NAME,
      key,
    })
  }
}

export async function uploadPrivateImageBuffer({
  buffer,
  key,
  contentType = 'image/png',
  metadata = {},
}) {
  return uploadPrivateBufferToR2({
    buffer,
    key,
    contentType,
    metadata,
  })
}

export async function uploadBufferToR2({ buffer, key, contentType = 'application/octet-stream', cacheControl }) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ApiError(400, 'Buffer inválido para upload no R2.')
  }

  if (!key) {
    throw new ApiError(400, 'Chave do objeto R2 não informada.')
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
    throw new ApiError(400, 'Base64 de mídia não informado para upload no R2.')
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

export async function uploadStreamToR2({
  bodyStream,
  key,
  bucket = env.R2_BUCKET_NAME,
  contentType = 'application/octet-stream',
  contentLength,
  cacheControl,
  metadata = {},
  queueSize = 4,
  partSize = 1024 * 1024 * 8,
  privateAccess = false,
  abortSignal = null,
}) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: !privateAccess })
  const normalizedStream = normalizeBodyStream(bodyStream)
  let upload = null
  let abortHandler = null

  try {
    upload = new Upload({
      client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: normalizedStream,
        ContentType: contentType || guessMimeTypeFromKey(key),
        ...(contentLength ? { ContentLength: Number(contentLength) } : {}),
        CacheControl: cacheControl || (privateAccess ? 'private, no-store' : 'public, max-age=31536000, immutable'),
        Metadata: sanitizeMetadata(metadata),
      },
      queueSize,
      partSize,
      leavePartsOnError: false,
    })

    if (abortSignal) {
      if (abortSignal.aborted) {
        await upload.abort()
        throw new ApiError(499, 'Upload privado cancelado antes do início.')
      }

      abortHandler = () => {
        upload.abort().catch(() => {})
      }
      abortSignal.addEventListener('abort', abortHandler, { once: true })
    }

    const result = await upload.done()

    return {
      bucket,
      key,
      url: !privateAccess && bucket === env.R2_BUCKET_NAME ? buildPublicUrl(key) : null,
      etag: result.ETag || null,
      location: result.Location || null,
      versionId: result.VersionId || null,
      contentType,
      contentLength: contentLength ? Number(contentLength) : null,
      private: Boolean(privateAccess),
    }
  } catch (error) {
    throw wrapStorageError('uploadStreamToR2', error, { bucket, key })
  } finally {
    if (abortHandler && abortSignal) {
      abortSignal.removeEventListener('abort', abortHandler)
    }
  }
}

export async function getPrivateObjectStream({
  bucket = env.R2_BUCKET_NAME,
  key,
  range = null,
  abortSignal = null,
} = {}) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ...(range ? { Range: range } : {}),
      }),
      abortSignal ? { abortSignal } : undefined,
    )

    return {
      bucket,
      key,
      bodyStream: normalizeBodyStream(result.Body),
      contentType: result.ContentType || guessMimeTypeFromKey(key),
      contentLength: result.ContentLength ?? null,
      contentRange: result.ContentRange || null,
      acceptRanges: result.AcceptRanges || 'bytes',
      etag: result.ETag || null,
      lastModified: result.LastModified ? result.LastModified.toISOString() : null,
      metadata: result.Metadata || {},
      statusCode: result.ContentRange ? 206 : 200,
      private: true,
    }
  } catch (error) {
    throw wrapStorageError('getPrivateObjectStream', error, { bucket, key, range })
  }
}

export async function downloadPrivateObjectToFile({
  bucket = env.R2_BUCKET_NAME,
  key,
  filePath,
  abortSignal = null,
} = {}) {
  if (!String(filePath || '').trim()) {
    throw new ApiError(400, 'filePath obrigatório para download privado.')
  }

  const object = await getPrivateObjectStream({ bucket, key, abortSignal })
  const fileStream = createWriteStream(filePath, { flags: 'wx' })
  if (abortSignal) {
    await pipeline(object.bodyStream, fileStream, { signal: abortSignal })
  } else {
    await pipeline(object.bodyStream, fileStream)
  }

  return {
    ...object,
    bodyStream: undefined,
    filePath,
  }
}

export async function uploadPrivateFileToR2({
  filePath,
  bucket = env.R2_BUCKET_NAME,
  key,
  contentType = 'application/octet-stream',
  contentLength = null,
  metadata = {},
  abortSignal = null,
} = {}) {
  if (!String(filePath || '').trim()) {
    throw new ApiError(400, 'filePath obrigatório para upload privado.')
  }

  return uploadStreamToR2({
    bodyStream: createReadStream(filePath),
    key,
    bucket,
    contentType,
    contentLength,
    metadata,
    privateAccess: true,
    cacheControl: 'private, no-store',
    abortSignal,
  })
}

export async function readPrivateTextObject({
  bucket = env.R2_BUCKET_NAME,
  key,
  maxBytes = 1024 * 1024,
  abortSignal = null,
} = {}) {
  const object = await getPrivateObjectStream({ bucket, key, abortSignal })
  const chunks = []
  let total = 0

  for await (const chunk of object.bodyStream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length

    if (total > Number(maxBytes || 1024 * 1024)) {
      object.bodyStream.destroy?.()
      throw new ApiError(413, 'Objeto de texto privado excede o limite permitido.', {
        bucket,
        key,
        maxBytes,
      })
    }

    chunks.push(buffer)
  }

  return {
    ...object,
    bodyStream: undefined,
    text: Buffer.concat(chunks).toString('utf8'),
    byteSize: total,
  }
}

export async function createSignedUploadUrl({
  bucket = env.R2_BUCKET_NAME,
  key,
  contentType = 'application/octet-stream',
  expiresIn = 900,
  metadata = {},
} = {}) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      Metadata: sanitizeMetadata(metadata),
    })

    return await getSignedUrl(client, command, {
      expiresIn: normalizeExpiresIn(expiresIn),
    })
  } catch (error) {
    throw wrapStorageError('createSignedUploadUrl', error, { bucket, key })
  }
}

export async function createSignedReadUrl(bucket = env.R2_BUCKET_NAME, key, expiresIn = 3600) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })

    return await getSignedUrl(client, command, {
      expiresIn: normalizeExpiresIn(expiresIn),
    })
  } catch (error) {
    throw wrapStorageError('createSignedReadUrl', error, { bucket, key })
  }
}

export async function deleteObject(bucket = env.R2_BUCKET_NAME, key) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return {
      bucket,
      key,
      deleted: true,
      deleteMarker: result.DeleteMarker || false,
      versionId: result.VersionId || null,
    }
  } catch (error) {
    throw wrapStorageError('deleteObject', error, { bucket, key })
  }
}

export async function copyObject(sourceBucket, sourceKey, destBucket, destKey, options = {}) {
  assertBucketAndKey(sourceBucket, sourceKey)
  assertBucketAndKey(destBucket, destKey)

  const client = getR2Client()

  try {
    const result = await client.send(new CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      CopySource: encodeCopySource(sourceBucket, sourceKey),
      ...(options.contentType ? { ContentType: options.contentType } : {}),
      ...(options.metadata
        ? {
            Metadata: sanitizeMetadata(options.metadata),
            MetadataDirective: 'REPLACE',
          }
        : {}),
    }))

    return {
      sourceBucket,
      sourceKey,
      destBucket,
      destKey,
      copied: true,
      etag: result.CopyObjectResult?.ETag || null,
      lastModified: result.CopyObjectResult?.LastModified || null,
    }
  } catch (error) {
    throw wrapStorageError('copyObject', error, {
      sourceBucket,
      sourceKey,
      destBucket,
      destKey,
    })
  }
}

export async function headObject(bucket = env.R2_BUCKET_NAME, key) {
  assertBucketAndKey(bucket, key)

  const client = getR2Client({ requirePublicBaseUrl: false })

  try {
    const result = await client.send(new HeadObjectCommand({
      Bucket: bucket,
      Key: key,
    }))

    return {
      bucket,
      key,
      exists: true,
      contentLength: result.ContentLength || null,
      contentType: result.ContentType || null,
      etag: result.ETag || null,
      lastModified: result.LastModified || null,
      metadata: result.Metadata || {},
    }
  } catch (error) {
    throw wrapStorageError('headObject', error, { bucket, key })
  }
}
