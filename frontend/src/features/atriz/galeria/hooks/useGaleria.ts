import { useQuery } from '@tanstack/react-query'
import { getGaleria } from '@/features/atriz/galeria/api/getGaleria'

export function useGaleria() {
  return useQuery({
    queryKey: ['atriz-painel-galeria'],
    queryFn: getGaleria,
  })
}
