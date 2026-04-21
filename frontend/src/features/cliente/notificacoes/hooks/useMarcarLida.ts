import { useMutation, useQueryClient } from '@tanstack/react-query'
import { marcarLida } from '@/features/cliente/notificacoes/api/marcarLida'

export function useMarcarLida() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: marcarLida,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes'] })
    },
  })
}
