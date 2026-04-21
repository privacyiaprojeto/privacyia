import { useQuery } from '@tanstack/react-query'
import { getPreferencias } from '@/features/cliente/notificacoes/api/getPreferencias'

export function usePreferencias() {
  return useQuery({
    queryKey: ['notificacoes', 'preferencias'],
    queryFn: getPreferencias,
  })
}
