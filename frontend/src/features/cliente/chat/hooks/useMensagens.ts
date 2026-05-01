import { useQuery } from '@tanstack/react-query'
import { getMensagens } from '@/features/cliente/chat/api/getMensagens'

export function useMensagens(conversaId: string) {
  return useQuery({
    queryKey: ['chat', 'mensagens', conversaId],
    queryFn: async () => {
      try {
        return await getMensagens(conversaId)
      } catch (error) {
        console.error('Erro ao buscar mensagens reais:', error)
        return []
      }
    },
    enabled: !!conversaId,
    staleTime: 5_000,
    refetchOnWindowFocus: false,
  })
}