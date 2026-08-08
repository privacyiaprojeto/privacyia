import { api } from '@/shared/lib/axios'
import type { Post } from '@/features/cliente/feed/types'

function unwrapPosts(raw: unknown): Post[] {
  if (Array.isArray(raw)) return raw as Post[]

  if (raw && typeof raw === 'object') {
    const envelope = raw as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as Post[]
    if (Array.isArray(envelope.items)) return envelope.items as Post[]
    if (Array.isArray(envelope.results)) return envelope.results as Post[]
  }

  return []
}

export async function getFeedPosts(): Promise<Post[]> {
  const { data } = await api.get<unknown>('/feed/posts')
  return unwrapPosts(data)
}
