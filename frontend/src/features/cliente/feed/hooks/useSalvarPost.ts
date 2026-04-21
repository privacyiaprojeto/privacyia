import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salvarPost } from '@/features/cliente/feed/api/salvarPost'

export function useSalvarPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: salvarPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed', 'posts'] }),
  })
}
