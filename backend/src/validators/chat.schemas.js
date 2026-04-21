import { z } from 'zod'

export const conversationIdParamsSchema = z.object({
  id: z.string().uuid().or(z.string().regex(/^\d+$/)),
})

export const sendMessageSchema = z.object({
  conteudo: z.string().trim().min(1).max(5000),
})
