import { api } from '@/shared/lib/axios'

export async function denunciarImagem(id: string): Promise<void> {
  await api.post(`/nsfw/imagem/${id}/denunciar`, { motivo: 'Resultado defeituoso' })
}
