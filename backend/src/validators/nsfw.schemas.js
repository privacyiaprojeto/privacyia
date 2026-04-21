import { z } from 'zod'

export const gerarImagemSchema = z.object({
  atrizId: z.string().uuid('atrizId inválido'),
  posicaoId: z.string().uuid().nullable().optional(),
  ambienteId: z.string().uuid().nullable().optional(),
  acessorioId: z.string().uuid().nullable().optional(),
  roupaId: z.string().uuid().nullable().optional(),
})

export const gerarVideoSchema = z.object({
  atrizId: z.string().uuid('atrizId inválido'),
  acaoId: z.string().uuid().nullable().optional(),
  roupaId: z.string().uuid().nullable().optional(),
  localizacaoId: z.string().uuid().nullable().optional(),
})

export const denunciarGeracaoSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo da denúncia').max(500),
})
