import { api } from '@/shared/lib/axios'
import type { PacoteCreditos } from '@/features/cliente/carteira/types'

export async function getPacotes(): Promise<PacoteCreditos[]> {
  const { data } = await api.get<PacoteCreditos[]>('/carteira/pacotes')
  return data
}
