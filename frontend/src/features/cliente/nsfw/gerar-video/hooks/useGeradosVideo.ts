import { useQuery } from '@tanstack/react-query'
import { getGeradosVideo } from '@/features/cliente/nsfw/gerar-video/api/getGeradosVideo'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

export function useGeradosVideo() {
  return useQuery<ItemGerado[]>({
    queryKey: ['nsfw', 'gerados', 'video'],
    queryFn: getGeradosVideo,
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      const temEmAndamento = items.some((i) => i.status === 'em_andamento')
      return temEmAndamento ? 4000 : false
    },
  })
}
