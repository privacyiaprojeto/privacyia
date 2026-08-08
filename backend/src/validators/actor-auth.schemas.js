import { z } from 'zod'
import { strongPasswordSchema } from './auth.schemas.js'

const optionalCleanString = (max = 500) => z
  .string()
  .trim()
  .max(max)
  .optional()
  .transform((value) => value || undefined)

export const registerActorAuthByInviteSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').optional(),
  password: strongPasswordSchema,
  name: optionalCleanString(120),
  displayName: optionalCleanString(120),
  phone: optionalCleanString(40),
})
