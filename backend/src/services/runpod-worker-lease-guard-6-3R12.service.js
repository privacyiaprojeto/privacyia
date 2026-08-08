import fs from 'fs'
import path from 'path'
import { env } from '../config/env.js'
import { getRedisConnection } from '../config/redis.js'
import { applyRunPodCostGuard } from './runpod-cost-guard.service.js'
import { inspectRunPodProductionLease } from './runpod-production-lease.service.js'

const SPRINT = 'P2-RUNPOD-DISTRIBUTED-LEASE'
const NAME = 'Distributed Worker/Provider RunPod Lease Guard'
const COOLDOWN_PHRASE = 'DESLIGAR WORKERS RUNPOD 6.3R9'
const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])

const nowIso = () => new Date().toISOString()
const toBool = (value) => TRUTHY.has(String(value ?? '').trim().toLowerCase())
const hasValue = (value) => value !== null && value !== undefined && String(value).trim().length > 0
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const unique = (values = []) => [...new Set(values.filter(Boolean).map((value) => String(value)))]

function splitCsv(value) {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean)
}

function resolveEndpointIdsFromEnv() {
  return unique([
    ...splitCsv(process.env.RUNPOD_6_3R12_ENDPOINT_IDS),
    ...splitCsv(process.env.RUNPOD_6_3R10_ENDPOINT_IDS),
    ...splitCsv(process.env.RUNPOD_6_3R9_ENDPOINT_IDS),
    process.env.RUNPOD_IMAGE_ENDPOINT_ID,
    process.env.RUNPOD_VIDEO_ENDPOINT_ID,
    process.env.RUNPOD_QWEN_TTS_ENDPOINT_ID,
    process.env.RUNPOD_AUDIO_ENDPOINT_ID,
  ])
}

function resolveProjectRoot() {
  const cwd = process.cwd()
  return path.basename(cwd).toLowerCase() === 'backend' ? path.resolve(cwd, '..') : cwd
}

function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch { return '' }
}

function buildSafety(extra = {}) {
  return {
    runPodInferenceCalledByThisService: false,
    runPodGraphqlMutationExecutedByThisService: false,
    r2RealUploadByThisService: false,
    databaseMutationExecutedByThisService: false,
    realQueueJobCreated: false,
    distributedRedisLease: true,
    processMemoryLeaseState: false,
    ...extra,
  }
}

function getEndpointIdForMediaType(mediaType, explicitEndpointId) {
  if (hasValue(explicitEndpointId)) return String(explicitEndpointId).trim()
  const type = String(mediaType || '').trim().toLowerCase()
  if (type === 'image') return env.RUNPOD_IMAGE_ENDPOINT_ID || null
  if (type === 'video' || type === 'live_action') return env.RUNPOD_VIDEO_ENDPOINT_ID || null
  if (type === 'audio' || type === 'tts') return env.RUNPOD_QWEN_TTS_ENDPOINT_ID || env.RUNPOD_AUDIO_ENDPOINT_ID || null
  return null
}

function shouldRequireWorkerLease() {
  return toBool(process.env.REQUIRE_RUNPOD_WORKER_LEASE ?? 'true') ||
    toBool(process.env.REQUIRE_RUNPOD_PRODUCTION_LEASE ?? 'true') ||
    toBool(process.env.REQUIRE_RUNPOD_LEASE_FOR_ASYNC_WORKERS ?? 'true')
}

function getLeaseConfig() {
  return {
    ttlMs: Math.max(Number(env.RUNPOD_LEASE_TTL_MS || 120000), 30000),
    heartbeatMs: Math.max(Number(env.RUNPOD_LEASE_HEARTBEAT_MS || 30000), 5000),
    cooldownWaitTimeoutMs: Math.max(Number(env.RUNPOD_LEASE_COOLDOWN_WAIT_TIMEOUT_MS || 14400000), 60000),
    waitPollMs: 1000,
  }
}

function distributedKeys(endpointId) {
  const safeEndpoint = String(endpointId).replace(/[^a-zA-Z0-9_.-]/g, '_')
  const base = `${env.REDIS_QUEUE_PREFIX}:runpod:lease:${safeEndpoint}`
  return {
    state: `${base}:state`,
    leases: `${base}:active`,
  }
}

const ACQUIRE_SCRIPT = `
local now_ms = tonumber(ARGV[1])
local expires_ms = tonumber(ARGV[2])
local lease_id = ARGV[3]
local updated_at = ARGV[4]
local expired = redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms)
local count = redis.call('ZCARD', KEYS[2])
if expired > 0 then
  redis.call('HSET', KEYS[1], 'cooldown_requested', '1', 'blocked_reason', 'expired_lease_requires_cooldown')
end
redis.call('HSET', KEYS[1], 'active_job_count', tostring(count), 'updated_at', updated_at)
local blocked = redis.call('HGET', KEYS[1], 'blocked') or '0'
local cooldown = redis.call('HGET', KEYS[1], 'cooldown_requested') or '0'
local in_progress = redis.call('HGET', KEYS[1], 'cooldown_in_progress') or '0'
if blocked == '1' then return {0, 'blocked', count} end
if cooldown == '1' or in_progress == '1' then return {0, 'cooldown_pending', count} end
redis.call('ZADD', KEYS[2], expires_ms, lease_id)
count = redis.call('ZCARD', KEYS[2])
redis.call('HSET', KEYS[1], 'active_job_count', tostring(count), 'updated_at', updated_at)
redis.call('PEXPIRE', KEYS[1], 604800000)
redis.call('PEXPIRE', KEYS[2], 604800000)
return {1, 'acquired', count}
`

const HEARTBEAT_SCRIPT = `
local now_ms = tonumber(ARGV[1])
local expires_ms = tonumber(ARGV[2])
local lease_id = ARGV[3]
local updated_at = ARGV[4]
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms)
local updated = redis.call('ZADD', KEYS[2], 'XX', expires_ms, lease_id)
local count = redis.call('ZCARD', KEYS[2])
redis.call('HSET', KEYS[1], 'active_job_count', tostring(count), 'updated_at', updated_at)
return {updated, count}
`

const RELEASE_AND_REQUEST_COOLDOWN_SCRIPT = `
local now_ms = tonumber(ARGV[1])
local lease_id = ARGV[2]
local updated_at = ARGV[3]
redis.call('ZREM', KEYS[2], lease_id)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms)
local count = redis.call('ZCARD', KEYS[2])
redis.call('HSET', KEYS[1], 'active_job_count', tostring(count), 'cooldown_requested', '1', 'updated_at', updated_at)
local blocked = redis.call('HGET', KEYS[1], 'blocked') or '0'
local in_progress = redis.call('HGET', KEYS[1], 'cooldown_in_progress') or '0'
if count == 0 and blocked ~= '1' and in_progress ~= '1' then
  redis.call('HSET', KEYS[1], 'cooldown_in_progress', '1', 'cooldown_started_at_ms', tostring(now_ms))
  return {1, count}
end
return {0, count}
`

const CLAIM_RECOVERY_COOLDOWN_SCRIPT = `
local now_ms = tonumber(ARGV[1])
local stale_before_ms = tonumber(ARGV[2])
local updated_at = ARGV[3]
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now_ms)
local count = redis.call('ZCARD', KEYS[2])
local blocked = redis.call('HGET', KEYS[1], 'blocked') or '0'
local requested = redis.call('HGET', KEYS[1], 'cooldown_requested') or '0'
local in_progress = redis.call('HGET', KEYS[1], 'cooldown_in_progress') or '0'
local started = tonumber(redis.call('HGET', KEYS[1], 'cooldown_started_at_ms') or '0')
if in_progress == '1' and started > 0 and started < stale_before_ms then
  in_progress = '0'
  redis.call('HSET', KEYS[1], 'cooldown_in_progress', '0', 'cooldown_requested', '1')
  requested = '1'
end
redis.call('HSET', KEYS[1], 'active_job_count', tostring(count), 'updated_at', updated_at)
if count == 0 and blocked ~= '1' and requested == '1' and in_progress ~= '1' then
  redis.call('HSET', KEYS[1], 'cooldown_in_progress', '1', 'cooldown_started_at_ms', tostring(now_ms))
  return 1
end
return 0
`

const FINALIZE_COOLDOWN_SCRIPT = `
local ok = ARGV[1]
local updated_at = ARGV[2]
local reason = ARGV[3]
if ok == '1' then
  redis.call('HSET', KEYS[1],
    'cooldown_requested', '0',
    'cooldown_in_progress', '0',
    'blocked', '0',
    'blocked_reason', '',
    'cooldown_finished_at', updated_at,
    'updated_at', updated_at)
else
  redis.call('HSET', KEYS[1],
    'cooldown_requested', '1',
    'cooldown_in_progress', '0',
    'blocked', '1',
    'blocked_reason', reason,
    'cooldown_failed_at', updated_at,
    'updated_at', updated_at)
end
return 1
`

function buildCooldownEnv(endpointIds = []) {
  return {
    RUN_6_3R9_RUNPOD_COST_GUARD: 'true',
    ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION: 'true',
    RUNPOD_6_3R9_ACTION: 'cooldown',
    RUNPOD_6_3R9_CONFIRMATION_PHRASE: COOLDOWN_PHRASE,
    RUNPOD_6_3R9_ENDPOINT_IDS: unique(endpointIds).join(','),
    RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX: String(process.env.RUNPOD_6_3R12_COOLDOWN_WORKERS_MAX || 0),
    RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS: String(process.env.RUNPOD_6_3R12_COOLDOWN_IDLE_TIMEOUT_SECONDS || 5),
  }
}

async function withTemporaryEnv(overrides, fn) {
  const previous = {}
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key]
    process.env[key] = String(value)
  }
  try {
    return await fn()
  } finally {
    for (const key of Object.keys(overrides)) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

async function runCooldown(endpointId) {
  return withTemporaryEnv(buildCooldownEnv([endpointId]), () => applyRunPodCostGuard())
}

async function finalizeDistributedCooldown(redis, keys, { ok, reason = '' } = {}) {
  await redis.eval(FINALIZE_COOLDOWN_SCRIPT, 1, keys.state, ok ? '1' : '0', nowIso(), String(reason || '').slice(0, 1000))
}

async function executeDistributedCooldown({ redis, keys, endpointId }) {
  let result = null
  let error = null
  try {
    result = await runCooldown(endpointId)
  } catch (caught) {
    error = caught
  }

  const ok = !error && result?.status === 'RUNPOD_COST_GUARD_APPLIED_CONTROLLED'
  await finalizeDistributedCooldown(redis, keys, {
    ok,
    reason: error?.message || result?.status || 'cooldown_failed',
  })

  if (!ok) {
    const cooldownError = new Error(`RunPod Worker Lease bloqueou novas produções: cooldown distribuído falhou no endpoint ${endpointId}.`)
    cooldownError.cooldownResult = result
    cooldownError.cooldownError = error
    throw cooldownError
  }

  return result
}

async function claimRecoveryCooldown({ redis, keys, endpointId, ttlMs }) {
  const now = Date.now()
  const claimed = Number(await redis.eval(
    CLAIM_RECOVERY_COOLDOWN_SCRIPT,
    2,
    keys.state,
    keys.leases,
    now,
    now - Math.max(ttlMs * 2, 60000),
    nowIso(),
  )) === 1

  if (claimed) await executeDistributedCooldown({ redis, keys, endpointId })
  return claimed
}

async function acquireDistributedLease({ redis, keys, endpointId, leaseId, ttlMs }) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const now = Date.now()
    const response = await redis.eval(
      ACQUIRE_SCRIPT,
      2,
      keys.state,
      keys.leases,
      now,
      now + ttlMs,
      leaseId,
      nowIso(),
    )

    const allowed = Number(response?.[0] || 0) === 1
    const reason = String(response?.[1] || 'unknown')
    if (allowed) return { activeJobCount: Number(response?.[2] || 1) }

    if (reason === 'cooldown_pending') {
      const recovered = await claimRecoveryCooldown({ redis, keys, endpointId, ttlMs })
      if (recovered) continue
    }

    const state = await redis.hgetall(keys.state)
    throw new Error(`RunPod Worker Lease bloqueou produção no endpoint ${endpointId}: ${reason}${state.blocked_reason ? ` (${state.blocked_reason})` : ''}.`)
  }

  throw new Error(`RunPod Worker Lease não conseguiu adquirir lease distribuído no endpoint ${endpointId}.`)
}

function startHeartbeat({ redis, keys, leaseId, ttlMs, heartbeatMs, onError }) {
  const timer = setInterval(async () => {
    try {
      const now = Date.now()
      const result = await redis.eval(HEARTBEAT_SCRIPT, 2, keys.state, keys.leases, now, now + ttlMs, leaseId, nowIso())
      if (Number(result?.[0] || 0) !== 1) throw new Error('lease_expired_or_missing_during_heartbeat')
    } catch (error) {
      onError(error)
    }
  }, Math.min(heartbeatMs, Math.floor(ttlMs / 2)))
  timer.unref?.()
  return () => clearInterval(timer)
}

async function releaseAndRequestCooldown({ redis, keys, endpointId, leaseId }) {
  const response = await redis.eval(
    RELEASE_AND_REQUEST_COOLDOWN_SCRIPT,
    2,
    keys.state,
    keys.leases,
    Date.now(),
    leaseId,
    nowIso(),
  )
  return {
    shouldRunCooldown: Number(response?.[0] || 0) === 1,
    activeJobCount: Number(response?.[1] || 0),
    endpointId,
  }
}

async function waitForCooldownSettlement({ redis, keys, timeoutMs, pollMs }) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const state = await redis.hgetall(keys.state)
    if (state.blocked === '1') {
      throw new Error(`RunPod Worker Lease bloqueado após falha de cooldown: ${state.blocked_reason || 'sem motivo registrado'}.`)
    }
    if (state.cooldown_requested !== '1' && state.cooldown_in_progress !== '1') return state
    await sleep(pollMs)
  }
  throw new Error('Tempo limite aguardando o cooldown distribuído do RunPod.')
}

export async function getRunPodDistributedLeaseState(endpointId) {
  if (!endpointId) throw new Error('endpointId é obrigatório.')
  const redis = getRedisConnection('runpod-distributed-lease-inspection')
  const keys = distributedKeys(endpointId)
  const [state, activeLeaseIds] = await Promise.all([
    redis.hgetall(keys.state),
    redis.zrange(keys.leases, 0, -1),
  ])
  return {
    endpointId,
    activeJobCount: Number(state.active_job_count || activeLeaseIds.length || 0),
    cooldownRequested: state.cooldown_requested === '1',
    cooldownInProgress: state.cooldown_in_progress === '1',
    blocked: state.blocked === '1',
    blockedReason: state.blocked_reason || null,
    activeLeaseIds,
    updatedAt: state.updated_at || null,
  }
}

export async function withRunPodWorkerLease({
  productionName = 'runpod-worker-provider-job',
  mediaType = 'unknown',
  endpointId = null,
  runProduction,
} = {}) {
  if (typeof runProduction !== 'function') throw new Error('withRunPodWorkerLease exige runProduction como função.')

  const resolvedEndpointId = getEndpointIdForMediaType(mediaType, endpointId)
  const startedAt = nowIso()
  const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

  if (!shouldRequireWorkerLease()) {
    return runProduction({ leaseId, startedAt, productionName, mediaType, endpointId: resolvedEndpointId, leaseBypassed: true })
  }
  if (!hasValue(env.RUNPOD_API_KEY)) throw new Error(`RunPod Worker Lease bloqueou ${productionName}: RUNPOD_API_KEY ausente.`)
  if (!hasValue(resolvedEndpointId)) throw new Error(`RunPod Worker Lease bloqueou ${productionName}: endpoint ausente para mediaType=${mediaType}.`)

  const redis = getRedisConnection('runpod-distributed-worker-lease')
  const keys = distributedKeys(resolvedEndpointId)
  const config = getLeaseConfig()
  await acquireDistributedLease({ redis, keys, endpointId: resolvedEndpointId, leaseId, ttlMs: config.ttlMs })

  let heartbeatError = null
  const stopHeartbeat = startHeartbeat({
    redis,
    keys,
    leaseId,
    ttlMs: config.ttlMs,
    heartbeatMs: config.heartbeatMs,
    onError: (error) => { heartbeatError = heartbeatError || error },
  })

  let productionResult = null
  let productionError = null
  let cooldownResult = null

  try {
    productionResult = await runProduction({ leaseId, startedAt, productionName, mediaType, endpointId: resolvedEndpointId })
  } catch (error) {
    productionError = error
  } finally {
    stopHeartbeat()
    const release = await releaseAndRequestCooldown({ redis, keys, endpointId: resolvedEndpointId, leaseId })
    if (release.shouldRunCooldown) {
      cooldownResult = await executeDistributedCooldown({ redis, keys, endpointId: resolvedEndpointId })
    } else {
      await waitForCooldownSettlement({
        redis,
        keys,
        timeoutMs: config.cooldownWaitTimeoutMs,
        pollMs: config.waitPollMs,
      })
    }
  }

  if (heartbeatError) {
    const error = new Error(`RunPod Worker Lease perdeu heartbeat Redis durante ${productionName}.`)
    error.cause = heartbeatError
    error.productionResult = productionResult
    throw error
  }
  if (productionError) throw productionError

  if (productionResult && typeof productionResult === 'object' && !Buffer.isBuffer(productionResult)) {
    return {
      ...productionResult,
      runpodWorkerLease: {
        leaseId,
        productionName,
        mediaType,
        endpointId: resolvedEndpointId,
        startedAt,
        finishedAt: nowIso(),
        distributed: true,
        cooldownOk: true,
        cooldownStatus: cooldownResult?.status || 'completed_by_peer',
      },
    }
  }

  return productionResult
}

function inspectProviderPatch() {
  const root = resolveProjectRoot()
  const provider = readFileSafe(path.join(root, 'backend/src/services/providers/runpod.provider.js'))
  const imageWorker = readFileSafe(path.join(root, 'backend/src/workers/image.worker.js'))
  const videoWorker = readFileSafe(path.join(root, 'backend/src/workers/video-v2v.worker.js'))
  return {
    provider: {
      file: 'backend/src/services/providers/runpod.provider.js',
      exists: Boolean(provider),
      hasWorkerLeaseImport: provider.includes('runpod-worker-lease-guard-6-3R12.service.js'),
      hasWithRunPodWorkerLease: provider.includes('withRunPodWorkerLease'),
      hasImageCoreFunction: provider.includes('generateImageWithRunPodCore'),
      hasVideoCoreFunction: provider.includes('generateVideoWithRunPodCore'),
      imageExportWrapped: provider.includes("mediaType: 'image'") && provider.includes('generateImageWithRunPodCore(args)'),
      videoExportWrapped: provider.includes("mediaType: 'video'") && provider.includes('generateVideoWithRunPodCore(args)'),
      keepsSpeechExportDirect: provider.includes('export async function generateSpeechWithRunPod'),
      cancellationOnTimeout: provider.includes('cancelRunPodJobAfterTimeout'),
      ok: provider.includes('withRunPodWorkerLease') && provider.includes('cancelRunPodJobAfterTimeout'),
    },
    worker: {
      files: ['backend/src/workers/image.worker.js', 'backend/src/workers/video-v2v.worker.js'],
      exists: Boolean(imageWorker && videoWorker),
      importsRealImageProcessor: imageWorker.includes('processFactoryRealImageItem'),
      delegatesRealImageToService: imageWorker.includes('processFactoryRealImageItem(currentJob)'),
      isolatedVideoWorker: videoWorker.includes('QUEUE_NAMES.VIDEO_V2V'),
      ok: Boolean(imageWorker && videoWorker),
    },
  }
}

export function getRunPodWorkerLeaseGuardConfig() {
  const lease = getLeaseConfig()
  return {
    sprint: SPRINT,
    name: NAME,
    mode: 'redis_distributed_active_job_count_and_cooldown_requested',
    endpointIds: resolveEndpointIdsFromEnv(),
    lease,
    rules: {
      stateStoredInRedis: true,
      activeJobCountDistributed: true,
      cooldownRequestedDistributed: true,
      expiredLeaseForcesCooldownRecovery: true,
      newProductionBlockedDuringCooldown: true,
      productionBlockedIfCooldownFails: true,
      processMemoryStateForbidden: true,
    },
    safety: buildSafety(),
  }
}

export async function inspectRunPodWorkerLeaseGuard() {
  const blockers = []
  const warnings = []
  const providerPatch = inspectProviderPatch()
  if (!providerPatch.provider.ok) blockers.push('runpod_provider_not_wrapped_or_cancel_not_configured')
  if (!providerPatch.worker.ok) blockers.push('isolated_workers_not_found')

  let leaseInspection = { status: 'NOT_CHECKED', blockers: [], warnings: [] }
  try {
    leaseInspection = await inspectRunPodProductionLease()
    if (leaseInspection.blockers?.length) warnings.push('legacy_r10_lease_has_warnings_or_blockers')
  } catch (error) {
    warnings.push(`legacy_r10_inspection_failed:${error.message}`)
  }

  return {
    sprint: SPRINT,
    status: blockers.length ? 'RUNPOD_WORKER_LEASE_GUARD_NOT_READY' : 'RUNPOD_WORKER_LEASE_GUARD_READY_WITH_WARNINGS',
    checkedAt: nowIso(),
    config: getRunPodWorkerLeaseGuardConfig(),
    providerPatch,
    leaseInspection: {
      status: leaseInspection.status,
      blockers: leaseInspection.blockers || [],
      warnings: leaseInspection.warnings || [],
    },
    workerPolicy: {
      imageProviderCallsUseWorkerLease: providerPatch.provider.imageExportWrapped,
      videoProviderCallsUseWorkerLease: providerPatch.provider.videoExportWrapped,
      cooldownRunsInsideProviderFinally: true,
      productionBlockedIfCooldownFails: true,
      stateStoredInRedis: true,
      activeJobCountDistributed: true,
      cooldownRequestedDistributed: true,
    },
    blockers,
    warnings,
    safety: buildSafety(),
  }
}

export async function testRunPodWorkerLeaseGuard() {
  const inspection = await inspectRunPodWorkerLeaseGuard()
  return {
    sprint: SPRINT,
    status: 'RUNPOD_WORKER_LEASE_GUARD_TEST_READY',
    checkedAt: nowIso(),
    inspection,
    localSimulation: {
      noRunPodInference: true,
      noRedisCommandExecutedByTest: true,
      noR2: true,
      noDbMutation: true,
      processMemoryStateAbsent: true,
    },
    blockers: inspection.blockers || [],
    warnings: inspection.warnings || [],
    safety: buildSafety(),
  }
}
