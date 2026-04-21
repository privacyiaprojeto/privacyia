import { api } from '@/shared/lib/axios'
import type { Post } from '@/features/cliente/feed/types'

export async function getFeedPosts(): Promise<Post[]> {
  const { data } = await api.get<Post[]>('/feed/posts')
  return data
}
