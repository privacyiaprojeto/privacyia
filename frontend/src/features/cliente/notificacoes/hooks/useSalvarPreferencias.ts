import { useMutation, useQueryClient } from '@tanstack/react-query'
import { salvarPreferencias } from '@/features/cliente/notificacoes/api/salvarPreferencias'

export function useSalvarPreferencias() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: salvarPreferencias,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacoes', 'preferencias'] })
    },
  })
}
