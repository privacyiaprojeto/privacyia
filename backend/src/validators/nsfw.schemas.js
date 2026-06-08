import { z } from 'zod'

const optionalUuid = z.string().uuid().nullable().optional()

function emptyToNull(value) {
  return value === '' ? null : value
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
    baseVideoUrl: emptyToNull(input.baseVideoUrl ?? input.videoBaseUrl ?? input.targetVideoUrl ?? null),
    videoBaseUrl: emptyToNull(input.videoBaseUrl ?? input.baseVideoUrl ?? input.targetVideoUrl ?? null),
    targetVideoUrl: emptyToNull(input.targetVideoUrl ?? input.baseVideoUrl ?? input.videoBaseUrl ?? null),
    sourceImageUrl: emptyToNull(input.sourceImageUrl ?? input.referenceImageUrl ?? null),
    referenceImageUrl: emptyToNull(input.referenceImageUrl ?? input.sourceImageUrl ?? null),
  }
}

const optionalUrl = z.string().trim().url().nullable().optional()


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
    baseVideoUrl: optionalUrl,
    videoBaseUrl: optionalUrl,
    targetVideoUrl: optionalUrl,
    sourceImageUrl: optionalUrl,
    referenceImageUrl: optionalUrl,
  }),
)

export const denunciarGeracaoSchema = z.object({
  motivo: z.string().trim().min(3, 'Informe o motivo da denúncia').max(500),
})
