import { useMutation, useQueryClient } from '@tanstack/react-query'
import { enviarMensagem } from '@/features/cliente/chat/api/enviarMensagem'
import { formatChatClock, normalizeMensagem } from '@/features/cliente/chat/api/chatFormatters'
import type { Conversa, Mensagem } from '@/features/cliente/chat/types'

export function useEnviarMensagem(conversaId: string) {
  const queryClient = useQueryClient()
  const mensagensKey = ['chat', 'mensagens', conversaId]
  const conversasKey = ['chat', 'conversas']

  return useMutation({
    mutationFn: (conteudo: string) => enviarMensagem(conversaId, conteudo),
    onMutate: async (conteudo) => {
      await queryClient.cancelQueries({ queryKey: mensagensKey })
      await queryClient.cancelQueries({ queryKey: conversasKey })

      const previousMessages = queryClient.getQueryData<Mensagem[]>(mensagensKey)
      const previousConversations = queryClient.getQueryData<Conversa[]>(conversasKey)
      const now = new Date().toISOString()
      const optimisticId = `local-${Date.now()}`

      const optimisticMessage: Mensagem = {
        id: optimisticId,
        conversaId,
        conteudo,
        de: 'cliente',
        criadaEm: formatChatClock(now),
      }

      queryClient.setQueryData<Mensagem[]>(mensagensKey, (old = []) => [
        ...old,
        optimisticMessage,
      ])

      queryClient.setQueryData<Conversa[]>(conversasKey, (old = []) =>
        old.map((conversa) => {
          if (conversa.id !== conversaId) return conversa

          return {
            ...conversa,
            ultimaMensagem: conteudo,
            ultimaHora: formatChatClock(now),
            updatedAt: now,
          }
        }),
      )

      return {
        previousMessages,
        previousConversations,
        optimisticId,
      }
    },
    onError: (_error, _conteudo, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(mensagensKey, context.previousMessages)
      }

      if (context?.previousConversations) {
        queryClient.setQueryData(conversasKey, context.previousConversations)
      }
    },
    onSuccess: (message, _conteudo, context) => {
      const normalized = normalizeMensagem(message)

      queryClient.setQueryData<Mensagem[]>(mensagensKey, (old = []) => {
        const withoutOptimistic = old.filter((item) => item.id !== context?.optimisticId)
        const withoutDuplicate = withoutOptimistic.filter((item) => item.id !== normalized.id)
        return [...withoutDuplicate, normalized]
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: mensagensKey })
      queryClient.invalidateQueries({ queryKey: conversasKey })
    },
  })
}
