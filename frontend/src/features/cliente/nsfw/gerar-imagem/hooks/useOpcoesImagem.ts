import { useQuery } from '@tanstack/react-query'
import { getOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/api/getOpcoesImagem'

export function useOpcoesImagem(atrizId?: string | null) {
  return useQuery({
    queryKey: ['nsfw', 'imagem', 'opcoes', atrizId || 'sem-atriz'],
    queryFn: () => getOpcoesImagem(atrizId),
    enabled: Boolean(atrizId),
  })
}
