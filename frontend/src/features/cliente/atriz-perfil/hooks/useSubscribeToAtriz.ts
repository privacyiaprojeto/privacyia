import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subscribeToAtriz } from '@/features/cliente/atriz-perfil/api/subscribeToAtriz'

export function useSubscribeToAtriz(slug?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: subscribeToAtriz,
    onSuccess: () => {
      if (slug) {
        queryClient.invalidateQueries({ queryKey: ['atriz-perfil', slug] })
      }
    },
  })
}
