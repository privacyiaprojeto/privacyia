import { useQuery } from '@tanstack/react-query'
import { getAtrizPerfil } from '@/features/cliente/chat/api/getAtrizPerfil'
import { enrichChatProfile } from '@/shared/fallbacks/actresses'

export function useAtrizPerfil(atrizId: string) {
  return useQuery({
    queryKey: ['chat', 'atriz-perfil', atrizId],
    queryFn: async () => {
      try {
        return await getAtrizPerfil(atrizId)
      } catch {
        return enrichChatProfile({ id: atrizId })
      }
    },
    enabled: !!atrizId,
    select: (data) => enrichChatProfile(data),
  })
}
