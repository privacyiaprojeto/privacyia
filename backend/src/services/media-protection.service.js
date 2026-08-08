import crypto from 'crypto'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import {
  createAdminSecureAssetPreview,
  createSecureHlsManifestAccess,
  createSecureRenditionReadAccess,
} from './media-secure-access.service.js'
import { getPrivateObjectStream } from './storage.service.js'

const AUDIT_TABLE = 'admin_audit_logs'
let sharpModulePromise = null

function nowIso() {
  return new Date().toISOString()
}

function maskValue(value, visibleStart = 3, visibleEnd = 2) {
  const text = String(value || '').trim()
  const start = Math.max(Number(visibleStart || 0), 0)
  const end = Math.max(Number(visibleEnd || 0), 0)

  if (!text) return 'anon'

  if (end === 0) {
    if (text.length <= start) return `${text.slice(0, start)}***`
    return `${text.slice(0, start)}***`
  }

  if (text.length <= start + end) return `${text.slice(0, start)}***${text.slice(-end)}`

  return `${text.slice(0, start)}***${text.slice(-end)}`
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 12)
}


function buildVisualForensicCode(value, prefix = 'ID') {
  const hash = hashText(value).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return `${prefix}-${hash.slice(0, 8)}`
}

function compactTimestampForWatermark(value) {
  const text = String(value || '')
  return text.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
}

function compactPayload(payload = {}) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  )
}

async function getSharp() {
  if (!sharpModulePromise) {
    sharpModulePromise = import('sharp')
      .then((module) => module.default || module)
      .catch((error) => {
        throw new ApiError(500, 'Biblioteca sharp não está disponível para watermark dinâmica.', {
          message: error.message,
        })
      })
  }

  return sharpModulePromise
}

function parseMissingColumn(error) {
  const message = String(error?.message || '')

  return (
    message.match(/Could not find the '([^']+)' column/)?.[1] ||
    message.match(/column "([^"]+)" of relation "[^"]+" does not exist/)?.[1] ||
    null
  )
}

function parseNullViolationColumn(error) {
  const message = String(error?.message || '')

  return message.match(/null value in column "([^"]+)"/)?.[1] || null
}


function buildAuditSupersetPayload({
  action,
  actorProfileId,
  auditMetadata,
  entityTable,
  entityId,
}) {
  const description = `${action} em ${entityTable}/${entityId}`

  return compactPayload({
    action,
    event: action,
    event_name: action,
    event_type: action,
    operation: action,
    activity: action,

    entity_type: entityTable,
    resource_type: entityTable,
    target_type: entityTable,
    target_table: entityTable,
    table_name: entityTable,
    record_table: entityTable,

    entity_id: entityId,
    resource_id: entityId,
    target_id: entityId,
    record_id: entityId,
    row_id: entityId,

    actor_profile_id: actorProfileId || null,
    profile_id: actorProfileId || null,
    user_id: actorProfileId || null,
    actor_id: actorProfileId || null,

    description,
    message: description,

    metadata: auditMetadata,
    details: auditMetadata,
    payload: auditMetadata,
    data: auditMetadata,
    context: auditMetadata,
    audit_payload: auditMetadata,
    change_payload: auditMetadata,
    changes: auditMetadata,

    old_values: auditMetadata.before || {},
    previous_values: auditMetadata.before || {},
    before: auditMetadata.before || {},

    new_values: auditMetadata.after || {},
    current_values: auditMetadata.after || {},
    after: auditMetadata.after || {},

    ip_address: auditMetadata?.requestContext?.ip || null,
    user_agent: auditMetadata?.requestContext?.userAgent || null,
    request_id: auditMetadata?.requestContext?.requestId || null,

    created_at: nowIso(),
  })
}

async function fillRequiredAuditColumn(payload, column, {
  action,
  actorProfileId,
  auditMetadata,
  entityTable,
  entityId,
}) {
  const normalized = String(column || '').toLowerCase()

  if (normalized.includes('action') || normalized.includes('event') || normalized.includes('operation') || normalized.includes('activity')) {
    payload[column] = action
    return true
  }

  if (normalized.includes('description') || normalized.includes('message')) {
    payload[column] = `${action} em ${entityTable}/${entityId}`
    return true
  }

  if (normalized.includes('table') || normalized.includes('entity_type') || normalized.includes('resource_type') || normalized.includes('target_type')) {
    payload[column] = entityTable
    return true
  }

  if (normalized.includes('metadata') || normalized.includes('details') || normalized.includes('payload') || normalized.includes('context') || normalized.includes('change') || normalized.includes('data')) {
    payload[column] = auditMetadata
    return true
  }

  if (normalized.includes('old') || normalized.includes('before') || normalized.includes('previous')) {
    payload[column] = auditMetadata.before || {}
    return true
  }

  if (normalized.includes('new') || normalized.includes('after') || normalized.includes('current')) {
    payload[column] = auditMetadata.after || {}
    return true
  }

  if (normalized.includes('profile') || normalized.includes('user') || normalized.includes('actor') || normalized.includes('admin')) {
    payload[column] = actorProfileId
    return Boolean(payload[column])
  }

  if ((normalized.includes('id') || normalized.endsWith('_uuid')) && normalized !== 'id') {
    payload[column] = entityId
    return true
  }

  if (normalized.includes('created') || normalized.includes('updated') || normalized.includes('at')) {
    payload[column] = nowIso()
    return true
  }

  return false
}

async function insertAdaptiveAuditLog({ action, actorProfileId, requestContext, entityTable, entityId, metadata = {} }) {
  const resolvedActorProfileId = actorProfileId
  const auditMetadata = {
    ...metadata,
    requestContext,
    before: metadata.before || {},
    after: metadata.after || {},
  }

  let payload = buildAuditSupersetPayload({
    action,
    actorProfileId: resolvedActorProfileId,
    auditMetadata,
    entityTable,
    entityId,
  })

  const errors = []

  for (let attempt = 1; attempt <= 80; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(AUDIT_TABLE)
      .insert(payload)
      .select('*')
      .maybeSingle()

    if (!error) {
      return data || payload
    }

    errors.push(error.message)

    const missingColumn = parseMissingColumn(error)
    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      delete payload[missingColumn]
      continue
    }

    const nullColumn = parseNullViolationColumn(error)
    if (nullColumn && !payload[nullColumn]) {
      const filled = await fillRequiredAuditColumn(payload, nullColumn, {
        action,
        actorProfileId: resolvedActorProfileId,
        auditMetadata,
        entityTable,
        entityId,
      })

      if (filled) continue
    }

    throw new ApiError(500, 'Erro ao inserir auditoria de acesso protegido.', {
      action,
      entityTable,
      entityId,
      payloadColumns: Object.keys(payload),
      error: error.message,
      previousErrors: errors.slice(-10),
    })
  }

  throw new ApiError(500, 'Erro ao inserir auditoria de acesso protegido após múltiplas tentativas.', {
    action,
    entityTable,
    entityId,
    errors: errors.slice(-20),
  })
}

function buildForensicContext({ asset, actorProfileId, requestContext, watermarkLabel }) {
  const timestamp = nowIso()
  const ip = requestContext?.ip || '0.0.0.0'
  const actor = actorProfileId || 'anonymous'
  const sessionId = crypto.randomUUID()

  return {
    sessionId,
    actorProfileId: actor,
    actorMasked: maskValue(actor, 4, 4),
    actorHash: hashText(actor),
    actorVisualCode: buildVisualForensicCode(actor, 'CONTA'),
    ipMasked: maskValue(ip, 3, 0),
    ipHash: hashText(ip),
    timestamp,
    watermarkTimestamp: compactTimestampForWatermark(timestamp),
    assetId: asset.id,
    assetVisualCode: buildVisualForensicCode(asset.id, 'MIDIA'),
    sessionVisualCode: buildVisualForensicCode(sessionId, 'SESSAO'),
    batchId: asset.batchId || asset.batch_id || null,
    batchItemId: asset.batchItemId || asset.batch_item_id || null,
    companionId: asset.companionId || asset.companion_id || null,
    watermarkLabel: watermarkLabel || 'PRIVACY IA',
  }
}

function buildWatermarkLines(forensic) {
  return [
    `${forensic.watermarkLabel} • VISUALIZAÇÃO PROTEGIDA`,
    `${forensic.actorVisualCode} • ${forensic.sessionVisualCode}`,
    `${forensic.assetVisualCode} • ${forensic.watermarkTimestamp}`,
  ]
}

function escapeXml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function buildWatermarkSvg({ width, height, lines }) {
  const safeWidth = Math.max(Number(width || 1024), 400)
  const safeHeight = Math.max(Number(height || 1024), 400)

  const lineBlock = lines
    .map((line, index) => `<text x="0" y="${index * 26}" font-size="22" fill="rgba(255,255,255,0.10)" font-family="Arial, Helvetica, sans-serif">${escapeXml(line)}</text>`)
    .join('')

  return `
  <svg width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="wm" width="420" height="180" patternUnits="userSpaceOnUse" patternTransform="rotate(-28)">
        <g opacity="1">
          ${lineBlock}
        </g>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#wm)" />
    <rect x="18" y="${safeHeight - 62}" rx="12" ry="12" width="${Math.min(safeWidth - 36, 760)}" height="44" fill="rgba(0,0,0,0.28)"/>
    <text x="32" y="${safeHeight - 34}" font-size="18" fill="rgba(255,255,255,0.65)" font-family="Arial, Helvetica, sans-serif">${escapeXml(lines.join(' • '))}</text>
  </svg>
  `
}

async function applyImageWatermark(buffer, forensic) {
  const sharp = await getSharp()
  const image = sharp(buffer)
  const metadata = await image.metadata()
  const width = metadata.width || 1024
  const height = metadata.height || 1024
  const lines = buildWatermarkLines(forensic)
  const svg = buildWatermarkSvg({ width, height, lines })

  return sharp(buffer)
    .composite([
      {
        input: Buffer.from(svg),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer()
}

function buildProtectionHeaders({
  forensic,
  contentType,
  contentLength,
  etag,
  lastModified,
  contentRange,
  acceptRanges = 'bytes',
  watermarkStatus = 'not-applied-for-media-type',
  mediaDisposition = 'inline',
  protectedStream = 'enabled',
}) {
  return {
    'Content-Type': contentType || 'application/octet-stream',
    'Content-Length': contentLength !== null && contentLength !== undefined ? String(contentLength) : null,
    'Accept-Ranges': acceptRanges || 'bytes',
    'Content-Range': contentRange || null,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    Pragma: 'no-cache',
    Expires: '0',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; object-src 'none'; frame-ancestors 'none'",
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), display-capture=()',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'Content-Disposition': `${mediaDisposition}; filename="privacy-protected-media"`,
    ETag: etag || null,
    'Last-Modified': lastModified || null,
    'X-Asset-View-Session': forensic.sessionId,
    'X-Asset-Viewer-Hash': forensic.actorHash,
    'X-Asset-IP-Hash': forensic.ipHash,
    'X-Visual-Watermark': watermarkStatus,
    'X-Protected-Stream': protectedStream,
  }
}

function isImageContentType(contentType = '') {
  return String(contentType || '').toLowerCase().startsWith('image/')
}

function isStreamableContentType(contentType = '') {
  const normalized = String(contentType || '').toLowerCase()
  return normalized.startsWith('video/') || normalized.startsWith('audio/')
}

function normalizeRangeHeader(value) {
  const range = String(value || '').trim()
  if (!range) return null

  if (!/^bytes=\d*-\d*$/i.test(range)) {
    throw new ApiError(416, 'Cabeçalho Range inválido para streaming protegido.', { range })
  }

  return range
}

async function readStreamToBuffer(bodyStream, maxBytes) {
  const chunks = []
  let total = 0

  for await (const chunk of bodyStream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.length

    if (total > maxBytes) {
      bodyStream.destroy?.()
      throw new ApiError(413, 'Imagem protegida excede o limite de processamento em memória.', {
        maxBytes,
      })
    }

    chunks.push(buffer)
  }

  return Buffer.concat(chunks)
}

function buildRequestContext(input = {}) {
  return {
    source: input.source || 'protected_media_backend',
    requestId: input.requestId || null,
    ip: input.ip || null,
    userAgent: input.userAgent || null,
  }
}

async function auditProtectedAccess({
  action,
  actorProfileId,
  requestContext,
  entityTable,
  entityId,
  mediaType,
  status,
  forensic,
  watermarkApplied,
  range,
  rangeHonored,
  deliveryMode,
  expiresIn,
  expiresAt,
  extra = {},
}) {
  return insertAdaptiveAuditLog({
    action,
    actorProfileId,
    requestContext,
    entityTable,
    entityId,
    metadata: {
      before: {
        status,
        media_type: mediaType,
      },
      after: {
        protected_view: true,
        protected_stream: true,
        watermark_applied: watermarkApplied,
        range_requested: range || null,
        range_honored: Boolean(rangeHonored),
        delivery_mode: deliveryMode,
        session_id: forensic.sessionId,
      },
      forensic: {
        sessionId: forensic.sessionId,
        actorHash: forensic.actorHash,
        actorVisualCode: forensic.actorVisualCode,
        ipHash: forensic.ipHash,
        assetVisualCode: forensic.assetVisualCode,
        sessionVisualCode: forensic.sessionVisualCode,
        timestamp: forensic.timestamp,
        watermarkApplied,
        rangeRequested: range || null,
        rangeHonored: Boolean(rangeHonored),
      },
      secureAccess: {
        expiresIn,
        expiresAt,
        deliveryMode,
      },
      ...extra,
    },
  })
}

export async function fetchProtectedAssetPayload(assetId, input = {}) {
  const actorProfileId = input.actorProfileId || input.profileId || input.userId || null
  if (!actorProfileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para acesso protegido de mídia.')
  }

  const requestContext = buildRequestContext(input)
  const preview = await createAdminSecureAssetPreview(assetId, {
    ...input,
    actorProfileId,
    includeSignedUrl: false,
  })
  const forensic = buildForensicContext({
    asset: preview.asset,
    actorProfileId,
    requestContext,
    watermarkLabel: input.watermarkLabel || 'PRIVACY IA',
  })

  const expectedMediaType = String(preview.asset?.mediaType || '').toLowerCase()
  const streamableByMetadata = ['video', 'audio', 'live_action', 'live_audio'].includes(expectedMediaType)
  const range = normalizeRangeHeader(input.range || input.rangeHeader || input.range_header || null)
  const abortController = new AbortController()

  const object = await getPrivateObjectStream({
    bucket: preview.access.bucket,
    key: preview.access.key,
    range: streamableByMetadata ? range : null,
    abortSignal: abortController.signal,
  })

  const contentType = object.contentType || 'application/octet-stream'
  const isImage = isImageContentType(contentType)
  const isStreamable = streamableByMetadata || isStreamableContentType(contentType)
  const rangeHonored = Boolean(object.contentRange)
  const statusCode = rangeHonored ? 206 : 200

  if (isImage) {
    const originalBuffer = await readStreamToBuffer(object.bodyStream, env.MEDIA_PROTECTED_IMAGE_MAX_BYTES)
    const outputBuffer = await applyImageWatermark(originalBuffer, forensic)
    const auditLog = await auditProtectedAccess({
      action: 'media.asset.protected_view',
      actorProfileId,
      requestContext,
      entityTable: 'media_asset_variants',
      entityId: preview.asset.id,
      mediaType: preview.asset.mediaType,
      status: preview.asset.status,
      forensic,
      watermarkApplied: true,
      range: null,
      rangeHonored: false,
      deliveryMode: 'backend_buffered_image',
      expiresIn: preview.access.expiresIn,
      expiresAt: preview.access.expiresAt,
    })

    return {
      kind: 'buffer',
      asset: preview.asset,
      forensic,
      protection: preview.protection,
      watermarkApplied: true,
      streamable: false,
      statusCode: 200,
      responseHeaders: buildProtectionHeaders({
        forensic,
        contentType: 'image/png',
        contentLength: outputBuffer.length,
        watermarkStatus: 'dynamic-image-watermark-enabled',
        protectedStream: 'buffered-image',
      }),
      buffer: outputBuffer,
      sizeBytes: outputBuffer.length,
      auditLog: {
        id: auditLog?.id || null,
        action: auditLog?.action || 'media.asset.protected_view',
      },
    }
  }

  if (!isStreamable) {
    abortController.abort()
    throw new ApiError(415, 'Tipo de mídia não suportado para entrega protegida.', {
      assetId,
      contentType,
    })
  }

  const auditLog = await auditProtectedAccess({
    action: 'media.asset.protected_stream',
    actorProfileId,
    requestContext,
    entityTable: 'media_asset_variants',
    entityId: preview.asset.id,
    mediaType: preview.asset.mediaType,
    status: preview.asset.status,
    forensic,
    watermarkApplied: false,
    range,
    rangeHonored,
    deliveryMode: 'backend_stream_pipe',
    expiresIn: preview.access.expiresIn,
    expiresAt: preview.access.expiresAt,
  })

  return {
    kind: 'stream',
    asset: preview.asset,
    forensic,
    protection: preview.protection,
    watermarkApplied: false,
    streamable: true,
    rangeRequested: range,
    rangeHonored,
    statusCode,
    responseHeaders: buildProtectionHeaders({
      forensic,
      contentType,
      contentLength: object.contentLength,
      etag: object.etag,
      lastModified: object.lastModified,
      contentRange: object.contentRange,
      acceptRanges: object.acceptRanges,
      watermarkStatus: 'source-rendition-or-legacy',
      protectedStream: 'backend-pipe',
    }),
    bodyStream: object.bodyStream,
    abort: () => abortController.abort(),
    auditLog: {
      id: auditLog?.id || null,
      action: auditLog?.action || 'media.asset.protected_stream',
    },
  }
}

export async function fetchProtectedRenditionPayload(rendition, input = {}) {
  const actorProfileId = input.actorProfileId || input.profileId || input.userId || null
  if (!actorProfileId) {
    throw new ApiError(401, 'Perfil autenticado obrigatório para acesso protegido de rendition.')
  }

  if (!rendition?.id) throw new ApiError(404, 'Rendition ausente para entrega protegida.')

  const requestContext = buildRequestContext(input)
  const forensicAsset = {
    id: rendition.id,
    mediaType: rendition.rendition_type,
    companionId: input.asset?.companion_id || input.asset?.companionId || null,
    combinationId: input.asset?.combination_id || input.asset?.combinationId || null,
  }
  const forensic = buildForensicContext({
    asset: forensicAsset,
    actorProfileId,
    requestContext,
    watermarkLabel: input.watermarkLabel || 'PRIVACY IA',
  })
  const abortController = new AbortController()

  if (rendition.rendition_type === 'hls_stream') {
    const secure = await createSecureHlsManifestAccess(rendition.id, {
      expiresIn: input.expiresIn,
      abortSignal: abortController.signal,
    })
    const auditLog = await auditProtectedAccess({
      action: 'media.rendition.protected_hls_manifest',
      actorProfileId,
      requestContext,
      entityTable: 'media_asset_renditions',
      entityId: rendition.id,
      mediaType: 'hls_stream',
      status: rendition.status,
      forensic,
      watermarkApplied: true,
      range: null,
      rangeHonored: false,
      deliveryMode: 'hls_signed_segments',
      expiresIn: secure.access.expiresIn,
      expiresAt: secure.access.expiresAt,
      extra: {
        hls: {
          segmentCount: secure.segmentCount,
          manifestByteSize: secure.manifestByteSize,
        },
      },
    })

    return {
      kind: 'manifest',
      rendition: secure.rendition,
      forensic,
      protection: secure.protection,
      watermarkApplied: true,
      streamable: true,
      statusCode: 200,
      responseHeaders: buildProtectionHeaders({
        forensic,
        contentType: secure.contentType,
        contentLength: secure.manifestByteSize,
        acceptRanges: 'none',
        watermarkStatus: 'platform-watermark-in-rendition',
        protectedStream: 'hls-signed-segments',
      }),
      manifest: secure.manifest,
      abort: () => abortController.abort(),
      auditLog: {
        id: auditLog?.id || null,
        action: auditLog?.action || 'media.rendition.protected_hls_manifest',
      },
    }
  }

  const secure = await createSecureRenditionReadAccess(rendition.id, {
    expiresIn: input.expiresIn,
    expectedTypes: ['preview', 'forensic_watermark'],
  })
  const range = normalizeRangeHeader(input.range || null)
  const object = await getPrivateObjectStream({
    bucket: secure.access.bucket,
    key: secure.access.key,
    range,
    abortSignal: abortController.signal,
  })
  const rangeHonored = Boolean(object.contentRange)
  const auditLog = await auditProtectedAccess({
    action: 'media.rendition.protected_stream',
    actorProfileId,
    requestContext,
    entityTable: 'media_asset_renditions',
    entityId: rendition.id,
    mediaType: rendition.rendition_type,
    status: rendition.status,
    forensic,
    watermarkApplied: true,
    range,
    rangeHonored,
    deliveryMode: 'backend_stream_pipe',
    expiresIn: secure.access.expiresIn,
    expiresAt: secure.access.expiresAt,
  })

  return {
    kind: 'stream',
    rendition: secure.rendition,
    forensic,
    protection: secure.protection,
    watermarkApplied: true,
    streamable: true,
    rangeRequested: range,
    rangeHonored,
    statusCode: rangeHonored ? 206 : 200,
    responseHeaders: buildProtectionHeaders({
      forensic,
      contentType: object.contentType,
      contentLength: object.contentLength,
      etag: object.etag,
      lastModified: object.lastModified,
      contentRange: object.contentRange,
      acceptRanges: object.acceptRanges,
      watermarkStatus: 'platform-or-forensic-rendition',
      protectedStream: 'backend-pipe',
    }),
    bodyStream: object.bodyStream,
    abort: () => abortController.abort(),
    auditLog: {
      id: auditLog?.id || null,
      action: auditLog?.action || 'media.rendition.protected_stream',
    },
  }
}
