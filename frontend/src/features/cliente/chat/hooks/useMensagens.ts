import { useQuery } from '@tanstack/react-query'
import { getMensagens } from '@/features/cliente/chat/api/getMensagens'

export function useMensagens(conversaId: string) {
  return useQuery({
    queryKey: ['chat', 'mensagens', conversaId],
    queryFn: () => getMensagens(conversaId),
    enabled: !!conversaId,
  })
}
