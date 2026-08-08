import { useQuery } from '@tanstack/react-query'
import { getSecoes } from '@/features/cliente/descobrir/api/getSecoes'

export function useSecoes() {
  return useQuery({
    queryKey: ['descobrir', 'secoes'],
    queryFn: getSecoes,
  })
}
