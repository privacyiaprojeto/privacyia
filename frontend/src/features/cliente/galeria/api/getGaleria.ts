import { api } from '@/shared/lib/axios'
import { env } from '@/shared/lib/env'
import type { GaleriaEntrega, GaleriaEntregasResponse } from '@/features/cliente/galeria/types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

function toAbsoluteApiUrl(url?: string | null) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url

  const base = env.VITE_API_URL.replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

function normalizeMediaContract(item: GaleriaEntrega) {
  if (!item.mediaContract) return null

  return {
    mediaType: item.mediaContract.mediaType || null,
    clientSupported: Boolean(item.mediaContract.clientSupported),
    clientOpenable: Boolean(item.mediaContract.clientOpenable),
    clientPurchasable: Boolean(item.mediaContract.clientPurchasable),
    protectedRenderer: item.mediaContract.protectedRenderer || null,
    reasonCode: item.mediaContract.reasonCode || null,
    severity: item.mediaContract.severity || null,
    userMessage: item.mediaContract.userMessage || null,
  }
}

function normalizeEntrega(item: GaleriaEntrega): GaleriaEntrega {
  return {
    ...item,
    protectedViewUrl: toAbsoluteApiUrl(item.protectedViewUrl),
    mediaPlayback: item.mediaPlayback ? {
      mediaStatus: item.mediaPlayback.mediaStatus || 'unavailable',
      streamKind: item.mediaPlayback.streamKind || null,
      userMessage: item.mediaPlayback.userMessage || null,
    } : null,
    mediaContract: normalizeMediaContract(item),
    pricing: {
      totalPriceCredits: Number(item.pricing?.totalPriceCredits || 0),
      companionCreditsUsed: Number(item.pricing?.companionCreditsUsed || 0),
      universalCreditsUsed: Number(item.pricing?.universalCreditsUsed || 0),
    },
    combination: {
      ...item.combination,
      signaturePath: item.combination?.signaturePath || [],
      signature: item.combination?.signature || [],
    },
  }
}

export async function getGaleria(q?: string): Promise<GaleriaEntregasResponse> {
  const { data } = await api.get<ApiEnvelope<GaleriaEntregasResponse>>('/media/deliveries', {
    params: {
      limit: 60,
      ...(q ? { q } : {}),
    },
  })

  const result = data.data || { items: [], pagination: { limit: 60, offset: 0, returned: 0, hasMore: false } }
  const rawItems = result.items || []
  const normalizedItems = rawItems.map(normalizeEntrega)
  const query = String(q || '').trim().toLowerCase()

  return {
    ...result,
    items: query
      ? normalizedItems.filter((item) => {
          const haystack = [
            item.companion?.name,
            item.combination?.title,
            item.combination?.mediaType,
            ...(item.combination?.signaturePath || []),
          ].filter(Boolean).join(' ').toLowerCase()
          return haystack.includes(query)
        })
      : normalizedItems,
  }
}
