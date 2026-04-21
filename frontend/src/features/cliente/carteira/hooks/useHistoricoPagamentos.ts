import { useQuery } from '@tanstack/react-query'
import { getHistoricoPagamentos } from '@/features/cliente/carteira/api/getHistoricoPagamentos'

export function useHistoricoPagamentos() {
  return useQuery({
    queryKey: ['carteira', 'historico-pagamentos'],
    queryFn: getHistoricoPagamentos,
  })
}
