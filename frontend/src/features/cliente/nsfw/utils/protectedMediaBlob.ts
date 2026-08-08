/**
 * Compatibilidade P4: o antigo carregador baixava o arquivo inteiro como Blob.
 * O playback protegido agora é resolvido por token curto + streaming/HLS.
 */
export function isProtectedViewUrl(url?: string | null) {
  if (!url) return false
  return (
    (url.includes('/media/deliveries/') && url.includes('/protected-view')) ||
    (url.includes('/media/catalog-products/') && url.includes('/preview'))
  )
}

export function getCachedProtectedMediaBlobUrl(_url?: string | null) {
  return null
}

export async function loadProtectedMediaBlobUrl(url: string) {
  return url
}

export function preloadProtectedMediaBlobUrl(_url?: string | null) {
  // Intencionalmente vazio: não fazemos mais download integral antecipado.
}
