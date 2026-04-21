import { useMutation, useQueryClient } from '@tanstack/react-query'
import { denunciarImagem } from '@/features/cliente/nsfw/gerar-imagem/api/denunciarImagem'

export function useDenunciarImagem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: denunciarImagem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nsfw', 'gerados', 'imagem'] })
    },
  })
}
