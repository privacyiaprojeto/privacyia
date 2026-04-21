import { useQuery } from '@tanstack/react-query'
import { getOpcoesVideo } from '@/features/cliente/nsfw/gerar-video/api/getOpcoesVideo'

export function useOpcoesVideo() {
  return useQuery({
    queryKey: ['nsfw', 'video', 'opcoes'],
    queryFn: getOpcoesVideo,
  })
}
