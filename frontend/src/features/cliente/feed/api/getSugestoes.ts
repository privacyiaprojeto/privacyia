import { api } from '@/shared/lib/axios'
import type { AtrizPerfil } from '@/shared/types/atriz'

function normalizeText(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isInternalTestAvatar(atriz: Partial<AtrizPerfil>) {
  const text = [atriz.nome, atriz.slug, atriz.id]
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

function unwrap(data: unknown): AtrizPerfil[] {
  if (Array.isArray(data)) return data as AtrizPerfil[]
  if (data && typeof data === 'object') {
    const envelope = data as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as AtrizPerfil[]
    if (Array.isArray(envelope.items)) return envelope.items as AtrizPerfil[]
    if (Array.isArray(envelope.results)) return envelope.results as AtrizPerfil[]
  }
  return []
}

export async function getSugestoes(): Promise<AtrizPerfil[]> {
  const { data } = await api.get<unknown>('/feed/sugestoes')
  return unwrap(data).filter((atriz) => !isInternalTestAvatar(atriz))
}
