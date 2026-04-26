import { useMutation, useQueryClient } from '@tanstack/react-query'
import { atualizarPerfil } from '@/features/cliente/perfil/api/atualizarPerfil'

export function useAtualizarPerfil() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: atualizarPerfil,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cliente', 'perfil'] })
    },
  })
}
