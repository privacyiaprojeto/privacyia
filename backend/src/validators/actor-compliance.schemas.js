import { z } from 'zod'
import { CONTENT_TYPES } from './creation-admin.schemas.js'

const optionalCleanString = (max = 500) => z
  .string()
  .trim()
  .max(max)
  .optional()
  .transform((value) => value || undefined)

const nullableCleanString = (max = 500) => z
  .string()
  .trim()
  .max(max)
  .optional()
  .transform((value) => value || null)

const uuidSchema = z.string().uuid('ID inválido.')

const booleanQueryParam = (defaultValue = false) => z
  .union([z.boolean(), z.string()])
  .optional()
  .transform((value) => {
    if (value === undefined || value === null || value === '') return defaultValue
    return String(value).toLowerCase() === 'true'
  })

const MAX_MAPPING_ASSET_BYTES = 25 * 1024 * 1024
const MAX_MAPPING_BASE64_CHARS = 36 * 1024 * 1024
const ALLOWED_MAPPING_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'application/octet-stream',
])

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

export const listActorProfilesQuerySchema = z.object({
  status: nullableCleanString(40),
  search: nullableCleanString(120),
  includeBlocked: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((value) => String(value || 'false').toLowerCase() === 'true'),
})

export const createActorProfileSchema = z.object({
  displayName: z.string().trim().min(2, 'Nome artístico obrigatório.').max(120),
  legalName: nullableCleanString(180),
  email: z.string().trim().email('E-mail inválido.').optional(),
  phone: nullableCleanString(40),
  countryCode: z.string().trim().min(2).max(2).optional().default('BR'),
  notes: nullableCleanString(1500),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const blockActorProfileSchema = z.object({
  reason: optionalCleanString(1500),
})

export const unblockActorProfileSchema = z.object({
  reason: optionalCleanString(1500),
})

export const generateActorInviteSchema = z.object({
  email: z.string().trim().email('E-mail inválido.').optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional().default(7),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const acceptActorInviteSchema = z.object({
  displayName: optionalCleanString(120),
  legalName: optionalCleanString(180),
  email: z.string().trim().email('E-mail inválido.').optional(),
  phone: optionalCleanString(40),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
})

export const createKycCaseSchema = z.object({
  caseType: optionalCleanString(60).default('avatar_mapping'),
  notes: nullableCleanString(1500),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
  submitForReview: z.boolean().optional().default(false),
})

export const registerKycAssetSchema = z.object({
  mappingRequirementId: uuidSchema,
  replacementAssetId: uuidSchema.optional(),
  base64: z.string().trim().max(MAX_MAPPING_BASE64_CHARS, 'Material muito grande para envio direto. Use arquivo de até 25 MB.').optional(),
  contentType: z.string().trim().max(120).optional().default('application/octet-stream'),
  originalFilename: nullableCleanString(180),
  byteSize: z.coerce.number().int().min(0).max(MAX_MAPPING_ASSET_BYTES, 'Material de mapeamento deve ter no máximo 25 MB.').optional(),
  checksumSha256: nullableCleanString(128),
  dryRunOnly: z.boolean().optional().default(false),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}).superRefine((value, ctx) => {
  if (!value.dryRunOnly && !value.base64) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['base64'],
      message: 'Envie o material em base64 ou use dryRunOnly=true para teste seguro.',
    })
  }

  const contentType = String(value.contentType || 'application/octet-stream').toLowerCase()
  if (!value.dryRunOnly && !ALLOWED_MAPPING_CONTENT_TYPES.has(contentType)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['contentType'],
      message: 'Material de mapeamento deve ser PDF, imagem, vídeo curto ou áudio.',
    })
  }
})

const MAX_ADMIN_EDITED_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_ADMIN_EDITED_IMAGE_BASE64_CHARS = 18 * 1024 * 1024

export const createKycAssetEditedCopySchema = z.object({
  base64: z.string().trim().min(1, 'A cópia ajustada não foi enviada.').max(MAX_ADMIN_EDITED_IMAGE_BASE64_CHARS, 'A cópia ajustada deve ter no máximo 12 MB.'),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
  originalFilename: nullableCleanString(180),
  byteSize: z.coerce.number().int().positive().max(MAX_ADMIN_EDITED_IMAGE_BYTES, 'A cópia ajustada deve ter no máximo 12 MB.'),
  note: nullableCleanString(1500),
  transform: z.object({
    cropAspect: z.enum(['original', 'square', 'portrait']).default('original'),
    zoom: z.coerce.number().min(1).max(4),
    offsetX: z.coerce.number().min(-5000).max(5000),
    offsetY: z.coerce.number().min(-5000).max(5000),
    rotation: z.coerce.number().min(-180).max(180),
    brightness: z.coerce.number().min(50).max(150),
    contrast: z.coerce.number().min(50).max(150),
    saturation: z.coerce.number().min(0).max(200),
    grayscale: z.coerce.number().min(0).max(100),
    outputWidth: z.coerce.number().int().min(320).max(4096),
    outputHeight: z.coerce.number().int().min(320).max(4096),
    preset: z.enum(['none', 'light_cleanup']).default('none'),
  }),
})


export const reclassifyKycAssetSchema = z.object({
  mappingRequirementId: uuidSchema,
  note: nullableCleanString(1500),
})

export const approveKycAssetSchema = z.object({
  note: nullableCleanString(1500),
})

export const rejectKycAssetSchema = z.object({
  reason: z.string().trim().min(2, 'Informe o motivo da rejeição do material.').max(1500),
})

export const approveKycCaseSchema = z.object({
  note: nullableCleanString(1500),
})

export const rejectKycCaseSchema = z.object({
  reason: z.string().trim().min(2, 'Informe o motivo da reprovação do mapeamento.').max(1500),
})

export const authorizeAvatarProductionSchema = z.object({
  actorProfileId: uuidSchema,
  kycCaseId: uuidSchema,
  authorizedForContentTypes: z.array(contentTypeSchema).optional().default([...CONTENT_TYPES]),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  note: nullableCleanString(1500),
  financeSnapshot: z.record(z.string(), z.unknown()).optional().default({}),
  termsSnapshot: z.record(z.string(), z.unknown()).optional().default({}),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
}).refine((value) => {
  if (!value.startsAt || !value.endsAt) return true
  return new Date(value.endsAt).getTime() > new Date(value.startsAt).getTime()
}, {
  path: ['endsAt'],
  message: 'A data final precisa ser posterior à data inicial.',
})

export const revokeAvatarProductionAuthorizationSchema = z.object({
  reason: optionalCleanString(1500),
})


export const listMappingVaultTestArtifactsQuerySchema = z.object({
  checkR2: booleanQueryParam(false),
  includeQuarantined: booleanQueryParam(false),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
})

export const quarantineMappingVaultTestArtifactsSchema = z.object({
  assetIds: z.array(uuidSchema).max(100).optional().default([]),
  dryRunOnly: z.boolean().optional().default(true),
  copyR2: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  reason: nullableCleanString(1000),
  confirmationPhrase: optionalCleanString(80),
})
