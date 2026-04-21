import { useQuery } from '@tanstack/react-query'
import { getHistoricoCreditos } from '@/features/cliente/carteira/api/getHistoricoCreditos'

export function useHistoricoCreditos() {
  return useQuery({
    queryKey: ['carteira', 'historico-creditos'],
    queryFn: getHistoricoCreditos,
  })
}
