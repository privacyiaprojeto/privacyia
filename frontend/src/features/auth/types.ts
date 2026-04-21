import { z } from 'zod'
import type { User } from '@/shared/types/user'

export const strongPasswordSchema = z
  .string()
  .min(8, 'Mínimo de 8 caracteres')
  .regex(/[A-Z]/, 'Deve conter pelo menos uma letra maiúscula')
  .regex(/[a-z]/, 'Deve conter pelo menos uma letra minúscula')
  .regex(/[0-9]/, 'Deve conter pelo menos um número')
  .regex(/[^A-Za-z0-9]/, 'Deve conter pelo menos um símbolo')

export const loginSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(1, 'Informe sua senha'),
})

export type LoginInput = z.infer<typeof loginSchema>

export const signUpSchema = z.object({
  username: z.string().min(3, 'Mínimo de 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  password: strongPasswordSchema,
})

export type SignUpInput = z.infer<typeof signUpSchema>

export interface LoginResponse {
  token: string
  user: User
}

export interface SignUpResponse {
  success: boolean
  requiresEmailConfirmation: boolean
  message?: string
  email?: string
  token?: string
  user?: User
}
