import { useMutation, useQueryClient } from '@tanstack/react-query'
import { gerarImagem } from '@/features/cliente/nsfw/gerar-imagem/api/gerarImagem'

export function useGerarImagem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: gerarImagem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nsfw', 'gerados', 'imagem'] })
      queryClient.invalidateQueries({ queryKey: ['carteira', 'resumo'] })
    },
  })
}
