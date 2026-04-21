import { useQuery } from '@tanstack/react-query'
import { getAtrizesAssinadas } from '@/features/cliente/nsfw/api/getAtrizesAssinadas'

export function useAtrizesAssinadas() {
  return useQuery({
    queryKey: ['nsfw', 'atrizes-assinadas'],
    queryFn: getAtrizesAssinadas,
  })
}
