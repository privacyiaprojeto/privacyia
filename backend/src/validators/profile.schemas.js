import { z } from 'zod'

export const updateProfileSchema = z
  .object({
    nome: z.string().trim().min(2, 'Nome precisa ter pelo menos 2 caracteres').max(120).optional(),
    email: z.string().trim().email('E-mail inválido').optional(),
    promptTom: z.string().trim().max(500, 'Máximo de 500 caracteres').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Informe ao menos um campo para atualizar.',
  })
