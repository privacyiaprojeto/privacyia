import { useQuery } from '@tanstack/react-query'
import { getFinanceiro } from '@/features/atriz/financeiro/api/getFinanceiro'

export function useFinanceiro() {
  return useQuery({
    queryKey: ['atriz-painel-financeiro'],
    queryFn: getFinanceiro,
  })
}
