import { z } from 'zod'

export const addPaymentMethodSchema = z.object({
  tipo: z.enum(['cartao', 'pix']),
  apelido: z.string().trim().max(120).optional(),
  ultimosDigitos: z.string().regex(/^\d{4}$/).optional(),
  bandeira: z.string().trim().max(60).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'cartao') {
    if (!data.bandeira) {
      ctx.addIssue({ code: 'custom', path: ['bandeira'], message: 'Bandeira é obrigatória.' })
    }
    if (!data.ultimosDigitos) {
      ctx.addIssue({ code: 'custom', path: ['ultimosDigitos'], message: 'Últimos 4 dígitos são obrigatórios.' })
    }
  }

  if (data.tipo === 'pix' && !data.apelido) {
    ctx.addIssue({ code: 'custom', path: ['apelido'], message: 'Apelido é obrigatório para Pix.' })
  }
})

export const buyCreditsSchema = z.object({
  pacoteId: z.string().uuid().or(z.string().min(1)),
  metodoId: z.string().uuid().or(z.string().min(1)),
})
