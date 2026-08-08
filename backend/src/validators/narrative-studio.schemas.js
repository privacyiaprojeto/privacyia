import { z } from 'zod'

export const NARRATIVE_CONTENT_TYPES = ['live_audio', 'live_action']

const narrativeContentTypeSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[\s-]+/g, '_')

    const aliases = {
      audio_live: 'live_audio',
      live_audio: 'live_audio',
      audio_story: 'live_audio',
      historia_audio: 'live_audio',
      live_action: 'live_action',
      video_live: 'live_action',
      cena_live: 'live_action',
      narrativa_video: 'live_action',
    }

    return aliases[normalized] || normalized
  })
  .refine((value) => NARRATIVE_CONTENT_TYPES.includes(value), {
    message: 'Tipo narrativo inválido. Use live_audio ou live_action.',
  })

const optionalText = (max = 2000) => z.string().trim().max(max).optional().default('')

export const narrativeStudioPreviewSchema = z.object({
  companionId: z.string().uuid('Avatar obrigatório.'),
  contentType: narrativeContentTypeSchema,
  publicTitle: z.string().trim().min(3, 'Título público obrigatório.').max(120),
  publicDescription: optionalText(600),
  event: optionalText(500),
  mood: optionalText(200),
  location: optionalText(300),
  narrativeIntent: optionalText(800),
  manualPrompt: optionalText(5000),
  voiceStyle: optionalText(300),
  visualStyle: optionalText(500),
  durationSeconds: z.coerce.number().int().min(10).max(360).default(90),
  priceCredits: z.coerce.number().int().min(0).max(100000).default(30),
  publishDestination: z.enum(['chat_side_store', 'avatar_feed', 'both', 'admin_only']).optional().default('chat_side_store'),
  isFreePreview: z.boolean().optional().default(false),
  isExclusiveForSale: z.boolean().optional().default(true),
  qaRequired: z.boolean().optional().default(true),
  safeModeOnly: z.boolean().optional().default(true),
})

export const narrativeStudioCreateDraftSchema = narrativeStudioPreviewSchema.extend({
  dryRunOnly: z.boolean().optional().default(true),
})
