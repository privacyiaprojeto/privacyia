import { useMutation, useQueryClient } from '@tanstack/react-query'
import { marcarTodasLidas } from '@/features/cliente/notificacoes/api/marcarTodasLidas'

export function useMarcarTodasLidas() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: marcarTodasLidas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    },
  })
}
