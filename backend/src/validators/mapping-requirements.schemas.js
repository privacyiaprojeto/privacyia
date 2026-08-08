import { z } from 'zod'

const mediaTypeSchema = z.enum(['image', 'audio', 'video'], {
  message: 'Tipo de mídia inválido. Use image, audio ou video.',
})


const systemTagSchema = z.enum([
  'face_front',
  'face_profile',
  'face_profile_left',
  'face_profile_right',
  'body_front',
  'body_back',
  'nsfw_front',
  'nsfw_back',
  'nsfw_closeup_front',
  'nsfw_closeup_back',
  'voice_natural',
  'voice_whisper',
  'voice_affectionate',
  'nsfw_voice_moan',
  'video_expression',
  'video_walk',
], {
  message: 'Tag de sistema inválida.',
})

const booleanQueryParam = (defaultValue = false) => z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return defaultValue
    return String(value).toLowerCase() === 'true'
  })

export const listMappingRequirementsQuerySchema = z.object({
  includeInactive: booleanQueryParam(false),
})

export const createMappingRequirementSchema = z.object({
  title: z.string().trim().min(2, 'Título obrigatório.').max(120),
  description: z.string().trim().min(12, 'Descreva de forma clara o material esperado.').max(1000),
  mediaType: mediaTypeSchema,
  systemTag: systemTagSchema.nullable().optional().default(null),
  isRequired: z.boolean().optional().default(true),
})

export const updateMappingRequirementSchema = z.object({
  title: z.string().trim().min(2, 'Título obrigatório.').max(120).optional(),
  description: z.string().trim().min(12, 'Descreva de forma clara o material esperado.').max(1000).optional(),
  mediaType: mediaTypeSchema.optional(),
  systemTag: systemTagSchema.nullable().optional(),
  isRequired: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: 'Informe ao menos um campo para atualizar.',
})
