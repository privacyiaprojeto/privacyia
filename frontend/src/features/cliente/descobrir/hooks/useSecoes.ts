import { useQuery } from '@tanstack/react-query'
import { getSecoes } from '@/features/cliente/descobrir/api/getSecoes'
import { enrichSections } from '@/shared/fallbacks/actresses'

export function useSecoes() {
  return useQuery({
    queryKey: ['descobrir', 'secoes'],
    queryFn: async () => {
      try {
        return await getSecoes()
      } catch {
        return []
      }
    },
    select: (data) => enrichSections(data),
  })
}
