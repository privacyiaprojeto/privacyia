import { api } from '@/shared/lib/axios'
import type { GerarVideoInput, GerarVideoResponse } from '@/features/cliente/nsfw/gerar-video/types'

export async function gerarVideo(input: GerarVideoInput): Promise<GerarVideoResponse> {
  const { data } = await api.post<GerarVideoResponse>('/nsfw/video/gerar', input)
  return data
}
