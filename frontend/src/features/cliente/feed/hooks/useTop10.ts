import { useQuery } from '@tanstack/react-query'
import { getTop10 } from '@/features/cliente/feed/api/getTop10'

export function useTop10() {
  return useQuery({
    queryKey: ['feed', 'top10'],
    queryFn: getTop10,
  })
}
