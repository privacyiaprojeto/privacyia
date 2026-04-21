import { useQuery } from '@tanstack/react-query'
import { getGeradosImagem } from '@/features/cliente/nsfw/gerar-imagem/api/getGeradosImagem'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

export function useGeradosImagem() {
  return useQuery<ItemGerado[]>({
    queryKey: ['nsfw', 'gerados', 'imagem'],
    queryFn: getGeradosImagem,
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      const temEmAndamento = items.some((i) => i.status === 'em_andamento')
      return temEmAndamento ? 4000 : false
    },
  })
}
