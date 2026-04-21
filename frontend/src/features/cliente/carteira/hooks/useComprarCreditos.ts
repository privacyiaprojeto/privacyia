import { useMutation, useQueryClient } from '@tanstack/react-query'
import { comprarCreditos } from '@/features/cliente/carteira/api/comprarCreditos'

export function useComprarCreditos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: comprarCreditos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carteira'] })
    },
  })
}
