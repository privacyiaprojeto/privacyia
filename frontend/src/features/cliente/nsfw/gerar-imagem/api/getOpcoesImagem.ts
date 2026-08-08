import { api } from '@/shared/lib/axios'
import type { OpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'

function unwrapOptions(data: unknown): OpcaoImagem[] {
  if (Array.isArray(data)) return data as OpcaoImagem[]
  if (data && typeof data === 'object') {
    const envelope = data as { data?: unknown; items?: unknown; results?: unknown }
    if (Array.isArray(envelope.data)) return envelope.data as OpcaoImagem[]
    if (Array.isArray(envelope.items)) return envelope.items as OpcaoImagem[]
    if (Array.isArray(envelope.results)) return envelope.results as OpcaoImagem[]
  }
  return []
}

export async function getOpcoesImagem(atrizId?: string | null): Promise<OpcaoImagem[]> {
  if (!atrizId) return []

  const { data } = await api.get<unknown>('/nsfw/imagem/opcoes', {
    params: { atrizId },
  })

  return unwrapOptions(data)
}
