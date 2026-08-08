import { z } from 'zod'

const uuidSchema = z.string().uuid('Identificador inválido.')

const sceneTypeSchema = z.enum([
  'scene_solo_f',
  'scene_solo_m',
  'scene_duo_mf',
  'scene_duo_ff',
  'scene_duo_mm',
  'scene_trio',
], {
  message: 'Classificação de cena inválida.',
})

const booleanQueryParam = (defaultValue = false) => z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return defaultValue
    return String(value).toLowerCase() === 'true'
  })

export const sceneIdParamSchema = z.object({
  sceneId: uuidSchema,
})

export const listBaseScenesQuerySchema = z.object({
  includeInactive: booleanQueryParam(false),
})

export const createBaseSceneUploadSchema = z.object({
  title: z.string().trim().min(2, 'Título obrigatório.').max(160),
  description: z.string().trim().max(1600).optional().default(''),
  slotsCount: z.coerce.number().int().min(1).max(3).default(2),
  sceneType: sceneTypeSchema,
  filename: z.string().trim().min(1).max(255),
  contentType: z.literal('video/mp4', {
    errorMap: () => ({ message: 'A biblioteca aceita somente vídeo MP4.' }),
  }),
  byteSize: z.coerce.number().int().positive().max(750 * 1024 * 1024, 'O vídeo deve ter no máximo 750 MB.'),
})

export const updateBaseSceneSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1600).optional(),
  slotsCount: z.coerce.number().int().min(1).max(3).optional(),
  sceneType: sceneTypeSchema.optional(),
  isActive: z.boolean().optional(),
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: 'Informe ao menos um campo para atualizar.',
})

const virtualExtraTypeSchema = z.enum([
  'generic_black_man',
  'generic_white_muscular_man',
  'generic_asian_woman',
  'custom',
])

const castSlotSchema = z.discriminatedUnion('participantType', [
  z.object({
    slotIndex: z.coerce.number().int().min(1).max(3),
    participantType: z.literal('actor'),
    actorProfileId: uuidSchema,
    companionId: uuidSchema.optional().nullable(),
  }),
  z.object({
    slotIndex: z.coerce.number().int().min(1).max(3),
    participantType: z.literal('virtual_extra'),
    extraType: virtualExtraTypeSchema,
    customDescription: z.string().trim().max(500).optional().default(''),
  }).superRefine((value, ctx) => {
    if (value.extraType === 'custom' && !value.customDescription) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['customDescription'], message: 'Descreva o personagem personalizado.' })
    }
  }),
])

export const createSceneDirectionSchema = z.object({
  baseSceneId: uuidSchema.optional().nullable(),
  productionMode: z.enum(['v2v', 'i2v']),
  slots: z.array(castSlotSchema).min(1).max(3),
  prompt: z.string().trim().min(5, 'Descreva a ambientação e a ação.').max(4000),
  execute: z.boolean().optional().default(true),
}).superRefine((value, ctx) => {
  if (value.productionMode === 'v2v' && !value.baseSceneId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseSceneId'], message: 'Selecione uma cena base para produção V2V.' })
  }

  if (value.productionMode === 'i2v' && value.baseSceneId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['baseSceneId'], message: 'Produção solo I2V não usa cena base.' })
  }

  const indexes = value.slots.map((slot) => slot.slotIndex)
  if (new Set(indexes).size !== indexes.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['slots'], message: 'Cada posição do elenco deve ser única.' })
  }
})

export const listSceneDirectionsQuerySchema = z.object({
  status: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
})

export const productIdParamSchema = z.object({
  productId: uuidSchema,
})

const splitSchema = z.object({
  beneficiaryId: uuidSchema,
  beneficiaryType: z.enum(['actor', 'company']),
  beneficiaryName: z.string().trim().min(1).max(180),
  splitPercentage: z.coerce.number().min(0).max(100),
  displayOnStorefront: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(2).default(0),
})

export const replaceProductSplitsSchema = z.object({
  splits: z.array(splitSchema).max(3),
}).superRefine((value, ctx) => {
  const total = value.splits.reduce((sum, split) => sum + Number(split.splitPercentage || 0), 0)
  if (total > 100.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['splits'], message: 'A soma dos repasses não pode ultrapassar 100%.' })
  }

  const unique = new Set(value.splits.map((split) => `${split.beneficiaryType}:${split.beneficiaryId}`))
  if (unique.size !== value.splits.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['splits'], message: 'O mesmo beneficiário não pode aparecer duas vezes.' })
  }
})
