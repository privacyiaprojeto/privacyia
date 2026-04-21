import { useMutation, useQueryClient } from '@tanstack/react-query'
import { curtirPost } from '@/features/cliente/feed/api/curtirPost'

export function useCurtirPost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: curtirPost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['feed', 'posts'] }),
  })
}
