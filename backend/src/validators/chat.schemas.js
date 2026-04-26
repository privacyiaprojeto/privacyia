import { z } from 'zod'

const personaText = z.string().trim().min(1).max(80)

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid(),
})


export const messageAudioParamsSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
})

export const sendMessageSchema = z.object({
  conteudo: z.string().trim().min(1).max(5000),
})

export const startConversationSchema = z.object({
  companionId: z.string().uuid(),
  relationshipType: personaText.optional(),
  currentMood: personaText.optional(),
})

export const updateConversationPersonaSchema = z
  .object({
    relationshipType: personaText.optional(),
    currentMood: personaText.optional(),
  })
  .refine(
    (data) => data.relationshipType !== undefined || data.currentMood !== undefined,
    {
      message: 'relationshipType ou currentMood é obrigatório.',
    },
  )
