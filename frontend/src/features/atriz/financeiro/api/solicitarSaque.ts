import { api } from '@/shared/lib/axios'
import type { SaqueItem } from '@/features/atriz/financeiro/types'

export async function solicitarSaque(valor: number): Promise<SaqueItem> {
  const { data } = await api.post<SaqueItem>('/atriz/painel/financeiro/saque', { valor })
  return data
}
