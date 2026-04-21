import { useQuery } from '@tanstack/react-query'
import { getPacotes } from '@/features/cliente/carteira/api/getPacotes'

export function usePacotes() {
  return useQuery({
    queryKey: ['carteira', 'pacotes'],
    queryFn: getPacotes,
  })
}
