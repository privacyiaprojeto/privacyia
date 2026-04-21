import { z } from 'zod'

export const notificationIdParamsSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
})

export const notificationPreferencesSchema = z.object({
  marketing: z.boolean().optional(),
  sistema: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Envie ao menos um campo de preferência.',
})
