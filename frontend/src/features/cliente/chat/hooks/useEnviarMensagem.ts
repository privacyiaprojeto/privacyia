import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enviarMensagem } from '@/features/cliente/chat/api/enviarMensagem'

export function useEnviarMensagem(conversaId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (conteudo: string) => enviarMensagem(conversaId, conteudo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'mensagens', conversaId] })
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
    },
  })
}
