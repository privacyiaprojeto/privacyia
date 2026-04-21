import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gerarVideo } from '@/features/cliente/nsfw/gerar-video/api/gerarVideo'

export function useGerarVideo() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: gerarVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nsfw', 'gerados', 'video'] })
      queryClient.invalidateQueries({ queryKey: ['carteira', 'resumo'] })
    },
  })
}
