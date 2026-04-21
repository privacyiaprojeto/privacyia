import { useQuery } from '@tanstack/react-query'
import { getCarteira } from '@/features/cliente/carteira/api/getCarteira'

export function useCarteira() {
  return useQuery({
    queryKey: ['carteira', 'resumo'],
    queryFn: getCarteira,
  })
}
