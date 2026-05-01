import { useMutation, useQueryClient } from '@tanstack/react-query'
import { resetConversationMessages } from '@/features/cliente/chat/api/resetConversationMessages'
import type { Conversa, Mensagem } from '@/features/cliente/chat/types'

export function useResetarChat(conversaId: string) {
  const queryClient = useQueryClient()
  const mensagensKey = ['chat', 'mensagens', conversaId]
  const conversasKey = ['chat', 'conversas']

  return useMutation({
    mutationFn: () => resetConversationMessages(conversaId),
    onSuccess: (response) => {
      if (response.mensagem) {
        queryClient.setQueryData<Mensagem[]>(mensagensKey, [response.mensagem])

        queryClient.setQueryData<Conversa[]>(conversasKey, (old = []) =>
          old.map((conversa) => {
            if (conversa.id !== conversaId) return conversa

            return {
              ...conversa,
              ultimaMensagem: response.mensagem?.conteudo || 'Conversa reiniciada',
              ultimaHora: response.mensagem?.criadaEm || conversa.ultimaHora,
              updatedAt: new Date().toISOString(),
            }
          }),
        )
      }

      queryClient.invalidateQueries({ queryKey: mensagensKey })
      queryClient.invalidateQueries({ queryKey: conversasKey })
    },
  })
}
