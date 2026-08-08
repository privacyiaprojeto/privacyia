import { z } from 'zod'

export const CONTENT_TYPES = [
  'image',
  'video',
  'short_video',
  'live_action',
  'audio',
  'live_audio',
]

const contentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/-/g, '_')

    const aliases = {
      imagem: 'image',
      image: 'image',
      foto: 'image',
      video: 'video',
      videos: 'video',
      video_curto: 'short_video',
      short_video: 'short_video',
      live_action: 'live_action',
      live: 'live_action',
      audio: 'audio',
      audio_live: 'live_audio',
      live_audio: 'live_audio',
      tts: 'audio',
    }

    return aliases[normalized] || normalized
  })
  .refine((value) => CONTENT_TYPES.includes(value), {
    message: 'Tipo de conteúdo inválido.',
  })

export const contentTypesArraySchema = z
  .array(contentTypeSchema)
  .min(1, 'Informe ao menos um tipo de conteúdo.')
  .max(6, 'Máximo de 6 tipos de conteúdo.')

export const listCreationTitlesQuerySchema = z.object({
  contentType: contentTypeSchema.optional(),
  includeInactive: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => String(value || 'false').toLowerCase() === 'true'),
})

export const createCreationTitleSchema = z.object({
  name: z.string().trim().min(2, 'Nome do título obrigatório.').max(80),
  description: z.string().trim().max(600).optional().default(''),
  contentTypes: contentTypesArraySchema,
  visibleToClient: z.boolean().optional().default(true),
  adminOnly: z.boolean().optional().default(false),
  sortOrder: z.coerce.number().int().optional().default(0),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const updateCreationTitleSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(600).optional(),
  contentTypes: contentTypesArraySchema.optional(),
  visibleToClient: z.boolean().optional(),
  adminOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Envie ao menos um campo para atualizar.',
})

export const createCreationItemsSchema = z.object({
  items: z
    .array(z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(600).optional().default(''),
      contentTypes: contentTypesArraySchema.optional(),
      visibleToClient: z.boolean().optional().default(true),
      adminOnly: z.boolean().optional().default(false),
      technicalSnippet: z.string().trim().max(2500).optional().default(''),
      negativePrompt: z.string().trim().max(2500).optional().default(''),
      sortOrder: z.coerce.number().int().optional().default(0),
      metadata: z.record(z.string(), z.unknown()).optional().default({}),
    }))
    .min(1, 'Informe ao menos um item.')
    .max(80, 'Máximo de 80 itens por envio.'),
})

export const updateCreationItemSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(600).optional(),
  contentTypes: contentTypesArraySchema.optional(),
  visibleToClient: z.boolean().optional(),
  adminOnly: z.boolean().optional(),
  isActive: z.boolean().optional(),
  technicalSnippet: z.string().trim().max(2500).optional(),
  negativePrompt: z.string().trim().max(2500).optional(),
  sortOrder: z.coerce.number().int().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'Envie ao menos um campo para atualizar.',
})

export const avatarCreationOptionsSchema = z.object({
  enabledContentTypes: contentTypesArraySchema.optional().default([]),
  enabledItemIds: z.array(z.string().uuid()).optional().default([]),
  visibleToClientItemIds: z.array(z.string().uuid()).optional().default([]),
})

export const previewCombinationsSchema = z.object({
  companionId: z.string().uuid('Avatar inválido.'),
  contentType: contentTypeSchema,
  selections: z.record(z.string().uuid(), z.array(z.string().uuid()).min(1)),
})

export const createProductionBatchSchema = previewCombinationsSchema.extend({
  requestedVariants: z.coerce.number().int().min(1).max(10).optional().default(1),
  generateRealMedia: z.boolean().optional().default(false),
  dryRunOnly: z.boolean().optional().default(true),
  enqueueJobs: z.boolean().optional().default(false),
  confirmationPhrase: z.string().trim().max(120).optional().default(''),
})


export const clientModelVisibilitySchema = z.object({
  visibleToClient: z.boolean(),
  priceCredits: z.coerce.number().int().min(0).max(100000).optional(),
  isActive: z.boolean().optional().default(true),
}).transform((value) => ({
  ...value,
  adminOnly: !value.visibleToClient,
}))
