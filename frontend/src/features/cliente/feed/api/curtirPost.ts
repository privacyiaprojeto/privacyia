import { api } from '@/shared/lib/axios'

export async function curtirPost(postId: string): Promise<{ curtido: boolean; curtidas: number }> {
  const { data } = await api.post(`/feed/posts/${postId}/curtir`)
  return data
}
