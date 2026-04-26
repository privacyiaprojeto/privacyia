import { api } from '@/shared/lib/axios'
import type { Secao } from '@/features/cliente/descobrir/types'

export async function getSecoes(): Promise<Secao[]> {
  const { data } = await api.get<Secao[]>('/descobrir/secoes')
  return data
}