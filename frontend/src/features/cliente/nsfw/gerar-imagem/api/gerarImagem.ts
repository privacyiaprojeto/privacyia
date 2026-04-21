import { api } from '@/shared/lib/axios'
import type { GerarImagemInput, GerarImagemResponse } from '@/features/cliente/nsfw/gerar-imagem/types'

export async function gerarImagem(input: GerarImagemInput): Promise<GerarImagemResponse> {
  const { data } = await api.post<GerarImagemResponse>('/nsfw/imagem/gerar', input)
  return data
}
