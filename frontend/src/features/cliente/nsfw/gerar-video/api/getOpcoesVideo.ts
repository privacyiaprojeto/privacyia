import { api } from '@/shared/lib/axios'
import type { OpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

export async function getOpcoesVideo(atrizId?: string | null): Promise<OpcaoVideo[]> {
  const { data } = await api.get<OpcaoVideo[]>('/nsfw/video/opcoes', {
    params: atrizId ? { atrizId } : undefined,
  })
  return data
}
