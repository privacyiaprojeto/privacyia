import { api } from '@/shared/lib/axios'
import type { MetodoPagamento } from '@/features/cliente/carteira/types'

export async function getMetodosPagamento(): Promise<MetodoPagamento[]> {
  const { data } = await api.get<MetodoPagamento[]>('/carteira/metodos-pagamento')
  return data
}
