import { useQuery } from '@tanstack/react-query'
import { getConversas } from '@/features/cliente/chat/api/getConversas'
import { enrichConversations } from '@/shared/fallbacks/actresses'

export function useConversas() {
  return useQuery({
    queryKey: ['chat', 'conversas'],
    queryFn: async () => {
      try {
        return await getConversas()
      } catch {
        return []
      }
    },
    select: (data) => enrichConversations(data),
  })
}
