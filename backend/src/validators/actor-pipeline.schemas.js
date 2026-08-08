import { z } from 'zod'

export const actorPipelineActorParamSchema = z.object({
  actorId: z.string().uuid(),
})

export const actorPipelineProductParamSchema = z.object({
  actorId: z.string().uuid(),
  assetId: z.string().uuid(),
})

const dictionarySelectionSchema = z.object({
  id: z.string().uuid(),
})

const castParticipantSchema = z.object({
  actorProfileId: z.string().uuid().optional().nullable(),
  participantType: z.enum(['actor', 'virtual_extra']).default('virtual_extra'),
  extraType: z.enum(['generic_black_man', 'generic_white_muscular_man', 'generic_asian_woman', 'custom']).optional(),
  customDescription: z.string().trim().max(500).optional().nullable(),
})

export const actorIdentityLoraReadinessSchema = z.object({
  confirmation: z.literal('PREPARAR READINESS LORA STAGE 2.2A'),
}).strict()

export const actorIdentityPreparationAuthorizationSchema = z.object({
  confirmation: z.literal('AUTORIZAR USO PARA PREPARAR IDENTIDADE'),
  note: z.string().trim().max(1500).optional().nullable(),
}).strict()

export const actorIdentityDatasetRegistrationSchema = z.object({
  confirmation: z.literal('REGISTRAR CONJUNTO APROVADO'),
}).strict()

export const actorIdentityTrainingExecutionPlanSchema = z.object({
  confirmation: z.literal('PREPARAR PREFLIGHT CONTROLADO DA IDENTIDADE D3.5'),
}).strict()

export const actorIdentityTrainingStartSchema = z.object({
  confirmation: z.literal('CRIAR IDENTIDADE REAL CONTROLADA D3.6B'),
}).strict()

export const actorIdentityPreviewStartSchema = z.object({
  confirmation: z.literal('PREPARAR PREVIA PRIVADA DA IDENTIDADE'),
}).strict()

export const actorIdentityVideoForensicAuditSchema = z.object({
  confirmation: z.literal('EXECUTAR AUDITORIA FORENSE SEM GPU D3.6H3'),
}).strict()

export const actorIdentityTrainingTargetAuditSchema = z.object({
  confirmation: z.literal('EXECUTAR AUDITORIA DO ALVO DE TREINAMENTO D3.6H4'),
}).strict()

export const actorIdentityReviewDecisionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('approve'),
    confirmation: z.literal('APROVAR IDENTIDADE DE VIDEO DO ATOR'),
    notes: z.string().trim().max(1500).optional().nullable(),
  }).strict(),
  z.object({
    action: z.literal('reject'),
    confirmation: z.literal('REJEITAR IDENTIDADE E SOLICITAR NOVO TREINAMENTO'),
    reason: z.string().trim().min(10).max(1500),
    notes: z.string().trim().max(1500).optional().nullable(),
  }).strict(),
])

export const actorPipelineProductionSchema = z.object({
  productType: z.enum(['image', 'short_video', 'live_action_v2v', 'live_audio']),
  dictionarySelections: z.array(dictionarySelectionSchema).max(60).default([]),
  variations: z.coerce.number().int().min(1).max(20).default(1),
  baseSceneId: z.string().uuid().optional().nullable(),
  storylineId: z.string().uuid().optional().nullable(),
  additionalCast: z.array(castParticipantSchema).max(2).default([]),
  notes: z.string().trim().max(1000).optional().nullable(),
})

const splitSchema = z.object({
  beneficiaryId: z.string().uuid(),
  beneficiaryType: z.enum(['actor', 'company']),
  splitPercentage: z.coerce.number().min(0).max(100),
  displayOnStorefront: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(2).default(0),
})


export const actorPipelineApproveSchema = z.object({
  notes: z.string().trim().max(1000).optional().nullable(),
})

export const actorPipelineRejectSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
})

export const actorPipelinePublicationSchema = z.object({
  destination: z.enum(['feed', 'premium', 'public_storefront']),
  priceCredits: z.coerce.number().int().min(1).max(1000000),
  description: z.string().trim().min(3).max(2000),
  splits: z.array(splitSchema).min(1).max(3),
}).superRefine((value, ctx) => {
  const total = value.splits.reduce((sum, item) => sum + Number(item.splitPercentage || 0), 0)
  if (total > 100.0001) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['splits'], message: 'A soma dos repasses não pode ultrapassar 100%.' })
  }

  const keys = value.splits.map((item) => `${item.beneficiaryType}:${item.beneficiaryId}`)
  if (new Set(keys).size !== keys.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['splits'], message: 'O mesmo beneficiário não pode aparecer duas vezes.' })
  }
})
