import { useQuery } from '@tanstack/react-query'
import { getTimeline } from '@/features/cliente/chat/api/getTimeline'

export function useTimeline(atrizId: string) {
  return useQuery({
    queryKey: ['chat', 'timeline', atrizId],
    queryFn: () => getTimeline(atrizId),
    enabled: !!atrizId,
  })
}
