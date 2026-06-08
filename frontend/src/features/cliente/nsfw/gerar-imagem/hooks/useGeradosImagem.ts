import { useQuery } from '@tanstack/react-query'
import { getGeradosImagem } from '@/features/cliente/nsfw/gerar-imagem/api/getGeradosImagem'
import type { ItemGerado } from '@/features/cliente/nsfw/types'

export function useGeradosImagem() {
  return useQuery<ItemGerado[]>({
    queryKey: ['nsfw', 'gerados', 'imagem'],
    queryFn: getGeradosImagem,
    refetchInterval: (query) => {
      const items = query.state.data ?? []
      const temEmAndamento = items.some((i) => ['em_andamento', 'processing'].includes(String(i.status || '').toLowerCase()))
      return temEmAndamento ? 3000 : false
    },
    refetchOnWindowFocus: true,
  })
}
