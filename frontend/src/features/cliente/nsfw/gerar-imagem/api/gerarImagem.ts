import { api } from '@/shared/lib/axios'
import { claimDynamicPromptImagem } from '@/features/cliente/nsfw/gerar-imagem/api/dynamicPromptImagem'
import type { GerarImagemInput, GerarImagemResponse } from '@/features/cliente/nsfw/gerar-imagem/types'

export async function gerarImagem(input: GerarImagemInput): Promise<GerarImagemResponse> {
  if (input.dynamicClaim) {
    return claimDynamicPromptImagem({
      companionId: input.atrizId,
      mediaType: 'imagem',
      selections: input.dynamicSelections || [],
      combinationId: input.combinationId || null,
    })
  }

  const { data } = await api.post<GerarImagemResponse>('/nsfw/imagem/gerar', input)
  return data
}
