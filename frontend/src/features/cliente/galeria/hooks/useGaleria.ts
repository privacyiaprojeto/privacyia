import { useQuery } from '@tanstack/react-query'
import { getGaleria } from '@/features/cliente/galeria/api/getGaleria'

export function useGaleria(q?: string) {
  return useQuery({
    queryKey: ['galeria', q ?? ''],
    queryFn: () => getGaleria(q),
  })
}
