import { env } from '../config/env.js'

const DEFAULT_PROVIDER = 'runpod'
const TELEMETRY_VERSION = 1

function toFiniteNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && !value.trim()) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toNonNegativeNumber(value) {
  const parsed = toFiniteNumber(value)
  return parsed !== null && parsed >= 0 ? parsed : null
}

function firstNonNegativeNumber(...values) {
  for (const value of values) {
    const parsed = toNonNegativeNumber(value)
    if (parsed !== null) return parsed
  }

  return null
}

function firstFilledString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function roundUsd(value) {
  const parsed = toNonNegativeNumber(value)
  if (parsed === null) return null
  return Math.round((parsed + Number.EPSILON) * 100000000) / 100000000
}

function normalizeMediaType(value = 'image') {
  const normalized = String(value || '').trim().toLowerCase()

  if (['image', 'imagem', 'img', 'photo', 'foto'].includes(normalized)) return 'image'
  if (['audio', 'voice', 'speech', 'tts'].includes(normalized)) return 'audio'
  if (['video', 'vídeo', 'live_action', 'live-action', 'live action'].includes(normalized)) return 'video'

  return normalized || 'image'
}

function normalizeEndpointEnvSuffix(endpointId) {
  return String(endpointId || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
}

function resolveConfiguredGpuType(mediaType, endpointId) {
  const endpointSuffix = normalizeEndpointEnvSuffix(endpointId)
  const endpointSpecific = endpointSuffix
    ? process.env[`RUNPOD_GPU_TYPE_${endpointSuffix}`]
    : null

  if (endpointSpecific) return endpointSpecific
  if (mediaType === 'image') return env.RUNPOD_IMAGE_GPU_TYPE || null
  if (mediaType === 'audio') return env.RUNPOD_AUDIO_GPU_TYPE || null
  if (mediaType === 'video') return env.RUNPOD_VIDEO_GPU_TYPE || null

  return env.RUNPOD_GPU_TYPE || null
}

export function resolveRunPodCostRate({ endpointId, mediaType = 'image' } = {}) {
  const normalizedMediaType = normalizeMediaType(mediaType)
  const endpointSuffix = normalizeEndpointEnvSuffix(endpointId)
  const endpointSpecificValue = endpointSuffix
    ? process.env[`RUNPOD_COST_PER_SECOND_USD_${endpointSuffix}`]
    : null
  const endpointSpecificRate = toNonNegativeNumber(endpointSpecificValue)

  if (endpointSpecificRate !== null && endpointSpecificRate > 0) {
    return {
      rateUsdPerSecond: endpointSpecificRate,
      source: `env:RUNPOD_COST_PER_SECOND_USD_${endpointSuffix}`,
    }
  }

  const mediaRate = normalizedMediaType === 'image'
    ? toNonNegativeNumber(env.RUNPOD_IMAGE_GPU_COST_PER_SECOND_USD)
    : normalizedMediaType === 'audio'
      ? toNonNegativeNumber(env.RUNPOD_AUDIO_GPU_COST_PER_SECOND_USD)
      : normalizedMediaType === 'video'
        ? toNonNegativeNumber(env.RUNPOD_VIDEO_GPU_COST_PER_SECOND_USD)
        : null

  if (mediaRate !== null && mediaRate > 0) {
    return {
      rateUsdPerSecond: mediaRate,
      source: `env:RUNPOD_${normalizedMediaType.toUpperCase()}_GPU_COST_PER_SECOND_USD`,
    }
  }

  const genericRate = toNonNegativeNumber(env.RUNPOD_GPU_COST_PER_SECOND_USD)

  if (genericRate !== null && genericRate > 0) {
    return {
      rateUsdPerSecond: genericRate,
      source: 'env:RUNPOD_GPU_COST_PER_SECOND_USD',
    }
  }

  return {
    rateUsdPerSecond: null,
    source: 'missing_rate',
  }
}

function readTelemetryContainers(payload = {}) {
  const output = payload?.output && typeof payload.output === 'object' ? payload.output : {}
  const metrics = payload?.metrics && typeof payload.metrics === 'object' ? payload.metrics : {}
  const usage = payload?.usage && typeof payload.usage === 'object' ? payload.usage : {}
  const outputMetrics = output?.metrics && typeof output.metrics === 'object' ? output.metrics : {}
  const outputUsage = output?.usage && typeof output.usage === 'object' ? output.usage : {}

  return {
    output,
    metrics,
    usage,
    outputMetrics,
    outputUsage,
  }
}

function sanitizeTelemetryMetrics(value, depth = 0) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed.slice(0, 200) : null
  }

  if (depth >= 2 || Array.isArray(value) || typeof value !== 'object') return null

  const entries = Object.entries(value).slice(0, 40)
  const result = {}

  for (const [key, entryValue] of entries) {
    const sanitized = sanitizeTelemetryMetrics(entryValue, depth + 1)
    if (sanitized !== null && sanitized !== undefined) result[key] = sanitized
  }

  return Object.keys(result).length > 0 ? result : null
}

function buildProviderMetrics({ metrics, usage, outputMetrics, outputUsage }) {
  const providerMetrics = {
    metrics: sanitizeTelemetryMetrics(metrics),
    usage: sanitizeTelemetryMetrics(usage),
    outputMetrics: sanitizeTelemetryMetrics(outputMetrics),
    outputUsage: sanitizeTelemetryMetrics(outputUsage),
  }

  return Object.fromEntries(
    Object.entries(providerMetrics).filter(([, value]) => value && Object.keys(value).length > 0),
  )
}

export function extractRunPodTelemetry({
  payload = {},
  endpointId = null,
  mediaType = 'image',
  providerJobId = null,
  terminalStatus = null,
  errorType = null,
  capturedAt = new Date().toISOString(),
} = {}) {
  const normalizedMediaType = normalizeMediaType(mediaType)
  const { output, metrics, usage, outputMetrics, outputUsage } = readTelemetryContainers(payload)

  const executionTimeMs = firstNonNegativeNumber(
    payload?.executionTime,
    payload?.execution_time,
    payload?.executionTimeMs,
    payload?.execution_time_ms,
    metrics?.executionTime,
    metrics?.execution_time,
    metrics?.executionTimeMs,
    metrics?.execution_time_ms,
    usage?.executionTime,
    usage?.execution_time,
    output?.executionTime,
    output?.execution_time,
    outputMetrics?.executionTime,
    outputMetrics?.execution_time,
    outputUsage?.executionTime,
    outputUsage?.execution_time,
  )

  const delayTimeMs = firstNonNegativeNumber(
    payload?.delayTime,
    payload?.delay_time,
    payload?.delayTimeMs,
    payload?.delay_time_ms,
    metrics?.delayTime,
    metrics?.delay_time,
    metrics?.delayTimeMs,
    metrics?.delay_time_ms,
    usage?.delayTime,
    usage?.delay_time,
    output?.delayTime,
    output?.delay_time,
    outputMetrics?.delayTime,
    outputMetrics?.delay_time,
    outputUsage?.delayTime,
    outputUsage?.delay_time,
  )

  const resolvedProviderJobId = firstFilledString(
    providerJobId,
    payload?.id,
    payload?.jobId,
    payload?.job_id,
    output?.jobId,
    output?.job_id,
  )

  const providerStatus = firstFilledString(
    terminalStatus,
    payload?.status,
    output?.status,
    errorType,
  ) || 'UNKNOWN'

  const workerId = firstFilledString(
    payload?.workerId,
    payload?.worker_id,
    metrics?.workerId,
    metrics?.worker_id,
    output?.workerId,
    output?.worker_id,
    outputMetrics?.workerId,
    outputMetrics?.worker_id,
  )

  const gpuType = firstFilledString(
    payload?.gpuType,
    payload?.gpu_type,
    payload?.gpu,
    metrics?.gpuType,
    metrics?.gpu_type,
    metrics?.gpu,
    usage?.gpuType,
    usage?.gpu_type,
    output?.gpuType,
    output?.gpu_type,
    output?.gpu,
    outputMetrics?.gpuType,
    outputMetrics?.gpu_type,
    outputMetrics?.gpu,
    resolveConfiguredGpuType(normalizedMediaType, endpointId),
  )

  const providerReportedCostUsd = firstNonNegativeNumber(
    payload?.cost,
    payload?.costUsd,
    payload?.cost_usd,
    metrics?.cost,
    metrics?.costUsd,
    metrics?.cost_usd,
    usage?.cost,
    usage?.costUsd,
    usage?.cost_usd,
    output?.cost,
    output?.costUsd,
    output?.cost_usd,
    outputMetrics?.cost,
    outputMetrics?.costUsd,
    outputMetrics?.cost_usd,
    outputUsage?.cost,
    outputUsage?.costUsd,
    outputUsage?.cost_usd,
  )

  const providerMetrics = buildProviderMetrics({ metrics, usage, outputMetrics, outputUsage })
  const pricing = resolveRunPodCostRate({ endpointId, mediaType: normalizedMediaType })
  let actualCostUsd = null
  let costSource = 'unavailable'
  let costStatus = 'missing_execution_time_or_rate'

  if (providerReportedCostUsd !== null) {
    actualCostUsd = roundUsd(providerReportedCostUsd)
    costSource = 'provider_reported'
    costStatus = 'captured'
  } else if (executionTimeMs !== null && pricing.rateUsdPerSecond) {
    actualCostUsd = roundUsd((executionTimeMs / 1000) * pricing.rateUsdPerSecond)
    costSource = 'execution_time_x_configured_rate'
    costStatus = 'calculated'
  } else if (executionTimeMs !== null) {
    costStatus = 'missing_configured_rate'
  } else {
    costStatus = 'missing_execution_time'
  }

  const attemptKey = resolvedProviderJobId
    ? `${DEFAULT_PROVIDER}:${resolvedProviderJobId}`
    : `${DEFAULT_PROVIDER}:${endpointId || 'unknown-endpoint'}:${providerStatus}:${capturedAt}`

  return {
    version: TELEMETRY_VERSION,
    provider: DEFAULT_PROVIDER,
    mediaType: normalizedMediaType,
    endpointId: endpointId || null,
    providerJobId: resolvedProviderJobId,
    workerId,
    gpuType,
    providerMetrics,
    status: providerStatus,
    executionTimeMs,
    delayTimeMs,
    actualCostUsd,
    providerReportedCostUsd: roundUsd(providerReportedCostUsd),
    costRateUsdPerSecond: pricing.rateUsdPerSecond,
    costRateSource: pricing.source,
    costSource,
    costStatus,
    billable: actualCostUsd !== null ? actualCostUsd > 0 : executionTimeMs !== null && executionTimeMs > 0,
    errorType: errorType || null,
    attemptKey,
    capturedAt,
  }
}

export function attachRunPodTelemetryToError(error, telemetry, code = 'RUNPOD_JOB_FAILED') {
  const target = error instanceof Error ? error : new Error(String(error || 'Falha no RunPod.'))
  target.code = target.code || code
  target.runpodTelemetry = telemetry || target.runpodTelemetry || null
  return target
}

export function createRunPodTelemetryError(message, {
  telemetry = null,
  code = 'RUNPOD_JOB_FAILED',
  cause = null,
} = {}) {
  const error = new Error(message, cause ? { cause } : undefined)
  error.name = 'RunPodJobError'
  error.code = code
  error.runpodTelemetry = telemetry
  return error
}
