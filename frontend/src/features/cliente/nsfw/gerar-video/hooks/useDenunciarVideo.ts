import { useMutation, useQueryClient } from '@tanstack/react-query'
import { denunciarVideo } from '@/features/cliente/nsfw/gerar-video/api/denunciarVideo'

export function useDenunciarVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: denunciarVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nsfw', 'gerados', 'video'] })
    },
  })
}
