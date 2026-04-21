import { useQuery } from '@tanstack/react-query'
import { getAtrizPerfil } from '@/features/cliente/chat/api/getAtrizPerfil'

export function useAtrizPerfil(atrizId: string) {
  return useQuery({
    queryKey: ['chat', 'atriz-perfil', atrizId],
    queryFn: () => getAtrizPerfil(atrizId),
    enabled: !!atrizId,
  })
}
