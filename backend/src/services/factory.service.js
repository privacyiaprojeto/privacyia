import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { generateImageWithRunPod } from './providers/runpod.provider.js'
import {
  buildOrganizedMediaKey,
  getExtensionFromContentType,
  uploadPrivateImageBuffer,
} from './storage.service.js'
import { registerMasterForLegacyVariant } from './media-asset-master.service.js'
import { requestDefaultRenditionsForMaster } from './media-rendition.service.js'
import { loadApprovedActorIdentityReferences } from './production-identity.service.js'
import { markClientGenerationFailed, markClientGenerationQaPending } from './media-generation-tracking.service.js'
import { assertApprovedActorIdentityForProduction } from './actor-identity-lora.service.js'

const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const BATCHES_TABLE = 'media_generation_batches'
const COMBINATIONS_TABLE = 'media_combinations'
const COMPANIONS_TABLE = 'companions'
const ASSET_VARIANTS_TABLE = 'media_asset_variants'

const allowedFinalStatuses = new Set(['qa_pending', 'completed'])

const payloadColumnCandidates = [
  'generation_payload',
  'generation_params',
  'prompt_payload',
  'provider_payload',
  'factory_payload',
  'result_payload',
  'output_payload',
  'qa_payload',
  'metadata',
]

const promptColumnCandidates = [
  'prompt_final',
  'final_prompt',
  'prompt_text',
  'prompt',
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function hasColumn(row, columnName) {
  return Boolean(row && Object.prototype.hasOwnProperty.call(row, columnName))
}

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstFilled(...values) {
  return values
    .map((value) => (typeof value === 'string' ? normalizeText(value) : value))
    .find((value) => value !== undefined && value !== null && value !== '')
}

function firstIdFrom(...values) {
  return firstFilled(...values) || null
}

function truthy(value) {
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value || '').trim().toLowerCase())
}

function hashText(value) {
  const clean = normalizeText(value)

  if (!clean) return null

  return createHash('sha256').update(clean).digest('hex')
}

const PRIVATE_STORAGE_URL_KEYS = new Set([
  'r2_public_url',
  'public_url',
  'output_url',
  'file_url',
  'preview_url',
  'download_url',
  'signed_url',
])

function stripPrivateStorageUrlFields(value) {
  if (Array.isArray(value)) {
    return value.map(stripPrivateStorageUrlFields)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  const clean = {}

  for (const [key, nestedValue] of Object.entries(value)) {
    if (PRIVATE_STORAGE_URL_KEYS.has(String(key).toLowerCase())) continue
    clean[key] = stripPrivateStorageUrlFields(nestedValue)
  }

  return clean
}

function normalizeFactoryMediaType(value = 'imagem') {
  const normalized = normalizeText(value).toLowerCase()

  if (['imagem', 'image', 'img', 'photo', 'picture', 'foto'].includes(normalized)) {
    return 'imagem'
  }

  if (['video', 'videos', 'movie'].includes(normalized)) {
    return 'video'
  }

  if (['audio', 'voice', 'speech', 'tts'].includes(normalized)) {
    return 'audio'
  }

  if (['live_action', 'live-action', 'live action'].includes(normalized)) {
    return 'live_action'
  }

  if (['live_audio', 'live-audio', 'live audio'].includes(normalized)) {
    return 'live_audio'
  }

  return 'imagem'
}

function getVariantNumber({ jobData = {}, item = {} }) {
  return Math.max(Number(firstFilled(
    jobData.variantNumber,
    jobData.variant_number,
    item.variant_number,
    item.variantNumber,
    1,
  )) || 1, 1)
}

function getAssetStatusForItemStatus(status) {
  if (status === 'completed') return 'available'
  if (status === 'qa_pending') return 'qa_pending'
  if (status === 'rejected') return 'rejected'
  return 'qa_pending'
}

function assertJobPayload(data = {}) {
  if (!data.batchItemId && !data.batch_item_id) {
    throw new ApiError(400, 'batchItemId não informado no job da fábrica.')
  }

  const nextStatus = data.nextStatus || data.next_status

  if (nextStatus && !allowedFinalStatuses.has(nextStatus)) {
    throw new ApiError(400, 'Status final inválido para processamento da fábrica.', {
      nextStatus,
    })
  }
}

function getBatchItemId(data = {}) {
  return firstIdFrom(data.batchItemId, data.batch_item_id, data.itemId, data.item_id)
}

function getBatchId({ jobData = {}, item = {} }) {
  return firstIdFrom(
    jobData.batchId,
    jobData.batch_id,
    item.batch_id,
    item.batchId,
  )
}

function getCombinationId({ jobData = {}, item = {}, batch = {} }) {
  return firstIdFrom(
    jobData.combinationId,
    jobData.combination_id,
    jobData.mediaCombinationId,
    jobData.media_combination_id,
    item.combination_id,
    item.combinationId,
    item.media_combination_id,
    item.mediaCombinationId,
    batch.combination_id,
    batch.combinationId,
    batch.media_combination_id,
    batch.mediaCombinationId,
  )
}

function getCompanionId({ jobData = {}, item = {}, batch = {}, combination = {} }) {
  return firstIdFrom(
    jobData.companionId,
    jobData.companion_id,
    jobData.atrizId,
    jobData.atriz_id,
    item.companion_id,
    item.companionId,
    item.actress_id,
    item.actressId,
    item.atriz_id,
    item.atrizId,
    batch.companion_id,
    batch.companionId,
    batch.actress_id,
    batch.actressId,
    batch.atriz_id,
    batch.atrizId,
    combination.companion_id,
    combination.companionId,
    combination.actress_id,
    combination.actressId,
    combination.atriz_id,
    combination.atrizId,
  )
}

function getRequestedVariants(jobData = {}, item = {}, batch = {}) {
  return Math.max(
    Number(
      firstFilled(
        jobData.requestedVariants,
        jobData.requested_variants,
        item.requested_variants,
        item.requestedVariants,
        batch.requested_variants,
        batch.requestedVariants,
        1,
      ),
    ) || 1,
    1,
  )
}

function getMediaKind({ jobData = {}, item = {}, batch = {}, combination = {} }) {
  return normalizeText(
    firstFilled(
      jobData.mediaKind,
      jobData.media_kind,
      jobData.mediaType,
      jobData.media_type,
      item.media_kind,
      item.mediaKind,
      item.media_type,
      item.mediaType,
      batch.media_kind,
      batch.mediaKind,
      batch.media_type,
      batch.mediaType,
      combination.media_kind,
      combination.mediaKind,
      combination.media_type,
      combination.mediaType,
      'imagem',
    ),
  )
}

function getCombinationName(combination = {}) {
  return normalizeText(
    firstFilled(
      combination.name,
      combination.label,
      combination.title,
      combination.slug,
      combination.id,
      'factory combination',
    ),
  )
}

function getCombinationPrompt(combination = {}) {
  return normalizeText(
    firstFilled(
      combination.prompt_final,
      combination.final_prompt,
      combination.prompt_template,
      combination.prompt,
      combination.base_prompt,
      combination.description,
      combination.label,
      combination.name,
    ),
  )
}

function buildCompanionDescriptor(companion = {}) {
  return [
    companion.name,
    companion.slug ? `slug ${companion.slug}` : null,
    companion.age ? `${companion.age} anos` : null,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(', ')
}

function buildDryRunPrompt({ companion, combination, mediaKind }) {
  const combinationPrompt = getCombinationPrompt(combination)
  const companionDescriptor = buildCompanionDescriptor(companion)

  return [
    'factory offline dry-run payload',
    mediaKind ? `media_kind: ${mediaKind}` : null,
    companionDescriptor ? `companion: ${companionDescriptor}` : null,
    combinationPrompt ? `combination_prompt: ${combinationPrompt}` : `combination: ${getCombinationName(combination)}`,
    'provider call disabled',
    'gpu cost disabled',
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' | ')
}

function getStoredPayloadEnvelope(row = {}) {
  for (const column of payloadColumnCandidates) {
    const value = row?.[column]

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value
    }
  }

  return {}
}

function toTelemetryNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function roundTelemetryUsd(value) {
  const parsed = toTelemetryNumber(value)
  if (parsed === null) return null
  return Math.round((parsed + Number.EPSILON) * 100000000) / 100000000
}

function getStoredRunPodTelemetry(row = {}) {
  const nativeTelemetry = row?.telemetry
  if (nativeTelemetry && typeof nativeTelemetry === 'object' && !Array.isArray(nativeTelemetry)) {
    return nativeTelemetry
  }

  const envelopeTelemetry = getStoredPayloadEnvelope(row)?.telemetry
  if (envelopeTelemetry && typeof envelopeTelemetry === 'object' && !Array.isArray(envelopeTelemetry)) {
    return envelopeTelemetry
  }

  return {
    version: 1,
    provider: 'runpod',
    attempts: [],
    totals: {},
  }
}

function normalizeRunPodTelemetryAttempt(telemetry = {}, job = {}) {
  if (!telemetry || typeof telemetry !== 'object') return null

  const queueAttempt = Math.max(Number(job?.attemptsMade || 0) + 1, 1)
  const providerJobId = telemetry.providerJobId || telemetry.provider_job_id || null
  const attemptKey = telemetry.attemptKey || telemetry.attempt_key || (
    providerJobId
      ? `runpod:${providerJobId}`
      : `bullmq:${job?.id || 'unknown'}:attempt:${queueAttempt}`
  )

  return {
    version: Number(telemetry.version || 1) || 1,
    provider: telemetry.provider || 'runpod',
    mediaType: telemetry.mediaType || telemetry.media_type || 'image',
    endpointId: telemetry.endpointId || telemetry.endpoint_id || null,
    providerJobId,
    workerId: telemetry.workerId || telemetry.worker_id || null,
    gpuType: telemetry.gpuType || telemetry.gpu_type || null,
    providerMetrics: telemetry.providerMetrics || telemetry.provider_metrics || {},
    status: telemetry.status || null,
    executionTimeMs: toTelemetryNumber(telemetry.executionTimeMs ?? telemetry.execution_time_ms),
    delayTimeMs: toTelemetryNumber(telemetry.delayTimeMs ?? telemetry.delay_time_ms),
    actualCostUsd: roundTelemetryUsd(telemetry.actualCostUsd ?? telemetry.actual_cost_usd),
    providerReportedCostUsd: roundTelemetryUsd(
      telemetry.providerReportedCostUsd ?? telemetry.provider_reported_cost_usd,
    ),
    costRateUsdPerSecond: toTelemetryNumber(
      telemetry.costRateUsdPerSecond ?? telemetry.cost_rate_usd_per_second,
    ),
    costRateSource: telemetry.costRateSource || telemetry.cost_rate_source || null,
    costSource: telemetry.costSource || telemetry.cost_source || 'unavailable',
    costStatus: telemetry.costStatus || telemetry.cost_status || 'unavailable',
    billable: Boolean(telemetry.billable),
    errorType: telemetry.errorType || telemetry.error_type || null,
    attemptKey,
    capturedAt: telemetry.capturedAt || telemetry.captured_at || new Date().toISOString(),
    queueJobId: job?.id || null,
    queueJobName: job?.name || null,
    queueAttempt,
  }
}

function buildRunPodTelemetryPersistence(row = {}, telemetry = null, job = {}) {
  const attempt = normalizeRunPodTelemetryAttempt(telemetry, job)

  if (!attempt) {
    return {
      telemetryNode: getStoredRunPodTelemetry(row),
      columnPayload: {},
    }
  }

  const previous = getStoredRunPodTelemetry(row)
  const previousAttempts = Array.isArray(previous?.attempts) ? previous.attempts : []
  const alreadyRecorded = previousAttempts.some((entry) => {
    const entryKey = entry?.attemptKey || entry?.attempt_key
    return entryKey && entryKey === attempt.attemptKey
  })
  const attempts = alreadyRecorded ? previousAttempts : [...previousAttempts, attempt]

  const costValues = attempts
    .map((entry) => toTelemetryNumber(entry?.actualCostUsd ?? entry?.actual_cost_usd))
    .filter((value) => value !== null)
  const executionValues = attempts
    .map((entry) => toTelemetryNumber(entry?.executionTimeMs ?? entry?.execution_time_ms))
    .filter((value) => value !== null)
  const delayValues = attempts
    .map((entry) => toTelemetryNumber(entry?.delayTimeMs ?? entry?.delay_time_ms))
    .filter((value) => value !== null)

  const totalActualCostUsd = costValues.length > 0
    ? roundTelemetryUsd(costValues.reduce((total, value) => total + value, 0))
    : null
  const totalExecutionTimeMs = executionValues.length > 0
    ? Math.round(executionValues.reduce((total, value) => total + value, 0))
    : null
  const totalDelayTimeMs = delayValues.length > 0
    ? Math.round(delayValues.reduce((total, value) => total + value, 0))
    : null
  const latest = attempts[attempts.length - 1] || attempt

  const telemetryNode = {
    version: 1,
    provider: 'runpod',
    attempts,
    totals: {
      attempts: attempts.length,
      actualCostUsd: totalActualCostUsd,
      executionTimeMs: totalExecutionTimeMs,
      delayTimeMs: totalDelayTimeMs,
      billableAttempts: attempts.filter((entry) => Boolean(entry?.billable)).length,
    },
    latest,
    updatedAt: new Date().toISOString(),
  }

  const columnPayload = {}
  const nativeColumns = {
    provider_name: latest.provider || 'runpod',
    provider_job_id: latest.providerJobId || null,
    provider_endpoint_id: latest.endpointId || null,
    provider_worker_id: latest.workerId || null,
    provider_status: latest.status || null,
    provider_gpu_type: latest.gpuType || null,
    execution_time_ms: totalExecutionTimeMs,
    delay_time_ms: totalDelayTimeMs,
    actual_cost_usd: totalActualCostUsd,
    cost_rate_usd_per_second: latest.costRateUsdPerSecond ?? null,
    cost_source: latest.costSource || null,
    cost_status: latest.costStatus || null,
    telemetry: telemetryNode,
    telemetry_recorded_at: latest.capturedAt || new Date().toISOString(),
  }

  for (const [column, value] of Object.entries(nativeColumns)) {
    if (hasColumn(row, column)) columnPayload[column] = value
  }

  return {
    telemetryNode,
    columnPayload,
  }
}

function buildDryRunPayload({ job, item, batch, combination, companion }) {
  const jobData = job.data || {}
  const batchItemId = getBatchItemId(jobData)
  const batchId = getBatchId({ jobData, item })
  const combinationId = getCombinationId({ jobData, item, batch })
  const companionId = companion?.id || getCompanionId({ jobData, item, batch, combination })
  const mediaKind = getMediaKind({ jobData, item, batch, combination })
  const requestedVariants = getRequestedVariants(jobData, item, batch)
  const prompt = buildDryRunPrompt({ companion, combination, mediaKind })
  const previousEnvelope = getStoredPayloadEnvelope(item)

  return {
    ...previousEnvelope,
    factoryMode: 'dry_run',
    dryRun: true,
    provider: 'dry_run',
    engine: 'factory_offline_dry_run',
    mediaKind,
    media_kind: mediaKind,
    batchId,
    batch_id: batchId,
    batchItemId,
    batch_item_id: batchItemId,
    combinationId,
    combination_id: combinationId,
    companionId,
    companion_id: companionId,
    requestedVariants,
    requested_variants: requestedVariants,
    prompt,
    prompt_text: prompt,
    generationConfig: {
      width: Number(firstFilled(jobData.width, combination?.width, batch?.width, 1024)) || 1024,
      height: Number(firstFilled(jobData.height, combination?.height, batch?.height, 1024)) || 1024,
      steps: Number(firstFilled(jobData.steps, combination?.steps, batch?.steps, 32)) || 32,
      guidance_scale: Number(firstFilled(jobData.guidance_scale, combination?.guidance_scale, batch?.guidance_scale, 6.5)) || 6.5,
    },
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatar_url: companion.avatar_url || null,
          thumbnail_url: companion.thumbnail_url || null,
          banner_url: companion.banner_url || null,
        }
      : null,
    mediaCombination: combination
      ? {
          id: combination.id,
          name: combination.name || null,
          label: combination.label || null,
          slug: combination.slug || null,
          media_type: combination.media_type || null,
          media_kind: combination.media_kind || null,
        }
      : null,
    queueJob: {
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
    },
    requestedAt: new Date().toISOString(),
  }
}

function buildExistingColumnPayload(row, payload) {
  const update = {}

  for (const column of payloadColumnCandidates) {
    if (hasColumn(row, column)) {
      update[column] = payload
    }
  }

  for (const column of promptColumnCandidates) {
    if (hasColumn(row, column)) {
      update[column] = payload.prompt || payload.prompt_text || null
    }
  }

  return update
}

function buildStatusPayload(row, status, extra = {}) {
  const update = {}
  const now = new Date().toISOString()

  if (hasColumn(row, 'status')) update.status = status
  if (hasColumn(row, 'updated_at')) update.updated_at = now

  for (const [column, value] of Object.entries(extra)) {
    if (hasColumn(row, column)) {
      update[column] = value
    }
  }

  return update
}

async function updateById(tableName, id, payload, context = {}) {
  if (!id || Object.keys(payload).length === 0) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (!error) {
    return data
  }

  throw new ApiError(500, `Falha ao atualizar ${tableName}.`, {
    ...context,
    id,
    error: error.message,
  })
}

async function safeUpdateById(tableName, id, payload, fallbackPayload, context = {}) {
  if (!id || Object.keys(payload).length === 0) {
    return null
  }

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .update(payload)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (!error) {
    return data
  }

  if (!fallbackPayload || Object.keys(fallbackPayload).length === 0) {
    throw new ApiError(500, `Falha ao atualizar ${tableName}.`, {
      ...context,
      id,
      error: error.message,
    })
  }

  console.warn(`[factory] atualização completa de ${tableName} falhou; aplicando fallback mínimo:`, error.message)

  return updateById(tableName, id, fallbackPayload, context)
}

async function getById(tableName, id, label) {
  if (!id) return null

  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, `Falha ao buscar ${label}.`, {
      id,
      error: error.message,
    })
  }

  return data || null
}

async function getFirstActiveCompanion() {
  const { data, error } = await supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Falha ao buscar primeira companion ativa da fábrica.', {
      error: error.message,
    })
  }

  return data || null
}

async function getCompanion(companionId) {
  const companion = companionId
    ? await getById(COMPANIONS_TABLE, companionId, 'companion da fábrica')
    : null

  if (companion) {
    return companion
  }

  return getFirstActiveCompanion()
}

async function loadFactoryEntities(jobData = {}) {
  const batchItemId = getBatchItemId(jobData)
  let item = await getById(BATCH_ITEMS_TABLE, batchItemId, 'item do lote da fábrica')

  if (!item) {
    throw new ApiError(404, 'Item do lote da fábrica não encontrado.', {
      batchItemId,
    })
  }

  const runningPayload = buildStatusPayload(item, 'running')
  item = await updateById(BATCH_ITEMS_TABLE, batchItemId, runningPayload, { batchItemId }) || item

  const batchId = getBatchId({ jobData, item })
  let batch = await getById(BATCHES_TABLE, batchId, 'lote da fábrica')

  if (batch) {
    const batchRunningPayload = buildStatusPayload(batch, 'running', {
      started_at: batch.started_at || new Date().toISOString(),
    })

    batch = await updateById(BATCHES_TABLE, batch.id, batchRunningPayload, { batchId: batch.id }) || batch
  }

  const combinationId = getCombinationId({ jobData, item, batch })
  const combination = await getById(COMBINATIONS_TABLE, combinationId, 'combinação de mídia da fábrica')

  const companionId = getCompanionId({ jobData, item, batch, combination })
  const companion = await getCompanion(companionId)

  return {
    batchItemId,
    item,
    batch,
    combination,
    companion,
  }
}

function buildFactoryImagePrompt({ companion, combination, mediaKind, previousPayload = {} }) {
  const promptFromPayload = normalizeText(
    firstFilled(
      previousPayload.prompt,
      previousPayload.prompt_text,
      previousPayload.promptText,
      previousPayload.final_prompt,
      previousPayload.prompt_final,
    ),
  )

  if (promptFromPayload) {
    return promptFromPayload
  }

  const combinationPrompt = getCombinationPrompt(combination)
  const companionName = normalizeText(companion?.name || companion?.slug || 'adult female model')

  return [
    `photorealistic editorial portrait of ${companionName}`,
    mediaKind ? `media_kind: ${mediaKind}` : null,
    combinationPrompt || getCombinationName(combination),
    'solo adult subject',
    'cinematic lighting',
    'professional photography',
    'high detail',
    'consented adult subject',
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(', ')
}

function buildFactoryNegativePrompt(previousPayload = {}) {
  return normalizeText(
    firstFilled(
      previousPayload.negative_prompt,
      previousPayload.negativePrompt,
      previousPayload.negative,
      'low quality, blurry, distorted face, bad anatomy, extra fingers, missing fingers, deformed hands, watermark, text, logo, duplicate person, bad proportions, jpeg artifacts',
    ),
  )
}

function getNumericConfigValue(...values) {
  const value = Number(firstFilled(...values))
  return Number.isFinite(value) && value > 0 ? value : null
}

function buildFactoryImagePromptPayload({ job, item, batch, combination, companion }) {
  const jobData = job.data || {}
  const previousPayload = getStoredPayloadEnvelope(item)
  const previousGenerationConfig = previousPayload.generationConfig || previousPayload.generation_config || {}
  const mediaKind = getMediaKind({ jobData, item, batch, combination })

  const width = getNumericConfigValue(
    jobData.width,
    previousPayload.width,
    previousGenerationConfig.width,
    combination?.width,
    batch?.width,
    1024,
  ) || 1024

  const height = getNumericConfigValue(
    jobData.height,
    previousPayload.height,
    previousGenerationConfig.height,
    combination?.height,
    batch?.height,
    1024,
  ) || 1024

  const steps = getNumericConfigValue(
    jobData.steps,
    previousPayload.steps,
    previousPayload.num_inference_steps,
    previousGenerationConfig.steps,
    previousGenerationConfig.num_inference_steps,
    combination?.steps,
    batch?.steps,
    32,
  ) || 32

  const guidanceScale = Number(
    firstFilled(
      jobData.guidance_scale,
      previousPayload.guidance_scale,
      previousGenerationConfig.guidance_scale,
      combination?.guidance_scale,
      batch?.guidance_scale,
      6.5,
    ),
  ) || 6.5

  return {
    mediaKind,
    companionId: companion?.id || null,
    prompt: buildFactoryImagePrompt({
      companion,
      combination,
      mediaKind,
      previousPayload,
    }),
    prompt_text: buildFactoryImagePrompt({
      companion,
      combination,
      mediaKind,
      previousPayload,
    }),
    negative_prompt: buildFactoryNegativePrompt(previousPayload),
    negativePrompt: buildFactoryNegativePrompt(previousPayload),
    width,
    height,
    steps,
    num_inference_steps: steps,
    guidance_scale: guidanceScale,
    generationConfig: {
      width,
      height,
      steps,
      num_inference_steps: steps,
      guidance_scale: guidanceScale,
    },
    source: 'factory_queue',
    requestedAt: new Date().toISOString(),
  }
}

function buildFactoryRealImagePayload({
  job,
  item,
  batch,
  combination,
  companion,
  promptPayload,
  storageUpload,
  storageKey,
  runpodJobId,
  generatedImage,
  assetVariant,
  delivery,
  galleryItem,
  telemetry,
}) {
  const jobData = job.data || {}
  const batchItemId = getBatchItemId(jobData)
  const batchId = getBatchId({ jobData, item })
  const combinationId = getCombinationId({ jobData, item, batch })
  const companionId = companion?.id || getCompanionId({ jobData, item, batch, combination })
  const previousEnvelope = stripPrivateStorageUrlFields(getStoredPayloadEnvelope(item))

  return {
    ...previousEnvelope,
    factoryMode: 'real_image',
    dryRun: false,
    provider: 'runpod',
    engine: 'factory_queue_real_image_v1',
    mediaKind: promptPayload.mediaKind || 'imagem',
    media_kind: promptPayload.mediaKind || 'imagem',
    batchId,
    batch_id: batchId,
    batchItemId,
    batch_item_id: batchItemId,
    combinationId,
    combination_id: combinationId,
    companionId,
    companion_id: companionId,
    prompt: promptPayload.prompt,
    prompt_text: promptPayload.prompt_text || promptPayload.prompt,
    negative_prompt: promptPayload.negative_prompt,
    generationConfig: promptPayload.generationConfig,
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatar_url: companion.avatar_url || null,
          thumbnail_url: companion.thumbnail_url || null,
          banner_url: companion.banner_url || null,
        }
      : null,
    mediaCombination: combination
      ? {
          id: combination.id,
          name: combination.name || null,
          label: combination.label || null,
          slug: combination.slug || null,
          media_type: combination.media_type || null,
          media_kind: combination.media_kind || null,
        }
      : null,
    queueJob: {
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
    },
    telemetry: telemetry || null,
    output: {
      media_type: 'image',
      mime_type: generatedImage?.mimeType || storageUpload?.contentType || 'image/png',
      extension: generatedImage?.extension || 'png',
      r2_bucket: storageUpload?.bucket || env.R2_BUCKET_NAME,
      r2_key: storageKey,
      byte_size: storageUpload?.byteSize || generatedImage?.buffer?.length || null,
      etag: storageUpload?.etag || null,
      version_id: storageUpload?.versionId || null,
      private: true,
      runpod_job_id: runpodJobId || null,
      variant_id: assetVariant?.id || null,
      delivery_id: delivery?.id || null,
      gallery_item_id: galleryItem?.id || null,
      generated_at: new Date().toISOString(),
    },
    assetVariant: assetVariant
      ? {
          id: assetVariant.id,
          status: assetVariant.status || null,
          media_type: assetVariant.media_type || null,
          variant_number: assetVariant.variant_number || null,
          r2_bucket: assetVariant.r2_bucket || null,
          r2_key: assetVariant.r2_key || null,
        }
      : null,
    delivery: delivery
      ? {
          id: delivery.id,
          profile_id: delivery.profile_id || null,
          delivery_source: delivery.delivery_source || null,
        }
      : null,
    galleryItem: galleryItem
      ? {
          id: galleryItem.id,
          profile_id: galleryItem.profile_id || null,
          source: galleryItem.source || null,
        }
      : null,
    requestedAt: previousEnvelope.requestedAt || previousEnvelope.requested_at || null,
    completedAt: new Date().toISOString(),
  }
}

async function insertMediaAssetVariant({
  job,
  item,
  batch,
  combination,
  companion,
  promptPayload,
  storageUpload,
  storageKey,
  generatedImage,
  runpodJobId,
  nextStatus,
  telemetry,
}) {
  if (!combination?.id) {
    throw new ApiError(500, 'Combinação de mídia não encontrada para registrar asset da fábrica.', {
      batchItemId: item?.id,
      batchId: batch?.id,
    })
  }

  if (!companion?.id) {
    throw new ApiError(500, 'Companion não encontrada para registrar asset da fábrica.', {
      batchItemId: item?.id,
      batchId: batch?.id,
    })
  }

  const jobData = job.data || {}
  const mediaType = normalizeFactoryMediaType(promptPayload.mediaKind || promptPayload.media_kind || 'imagem')
  const variantNumber = getVariantNumber({ jobData, item })
  const status = getAssetStatusForItemStatus(nextStatus)
  const promptHash = hashText(promptPayload.prompt || promptPayload.prompt_text)

  const insertPayload = {
    combination_id: combination.id,
    batch_id: batch?.id || item?.batch_id || null,
    batch_item_id: item?.id || null,
    companion_id: companion.id,
    actor_profile_id: item?.actor_profile_id || batch?.actor_profile_id || jobData.actorProfileId || jobData.actor_profile_id || combination?.actor_profile_id || null,
    avatar_production_authorization_id: item?.avatar_production_authorization_id || batch?.avatar_production_authorization_id || jobData.productionAuthorizationId || jobData.production_authorization_id || combination?.avatar_production_authorization_id || null,
    media_origin: item?.media_origin || batch?.media_origin || combination?.media_origin || 'factory_queue',
    media_type: mediaType,
    variant_number: variantNumber,
    r2_bucket: storageUpload?.bucket || env.R2_BUCKET_NAME,
    r2_key: storageKey,
    seed: promptPayload.seed ? String(promptPayload.seed) : null,
    prompt_hash: promptHash,
    engine: 'runpod',
    model_version: jobData.modelVersion || jobData.model_version || promptPayload.model_version || null,
    status,
    max_assignments: Number(combination?.max_assignments || 1) || 1,
    current_assignments: 0,
    qa_payload: {
      status,
      source: 'factory_queue',
      requires_qa: status === 'qa_pending',
      batch_id: batch?.id || item?.batch_id || null,
      batch_item_id: item?.id || null,
      combination_id: combination.id,
      companion_id: companion.id,
      actor_profile_id: item?.actor_profile_id || batch?.actor_profile_id || jobData.actorProfileId || jobData.actor_profile_id || combination?.actor_profile_id || null,
      runpod_job_id: runpodJobId || null,
      r2_bucket: storageUpload?.bucket || env.R2_BUCKET_NAME,
      r2_key: storageKey,
      mime_type: generatedImage?.mimeType || storageUpload?.contentType || 'image/png',
      byte_size: storageUpload?.byteSize || generatedImage?.buffer?.length || null,
      private_storage: true,
      telemetry: telemetry || null,
      generated_at: new Date().toISOString(),
    },
    metadata: {
      source: 'factory_queue_real_image_v2_private',
      actor_profile_id: item?.actor_profile_id || batch?.actor_profile_id || jobData.actorProfileId || jobData.actor_profile_id || combination?.actor_profile_id || null,
      avatar_production_authorization_id: item?.avatar_production_authorization_id || batch?.avatar_production_authorization_id || jobData.productionAuthorizationId || jobData.production_authorization_id || combination?.avatar_production_authorization_id || null,
      provider: 'runpod',
      telemetry: telemetry || null,
      storage: {
        bucket: storageUpload?.bucket || env.R2_BUCKET_NAME,
        key: storageKey,
        content_type: storageUpload?.contentType || generatedImage?.mimeType || 'image/png',
        byte_size: storageUpload?.byteSize || generatedImage?.buffer?.length || null,
        etag: storageUpload?.etag || null,
        version_id: storageUpload?.versionId || null,
        private: true,
      },
      runpod_job_id: runpodJobId || null,
      prompt_payload: stripPrivateStorageUrlFields(promptPayload),
      generation_config: promptPayload.generationConfig || promptPayload.generation_config || {},
      queue_job: {
        id: job.id,
        name: job.name,
        attempts_made: job.attemptsMade,
      },
    },
  }

  const { data, error } = await supabaseAdmin
    .from(ASSET_VARIANTS_TABLE)
    .insert(insertPayload)
    .select('*')
    .single()

  if (!error) {
    return data
  }

  if (error?.code === '23505' || /duplicate key/i.test(String(error?.message || ''))) {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from(ASSET_VARIANTS_TABLE)
      .select('*')
      .eq('r2_bucket', storageUpload?.bucket || env.R2_BUCKET_NAME)
      .eq('r2_key', storageKey)
      .maybeSingle()

    if (!existingError && existing) {
      return existing
    }
  }

  throw new ApiError(500, 'Falha ao registrar asset privado gerado pela fábrica.', {
    batchItemId: item?.id,
    batchId: batch?.id,
    combinationId: combination.id,
    companionId: companion.id,
    r2Key: storageKey,
    error: error.message,
  })
}

async function recomputeFactoryBatchProgress(batchId) {
  if (!batchId) return null

  const { data: rows, error } = await supabaseAdmin
    .from(BATCH_ITEMS_TABLE)
    .select('id,status,generated_variants,approved_variants,rejected_variants')
    .eq('batch_id', batchId)

  if (error) {
    throw new ApiError(500, 'Falha ao recomputar o progresso canônico do lote.', {
      batchId,
      error: error.message,
    })
  }

  const counters = {
    total: 0,
    queued: 0,
    processing: 0,
    qaPending: 0,
    completed: 0,
    failed: 0,
    generated: 0,
    approved: 0,
    rejected: 0,
  }

  for (const row of rows || []) {
    const status = String(row.status || '').trim().toLowerCase()
    counters.total += 1
    counters.generated += Math.max(Number(row.generated_variants || 0) || 0, 0)
    counters.approved += Math.max(Number(row.approved_variants || 0) || 0, 0)
    counters.rejected += Math.max(Number(row.rejected_variants || 0) || 0, 0)

    if (['planned', 'approved_to_queue', 'queued'].includes(status)) counters.queued += 1
    else if (['processing', 'running'].includes(status)) counters.processing += 1
    else if (status === 'qa_pending') counters.qaPending += 1
    else if (['completed', 'available'].includes(status)) counters.completed += 1
    else if (['failed', 'rejected', 'cancelled'].includes(status)) counters.failed += 1
  }

  let status = 'planned'

  if (counters.processing > 0) status = 'processing'
  else if (counters.queued > 0) status = 'approved_to_queue'
  else if (counters.qaPending > 0) status = 'qa_pending'
  else if (counters.total > 0 && counters.completed + counters.failed === counters.total) {
    status = counters.completed > 0 ? 'completed' : 'failed'
  }

  const terminal = counters.total > 0 &&
    counters.queued === 0 &&
    counters.processing === 0 &&
    counters.qaPending === 0

  const { data, error: updateError } = await supabaseAdmin
    .from(BATCHES_TABLE)
    .update({
      status,
      total_items: counters.total,
      total_count: counters.total,
      queued_items: counters.queued,
      processing_items: counters.processing,
      qa_pending_items: counters.qaPending,
      completed_items: counters.completed,
      failed_items: counters.failed,
      generated_count: counters.generated,
      approved_count: counters.approved,
      rejected_count: counters.rejected,
      updated_at: new Date().toISOString(),
      ...(terminal ? { completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', batchId)
    .select('*')
    .maybeSingle()

  if (updateError) {
    throw new ApiError(500, 'Falha ao atualizar os contadores canônicos do lote.', {
      batchId,
      error: updateError.message,
    })
  }

  return data
}

async function finalizeFactoryItemAndBatch({
  item,
  batch,
  batchItemId,
  nextStatus,
  generatedVariants,
  payload,
  telemetryColumns = {},
}) {
  const isCompleted = nextStatus === 'completed'

  const itemFinalPayload = {
    ...buildStatusPayload(item, nextStatus, {
      generated_variants: generatedVariants,
      approved_variants: isCompleted ? generatedVariants : 0,
      completed_at: new Date().toISOString(),
    }),
    ...buildExistingColumnPayload(item, payload),
    ...telemetryColumns,
  }

  const itemFallbackPayload = buildStatusPayload(item, nextStatus, {
    generated_variants: generatedVariants,
    approved_variants: isCompleted ? generatedVariants : 0,
  })

  const updatedItem = await safeUpdateById(
    BATCH_ITEMS_TABLE,
    batchItemId,
    itemFinalPayload,
    itemFallbackPayload,
    { batchItemId },
  )

  let updatedBatch = batch

  if (batch?.id) {
    try {
      updatedBatch = await recomputeFactoryBatchProgress(batch.id) || batch
    } catch (error) {
      console.error('[factory] falha não bloqueante ao recomputar lote após finalizar item:', {
        batchId: batch.id,
        error: error?.message || String(error),
      })
    }
  }

  return {
    updatedItem,
    updatedBatch,
  }
}

export async function processFactoryDryRunItem(job) {
  assertJobPayload(job.data)

  const jobData = job.data || {}
  const nextStatus = jobData.nextStatus || jobData.next_status || 'qa_pending'
  const delayMs = Number(jobData.delayMs || jobData.delay_ms || 0)

  const { batchItemId, item, batch, combination, companion } = await loadFactoryEntities(jobData)

  if (delayMs > 0) {
    await sleep(delayMs)
  }

  const generatedVariants = getRequestedVariants(jobData, item, batch)
  const dryRunPayload = buildDryRunPayload({
    job,
    item,
    batch,
    combination,
    companion,
  })

  const { updatedItem, updatedBatch } = await finalizeFactoryItemAndBatch({
    item,
    batch,
    batchItemId,
    nextStatus,
    generatedVariants,
    payload: dryRunPayload,
  })

  return {
    ok: true,
    dryRun: true,
    batchItemId,
    batchId: batch?.id || null,
    combinationId: combination?.id || null,
    companionId: companion?.id || null,
    status: nextStatus,
    generatedVariants,
    storedPayloadColumns: Object.keys(buildExistingColumnPayload(item, dryRunPayload)),
    item: updatedItem
      ? {
          id: updatedItem.id,
          status: updatedItem.status,
          updated_at: updatedItem.updated_at || null,
        }
      : null,
    batch: updatedBatch
      ? {
          id: updatedBatch.id,
          status: updatedBatch.status,
          updated_at: updatedBatch.updated_at || null,
        }
      : null,
  }
}


function buildSafeErrorForLog(error) {
  return {
    name: error?.name || 'Error',
    message: String(error?.message || 'Falha desconhecida.').slice(0, 1000),
    code: error?.code || error?.cause?.code || null,
    status: error?.response?.status || error?.status || null,
  }
}

function buildFactoryErrorPayload({ job, item, batch, combination, companion, error, stage, telemetry }) {
  const previousEnvelope = getStoredPayloadEnvelope(item)
  const safeMessage = String(error?.message || 'Falha desconhecida na geração real da fábrica.').slice(0, 1000)

  return {
    ...previousEnvelope,
    factoryMode: 'real_image',
    factory_mode: 'real_image',
    dryRun: false,
    dry_run: false,
    provider: previousEnvelope.provider || 'runpod',
    engine: previousEnvelope.engine || 'factory_queue_real_image_v1',
    batchId: batch?.id || item?.batch_id || previousEnvelope.batchId || previousEnvelope.batch_id || null,
    batch_id: batch?.id || item?.batch_id || previousEnvelope.batch_id || null,
    batchItemId: item?.id || previousEnvelope.batchItemId || previousEnvelope.batch_item_id || null,
    batch_item_id: item?.id || previousEnvelope.batch_item_id || null,
    combinationId: combination?.id || item?.combination_id || previousEnvelope.combinationId || previousEnvelope.combination_id || null,
    combination_id: combination?.id || item?.combination_id || previousEnvelope.combination_id || null,
    companionId: companion?.id || previousEnvelope.companionId || previousEnvelope.companion_id || null,
    companion_id: companion?.id || previousEnvelope.companion_id || null,
    queueJob: {
      id: job?.id || null,
      name: job?.name || null,
      attemptsMade: job?.attemptsMade || 0,
    },
    telemetry: telemetry || previousEnvelope.telemetry || null,
    error: {
      stage,
      message: safeMessage,
      name: error?.name || 'Error',
      failedAt: new Date().toISOString(),
    },
  }
}

async function markFactoryRealImageFailed({ job, item, batch, combination, companion, error, stage }) {
  if (!item?.id) return null

  const telemetryPersistence = buildRunPodTelemetryPersistence(
    item,
    error?.runpodTelemetry || null,
    job,
  )
  const errorPayload = buildFactoryErrorPayload({
    job,
    item,
    batch,
    combination,
    companion,
    error,
    stage,
    telemetry: telemetryPersistence.telemetryNode,
  })

  const rejectedVariants = Math.max(Number(item?.requested_variants || item?.requestedVariants || 1) || 1, 1)

  const itemPayload = {
    ...buildStatusPayload(item, 'failed', {
      rejected_variants: rejectedVariants,
      completed_at: new Date().toISOString(),
    }),
    ...buildExistingColumnPayload(item, errorPayload),
    ...telemetryPersistence.columnPayload,
  }

  const itemFallbackPayload = buildStatusPayload(item, 'failed', {
    rejected_variants: rejectedVariants,
  })

  const updatedItem = await safeUpdateById(
    BATCH_ITEMS_TABLE,
    item.id,
    itemPayload,
    itemFallbackPayload,
    { batchItemId: item.id, stage },
  )

  let updatedBatch = batch

  if (batch?.id) {
    try {
      updatedBatch = await recomputeFactoryBatchProgress(batch.id) || batch
    } catch (batchError) {
      console.error('[factory] falha não bloqueante ao recomputar lote após erro do item:', {
        batchId: batch.id,
        error: batchError?.message || String(batchError),
      })
    }
  }

  return {
    updatedItem,
    updatedBatch,
    errorPayload,
  }
}

export async function processFactoryRealImageItem(job) {
  assertJobPayload(job.data)

  const jobData = job.data || {}
  const nextStatus = jobData.nextStatus || jobData.next_status || 'qa_pending'
  const delayMs = Number(jobData.delayMs || jobData.delay_ms || 0)

  let batchItemId = getBatchItemId(jobData)
  let item = null
  let batch = null
  let combination = null
  let companion = null
  let runpodTelemetry = null

  try {
    const loaded = await loadFactoryEntities(jobData)

    batchItemId = loaded.batchItemId
    item = loaded.item
    batch = loaded.batch
    combination = loaded.combination
    companion = loaded.companion

    if (!companion) {
      throw new ApiError(404, 'Companion não encontrada para geração real da fábrica.', {
        batchItemId,
      })
    }

    if (delayMs > 0) {
      await sleep(delayMs)
    }

    const promptPayload = buildFactoryImagePromptPayload({
      job,
      item,
      batch,
      combination,
      companion,
    })
    const actorProfileId = item?.actor_profile_id || batch?.actor_profile_id || jobData.actorProfileId || jobData.actor_profile_id || combination?.actor_profile_id || null
    const authorizationId = item?.avatar_production_authorization_id || batch?.avatar_production_authorization_id || jobData.productionAuthorizationId || jobData.production_authorization_id || combination?.avatar_production_authorization_id || null
    await assertApprovedActorIdentityForProduction({
      actorProfileId,
      companionId: companion.id,
      authorizationId,
      contentType: 'image',
    })
    const identityReferences = await loadApprovedActorIdentityReferences(actorProfileId)
    if (!identityReferences.length) {
      throw new ApiError(409, 'A produção de imagem exige referências aprovadas do Cofre Biométrico.')
    }
    promptPayload.identityReferences = identityReferences
    promptPayload.actorProfileId = actorProfileId
    promptPayload.authorizationId = authorizationId
    promptPayload.guidedSelections = combination?.guided_selections || item?.guided_selections || []

    const generatedImage = await generateImageWithRunPod({
      companion,
      options: {},
      promptPayload,
    })

    runpodTelemetry = generatedImage.runpodTelemetry || null
    const telemetryPersistence = buildRunPodTelemetryPersistence(item, runpodTelemetry, job)

    const extension = generatedImage.extension || getExtensionFromContentType(generatedImage.mimeType || 'image/png')
    const variantNumber = getVariantNumber({ jobData, item })
    const storageKey = buildOrganizedMediaKey({
      companionSlug: companion.slug || companion.name,
      companionId: companion.id,
      mediaKind: promptPayload.mediaKind || 'imagem',
      source: 'factory',
      batchId: batch?.id || item?.batch_id || null,
      batchItemId,
      variantIndex: variantNumber,
      extension,
      createdAt: new Date().toISOString(),
    })

    const storageUpload = await uploadPrivateImageBuffer({
      buffer: generatedImage.buffer,
      key: storageKey,
      contentType: generatedImage.mimeType || 'image/png',
      metadata: {
        source: 'factory_queue_real_image_v2_private',
        batch_id: batch?.id || item?.batch_id || '',
        batch_item_id: batchItemId,
        combination_id: combination?.id || '',
        companion_id: companion.id,
        variant_number: variantNumber,
        provider_job_id: runpodTelemetry?.providerJobId || '',
        actual_cost_usd: runpodTelemetry?.actualCostUsd ?? '',
      },
    })

    const generatedVariants = 1
    let assetVariant = await insertMediaAssetVariant({
      job,
      item,
      batch,
      combination,
      companion,
      promptPayload,
      storageUpload,
      storageKey,
      generatedImage,
      runpodJobId: generatedImage.runpodJobId,
      nextStatus,
      telemetry: telemetryPersistence.telemetryNode,
    })

    const masterRegistration = await registerMasterForLegacyVariant({
      variant: assetVariant,
      storage: {
        bucket: storageUpload.bucket,
        key: storageKey,
        contentType: storageUpload.contentType || generatedImage.mimeType || 'image/png',
        byteSize: storageUpload.byteSize || generatedImage.buffer?.length || null,
      },
      mediaType: 'image',
      contentType: storageUpload.contentType || generatedImage.mimeType || 'image/png',
      metadata: {
        source: 'factory_queue_real_image',
        actorProfileId: assetVariant.actor_profile_id || null,
        combinationId: combination.id,
        batchId: batch?.id || null,
        batchItemId,
        providerJobId: generatedImage.runpodJobId || null,
      },
    })
    assetVariant = masterRegistration.variant
    const renditionRequests = await requestDefaultRenditionsForMaster({
      masterAssetId: masterRegistration.master.id,
      mediaType: 'image',
      requestedByProfileId: jobData.profileId || jobData.profile_id || item?.profile_id || null,
    })

    await markClientGenerationQaPending({
      mediaJobId: jobData.mediaJobId || jobData.media_job_id || null,
      generationId: jobData.generationId || jobData.generation_id || null,
      assetId: assetVariant.id,
      masterAssetId: masterRegistration.master.id,
      providerJobId: generatedImage.runpodJobId || null,
    })

    const delivery = null
    const galleryItem = null
    const realImagePayload = buildFactoryRealImagePayload({
      job,
      item,
      batch,
      combination,
      companion,
      promptPayload,
      storageUpload,
      storageKey,
      runpodJobId: generatedImage.runpodJobId,
      generatedImage,
      assetVariant,
      delivery,
      galleryItem,
      telemetry: telemetryPersistence.telemetryNode,
    })

    const { updatedItem, updatedBatch } = await finalizeFactoryItemAndBatch({
      item,
      batch,
      batchItemId,
      nextStatus,
      generatedVariants,
      payload: realImagePayload,
      telemetryColumns: telemetryPersistence.columnPayload,
    })

    return {
      ok: true,
      dryRun: false,
      mode: 'real_image',
      batchItemId,
      batchId: batch?.id || null,
      combinationId: combination?.id || null,
      companionId: companion?.id || null,
      status: nextStatus,
      generatedVariants,
      storage: {
        bucket: storageUpload.bucket,
        key: storageUpload.key,
        contentType: storageUpload.contentType,
        byteSize: storageUpload.byteSize,
        etag: storageUpload.etag,
        private: true,
      },
      storageKey,
      runpodJobId: generatedImage.runpodJobId || null,
      telemetry: telemetryPersistence.telemetryNode,
      actualCostUsd: telemetryPersistence.telemetryNode?.totals?.actualCostUsd ?? null,
      executionTimeMs: telemetryPersistence.telemetryNode?.totals?.executionTimeMs ?? null,
      assetVariantId: assetVariant?.id || null,
      masterAssetId: masterRegistration.master?.id || null,
      deliveryId: delivery?.id || null,
      galleryItemId: null,
      rendition: {
        previewRenditionId: renditionRequests.preview?.rendition?.id || null,
        deferred: Boolean(renditionRequests.preview?.deferred),
      },
      storedPayloadColumns: Object.keys(buildExistingColumnPayload(item, realImagePayload)),
      item: updatedItem
        ? {
            id: updatedItem.id,
            status: updatedItem.status,
            updated_at: updatedItem.updated_at || null,
          }
        : null,
      batch: updatedBatch
        ? {
            id: updatedBatch.id,
            status: updatedBatch.status,
            updated_at: updatedBatch.updated_at || null,
          }
        : null,
    }
  } catch (error) {
    if (runpodTelemetry && !error?.runpodTelemetry) {
      error.runpodTelemetry = runpodTelemetry
    }

    console.error(`[factory:real-image] falha no item ${batchItemId || 'desconhecido'}:`, buildSafeErrorForLog(error))

    await markClientGenerationFailed({
      mediaJobId: jobData.mediaJobId || jobData.media_job_id || null,
      generationId: jobData.generationId || jobData.generation_id || null,
      message: error?.message,
    }).catch(() => {})

    await markFactoryRealImageFailed({
      job,
      item,
      batch,
      combination,
      companion,
      error,
      stage: 'processFactoryRealImageItem',
    }).catch((markError) => {
      console.error('[factory:real-image] falha ao marcar item como failed:', markError)
    })

    throw error
  }
}
