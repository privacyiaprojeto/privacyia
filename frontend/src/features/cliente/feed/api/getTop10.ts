import { api } from '@/shared/lib/axios'
import type { Top10Item } from '@/features/cliente/feed/types'

function normalizeText(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isInternalTestAvatar(item: Top10Item) {
  const atriz = item.atriz || {}
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

function unwrap(data: unknown): Top10Item[] {
  if (Array.isArray(data)) return data as Top10Item[]
  if (data && typeof data === 'object') {
    const envelope = data as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as Top10Item[]
    if (Array.isArray(envelope.items)) return envelope.items as Top10Item[]
    if (Array.isArray(envelope.results)) return envelope.results as Top10Item[]
  }
  return []
}

export async function getTop10(): Promise<Top10Item[]> {
  const { data } = await api.get<unknown>('/feed/top10')
  return unwrap(data)
    .filter((item) => !isInternalTestAvatar(item))
    .map((item, index) => ({ ...item, posicao: index + 1 }))
}
