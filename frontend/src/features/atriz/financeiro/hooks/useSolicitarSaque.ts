import { useMutation, useQueryClient } from '@tanstack/react-query'
import { solicitarSaque } from '@/features/atriz/financeiro/api/solicitarSaque'

export function useSolicitarSaque() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: solicitarSaque,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atriz-painel-financeiro'] })
    },
  })
}
