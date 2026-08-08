import { z } from 'zod'

const optionalUuid = z.string().uuid().nullable().optional()

function emptyToNull(value) {
  return value === '' ? null : value
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function normalizeGerarVideoInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }

  const input = raw

  return {
    ...input,
    acaoId: emptyToNull(input.acaoId ?? input.acao ?? input.posicaoId ?? input.posicao ?? null),
    roupaId: emptyToNull(input.roupaId ?? input.roupa ?? null),
    localizacaoId: emptyToNull(input.localizacaoId ?? input.localizacao ?? input.ambienteId ?? input.ambiente ?? null),
    acessorioId: emptyToNull(input.acessorioId ?? input.acessorio ?? null),
    productionMode: String(input.productionMode ?? input.production_mode ?? (input.baseSceneId ? 'v2v' : 'i2v')).toLowerCase(),
    baseSceneId: emptyToNull(input.baseSceneId ?? input.base_scene_id ?? null),
    notes: emptyToNull(input.notes ?? input.prompt ?? null),
    guidedSelections: normalizeGuidedSelections(input.guidedSelections ?? input.selecoesGuiadas ?? input.dynamicSelections ?? null),
  }
}


const guidedSelectionSchema = z.object({
  titleId: z.string().uuid().nullable().optional(),
  category: z.string().trim().min(1).max(120).nullable().optional(),
  itemId: z.string().uuid('Item de criação inválido.'),
})

const guidedSelectionsSchema = z.array(guidedSelectionSchema).max(30).optional().default([])

function normalizeGuidedSelections(value) {
  if (!value) return []

  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        titleId: isUuid(item?.titleId) ? item.titleId : null,
        category: emptyToNull(item?.category ?? item?.categoria ?? item?.titleId ?? null),
        itemId: emptyToNull(item?.itemId ?? item?.id ?? null),
      }))
      .filter((item) => item.itemId)
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, itemId]) => Boolean(itemId))
      .map(([category, itemId]) => ({
        titleId: isUuid(category) ? category : null,
        category,
        itemId,
      }))
  }

  return []
}


function normalizeGerarImagemInput(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return raw
  }

  const input = raw

  return {
    ...input,
    posicaoId: input.posicaoId ?? input.posicao ?? null,
    ambienteId: input.ambienteId ?? input.ambiente ?? null,
    acessorioId: input.acessorioId ?? input.acessorio ?? null,
    roupaId: input.roupaId ?? input.roupa ?? null,
    guidedSelections: normalizeGuidedSelections(input.guidedSelections ?? input.selecoesGuiadas ?? input.dynamicSelections ?? null),
  }
}

export const gerarImagemSchema = z.preprocess(
  normalizeGerarImagemInput,
  z.object({
    atrizId: z.string().uuid('atrizId inválido'),
    posicaoId: optionalUuid,
    ambienteId: optionalUuid,
    acessorioId: optionalUuid,
    roupaId: optionalUuid,
    guidedSelections: guidedSelectionsSchema,
  }),
)

export const gerarVideoSchema = z.preprocess(
  normalizeGerarVideoInput,
  z.object({
    atrizId: z.string().uuid('atrizId inválido'),
    acaoId: optionalUuid,
    roupaId: optionalUuid,
    localizacaoId: optionalUuid,
    acessorioId: optionalUuid,
    productionMode: z.enum(['i2v', 'v2v']).default('i2v'),
    baseSceneId: optionalUuid,
    notes: z.string().trim().max(2000).nullable().optional(),
    guidedSelections: guidedSelectionsSchema,
  }),
)

export const denunciarGeracaoSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo da denúncia').max(500),
})
