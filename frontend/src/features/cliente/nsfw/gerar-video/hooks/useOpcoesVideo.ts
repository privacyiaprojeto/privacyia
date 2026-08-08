import { useQuery } from '@tanstack/react-query'
import { getOpcoesVideo } from '@/features/cliente/nsfw/gerar-video/api/getOpcoesVideo'

export function useOpcoesVideo(atrizId?: string | null) {
  return useQuery({
    queryKey: ['nsfw', 'video', 'opcoes', atrizId || 'fallback'],
    queryFn: () => getOpcoesVideo(atrizId),
  })
}
