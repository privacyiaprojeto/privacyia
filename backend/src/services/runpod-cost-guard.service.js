import fs from 'fs'
import path from 'path'

const SPRINT = '6.3R9'
const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const ACTIONS = new Set(['inspect', 'cooldown', 'emergency-lock', 'warm-single'])

const CONFIRMATION_PHRASES = {
  cooldown: 'DESLIGAR WORKERS RUNPOD 6.3R9',
  'emergency-lock': 'TRAVAR RUNPOD SEM WORKERS 6.3R9',
  'warm-single': 'AQUECER 1 WORKER RUNPOD 6.3R9',
}

function nowIso() {
  return new Date().toISOString()
}

function toBool(value) {
  return TRUTHY.has(String(value ?? '').trim().toLowerCase())
}

function hasValue(value) {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

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

function unique(values = []) {
  return [...new Set(values.filter((value) => hasValue(value)).map((value) => String(value).trim()))]
}

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
    ...extra,
  }
}

function resolveProjectRoot() {
  const cwd = process.cwd()
  if (path.basename(cwd).toLowerCase() === 'backend') return path.resolve(cwd, '..')
  return cwd
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    return null
  }
}

function walkFiles(root, options = {}) {
  const {
    maxFiles = 220,
    extensions = new Set(['.js', '.cjs', '.mjs', '.ts', '.tsx', '.json']),
    ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', 'coverage']),
  } = options

  const output = []

  function walk(current) {
    if (output.length >= maxFiles) return
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch (error) {
      return
    }

    for (const entry of entries) {
      if (output.length >= maxFiles) return
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (!ignoredDirs.has(entry.name)) walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      if (!extensions.has(path.extname(entry.name).toLowerCase())) continue
      output.push(absolute)
    }
  }

  walk(root)
  return output
}

function inspectStaticRunPodUsage() {
  const projectRoot = resolveProjectRoot()
  const backendRoot = path.join(projectRoot, 'backend')
  const srcRoot = path.join(backendRoot, 'src')
  const files = fs.existsSync(srcRoot) ? walkFiles(srcRoot) : []

  const hits = []
  const directInferenceHits = []
  const lifecycleGuardHits = []
  const dangerousEnvHits = []

  for (const absolute of files) {
    const relative = path.relative(projectRoot, absolute).replaceAll('\\', '/')
    const content = readFileSafe(absolute) || ''
    const lower = content.toLowerCase()

    if (lower.includes('runpod') || lower.includes('endpoint_id') || lower.includes('runsync')) {
      hits.push(relative)
    }

    if (lower.includes('/runsync') || lower.includes('/run"') || lower.includes('/run\'') || lower.includes('runpod.service')) {
      directInferenceHits.push(relative)
    }

    if (content.includes('runpod-cost-guard') || content.includes('RUNPOD_COST_GUARD') || content.includes('withRunPodCostLease')) {
      lifecycleGuardHits.push(relative)
    }

    if (
      content.includes('ENABLE_REAL_IMAGE_WORKER') ||
      content.includes('ALLOW_REAL_SINGLE_ITEM_PRODUCTION') ||
      content.includes('RUN_6_3Q2_AUDIO_LIVE_REAL_GENERATION') ||
      content.includes('ALLOW_6_3Q2_TTS_R2_REAL')
    ) {
      dangerousEnvHits.push(relative)
    }
  }

  const packagePath = path.join(backendRoot, 'package.json')
  const packageJson = readFileSafe(packagePath)
  const packageScripts = []
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson)
      for (const [name, command] of Object.entries(parsed.scripts || {})) {
        if (String(name).includes('runpod') || String(command).toLowerCase().includes('runpod') || String(command).includes('real-production') || String(command).includes('audio-live-real')) {
          packageScripts.push({ name, command })
        }
      }
    } catch (error) {
      packageScripts.push({ name: 'package_json_parse_error', command: error.message })
    }
  }

  return {
    projectRoot,
    scannedFiles: files.length,
    runPodReferences: unique(hits).slice(0, 60),
    directInferenceReferences: unique(directInferenceHits).slice(0, 60),
    lifecycleGuardReferences: unique(lifecycleGuardHits).slice(0, 60),
    productionFlagReferences: unique(dangerousEnvHits).slice(0, 60),
    packageScripts: packageScripts.slice(0, 40),
    summary: {
      runPodReferencesTotal: unique(hits).length,
      directInferenceReferencesTotal: unique(directInferenceHits).length,
      lifecycleGuardReferencesTotal: unique(lifecycleGuardHits).length,
      productionFlagReferencesTotal: unique(dangerousEnvHits).length,
      packageScriptsTotal: packageScripts.length,
    },
  }
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function resolveEndpointIds() {
  return unique([
    ...splitCsv(process.env.RUNPOD_6_3R9_ENDPOINT_IDS),
    ...splitCsv(process.env.RUNPOD_COST_GUARD_ENDPOINT_IDS),
    process.env.RUNPOD_6_3R9_ENDPOINT_ID,
    process.env.RUNPOD_ENDPOINT_ID,
    process.env.RUNPOD_TTS_ENDPOINT_ID,
    process.env.RUNPOD_QWEN_TTS_ENDPOINT_ID,
    process.env.RUNPOD_IMAGE_ENDPOINT_ID,
    process.env.RUNPOD_VIDEO_ENDPOINT_ID,
    process.env.RUNPOD_LIVE_ACTION_ENDPOINT_ID,
  ])
}

function resolveAction() {
  const action = String(process.env.RUNPOD_6_3R9_ACTION || 'inspect').trim()
  return ACTIONS.has(action) ? action : 'inspect'
}

function resolveDesiredSettings(action = resolveAction()) {
  const cooldownIdleTimeout = toInt(process.env.RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS, 5, { min: 1, max: 600 })
  const cooldownWorkersMax = toInt(process.env.RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX, 1, { min: 0, max: 3 })
  const lockdownWorkersMax = toInt(process.env.RUNPOD_6_3R9_LOCKDOWN_WORKERS_MAX, 0, { min: 0, max: 1 })
  const warmWorkersMin = toInt(process.env.RUNPOD_6_3R9_WARM_WORKERS_MIN, 1, { min: 1, max: 1 })
  const warmWorkersMax = toInt(process.env.RUNPOD_6_3R9_WARM_WORKERS_MAX, 1, { min: 1, max: 2 })
  const warmLeaseMinutes = toInt(process.env.RUNPOD_6_3R9_WARM_LEASE_MINUTES, 15, { min: 1, max: 30 })

  if (action === 'emergency-lock') {
    return {
      action,
      explanation: 'Trava emergencial: zera active workers e tenta impedir novos workers flex configurando workersMax no menor valor aceito pelo endpoint.',
      input: {
        workersMin: 0,
        workersMax: lockdownWorkersMax,
        idleTimeout: cooldownIdleTimeout,
      },
      lease: null,
      expectedEffect: 'Parar cobrança contínua de workers ativos e impedir nova produção até rearmar manualmente.',
    }
  }

  if (action === 'warm-single') {
    const expiresAt = new Date(Date.now() + warmLeaseMinutes * 60 * 1000).toISOString()
    return {
      action,
      explanation: 'Aquecimento controlado: mantém somente 1 active worker por uma janela curta. Deve ser seguido por cooldown em finally/pós-job.',
      input: {
        workersMin: warmWorkersMin,
        workersMax: warmWorkersMax,
        idleTimeout: cooldownIdleTimeout,
      },
      lease: {
        leaseMinutes: warmLeaseMinutes,
        expiresAt,
        requiredPostJobAction: 'cooldown',
      },
      expectedEffect: 'Reduz cold start para produção controlada, mas pode cobrar enquanto o worker estiver ativo.',
    }
  }

  return {
    action: 'cooldown',
    explanation: 'Cooldown seguro: zera active workers, mantém max workers baixo e idle timeout curto para scale-to-zero após o job.',
    input: {
      workersMin: 0,
      workersMax: cooldownWorkersMax,
      idleTimeout: cooldownIdleTimeout,
    },
    lease: null,
    expectedEffect: 'Permitir que workers ociosos desliguem rapidamente e evitar cobrança contínua por active workers.',
  }
}

function getEnvHints() {
  const action = resolveAction()
  const endpointIds = resolveEndpointIds()
  return {
    RUN_6_3R9_RUNPOD_COST_GUARD: toBool(process.env.RUN_6_3R9_RUNPOD_COST_GUARD),
    ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION: toBool(process.env.ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION),
    RUNPOD_6_3R9_ACTION: action,
    RUNPOD_6_3R9_CONFIRMATION_PHRASE: hasValue(process.env.RUNPOD_6_3R9_CONFIRMATION_PHRASE) ? '[preenchida]' : null,
    RUNPOD_API_KEY: maskSecret(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN),
    RUNPOD_6_3R9_ENDPOINT_IDS: endpointIds,
    RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX: process.env.RUNPOD_6_3R9_COOLDOWN_WORKERS_MAX || null,
    RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS: process.env.RUNPOD_6_3R9_COOLDOWN_IDLE_TIMEOUT_SECONDS || null,
    RUNPOD_6_3R9_LOCKDOWN_WORKERS_MAX: process.env.RUNPOD_6_3R9_LOCKDOWN_WORKERS_MAX || null,
    RUNPOD_6_3R9_WARM_LEASE_MINUTES: process.env.RUNPOD_6_3R9_WARM_LEASE_MINUTES || null,
  }
}

export function getRunPodCostGuardConfig() {
  const action = resolveAction()
  return {
    sprint: SPRINT,
    name: 'RunPod Cost Guard / Worker Lifecycle Safety',
    mode: 'read_only_by_default_with_explicit_endpoint_mutation',
    envHints: getEnvHints(),
    desiredSettingsPreview: action === 'inspect' ? resolveDesiredSettings('cooldown') : resolveDesiredSettings(action),
    confirmationPhrases: CONFIRMATION_PHRASES,
    safety: buildSafety(),
  }
}

function escapeGraphqlString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function runRunPodGraphql(query, { mutation = false } = {}) {
  const apiKey = process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN
  if (!hasValue(apiKey)) {
    return {
      ok: false,
      error: 'RUNPOD_API_KEY ausente',
      code: 'RUNPOD_API_KEY_MISSING',
      safety: buildSafety(),
    }
  }

  const response = await fetch(`https://api.runpod.io/graphql?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query }),
  })

  let json = null
  try {
    json = await response.json()
  } catch (error) {
    return {
      ok: false,
      httpStatus: response.status,
      error: `Resposta não JSON: ${error.message}`,
      code: 'RUNPOD_GRAPHQL_NON_JSON_RESPONSE',
      safety: buildSafety({
        runPodGraphqlQueryExecutedByThisService: !mutation,
        runPodGraphqlMutationExecutedByThisService: Boolean(mutation),
        runPodEndpointMutationExecutedByThisService: Boolean(mutation),
      }),
    }
  }

  return {
    ok: response.ok && !json.errors,
    httpStatus: response.status,
    data: json.data || null,
    errors: json.errors || null,
    error: json.errors ? 'RunPod GraphQL retornou errors' : null,
    safety: buildSafety({
      runPodGraphqlQueryExecutedByThisService: !mutation,
      runPodGraphqlMutationExecutedByThisService: Boolean(mutation),
      runPodEndpointMutationExecutedByThisService: Boolean(mutation),
    }),
  }
}

async function queryRunPodEndpoints() {
  const query = `query { myself { endpoints { id name gpuIds workersMin workersMax idleTimeout } } }`
  return runRunPodGraphql(query, { mutation: false })
}

function resolveEndpointName(endpointId, endpointLookup = {}) {
  const endpointSpecificEnv = process.env[`RUNPOD_6_3R9_ENDPOINT_NAME_${String(endpointId).toUpperCase().replace(/[^A-Z0-9]/g, '_')}`]
  const fallbackName = process.env.RUNPOD_6_3R9_ENDPOINT_NAME || process.env.RUNPOD_ENDPOINT_NAME
  return endpointLookup?.[endpointId]?.name || endpointSpecificEnv || fallbackName || null
}

function buildEndpointLookup(remoteData) {
  const endpoints = remoteData?.myself?.endpoints || []
  const output = {}
  for (const endpoint of endpoints) {
    if (!endpoint?.id) continue
    output[endpoint.id] = endpoint
  }
  return output
}

async function updateRunPodEndpoint(endpointId, settings, { endpointLookup = {} } = {}) {
  const endpointName = resolveEndpointName(endpointId, endpointLookup)
  if (!hasValue(endpointName)) {
    return {
      ok: false,
      httpStatus: null,
      data: null,
      errors: [{ message: 'EndpointInput.name é obrigatório no saveEndpoint. Informe RUNPOD_6_3R9_ENDPOINT_NAME ou habilite a pré-inspeção GraphQL para buscar o nome atual.' }],
      error: 'RunPod GraphQL exige name no EndpointInput',
      code: 'RUNPOD_ENDPOINT_NAME_REQUIRED',
      safety: buildSafety(),
    }
  }

  const fields = []
  fields.push(`id: "${escapeGraphqlString(endpointId)}"`)
  fields.push(`name: "${escapeGraphqlString(endpointName)}"`)
  if (Number.isFinite(settings.workersMin)) fields.push(`workersMin: ${settings.workersMin}`)
  if (Number.isFinite(settings.workersMax)) fields.push(`workersMax: ${settings.workersMax}`)
  if (Number.isFinite(settings.idleTimeout)) fields.push(`idleTimeout: ${settings.idleTimeout}`)

  const query = `mutation { saveEndpoint(input: { ${fields.join(', ')} }) { id name workersMin workersMax idleTimeout } }`
  const result = await runRunPodGraphql(query, { mutation: true })
  return {
    ...result,
    endpointNameUsed: endpointName,
  }
}

function validateApplyGuards({ action = resolveAction(), endpointIds = resolveEndpointIds() } = {}) {
  const blockers = []
  const warnings = []
  const runRequested = toBool(process.env.RUN_6_3R9_RUNPOD_COST_GUARD)
  const mutationAllowed = toBool(process.env.ALLOW_6_3R9_RUNPOD_ENDPOINT_MUTATION)
  const apiKeyPresent = hasValue(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN)
  const confirmationRequired = CONFIRMATION_PHRASES[action]
  const confirmationOk = action === 'inspect'
    ? false
    : String(process.env.RUNPOD_6_3R9_CONFIRMATION_PHRASE || '').trim() === confirmationRequired

  if (!runRequested) blockers.push('run_env_not_requested')
  if (!mutationAllowed) blockers.push('mutation_env_not_allowed')
  if (!ACTIONS.has(action) || action === 'inspect') blockers.push('action_not_mutating_or_invalid')
  if (!confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')
  if (!apiKeyPresent) blockers.push('runpod_api_key_missing')
  if (!endpointIds.length) blockers.push('runpod_endpoint_id_missing')

  if (action === 'warm-single') {
    warnings.push('warm_single_can_generate_idle_active_worker_cost_until_cooldown_runs')
    warnings.push('use_only_inside_admin_production_lease_and_run_cooldown_in_finally')
  }

  if (action === 'emergency-lock') {
    warnings.push('workersMax_zero_may_be_rejected_by_runpod_if_endpoint_requires_minimum_one')
  }

  return {
    runRequested,
    mutationAllowed,
    apiKeyPresent,
    confirmationRequired,
    confirmationOk,
    endpointIds,
    blockers,
    warnings,
  }
}

export async function inspectRunPodCostGuard({ allowGraphqlInspect = false } = {}) {
  const config = getRunPodCostGuardConfig()
  const staticValidation = inspectStaticRunPodUsage()
  const action = resolveAction()
  const endpointIds = resolveEndpointIds()
  const applyGuards = validateApplyGuards({ action, endpointIds })
  const blockers = []
  const warnings = []

  if (!endpointIds.length) warnings.push('runpod_endpoint_ids_not_configured_yet')
  if (!hasValue(process.env.RUNPOD_API_KEY || process.env.RUNPOD_API_TOKEN)) warnings.push('runpod_api_key_not_configured_for_emergency_shutdown')
  if (staticValidation.summary.directInferenceReferencesTotal > 0 && staticValidation.summary.lifecycleGuardReferencesTotal === 0) {
    warnings.push('runpod_inference_references_found_without_lifecycle_guard_integration')
  }
  if (staticValidation.summary.productionFlagReferencesTotal > 0) warnings.push('real_production_flags_exist_review_before_enabling')

  const dangerousEnvFlags = {
    ENABLE_REAL_IMAGE_WORKER: toBool(process.env.ENABLE_REAL_IMAGE_WORKER),
    ALLOW_REAL_SINGLE_ITEM_PRODUCTION: toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION),
    RUN_6_3Q2_AUDIO_LIVE_REAL_GENERATION: toBool(process.env.RUN_6_3Q2_AUDIO_LIVE_REAL_GENERATION),
    ALLOW_6_3Q2_TTS_R2_REAL: toBool(process.env.ALLOW_6_3Q2_TTS_R2_REAL),
  }

  if (Object.values(dangerousEnvFlags).some(Boolean) && !toBool(process.env.RUN_6_3R9_RUNPOD_COST_GUARD)) {
    warnings.push('real_generation_flags_detected_without_cost_guard_requested')
  }

  let remoteInspect = {
    called: false,
    ok: false,
    reason: allowGraphqlInspect ? null : 'GraphQL inspect desligado por padrão para manter teste sem chamada externa.',
    result: null,
  }

  if (allowGraphqlInspect) {
    const result = await queryRunPodEndpoints()
    remoteInspect = {
      called: true,
      ok: Boolean(result.ok),
      reason: result.error || null,
      result: result.ok ? result.data : { error: result.error, errors: result.errors, httpStatus: result.httpStatus, code: result.code },
    }
    if (!result.ok) warnings.push('runpod_graphql_inspect_failed')
  }

  return {
    sprint: SPRINT,
    status: blockers.length ? 'RUNPOD_COST_GUARD_NOT_READY' : 'RUNPOD_COST_GUARD_READY_WITH_WARNINGS',
    checkedAt: nowIso(),
    videoDiagnosis: {
      observedFromUserVideo: true,
      billingArea: 'RunPod Billing Explorer',
      evidenceSummary: 'A gravação mostra cobranças na coluna Serverless mesmo sem um worker claramente visível em execução na tela. Isso é compatível com workers ativos/ociosos, flex workers ainda dentro do idle timeout, endpoint com active workers > 0, jobs remanescentes ou endpoint sem scale-to-zero agressivo.',
      immediateRisk: 'Custo pode continuar pingando se workersMin/Active workers ficar maior que zero ou se o endpoint não reduzir rapidamente após o job.',
    },
    config,
    dangerousEnvFlags,
    staticValidation,
    remoteInspect,
    lifecyclePolicy: {
      defaultProductionMode: 'workersMin=0, workersMax baixo, idleTimeout curto, jobs assíncronos sob demanda',
      whenAdminRequestsProduction: [
        'Criar lease de produção com TTL curto.',
        'Opcionalmente aquecer 1 worker apenas durante a janela do job.',
        'Executar job real.',
        'No finally, rodar cooldown automático: workersMin=0, workersMax baixo, idleTimeout curto.',
        'Se falhar, manter produção real bloqueada e exigir inspeção antes de novo job.',
      ],
      forbiddenInProdWithoutLease: [
        'workersMin/Active workers maior que 0 por tempo indefinido',
        'flags reais ligadas sem frase e TTL',
        'max workers alto sem limite de gasto',
        'produção real sem pós-job cooldown',
      ],
    },
    applyPreview: {
      action,
      desiredSettings: action === 'inspect' ? resolveDesiredSettings('cooldown') : resolveDesiredSettings(action),
      guards: applyGuards,
      wouldMutateRunPodEndpoint: action !== 'inspect' && applyGuards.blockers.length === 0,
    },
    blockers,
    warnings,
    safety: buildSafety({
      runPodGraphqlQueryExecutedByThisService: Boolean(remoteInspect.called),
    }),
  }
}

export async function testRunPodCostGuard() {
  const inspection = await inspectRunPodCostGuard({ allowGraphqlInspect: false })
  const action = resolveAction()
  const endpointIds = resolveEndpointIds()
  const guards = validateApplyGuards({ action, endpointIds })

  return {
    sprint: SPRINT,
    status: 'RUNPOD_COST_GUARD_TEST_READY',
    checkedAt: nowIso(),
    inspection,
    blockedApplyPreview: {
      sprint: SPRINT,
      status: 'RUNPOD_COST_GUARD_APPLY_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedAction: action,
      blockers: guards.blockers.length ? guards.blockers : ['dry_run_only'],
      desiredSettings: action === 'inspect' ? resolveDesiredSettings('cooldown') : resolveDesiredSettings(action),
      safety: buildSafety(),
    },
    blockers: inspection.blockers || [],
    warnings: inspection.warnings || [],
    safety: buildSafety(),
  }
}

export async function applyRunPodCostGuard() {
  const action = resolveAction()
  const endpointIds = resolveEndpointIds()
  const guards = validateApplyGuards({ action, endpointIds })
  const desiredSettings = resolveDesiredSettings(action)

  if (guards.blockers.length) {
    return {
      sprint: SPRINT,
      status: 'RUNPOD_COST_GUARD_APPLY_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedAction: action,
      guards,
      desiredSettings,
      blockers: guards.blockers,
      warnings: guards.warnings,
      safety: buildSafety(),
    }
  }

  const warnings = [...guards.warnings]
  const endpointPrefetch = await queryRunPodEndpoints()
  const endpointLookup = endpointPrefetch.ok ? buildEndpointLookup(endpointPrefetch.data) : {}
  if (!endpointPrefetch.ok) warnings.push('runpod_endpoint_name_prefetch_failed')

  const results = []
  for (const endpointId of endpointIds) {
    const result = await updateRunPodEndpoint(endpointId, desiredSettings.input, { endpointLookup })
    results.push({
      endpointId,
      endpointNameUsed: result.endpointNameUsed || endpointLookup?.[endpointId]?.name || null,
      ok: Boolean(result.ok),
      httpStatus: result.httpStatus || null,
      data: result.data?.saveEndpoint || null,
      errors: result.errors || null,
      error: result.error || null,
      code: result.code || null,
    })
  }

  const failed = results.filter((item) => !item.ok)
  if (failed.length) warnings.push('one_or_more_runpod_endpoint_updates_failed')
  if (action === 'warm-single') warnings.push('cooldown_must_run_after_job_even_if_generation_fails')

  return {
    sprint: SPRINT,
    status: failed.length ? 'RUNPOD_COST_GUARD_APPLY_PARTIAL_OR_FAILED' : 'RUNPOD_COST_GUARD_APPLIED_CONTROLLED',
    dryRun: false,
    requestedAction: action,
    desiredSettings,
    endpointResults: results,
    postActionChecklist: action === 'warm-single'
      ? [
          'Executar geração real controlada.',
          'No finally, rodar RUNPOD_6_3R9_ACTION=cooldown com frase DESLIGAR WORKERS RUNPOD 6.3R9.',
          'Rodar inspect e confirmar workersMin=0 / idleTimeout curto.',
        ]
      : [
          'Abrir RunPod Billing/Endpoint e confirmar workers ativos zerando após idleTimeout.',
          'Não deixar RUN_6_3R9_RUNPOD_COST_GUARD=true após execução.',
          'Não habilitar produção real antes de integrar lease automático no Admin.',
        ],
    blockers: [],
    warnings,
    safety: buildSafety({
      runPodGraphqlMutationExecutedByThisService: true,
      runPodEndpointMutationExecutedByThisService: true,
    }),
  }
}

export async function withRunPodCostLease({ run, onBefore = null, onAfter = null } = {}) {
  if (typeof run !== 'function') throw new Error('withRunPodCostLease exige uma função run.')

  const startedAt = nowIso()
  let result
  let error

  try {
    if (typeof onBefore === 'function') await onBefore()
    result = await run()
    return result
  } catch (caught) {
    error = caught
    throw caught
  } finally {
    if (typeof onAfter === 'function') {
      await onAfter({ startedAt, finishedAt: nowIso(), result, error })
    }
  }
}
