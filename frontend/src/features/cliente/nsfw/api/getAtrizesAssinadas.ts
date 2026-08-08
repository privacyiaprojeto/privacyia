import { api } from '@/shared/lib/axios'
import type { AtrizAssinada } from '@/features/cliente/nsfw/types'

type RawAtrizAssinada = Partial<AtrizAssinada> & {
  name?: string | null
  avatar_url?: string | null
  banner_url?: string | null
  thumbnail_url?: string | null
  companion?: RawAtrizAssinada | null
  companions?: RawAtrizAssinada | null
}

function normalizeText(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isInternalTestAvatar(raw: RawAtrizAssinada) {
  const text = [raw.nome, raw.name, raw.id]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')

  return (
    text.includes('avatar teste') ||
    text.includes('avatar-teste') ||
    text.includes('teste 6.0') ||
    text.includes('teste-6-0') ||
    text.includes('teste_6_0') ||
    text.includes('sprint 6.0') ||
    text.includes('sprint-6-0')
  )
}

function unwrapResponse(data: unknown): RawAtrizAssinada[] {
  if (Array.isArray(data)) return data as RawAtrizAssinada[]
  if (data && typeof data === 'object') {
    const maybeEnvelope = data as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(maybeEnvelope.data)) return maybeEnvelope.data as RawAtrizAssinada[]
    if (Array.isArray(maybeEnvelope.items)) return maybeEnvelope.items as RawAtrizAssinada[]
    if (Array.isArray(maybeEnvelope.results)) return maybeEnvelope.results as RawAtrizAssinada[]
  }
  return []
}

function normalizeAtriz(raw: RawAtrizAssinada): AtrizAssinada | null {
  const companion = raw.companions || raw.companion || raw
  const id = String(companion.id || raw.id || '')
  if (!id) return null

  const nome = companion.nome || companion.name || raw.nome || raw.name || 'Avatar'
  const avatar = companion.avatar || companion.avatarUrl || companion.avatar_url || companion.thumbnail_url || companion.banner_url || ''

  return {
    id,
    nome,
    avatar,
    avatarUrl: companion.avatarUrl || avatar,
  }
}

export async function getAtrizesAssinadas(): Promise<AtrizAssinada[]> {
  const { data } = await api.get<unknown>('/nsfw/atrizes-assinadas')
  const unique = new Map<string, AtrizAssinada>()

  for (const raw of unwrapResponse(data)) {
    const item = normalizeAtriz(raw)
    if (!item || isInternalTestAvatar(item)) continue
    unique.set(item.id, item)
  }

  return Array.from(unique.values())
}
