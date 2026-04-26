import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  updateConversationPersona,
  type UpdateConversationPersonaInput,
} from '@/features/cliente/chat/api/updateConversationPersona'
import type { Conversa } from '@/features/cliente/chat/types'

export function useUpdateConversationPersona() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateConversationPersonaInput) => updateConversationPersona(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['chat', 'conversas'] })

      const previousConversations = queryClient.getQueryData<Conversa[]>(['chat', 'conversas'])

      queryClient.setQueryData<Conversa[]>(
        ['chat', 'conversas'],
        (current = []) =>
          current.map((conversation) =>
            conversation.id === input.conversationId
              ? {
                  ...conversation,
                  relationshipType:
                    input.relationshipType ?? conversation.relationshipType,
                  currentMood: input.currentMood ?? conversation.currentMood,
                }
              : conversation,
          ),
      )

      return { previousConversations }
    },
    onError: (_error, _input, context) => {
      if (context?.previousConversations) {
        queryClient.setQueryData(['chat', 'conversas'], context.previousConversations)
      }
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Conversa[]>(
        ['chat', 'conversas'],
        (current = []) =>
          current.map((conversation) =>
            conversation.id === data.id
              ? {
                  ...conversation,
                  relationshipType: data.relationshipType,
                  currentMood: data.currentMood,
                }
              : conversation,
          ),
      )
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
    },
  })
}
