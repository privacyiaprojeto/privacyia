import { useQuery } from '@tanstack/react-query'
import { getTimeline } from '@/features/cliente/chat/api/getTimeline'
import { enrichTimeline } from '@/shared/fallbacks/actresses'

export function useTimeline(atrizId: string) {
  return useQuery({
    queryKey: ['chat', 'timeline', atrizId],
    queryFn: async () => {
      try {
        return await getTimeline(atrizId)
      } catch {
        return []
      }
    },
    enabled: !!atrizId,
    select: (data) => enrichTimeline(atrizId, data),
  })
}
