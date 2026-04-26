import { useQuery } from '@tanstack/react-query'
import { getNotificacoesAtriz } from '@/features/atriz/notificacoes/api/getNotificacoesAtriz'

export function useNotificacoesAtriz() {
  return useQuery({
    queryKey: ['atriz-painel-notificacoes'],
    queryFn: getNotificacoesAtriz,
  })
}
