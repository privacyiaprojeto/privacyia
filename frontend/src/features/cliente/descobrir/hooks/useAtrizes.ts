import { useQuery } from '@tanstack/react-query'
import { getAtrizes } from '@/features/cliente/descobrir/api/getAtrizes'

export function useAtrizes() {
  return useQuery({
    queryKey: ['descobrir', 'atrizes'],
    queryFn: async () => {
      try {
        return await getAtrizes()
      } catch (error) {
        console.error('Falha ao carregar atrizes reais da API:', error)
        return []
      }
    },
  })
}
