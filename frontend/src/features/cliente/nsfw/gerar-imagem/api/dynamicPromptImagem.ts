import { api } from '@/shared/lib/axios'
import { env } from '@/shared/lib/env'
import type {
  DynamicPromptClaimInput,
  DynamicPromptClaimResult,
  DynamicPromptOptionsInput,
  DynamicPromptOptionsResult,
  DynamicPromptPrepareInput,
  DynamicPromptPrepareResult,
  GerarImagemResponse,
} from '@/features/cliente/nsfw/gerar-imagem/types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

function toAbsoluteApiUrl(url?: string | null) {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

  const base = env.VITE_API_URL.replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

export async function getDynamicPromptOptionsImagem(
  input: DynamicPromptOptionsInput,
): Promise<DynamicPromptOptionsResult> {
  const { data } = await api.post<ApiEnvelope<DynamicPromptOptionsResult>>('/media/dynamic-prompts/options', {
    companionId: input.companionId,
    mediaType: input.mediaType || 'imagem',
    selections: input.selections || [],
  })

  return data.data
}

export async function prepareDynamicPromptImagem(
  input: DynamicPromptPrepareInput,
): Promise<DynamicPromptPrepareResult> {
  const { data } = await api.post<ApiEnvelope<DynamicPromptPrepareResult>>('/media/dynamic-prompts/prepare-selection', {
    companionId: input.companionId,
    mediaType: input.mediaType || 'imagem',
    selections: input.selections || [],
    combinationId: input.combinationId || null,
  })

  return data.data
}

export async function claimDynamicPromptImagem(
  input: DynamicPromptClaimInput,
): Promise<GerarImagemResponse> {
  const { data } = await api.post<ApiEnvelope<DynamicPromptClaimResult>>('/media/dynamic-prompts/claim-selection', {
    companionId: input.companionId,
    mediaType: input.mediaType || 'imagem',
    selections: input.selections || [],
    combinationId: input.combinationId || null,
    deliverySource: 'cliente_prompt_dinamico',
  })

  const result = data.data
  return {
    id: result.deliveryId,
    status: 'concluido',
    progresso: 100,
    url: toAbsoluteApiUrl(result.protectedViewUrl),
    message: result.alreadyDelivered
      ? 'Mídia já comprada anteriormente. Nenhuma nova cobrança foi feita.'
      : 'Mídia liberada com sucesso e adicionada à sua biblioteca.',
    charged: Boolean(result.charged),
    alreadyDelivered: Boolean(result.alreadyDelivered),
    deliveryId: result.deliveryId,
    protectedViewUrl: result.protectedViewUrl,
    price: result.price,
    balance: result.balance,
    signature: result.signature,
  }
}
