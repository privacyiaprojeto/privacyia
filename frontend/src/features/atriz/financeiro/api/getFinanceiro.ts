import { api } from '@/shared/lib/axios'
import type { SaldoAtriz, GanhoItem, SaqueItem, MetodoRecebimento } from '@/features/atriz/financeiro/types'

export interface FinanceiroResponse {
  saldo: SaldoAtriz
  ganhos: GanhoItem[]
  saques: SaqueItem[]
  metodos: MetodoRecebimento[]
}

export async function getFinanceiro(): Promise<FinanceiroResponse> {
  const { data } = await api.get<FinanceiroResponse>('/atriz/painel/financeiro')
  return data
}
