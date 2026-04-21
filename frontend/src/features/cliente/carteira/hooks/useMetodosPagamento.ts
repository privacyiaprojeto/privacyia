import { useQuery } from '@tanstack/react-query'
import { getMetodosPagamento } from '@/features/cliente/carteira/api/getMetodosPagamento'

export function useMetodosPagamento() {
  return useQuery({
    queryKey: ['carteira', 'metodos-pagamento'],
    queryFn: getMetodosPagamento,
  })
}
