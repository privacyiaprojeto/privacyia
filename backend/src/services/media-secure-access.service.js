import path from 'node:path'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import {
  createSignedReadUrl,
  readPrivateTextObject,
} from './storage.service.js'

const ASSET_VARIANTS_TABLE = 'media_asset_variants'
const RENDITIONS_TABLE = 'media_asset_renditions'

const DEFAULT_TTL_SECONDS = 120
const MIN_TTL_SECONDS = 30
const MAX_TTL_SECONDS = 600

const DEFAULT_ALLOWED_STATUSES = ['available']
const ADMIN_PREVIEW_ALLOWED_STATUSES = ['qa_pending', 'available']

function nowPlusSecondsIso(seconds) {
  return new Date(Date.now() + Number(seconds || 0) * 1000).toISOString()
}

function normalizeTtlSeconds(value) {
  const parsed = Number(value || env.RENDITION_SIGNED_URL_TTL_SECONDS || DEFAULT_TTL_SECONDS)

  if (!Number.isFinite(parsed)) return DEFAULT_TTL_SECONDS

  return Math.min(
    Math.max(Math.floor(parsed), MIN_TTL_SECONDS),
    MAX_TTL_SECONDS,
  )
}

function normalizeAllowedStatuses(value, fallback = DEFAULT_ALLOWED_STATUSES) {
  if (!Array.isArray(value) || value.length === 0) return fallback
  return value.map((status) => String(status || '').trim()).filter(Boolean)
}

function buildSecurityPolicy({ ttlSeconds, deliveryMode = 'backend_proxy' }) {
  return {
    ttlSeconds,
    expiresAt: nowPlusSecondsIso(ttlSeconds),
    deliveryMode,
    cacheControl: 'no-store, no-cache, must-revalidate, private',
    contentSecurityPolicy: "default-src 'none'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; object-src 'none'; frame-ancestors 'none'",
    notes: [
      'Não usar URL pública persistente do R2 para conteúdo privado.',
      deliveryMode === 'hls_signed_segments'
        ? 'Manifesto entregue pelo backend; segmentos possuem Signed URLs curtas e específicas.'
        : 'Objeto privado entregue por stream backend com backpressure.',
      'A proteção não impede captura externa de tela/áudio; watermark e auditoria continuam obrigatórias.',
    ],
  }
}

async function getAsset(assetId) {
  if (!assetId) throw new ApiError(400, 'assetId obrigatório.')

  const { data, error } = await supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar asset para acesso seguro.', {
      assetId,
      error: error.message,
    })
  }

  return data || null
}

async function getRendition(renditionId) {
  if (!renditionId) throw new ApiError(400, 'renditionId obrigatório.')

  const { data, error } = await supabaseAdmin
    .from(RENDITIONS_TABLE)
    .select('*')
    .eq('id', renditionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar rendition para acesso seguro.', {
      renditionId,
      error: error.message,
    })
  }

  return data || null
}

function assertAssetReadable(asset, allowedStatuses) {
  if (!asset) throw new ApiError(404, 'Asset não encontrado para acesso seguro.')

  if (!allowedStatuses.includes(asset.status)) {
    throw new ApiError(409, 'Asset não está em status permitido para acesso seguro.', {
      assetId: asset.id,
      currentStatus: asset.status,
      allowedStatuses,
    })
  }

  if (!String(asset.r2_bucket || '').trim() || !String(asset.r2_key || '').trim()) {
    throw new ApiError(409, 'Asset sem ponteiro privado completo no R2.', {
      assetId: asset.id,
    })
  }
}

function assertRenditionReadable(rendition, allowedStatuses, expectedTypes = null) {
  if (!rendition) throw new ApiError(404, 'Rendition não encontrada para acesso seguro.')

  if (!allowedStatuses.includes(rendition.status)) {
    throw new ApiError(409, 'Rendition não está disponível para acesso seguro.', {
      renditionId: rendition.id,
      currentStatus: rendition.status,
      allowedStatuses,
    })
  }

  if (Array.isArray(expectedTypes) && expectedTypes.length > 0 && !expectedTypes.includes(rendition.rendition_type)) {
    throw new ApiError(409, 'Tipo da rendition não é compatível com esta entrega.', {
      renditionId: rendition.id,
      renditionType: rendition.rendition_type,
      expectedTypes,
    })
  }

  if (!String(rendition.r2_bucket || '').trim() || !String(rendition.r2_key || '').trim()) {
    throw new ApiError(409, 'Rendition sem ponteiro privado completo no R2.', {
      renditionId: rendition.id,
    })
  }
}

export async function createSecureAssetReadAccess(assetId, input = {}) {
  const asset = await getAsset(assetId)
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds || input.expiresIn || input.expires_in)
  const allowedStatuses = normalizeAllowedStatuses(input.allowedStatuses || input.allowed_statuses)

  assertAssetReadable(asset, allowedStatuses)

  const signedUrl = input.includeSignedUrl === false
    ? null
    : await createSignedReadUrl(asset.r2_bucket, asset.r2_key, ttlSeconds)

  return {
    ok: true,
    asset: {
      id: asset.id,
      status: asset.status,
      mediaType: asset.media_type,
      companionId: asset.companion_id,
      combinationId: asset.combination_id,
      batchId: asset.batch_id,
      batchItemId: asset.batch_item_id,
      variantNumber: asset.variant_number,
      masterAssetId: asset.master_asset_id || null,
      r2Bucket: asset.r2_bucket,
      r2Key: asset.r2_key,
      publishedAt: asset.published_at || null,
    },
    access: {
      type: 'private_r2_object',
      bucket: asset.r2_bucket,
      key: asset.r2_key,
      signedUrl,
      expiresIn: ttlSeconds,
      expiresAt: nowPlusSecondsIso(ttlSeconds),
    },
    protection: buildSecurityPolicy({ ttlSeconds, deliveryMode: 'backend_proxy' }),
  }
}

export async function createSecureRenditionReadAccess(renditionId, input = {}) {
  const rendition = await getRendition(renditionId)
  const ttlSeconds = normalizeTtlSeconds(input.ttlSeconds || input.expiresIn || input.expires_in)
  const allowedStatuses = normalizeAllowedStatuses(
    input.allowedStatuses || input.allowed_statuses,
    ['available'],
  )
  const expectedTypes = Array.isArray(input.expectedTypes)
    ? input.expectedTypes
    : input.expectedType
      ? [input.expectedType]
      : null

  assertRenditionReadable(rendition, allowedStatuses, expectedTypes)

  return {
    ok: true,
    rendition: {
      id: rendition.id,
      masterAssetId: rendition.master_asset_id,
      deliveryId: rendition.delivery_id || null,
      renditionType: rendition.rendition_type,
      status: rendition.status,
      r2Bucket: rendition.r2_bucket,
      r2Key: rendition.r2_key,
      metadata: rendition.metadata || {},
    },
    access: {
      type: 'private_r2_rendition',
      bucket: rendition.r2_bucket,
      key: rendition.r2_key,
      expiresIn: ttlSeconds,
      expiresAt: nowPlusSecondsIso(ttlSeconds),
    },
    protection: buildSecurityPolicy({ ttlSeconds, deliveryMode: 'backend_proxy' }),
  }
}

function assertRelativeHlsUri(uri, manifestKey) {
  const value = String(uri || '').trim()
  if (!value) throw new ApiError(500, 'Manifesto HLS contém URI vazia.')

  if (
    /^[a-z][a-z0-9+.-]*:/i.test(value) ||
    value.startsWith('/') ||
    value.includes('\\') ||
    value.includes('?') ||
    value.includes('#') ||
    !/^[a-zA-Z0-9._/-]+$/.test(value)
  ) {
    throw new ApiError(500, 'Manifesto HLS contém URI externa ou inválida.', {
      manifestKey,
      uri: value,
    })
  }

  const segments = value.split('/')
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    throw new ApiError(500, 'Manifesto HLS contém tentativa de path traversal.', {
      manifestKey,
      uri: value,
    })
  }

  if (!/\.(ts|m3u8|m4s|aac)$/i.test(value)) {
    throw new ApiError(500, 'Manifesto HLS contém extensão não autorizada.', {
      manifestKey,
      uri: value,
    })
  }

  return value
}

async function rewriteHlsManifestWithSignedSegments({ bucket, manifestKey, manifest, ttlSeconds }) {
  const manifestDirectory = path.posix.dirname(manifestKey)
  const signedByUri = new Map()
  const lines = String(manifest || '').replace(/\r\n/g, '\n').split('\n')
  const output = []

  for (const originalLine of lines) {
    const trimmed = originalLine.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      output.push(originalLine)
      continue
    }

    const relativeUri = assertRelativeHlsUri(trimmed, manifestKey)
    let signedUrl = signedByUri.get(relativeUri)

    if (!signedUrl) {
      const segmentKey = path.posix.normalize(path.posix.join(manifestDirectory, relativeUri))
      const allowedPrefix = manifestDirectory.endsWith('/') ? manifestDirectory : `${manifestDirectory}/`

      if (!segmentKey.startsWith(allowedPrefix)) {
        throw new ApiError(500, 'Segmento HLS saiu do prefixo privado autorizado.', {
          manifestKey,
          segmentKey,
        })
      }

      signedUrl = await createSignedReadUrl(bucket, segmentKey, ttlSeconds)
      signedByUri.set(relativeUri, signedUrl)
    }

    output.push(signedUrl)
  }

  return {
    manifest: output.join('\n'),
    segmentCount: signedByUri.size,
  }
}

export async function createSecureHlsManifestAccess(renditionId, input = {}) {
  const secure = await createSecureRenditionReadAccess(renditionId, {
    ...input,
    expectedType: 'hls_stream',
  })

  const object = await readPrivateTextObject({
    bucket: secure.access.bucket,
    key: secure.access.key,
    maxBytes: env.RENDITION_MANIFEST_MAX_BYTES,
    abortSignal: input.abortSignal || null,
  })

  if (!String(object.text || '').trim().startsWith('#EXTM3U')) {
    throw new ApiError(500, 'Rendition HLS não contém manifesto M3U8 válido.', {
      renditionId,
    })
  }

  const rewritten = await rewriteHlsManifestWithSignedSegments({
    bucket: secure.access.bucket,
    manifestKey: secure.access.key,
    manifest: object.text,
    ttlSeconds: secure.access.expiresIn,
  })

  return {
    ...secure,
    access: {
      ...secure.access,
      type: 'hls_signed_segments',
    },
    protection: buildSecurityPolicy({
      ttlSeconds: secure.access.expiresIn,
      deliveryMode: 'hls_signed_segments',
    }),
    manifest: rewritten.manifest,
    manifestByteSize: Buffer.byteLength(rewritten.manifest, 'utf8'),
    segmentCount: rewritten.segmentCount,
    contentType: 'application/vnd.apple.mpegurl',
  }
}

export async function createAdminSecureAssetPreview(assetId, input = {}) {
  return createSecureAssetReadAccess(assetId, {
    ...input,
    allowedStatuses: input.allowedStatuses || input.allowed_statuses || ADMIN_PREVIEW_ALLOWED_STATUSES,
  })
}
