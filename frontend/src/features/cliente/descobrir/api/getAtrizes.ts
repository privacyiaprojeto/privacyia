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

function normalizeAtriz(raw: RawAtriz): Atriz {
  const id = String(raw.id)
  const nome = raw.nome ?? raw.name ?? 'Criadora'
  const thumbnailUrl = raw.thumbnailUrl ?? raw.thumbnail_url ?? null
  const avatar = raw.avatar ?? raw.avatar_url ?? thumbnailUrl ?? ''
  const banner = raw.banner ?? raw.banner_url ?? thumbnailUrl ?? avatar
  const videoUrl = raw.videoUrl ?? raw.video_url ?? banner ?? avatar

  return {
    id,
    /**
     * Importante:
     * O slug visual pode existir, mas os cards devem navegar usando o ID real do Supabase.
     * Assim a página de perfil recebe um UUID válido e o botão de chat fica habilitado.
     */
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

export async function getAtrizes(): Promise<Atriz[]> {
  const { data } = await api.get<RawAtriz[]>('/atrizes')
  return Array.isArray(data) ? data.map(normalizeAtriz) : []
}
