import { useQuery } from '@tanstack/react-query'
import { getSugestoes } from '@/features/cliente/feed/api/getSugestoes'

export function useSugestoes() {
  return useQuery({
    queryKey: ['feed', 'sugestoes'],
    queryFn: getSugestoes,
  })
}
