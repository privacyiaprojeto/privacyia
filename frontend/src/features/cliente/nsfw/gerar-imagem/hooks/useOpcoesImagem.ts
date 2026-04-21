import { useQuery } from '@tanstack/react-query'
import { getOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/api/getOpcoesImagem'

export function useOpcoesImagem() {
  return useQuery({
    queryKey: ['nsfw', 'imagem', 'opcoes'],
    queryFn: getOpcoesImagem,
  })
}
