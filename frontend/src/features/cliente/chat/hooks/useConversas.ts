import { useQuery } from '@tanstack/react-query'
import { getConversas } from '@/features/cliente/chat/api/getConversas'

export function useConversas() {
  return useQuery({
    queryKey: ['chat', 'conversas'],
    queryFn: getConversas,
  })
}
