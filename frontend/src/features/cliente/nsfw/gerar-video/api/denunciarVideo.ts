import { api } from '@/shared/lib/axios'

export async function denunciarVideo(id: string): Promise<void> {
  await api.post(`/nsfw/video/${id}/denunciar`, { motivo: 'Resultado defeituoso ou corrompido' })
}
