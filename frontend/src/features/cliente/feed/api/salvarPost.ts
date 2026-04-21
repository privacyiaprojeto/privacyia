import { api } from '@/shared/lib/axios'

export async function salvarPost(postId: string): Promise<{ salvo: boolean }> {
  const { data } = await api.post(`/feed/posts/${postId}/salvar`)
  return data
}
