import { useQuery } from '@tanstack/react-query'
import { getMensagens } from '@/features/cliente/chat/api/getMensagens'
import { enrichMessages } from '@/shared/fallbacks/actresses'

export function useMensagens(conversaId: string) {
  return useQuery({
    queryKey: ['chat', 'mensagens', conversaId],
    queryFn: async () => {
      try {
        return await getMensagens(conversaId)
      } catch {
        return []
      }
    },
    enabled: !!conversaId,
    select: (data) => enrichMessages(conversaId, data),
  })
}
