import { api } from '@/shared/lib/axios'
import type { Atriz } from '@/shared/types/atriz'

type RawAtriz = Partial<Atriz> & {
  name?: string
  avatar_url?: string | null
  banner_url?: string | null
  video_url?: string | null
  bio?: string | null
  age?: number | null
  height_label?: string | null
  gallery_urls?: string[] | null
  thumbnail_url?: string | null
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}


function isInternalTestAvatar(raw: RawAtriz) {
  const text = [raw.nome, raw.name, raw.slug, raw.id]
    .map((value) => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
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

function normalizeAtriz(raw: RawAtriz): Atriz {
  const id = String(raw.id)
  const nome = raw.nome ?? raw.name ?? 'Criadora'
  const thumbnailUrl = raw.thumbnailUrl ?? raw.thumbnail_url ?? null
  const avatar = raw.avatar ?? raw.avatar_url ?? thumbnailUrl ?? ''
  const banner = raw.banner ?? raw.banner_url ?? thumbnailUrl ?? avatar
  const videoUrl = raw.videoUrl ?? raw.video_url ?? banner ?? avatar

  return {
    id,
    // Lógica solicitada por Lorenzo: preserva o ID real; slug segue apenas como dado visual/fallback.
    slug: raw.slug || toSlug(nome) || id,
    nome,
    avatar,
    banner,
    videoUrl,
    descricao: raw.descricao ?? raw.bio ?? '',
    idade: raw.idade ?? raw.age ?? 0,
    altura: raw.altura ?? raw.height_label ?? '',
    fotos: raw.fotos ?? raw.gallery_urls ?? [],
    thumbnailUrl,
    isFallback: false,
  }
}

function unwrapAtrizes(raw: unknown): RawAtriz[] {
  if (Array.isArray(raw)) return raw as RawAtriz[]

  if (raw && typeof raw === 'object') {
    const envelope = raw as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as RawAtriz[]
    if (Array.isArray(envelope.items)) return envelope.items as RawAtriz[]
    if (Array.isArray(envelope.results)) return envelope.results as RawAtriz[]
  }

  return []
}

export async function getAtrizes(): Promise<Atriz[]> {
  const { data } = await api.get<unknown>('/atrizes')
  return unwrapAtrizes(data)
    .filter((item) => !isInternalTestAvatar(item))
    .map(normalizeAtriz)
}
