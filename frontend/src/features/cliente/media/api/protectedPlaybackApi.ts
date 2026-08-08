import { api } from '@/shared/lib/axios'
import { env } from '@/shared/lib/env'

export type MediaAvailabilityStatus = 'processing' | 'ready' | 'unavailable'
export type MediaStreamKind = 'hls' | 'progressive' | 'audio' | 'image' | null

export interface ProtectedPlaybackAccess {
  mediaStatus: MediaAvailabilityStatus
  streamKind: MediaStreamKind
  mediaType?: string | null
  playbackUrl?: string | null
  expiresAt?: string | null
  expiresIn?: number | null
  userMessage?: string | null
}

interface ApiEnvelope<T> {
  success?: boolean
  data?: T
}

function toAbsoluteApiUrl(url?: string | null) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  const base = env.VITE_API_URL.replace(/\/$/, '')
  return `${base}${url.startsWith('/') ? url : `/${url}`}`
}

function pathnameFromSource(sourceUrl: string) {
  if (/^https?:\/\//i.test(sourceUrl)) return new URL(sourceUrl).pathname
  return sourceUrl.split('?')[0]
}

export function isProtectedPlaybackSource(url?: string | null) {
  if (!url) return false
  const path = pathnameFromSource(url)
  return (
    (/^\/media\/deliveries\/[^/]+\/protected-view$/.test(path)) ||
    (/^\/media\/catalog-products\/[^/]+\/preview$/.test(path))
  )
}

function accessEndpointFromSource(sourceUrl: string) {
  const path = pathnameFromSource(sourceUrl)
  const delivery = path.match(/^\/media\/deliveries\/([^/]+)\/protected-view$/)
  if (delivery) return `/media/deliveries/${encodeURIComponent(delivery[1])}/playback-access`

  const catalog = path.match(/^\/media\/catalog-products\/([^/]+)\/preview$/)
  if (catalog) return `/media/catalog-products/${encodeURIComponent(catalog[1])}/playback-access`

  return null
}

export async function requestProtectedPlaybackAccess(sourceUrl: string): Promise<ProtectedPlaybackAccess> {
  const endpoint = accessEndpointFromSource(sourceUrl)
  if (!endpoint) {
    return {
      mediaStatus: 'ready',
      streamKind: sourceUrl.toLowerCase().includes('.m3u8') ? 'hls' : null,
      playbackUrl: toAbsoluteApiUrl(sourceUrl),
      userMessage: 'Disponível.',
    }
  }

  const response = await api.get<ApiEnvelope<ProtectedPlaybackAccess>>(endpoint, {
    validateStatus: (status) => status >= 200 && status < 500,
  })
  const payload = response.data?.data || (response.data as unknown as ProtectedPlaybackAccess)

  if (!payload || !payload.mediaStatus) {
    throw new Error('Backend não retornou o contrato de playback protegido.')
  }

  return {
    ...payload,
    playbackUrl: toAbsoluteApiUrl(payload.playbackUrl),
  }
}
