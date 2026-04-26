import { api } from '@/shared/lib/axios'
import type { AssinantesResumo } from '@/features/atriz/assinantes/types'

export async function getAssinantes(): Promise<AssinantesResumo> {
  const { data } = await api.get<AssinantesResumo>('/atriz/painel/assinantes')
  return data
}
