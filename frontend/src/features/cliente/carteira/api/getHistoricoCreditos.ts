import { api } from '@/shared/lib/axios'
import type { TransacaoCredito } from '@/features/cliente/carteira/types'

export async function getHistoricoCreditos(): Promise<TransacaoCredito[]> {
  const { data } = await api.get<TransacaoCredito[]>('/carteira/historico-creditos')
  return data
}
