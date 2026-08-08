import { useQuery } from '@tanstack/react-query'
import { getAtrizes } from '@/features/cliente/descobrir/api/getAtrizes'

export function useAtrizes() {
  return useQuery({
    queryKey: ['descobrir', 'atrizes'],
    queryFn: getAtrizes,
  })
}
