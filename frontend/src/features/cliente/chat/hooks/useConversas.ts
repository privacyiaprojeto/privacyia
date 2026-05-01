import { useQuery } from '@tanstack/react-query'
import { getConversas } from '@/features/cliente/chat/api/getConversas'

export function useConversas() {
  return useQuery({
    queryKey: ['chat', 'conversas'],
    queryFn: async () => {
      try {
        return await getConversas()
      } catch (error) {
        console.error('Erro ao buscar conversas reais:', error)
        return []
      }
    },
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  })
}