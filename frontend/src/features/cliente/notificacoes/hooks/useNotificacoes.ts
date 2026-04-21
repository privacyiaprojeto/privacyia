import { useQuery } from '@tanstack/react-query'
import { getNotificacoes } from '@/features/cliente/notificacoes/api/getNotificacoes'

export function useNotificacoes() {
  return useQuery({
    queryKey: ['notificacoes'],
    queryFn: getNotificacoes,
  })
}
