import fs from 'fs'
import path from 'path'
import { applyRunPodCostGuard, inspectRunPodCostGuard } from './runpod-cost-guard.service.js'

const SPRINT = '6.3R10'
const NAME = 'Admin Production Lease + Auto Cooldown'
const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const ACTIONS = new Set(['inspect', 'simulate-local', 'cooldown-only', 'warm-and-cooldown-smoke'])
const CONFIRMATION_PHRASE = 'EXECUTAR LEASE RUNPOD 6.3R10'
const R9_COOLDOWN_PHRASE = 'DESLIGAR WORKERS RUNPOD 6.3R9'
const R9_WARM_PHRASE = 'AQUECER 1 WORKER RUNPOD 6.3R9'

function nowIso() { return new Date().toISOString() }
function toBool(value) { return TRUTHY.has(String(value ?? '').trim().toLowerCase()) }
function hasValue(value) { return value !== null && value !== undefined && String(value).trim().length > 0 }
function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}
function unique(values = []) { return [...new Set(values.filter((value) => hasValue(value)).map((value) => String(value).trim()))] }
function toInt(value, fallback, { min = null, max = null } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  let output = Number.isFinite(parsed) ? parsed : fallback
  if (min !== null && output < min) output = min
  if (max !== null && output > max) output = max
  return output
}
function maskSecret(value) {
  if (!hasValue(value)) return null
  const text = String(value)
  if (text.length <= 8) return '[preenchido]'
  return `${text.slice(0, 4)}...${text.slice(-4)}`
}
function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function buildSafety(extra = {}) {
  return {
    runPodInferenceCalledByThisService: false,
    runPodGraphqlQueryExecutedByThisService: false,
    runPodGraphqlMutationExecutedByThisService: false,
    runPodEndpointMutationExecutedByThisService: false,
    r2RealUploadByThisService: false,
    r2HeadObjectByThisService: false,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    databaseMutationExecutedByThisService: false,
    realVideoGeneratedByThisService: false,
    realAudioGeneratedByThisService: false,
    deliveryCreatedByThisService: false,
    galleryItemCreatedByThisService: false,
    creditLedgerCreatedByThisService: false,
    audioLiveTouchedByThisService: false,
    liveActionTouchedByThisService: false,
    adminProductionLeaseCreatedByThisService: false,
    cooldownAttemptedByThisService: false,
    cooldownRequiredByThisService: false,
    productionBlockedAfterCooldownFailure: false,
    ...extra,
  }
}

function resolveProjectRoot() {
  const cwd = process.cwd()
  if (path.basename(cwd).toLowerCase() === 'backend') return path.resolve(cwd, '..')
  return cwd
}
function readFileSafe(filePath) {
  try { return fs.readFileSync(filePath, 'utf8') } catch { return null }
}
function fileExists(relativePath) {
  return fs.existsSync(path.join(resolveProjectRoot(), relativePath))
}
function resolveAction() {
  const action = String(process.env.RUNPOD_6_3R10_ACTION || 'inspect').trim()
  return ACTIONS.has(action) ? action : 'inspect'
}
function resolveEndpointIds() {
  return unique([
    ...splitCsv(process.env.RUNPOD_6_3R10_ENDPOINT_IDS),
    ...splitCsv(process.env.RUNPOD_6_3R9_ENDPOINT_IDS),
    process.env.RUNPOD_6_3R10_ENDPOINT_ID,
    process.env.RUNPOD_6_3R9_ENDPOINT_ID,
    process.env.RUNPOD_ENDPOINT_ID,
    process.env.RUNPOD_TTS_ENDPOINT_ID,
    process.env.RUNPOD_QWEN_TTS_ENDPOINT_ID,
    process.env.RUNPOD_IMAGE_ENDPOINT_ID,
    process.env.RUNPOD_VIDEO_ENDPOINT_ID,
    process.env.RUNPOD_LIVE_ACTION_ENDPOINT_ID,
  ])
}
function getLeaseSeconds() { return toInt(process.env.RUNPOD_6_3R10_LEASE_SECONDS, 120, { min: 5, max: 900 }) }
function getSmokeSeconds() { return toInt(process.env.RUNPOD_6_3R10_SMOKE_SECONDS, 2, { min: 1, max: 10 }) }
function getCooldownIdleTimeout() { return toInt(process.env.RUNPOD_6_3R10_COOLDOWN_IDLE_TIMEOUT_SECONDS || process.env.RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS, 5, { min: 1, max: 600 }) }
function getCooldownWorkersMax() { return toInt(process.env.RUNPOD_6_3R10_COOLDOWN_WORKERS_MAX || process.env.RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX, 1, { min: 0, max: 3 }) }

function getEnvHints() {
  const endpointIds = resolveEndpointIds()
  return {
    RUN_6_3R10_RUNPOD_PRODUCTION_LEASE: toBool(process.env.RUN_6_3R10_RUNPOD_PRODUCTION_LEASE),
    ALLOW_6_3R10_RUNPOD_LEASE_MUTATION: toBool(process.env.ALLOW_6_3R10_RUNPOD_LEASE_MUTATION),
    RUNPOD_6_3R10_ACTION: resolveAction(),
    RUNPOD_6_3R10_CONFIRMATION_PHRASE: hasValue(process.env.RUNPOD_6_3R10_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
    RUNPOD_API_KEY: maskSecret(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN),
    RUNPOD_6_3R10_ENDPOINT_IDS: endpointIds,
    RUNPOD_6_3R10_ENDPOINT_NAME: process.env.RUNPOD_6_3R10_ENDPOINT_NAME || process.env.RUNPOD_6_3R9_ENDPOINT_NAME || process.env.RUNPOD_ENDPOINT_NAME || null,
    RUNPOD_6_3R10_LEASE_SECONDS: getLeaseSeconds(),
    RUNPOD_6_3R10_COOLDOWN_WORKERS_MAX: getCooldownWorkersMax(),
    RUNPOD_6_3R10_COOLDOWN_IDLE_TIMEOUT_SECONDS: getCooldownIdleTimeout(),
    RUNPOD_6_3R10_SMOKE_SECONDS: getSmokeSeconds(),
  }
}

export function getRunPodProductionLeaseConfig() {
  return {
    sprint: SPRINT,
    name: NAME,
    mode: 'admin_production_lease_layer_read_only_by_default',
    envHints: getEnvHints(),
    confirmationPhrase: CONFIRMATION_PHRASE,
    lifecyclePolicy: {
      defaultEndpointPolicy: {
        workersMin: 0,
        workersMax: getCooldownWorkersMax(),
        idleTimeout: getCooldownIdleTimeout(),
      },
      adminProductionFlow: [
        'Admin solicita produção real.',
        'Backend cria lease curto com TTL e limite de endpoint.',
        'Opcional: aquece 1 worker somente dentro da janela do lease.',
        'Executa o job real.',
        'No finally, SEMPRE chama cooldown: workersMin=0, workersMax baixo, idleTimeout curto.',
        'Se o cooldown falhar, bloqueia nova produção real até inspeção manual.',
      ],
      forbidden: [
        'Produção real sem lease.',
        'Worker ativo indefinidamente.',
        'workersMin > 0 fora da janela de produção.',
        'Job real sem finally de cooldown.',
        'Nova produção real após falha de cooldown.',
      ],
    },
    safety: buildSafety(),
  }
}

function inspectStaticIntegration() {
  const projectRoot = resolveProjectRoot()
  const checks = [
    {
      label: 'RunPod Cost Guard 6.3R9 presente',
      file: 'backend/src/services/runpod-cost-guard.service.js',
      required: ['applyRunPodCostGuard', 'resolveEndpointName', 'workersMin', 'idleTimeout'],
    },
    {
      label: 'Production Lease 6.3R10 presente',
      file: 'backend/src/services/runpod-production-lease.service.js',
      required: ['withRunPodProductionLease', 'cooldown', 'finally'],
    },
  ]

  const results = checks.map((check) => {
    const absolute = path.join(projectRoot, check.file)
    const content = readFileSafe(absolute)
    const missing = content ? check.required.filter((token) => !content.includes(token)) : check.required
    return {
      label: check.label,
      file: check.file,
      exists: Boolean(content),
      ok: Boolean(content) && missing.length === 0,
      missing,
    }
  })

  const riskyFiles = []
  const backendSrc = path.join(projectRoot, 'backend', 'src')
  function walk(current) {
    let entries = []
    try { entries = fs.readdirSync(current, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry.name)) walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (!['.js', '.cjs', '.mjs'].includes(path.extname(entry.name))) continue
      const content = readFileSafe(absolute) || ''
      const relative = path.relative(projectRoot, absolute).replaceAll('\\', '/')
      const lower = content.toLowerCase()
      const referencesRunPod = lower.includes('runpod') || lower.includes('endpoint_id') || lower.includes('runsync')
      const hasLease = content.includes('withRunPodProductionLease') || content.includes('runpod-production-lease')
      const isGuard = relative.includes('runpod-cost-guard') || relative.includes('runpod-production-lease')
      if (referencesRunPod && !hasLease && !isGuard) riskyFiles.push(relative)
    }
  }
  if (fs.existsSync(backendSrc)) walk(backendSrc)

  return {
    projectRoot,
    checks: results,
    summary: {
      total: results.length,
      passed: results.filter((item) => item.ok).length,
      failed: results.filter((item) => !item.ok).map((item) => item.file),
      runPodReferencesWithoutLeaseTotal: riskyFiles.length,
    },
    runPodReferencesWithoutLease: riskyFiles.slice(0, 50),
  }
}

function validateApplyGuards(action = resolveAction()) {
  const blockers = []
  const warnings = []
  const runRequested = toBool(process.env.RUN_6_3R10_RUNPOD_PRODUCTION_LEASE)
  const mutationAllowed = toBool(process.env.ALLOW_6_3R10_RUNPOD_LEASE_MUTATION)
  const confirmationOk = String(process.env.RUNPOD_6_3R10_CONFIRMATION_PHRASE || '').trim() === CONFIRMATION_PHRASE
  const endpointIds = resolveEndpointIds()
  const apiKeyPresent = hasValue(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN)

  if (!runRequested) blockers.push('run_env_not_requested')
  if (!mutationAllowed) blockers.push('mutation_env_not_allowed')
  if (!confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')
  if (!ACTIONS.has(action) || action === 'inspect' || action === 'simulate-local') blockers.push('action_not_mutating_or_invalid')
  if (!endpointIds.length) blockers.push('runpod_endpoint_id_missing')
  if (!apiKeyPresent) blockers.push('runpod_api_key_missing')

  if (action === 'warm-and-cooldown-smoke') {
    warnings.push('warm_and_cooldown_smoke_may_start_one_worker_for_a_few_seconds')
    warnings.push('use_only_after_r9_cooldown_is_homologated_and_billing_is_stable')
  }

  return {
    runRequested,
    mutationAllowed,
    confirmationOk,
    endpointIds,
    apiKeyPresent,
    blockers,
    warnings,
  }
}

function snapshotEnv(keys) {
  const output = {}
  for (const key of keys) output[key] = process.env[key]
  return output
}
function restoreEnv(snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}
function copyEnvIfPresent(from, to) {
  if (hasValue(process.env[from]) && !hasValue(process.env[to])) process.env[to] = process.env[from]
}

async function runR9Action(action) {
  const keys = [
    'RUN_6_3R9_RUNPOD_COST_GUARD',
    'ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION',
    'RUNPOD_6_3R9_ACTION',
    'RUNPOD_6_3R9_CONFIRMATION_PHRASE',
    'RUNPOD_6_3R9_ENDPOINT_IDS',
    'RUNPOD_6_3R9_ENDPOINT_NAME',
    'RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX',
    'RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS',
    'RUNPOD_6_3R9_WARM_LEASE_MINUTES',
    'RUNPOD_6_3R9_WARM_WORKERS_MIN',
    'RUNPOD_6_3R9_WARM_WORKERS_MAX',
  ]
  const snap = snapshotEnv(keys)
  try {
    process.env.RUN_6_3R9_RUNPOD_COST_GUARD = 'true'
    process.env.ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION = 'true'
    process.env.RUNPOD_6_3R9_ACTION = action
    process.env.RUNPOD_6_3R9_CONFIRMATION_PHRASE = action === 'warm-single' ? R9_WARM_PHRASE : R9_COOLDOWN_PHRASE
    process.env.RUNPOD_6_3R9_ENDPOINT_IDS = resolveEndpointIds().join(',')
    process.env.RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX = String(getCooldownWorkersMax())
    process.env.RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS = String(getCooldownIdleTimeout())
    process.env.RUNPOD_6_3R9_WARM_LEASE_MINUTES = '1'
    process.env.RUNPOD_6_3R9_WARM_WORKERS_MIN = '1'
    process.env.RUNPOD_6_3R9_WARM_WORKERS_MAX = '1'

    copyEnvIfPresent('RUNPOD_6_3R10_ENDPOINT_NAME', 'RUNPOD_6_3R9_ENDPOINT_NAME')
    copyEnvIfPresent('RUNPOD_ENDPOINT_NAME', 'RUNPOD_6_3R9_ENDPOINT_NAME')

    return await applyRunPodCostGuard()
  } finally {
    restoreEnv(snap)
  }
}

export async function inspectRunPodProductionLease() {
  const config = getRunPodProductionLeaseConfig()
  const staticValidation = inspectStaticIntegration()
  const endpointIds = resolveEndpointIds()
  const warnings = []
  const blockers = []

  if (!fileExists('backend/src/services/runpod-cost-guard.service.js')) blockers.push('runpod_cost_guard_6_3R9_not_found')
  if (!endpointIds.length) warnings.push('runpod_endpoint_ids_not_configured_for_lease')
  if (!hasValue(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN)) warnings.push('runpod_api_key_not_configured_for_lease_apply')
  if (staticValidation.summary.failed.length) blockers.push('lease_static_files_missing_or_incomplete')
  if (staticValidation.summary.runPodReferencesWithoutLeaseTotal > 0) warnings.push('existing_runpod_scripts_still_need_explicit_lease_integration')

  const r9Inspect = await inspectRunPodCostGuard({ allowGraphqlInspect: false })

  return {
    sprint: SPRINT,
    status: blockers.length ? 'RUNPOD_PRODUCTION_LEASE_NOT_READY' : 'RUNPOD_PRODUCTION_LEASE_READY_WITH_WARNINGS',
    checkedAt: nowIso(),
    config,
    staticValidation,
    r9GuardStatus: {
      status: r9Inspect.status,
      warnings: r9Inspect.warnings || [],
      dangerousEnvFlags: r9Inspect.dangerousEnvFlags || {},
      lifecyclePolicyDetected: Boolean(r9Inspect.lifecyclePolicy),
    },
    leaseReadiness: {
      endpointIds,
      apiKeyPresent: hasValue(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN),
      defaultCooldown: {
        workersMin: 0,
        workersMax: getCooldownWorkersMax(),
        idleTimeout: getCooldownIdleTimeout(),
      },
      maxLeaseSeconds: getLeaseSeconds(),
      canRunReadOnlySimulation: true,
      canRunRealWarmSmoke: validateApplyGuards('warm-and-cooldown-smoke').blockers.length === 0,
      canRunCooldownOnly: validateApplyGuards('cooldown-only').blockers.length === 0,
    },
    rules: {
      productionMustUseLease: true,
      cooldownMustRunInFinally: true,
      cooldownFailureBlocksNextProduction: true,
      noRunPodInferenceInThisSprint: true,
      noMediaGenerationInThisSprint: true,
      noDatabaseMutationInThisSprint: true,
    },
    blockers,
    warnings,
    safety: buildSafety({
      cooldownRequiredByThisService: true,
    }),
  }
}

export async function testRunPodProductionLease() {
  const inspection = await inspectRunPodProductionLease()
  const simulatedSteps = []
  let finallyRan = false

  try {
    simulatedSteps.push({ step: 'lease_created_local_only', at: nowIso() })
    simulatedSteps.push({ step: 'admin_job_simulated_no_runpod', at: nowIso() })
  } finally {
    finallyRan = true
    simulatedSteps.push({ step: 'finally_cooldown_required_local_only', at: nowIso() })
  }

  return {
    sprint: SPRINT,
    status: 'RUNPOD_PRODUCTION_LEASE_TEST_READY',
    checkedAt: nowIso(),
    inspection,
    localSimulation: {
      leaseCreated: true,
      adminJobExecuted: true,
      finallyRan,
      cooldownWouldRun: finallyRan,
      runPodMutationExecuted: false,
      runPodInferenceExecuted: false,
      mediaGenerated: false,
      steps: simulatedSteps,
    },
    blockers: inspection.blockers || [],
    warnings: inspection.warnings || [],
    safety: buildSafety({ cooldownRequiredByThisService: true }),
  }
}

export async function withRunPodProductionLease({ productionName = 'admin-production-job', runProduction, warmBeforeJob = false } = {}) {
  if (typeof runProduction !== 'function') throw new Error('withRunPodProductionLease exige runProduction como função.')

  const leaseId = `lease-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const startedAt = nowIso()
  let warmResult = null
  let productionResult = null
  let productionError = null
  let cooldownResult = null

  try {
    if (warmBeforeJob) warmResult = await runR9Action('warm-single')
    productionResult = await runProduction({ leaseId, startedAt, productionName })
    return {
      sprint: SPRINT,
      status: 'RUNPOD_PRODUCTION_LEASE_JOB_COMPLETED',
      leaseId,
      productionName,
      startedAt,
      finishedAt: nowIso(),
      warmResult,
      productionResult,
      cooldownResult: null,
    }
  } catch (error) {
    productionError = error
    throw error
  } finally {
    cooldownResult = await runR9Action('cooldown')
    const cooldownOk = cooldownResult?.status === 'RUNPOD_COST_GUARD_APPLIED_CONTROLLED'
    if (!cooldownOk) {
      globalThis.__RUNPOD_REAL_PRODUCTION_BLOCKED_AFTER_COOLDOWN_FAILURE__ = {
        blocked: true,
        leaseId,
        productionName,
        failedAt: nowIso(),
        cooldownResult,
        productionError: productionError?.message || null,
      }
    }
  }
}

export async function applyRunPodProductionLease() {
  const action = resolveAction()

  if (action === 'simulate-local') {
    return {
      sprint: SPRINT,
      status: 'RUNPOD_PRODUCTION_LEASE_LOCAL_SIMULATION_READY',
      checkedAt: nowIso(),
      localOnly: true,
      message: 'Simulação local concluída. Nenhum endpoint RunPod foi alterado.',
      safety: buildSafety({ cooldownRequiredByThisService: true }),
      blockers: [],
      warnings: [],
    }
  }

  const guards = validateApplyGuards(action)
  if (guards.blockers.length) {
    return {
      sprint: SPRINT,
      status: 'RUNPOD_PRODUCTION_LEASE_APPLY_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedAction: action,
      guards,
      blockers: guards.blockers,
      warnings: guards.warnings,
      safety: buildSafety({ cooldownRequiredByThisService: true }),
    }
  }

  const warnings = [...guards.warnings]
  let warmResult = null
  let fakeJobResult = null
  let cooldownResult = null
  let cooldownAttempted = false

  try {
    if (action === 'warm-and-cooldown-smoke') {
      warmResult = await runR9Action('warm-single')
      fakeJobResult = {
        ok: true,
        simulatedAdminJob: true,
        sleptSeconds: getSmokeSeconds(),
        noInference: true,
        noMedia: true,
      }
      await sleep(getSmokeSeconds() * 1000)
    }

    if (action === 'cooldown-only') {
      fakeJobResult = {
        ok: true,
        cooldownOnly: true,
        noWarmWorker: true,
        noInference: true,
        noMedia: true,
      }
    }
  } finally {
    cooldownAttempted = true
    cooldownResult = await runR9Action('cooldown')
  }

  const cooldownOk = cooldownResult?.status === 'RUNPOD_COST_GUARD_APPLIED_CONTROLLED'
  if (!cooldownOk) warnings.push('cooldown_failed_block_real_production_until_manual_inspection')

  return {
    sprint: SPRINT,
    status: cooldownOk ? 'RUNPOD_PRODUCTION_LEASE_APPLIED_WITH_AUTO_COOLDOWN' : 'RUNPOD_PRODUCTION_LEASE_COOLDOWN_FAILED',
    dryRun: false,
    requestedAction: action,
    lease: {
      endpointIds: guards.endpointIds,
      startedAt: nowIso(),
      maxLeaseSeconds: getLeaseSeconds(),
      warmBeforeJob: action === 'warm-and-cooldown-smoke',
      cooldownAttempted,
      cooldownOk,
    },
    warmResult,
    fakeJobResult,
    cooldownResult,
    blockers: [],
    warnings,
    safety: buildSafety({
      runPodGraphqlMutationExecutedByThisService: true,
      runPodEndpointMutationExecutedByThisService: true,
      adminProductionLeaseCreatedByThisService: true,
      cooldownAttemptedByThisService: cooldownAttempted,
      cooldownRequiredByThisService: true,
      productionBlockedAfterCooldownFailure: !cooldownOk,
    }),
  }
}
