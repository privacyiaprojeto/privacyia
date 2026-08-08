import { z } from 'zod'

const uuidSchema = z.string().uuid('Identificador inválido.')

const booleanQueryParam = (defaultValue = false) => z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return defaultValue
    return String(value).toLowerCase() === 'true'
  })

const categorySchema = z
  .string()
  .trim()
  .min(2, 'Categoria obrigatória.')
  .max(50)
  .regex(/^[a-z][a-z0-9_]*$/, 'Use uma categoria técnica em minúsculas, sem espaços.')

export const intelligenceItemIdParamSchema = z.object({
  itemId: uuidSchema,
})

export const listPromptDictionariesQuerySchema = z.object({
  category: categorySchema.optional(),
  includeInactive: booleanQueryParam(true),
})

export const createPromptDictionarySchema = z.object({
  category: categorySchema,
  label: z.string().trim().min(1, 'Item obrigatório.').max(160),
  isActive: z.boolean().optional().default(true),
})

export const updatePromptDictionarySchema = z.object({
  category: categorySchema.optional(),
  label: z.string().trim().min(1, 'Item obrigatório.').max(160).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Informe ao menos um campo para atualizar.',
})

export const listAudioStorylinesQuerySchema = z.object({
  includeInactive: booleanQueryParam(true),
})

export const createAudioStorylineSchema = z.object({
  title: z.string().trim().min(2, 'Título obrigatório.').max(160),
  script: z.string().trim().min(5, 'Roteiro obrigatório.').max(12000),
  voiceTone: z.string().trim().min(2, 'Tom de voz obrigatório.').max(120),
  isActive: z.boolean().optional().default(true),
})

export const updateAudioStorylineSchema = z.object({
  title: z.string().trim().min(2, 'Título obrigatório.').max(160).optional(),
  script: z.string().trim().min(5, 'Roteiro obrigatório.').max(12000).optional(),
  voiceTone: z.string().trim().min(2, 'Tom de voz obrigatório.').max(120).optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Informe ao menos um campo para atualizar.',
})
