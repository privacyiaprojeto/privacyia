import { api } from '@/shared/lib/axios'
import type { AtrizPerfilPublico, ClientMediaContract, LiveActionItem, LiveAudioItem } from '@/features/cliente/atriz-perfil/types'

type AnyRecord = Record<string, any>

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === 'object' ? value as AnyRecord : {}
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function firstBoolean(...values: unknown[]): boolean | null {
  for (const value of values) {
    if (typeof value === 'boolean') return value
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase()
      if (normalized === 'true') return true
      if (normalized === 'false') return false
    }
  }

  return null
}

function normalizeMediaContract(rawValue: unknown): ClientMediaContract | null {
  const raw = asRecord(rawValue)

  if (Object.keys(raw).length === 0) return null

  const reasonCode = firstString(raw.reasonCode, raw.reason_code, raw.code)
  const severity = firstString(raw.severity, raw.level)
  const mediaType = firstString(raw.mediaType, raw.media_type)
  const protectedRenderer = firstString(raw.protectedRenderer, raw.protected_renderer, raw.renderer)
  const userMessage = firstString(raw.userMessage, raw.user_message, raw.message)
  const clientSupported = firstBoolean(raw.clientSupported, raw.client_supported)
  const clientOpenable = firstBoolean(raw.clientOpenable, raw.client_openable)
  const clientPurchasable = firstBoolean(raw.clientPurchasable, raw.client_purchasable)

  if (
    !reasonCode &&
    !severity &&
    !mediaType &&
    !protectedRenderer &&
    userMessage === null &&
    clientSupported === null &&
    clientOpenable === null &&
    clientPurchasable === null
  ) {
    return null
  }

  return {
    mediaType,
    clientSupported,
    clientOpenable,
    clientPurchasable,
    protectedRenderer,
    reasonCode,
    severity,
    userMessage,
  }
}

function normalizeLiveAudioItem(item: LiveAudioItem): LiveAudioItem {
  const raw = asRecord(item)
  const mediaContract = normalizeMediaContract(raw.mediaContract || raw.media_contract || raw.contract)

  return {
    ...item,
    mediaContract: mediaContract || item.mediaContract || null,
  }
}

function normalizeLiveActionItem(item: LiveActionItem): LiveActionItem {
  const raw = asRecord(item)
  const mediaContract = normalizeMediaContract(raw.mediaContract || raw.media_contract || raw.contract)

  return {
    ...item,
    mediaContract: mediaContract || item.mediaContract || null,
  }
}

function normalizePerfil(raw: Partial<AtrizPerfilPublico>): AtrizPerfilPublico {
  const avatar = raw.avatar || raw.banner || raw.videoUrl || ''
  const banner = raw.banner || raw.videoUrl || avatar
  const videoUrl = raw.videoUrl || banner || avatar
  const fotos = raw.fotos?.length ? raw.fotos : [avatar, banner, videoUrl].filter(Boolean)

  return {
    id: String(raw.id),
    slug: raw.slug || String(raw.id),
    nome: raw.nome || 'Companion',
    avatar,
    banner,
    videoUrl,
    descricao: raw.descricao || 'Perfil premium da companion.',
    idade: raw.idade || 0,
    altura: raw.altura || '',
    fotos,
    assinaturaAtiva: raw.assinaturaAtiva ?? true,
    online: raw.online ?? true,
    totalConteudos: raw.totalConteudos || fotos.length,
    totalChats: raw.totalChats || 0,
    seguidores: raw.seguidores || 0,
    nivelAtual: raw.nivelAtual || 1,
    xpAtual: raw.xpAtual || 0,
    xpProximoNivel: raw.xpProximoNivel || 100,
    liveActions: (raw.liveActions || []).map(normalizeLiveActionItem),
    liveAudios: (raw.liveAudios || []).map(normalizeLiveAudioItem),
    historico: raw.historico || [],
  }
}

function unwrapProfile(raw: unknown): Partial<AtrizPerfilPublico> {
  if (!raw || typeof raw !== 'object') return {}
  const envelope = raw as { data?: unknown }
  return envelope.data && typeof envelope.data === 'object'
    ? envelope.data as Partial<AtrizPerfilPublico>
    : raw as Partial<AtrizPerfilPublico>
}

export async function getAtrizPerfilPublico(identifier: string): Promise<AtrizPerfilPublico> {
  const { data } = await api.get<unknown>(`/atrizes/${encodeURIComponent(identifier)}`)
  return normalizePerfil(unwrapProfile(data))
}
