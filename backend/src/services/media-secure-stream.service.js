import { ApiError } from '../utils/apiError.js'
import { createAdminSecureAssetPreview } from './media-secure-access.service.js'

function toPlainHeaders(headers) {
  const result = {}

  if (!headers || typeof headers.forEach !== 'function') {
    return result
  }

  headers.forEach((value, key) => {
    result[String(key).toLowerCase()] = value
  })

  return result
}

function buildResponseHeaders(upstreamHeaders = {}, asset) {
  return {
    contentType: upstreamHeaders['content-type'] || 'application/octet-stream',
    contentLength: upstreamHeaders['content-length'] || null,
    etag: upstreamHeaders.etag || null,
    lastModified: upstreamHeaders['last-modified'] || null,
    cacheControl: 'no-store, no-cache, must-revalidate, private',
    contentDisposition: `inline; filename="${asset.id}-${asset.variantNumber || 1}"`,
    contentSecurityPolicy: "default-src 'none'; img-src 'self' data: blob: https:; media-src 'self' blob: https:; object-src 'none'; frame-ancestors 'none'",
  }
}

export async function fetchSecureAssetProxyPayload(assetId, input = {}) {
  const preview = await createAdminSecureAssetPreview(assetId, input)

  const response = await fetch(preview.access.url, {
    method: 'GET',
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new ApiError(502, 'Falha ao buscar conteúdo assinado do R2 para proxy seguro.', {
      assetId,
      status: response.status,
      statusText: response.statusText,
    })
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const upstreamHeaders = toPlainHeaders(response.headers)
  const responseHeaders = buildResponseHeaders(upstreamHeaders, preview.asset)

  return {
    asset: preview.asset,
    protection: preview.protection,
    upstream: {
      status: response.status,
      ok: response.ok,
      headers: upstreamHeaders,
    },
    responseHeaders,
    buffer,
    sizeBytes: buffer.length,
  }
}
