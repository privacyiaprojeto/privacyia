import { api } from '@/shared/lib/axios'
import type { AdicionarMetodoInput, MetodoPagamento } from '@/features/cliente/carteira/types'

export async function adicionarMetodoPagamento(input: AdicionarMetodoInput): Promise<MetodoPagamento> {
  const { data } = await api.post<MetodoPagamento>('/carteira/metodos-pagamento', input)
  return data
}
