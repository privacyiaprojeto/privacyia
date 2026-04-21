import { api } from '@/shared/lib/axios'
import type { OpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'

export async function getOpcoesImagem(): Promise<OpcaoImagem[]> {
  const { data } = await api.get<OpcaoImagem[]>('/nsfw/imagem/opcoes')
  return data
}
