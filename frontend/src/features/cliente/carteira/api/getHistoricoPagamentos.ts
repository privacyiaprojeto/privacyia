import { api } from '@/shared/lib/axios'
import type { HistoricoPagamento } from '@/features/cliente/carteira/types'

export async function getHistoricoPagamentos(): Promise<HistoricoPagamento[]> {
  const { data } = await api.get<HistoricoPagamento[]>('/carteira/historico-pagamentos')
  return data
}
