import { useQuery } from '@tanstack/react-query'
import { getAssinantes } from '@/features/atriz/assinantes/api/getAssinantes'

export function useAssinantes() {
  return useQuery({
    queryKey: ['atriz-painel-assinantes'],
    queryFn: getAssinantes,
  })
}
