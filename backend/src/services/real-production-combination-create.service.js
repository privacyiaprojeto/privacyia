import { supabaseAdmin } from '../config/supabase.js'

const SPRINT = '6.3E'
const REQUIRED_CREATE_PHRASE = 'CADASTRAR COMBINACAO REAL 6.3E'
const DEFAULT_PRICE_CREDITS = 30
const DEFAULT_OPERATIONAL_COST_CREDITS = 2
const DEFAULT_PAYOUT_PERCENT = 40
const DEFAULT_QUANTITY = 1
const MAX_ADAPTIVE_ATTEMPTS = 64

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function boolEnv(name, fallback = false) {
  const value = process.env[name]
  if (value === undefined || value === null || value === '') return fallback
  return String(value).trim().toLowerCase() === 'true'
}

function intEnv(name, fallback) {
  const raw = process.env[name]
  if (raw === undefined || raw === null || raw === '') return fallback
  const parsed = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function cleanString(value, fallback = null) {
  if (value === undefined || value === null) return fallback
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function makeSlug(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function uniqueCompactId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function safeJson(value) {
  try {
    if (!value) return null
    return JSON.parse(value)
  } catch {
    return null
  }
}

function baseSafety(extra = {}) {
  return {
    runPodCalledByThisService: false,
    r2RealUploadByThisService: false,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    batchCreatedByThisService: false,
    batchItemCreatedByThisService: false,
    clientDeliveryCreatedByThisService: false,
    galleryItemCreatedByThisService: false,
    databaseMutationExecutedByThisService: false,
    runPodMayBeCalledByWorkerAfterQueue: false,
    ...extra
  }
}

function stripUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}

function filterPatchByKnownColumns(patch, columns = []) {
  if (!Array.isArray(columns) || columns.length === 0) {
    return {
      filteredPatch: { ...patch },
      removedBySchema: []
    }
  }

  const allowed = new Set(columns)
  const filteredEntries = Object.entries(patch).filter(([key]) => allowed.has(key))
  const removedBySchema = Object.keys(patch).filter((key) => !allowed.has(key))

  return {
    filteredPatch: Object.fromEntries(filteredEntries),
    removedBySchema
  }
}

function extractMissingColumn(errorMessage) {
  const message = String(errorMessage || '')
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /record "[^"]+" has no field "([^"]+)"/i,
    /schema cache.*?'([^']+)'/i
  ]

  for (const pattern of patterns) {
    const match = message.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}


function isMediaTypeConstraintError(errorMessage) {
  return String(errorMessage || '').includes('media_combinations_media_type_check')
}

function uniqueValues(values = []) {
  const seen = new Set()
  const result = []
  for (const value of values) {
    const cleaned = cleanString(value)
    if (!cleaned || seen.has(cleaned)) continue
    seen.add(cleaned)
    result.push(cleaned)
  }
  return result
}

function mediaTypeCandidates(configuredValue, existingValues = []) {
  return uniqueValues([
    configuredValue,
    ...existingValues,
    'imagem',
    'image_generation',
    'generated_image',
    'media_image',
    'photo',
    'foto',
    'picture',
    'image'
  ])
}

function redactPatchForLog(patch) {
  const redacted = { ...patch }
  if (redacted.prompt) redacted.prompt = '[prompt informado]'
  if (redacted.prompt_base) redacted.prompt_base = '[prompt informado]'
  if (redacted.prompt_template) redacted.prompt_template = '[prompt informado]'
  if (redacted.prompt_final) redacted.prompt_final = '[prompt informado]'
  if (redacted.config) redacted.config = '[json/config informado]'
  if (redacted.metadata) redacted.metadata = '[json/metadata informado]'
  return redacted
}

export function getRealProductionCombinationCreateConfig() {
  const companionId = cleanString(process.env.REAL_PRODUCTION_COMPANION_ID)
  const combinationLabel = cleanString(process.env.REAL_PRODUCTION_COMBINATION_LABEL, `Combinacao real ${SPRINT}`)
  const promptBase = cleanString(process.env.REAL_PRODUCTION_PROMPT_BASE, 'Retrato editorial premium, pose segura, iluminação de estúdio, composição profissional, qualidade alta')
  const mediaType = cleanString(process.env.REAL_PRODUCTION_MEDIA_TYPE, 'image')
  const category = cleanString(process.env.REAL_PRODUCTION_COMBINATION_CATEGORY, 'imagem_real_controlada')
  const style = cleanString(process.env.REAL_PRODUCTION_COMBINATION_STYLE, 'editorial')
  const environment = cleanString(process.env.REAL_PRODUCTION_COMBINATION_ENVIRONMENT, 'studio')
  const pose = cleanString(process.env.REAL_PRODUCTION_COMBINATION_POSE, 'pose_segura')
  const priceCredits = intEnv('REAL_PRODUCTION_PRICE_CREDITS', DEFAULT_PRICE_CREDITS)
  const operationalCostCredits = intEnv('REAL_PRODUCTION_OPERATIONAL_COST_CREDITS', DEFAULT_OPERATIONAL_COST_CREDITS)
  const payoutPercent = intEnv('REAL_PRODUCTION_PAYOUT_PERCENT', DEFAULT_PAYOUT_PERCENT)
  const quantity = intEnv('REAL_PRODUCTION_QUANTITY', DEFAULT_QUANTITY)
  const extraMetadata = safeJson(process.env.REAL_PRODUCTION_COMBINATION_METADATA_JSON)

  const shouldApply = boolEnv('RUN_6_3E_REAL_COMBINATION_CREATE') && boolEnv('ALLOW_REAL_COMBINATION_DATA_MUTATION')
  const confirmationInput = cleanString(process.env.REAL_COMBINATION_CREATE_CONFIRMATION_INPUT)

  return {
    sprint: SPRINT,
    requiredCreatePhrase: REQUIRED_CREATE_PHRASE,
    companionId,
    desiredValues: {
      combinationLabel,
      promptBase,
      mediaType,
      category,
      style,
      environment,
      pose,
      priceCredits,
      operationalCostCredits,
      payoutPercent,
      quantity,
      extraMetadata
    },
    shouldApply,
    confirmationInput,
    envHints: {
      RUN_6_3A_REAL_E2E: boolEnv('RUN_6_3A_REAL_E2E'),
      RUN_6_3C_REAL_PREP: boolEnv('RUN_6_3C_REAL_PREP'),
      RUN_6_3D_REAL_CANDIDATE_CONFIG: boolEnv('RUN_6_3D_REAL_CANDIDATE_CONFIG'),
      RUN_6_3E_REAL_COMBINATION_CREATE: boolEnv('RUN_6_3E_REAL_COMBINATION_CREATE'),
      ALLOW_REAL_COMBINATION_DATA_MUTATION: boolEnv('ALLOW_REAL_COMBINATION_DATA_MUTATION'),
      ENABLE_REAL_IMAGE_WORKER: boolEnv('ENABLE_REAL_IMAGE_WORKER'),
      REAL_PRODUCTION_COMPANION_ID: companionId,
      REAL_PRODUCTION_COMBINATION_ID: cleanString(process.env.REAL_PRODUCTION_COMBINATION_ID),
      REAL_PRODUCTION_COMBINATION_LABEL: combinationLabel,
      REAL_PRODUCTION_MEDIA_TYPE: mediaType,
      REAL_PRODUCTION_PRICE_CREDITS: priceCredits,
      REAL_PRODUCTION_OPERATIONAL_COST_CREDITS: operationalCostCredits,
      REAL_PRODUCTION_PAYOUT_PERCENT: payoutPercent
    },
    safety: baseSafety()
  }
}

function validateConfig(config) {
  const blockers = []
  const warnings = []

  if (!config.companionId) blockers.push('companion_id_required')
  else if (!uuidRegex.test(config.companionId)) blockers.push('companion_id_invalid_uuid')

  if (config.desiredValues.quantity !== 1) blockers.push('quantity_limited_to_one')
  if (!Number.isFinite(config.desiredValues.priceCredits) || config.desiredValues.priceCredits <= 0) blockers.push('price_credits_must_be_positive')
  if (!Number.isFinite(config.desiredValues.operationalCostCredits) || config.desiredValues.operationalCostCredits < 0) blockers.push('operational_cost_credits_invalid')
  if (!Number.isFinite(config.desiredValues.payoutPercent) || config.desiredValues.payoutPercent < 0 || config.desiredValues.payoutPercent > 100) blockers.push('payout_percent_invalid')
  if (!config.desiredValues.combinationLabel) blockers.push('combination_label_required')
  if (!config.desiredValues.promptBase) blockers.push('prompt_base_required')

  warnings.push('payout_rule_may_require_dedicated_table')
  warnings.push('after_creation_run_6_3D_to_configure_or_confirm_price_cost_payout')

  return { blockers, warnings }
}

async function fetchCompanion(companionId) {
  if (!companionId || !uuidRegex.test(companionId)) {
    return { ok: false, found: false, row: null, error: null }
  }

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('*')
    .eq('id', companionId)
    .maybeSingle()

  if (error) return { ok: false, found: false, row: null, error: error.message }
  return { ok: true, found: Boolean(data), row: data || null, error: null }
}

function companionLabel(row) {
  if (!row) return null
  return row.display_name || row.name || row.nome || row.slug || row.id || null
}

function buildCombinationPatch(config, companion) {
  const uid = uniqueCompactId()
  const label = config.desiredValues.combinationLabel
  const slug = makeSlug(`${label}-${uid}`)
  const metadata = {
    ...(config.desiredValues.extraMetadata || {}),
    sprint: SPRINT,
    source: 'real_production_combination_create_6_3E',
    created_by_flow: 'admin_real_production_controlled_combination',
    safe_for_client_exposure: false,
    real_candidate: true,
    demo: false,
    test: false,
    companion_label: companionLabel(companion)
  }

  const configPayload = {
    media_type: config.desiredValues.mediaType,
    category: config.desiredValues.category,
    style: config.desiredValues.style,
    environment: config.desiredValues.environment,
    pose: config.desiredValues.pose,
    prompt_base: config.desiredValues.promptBase,
    price_credits: config.desiredValues.priceCredits,
    operational_cost_credits: config.desiredValues.operationalCostCredits,
    payout_percent: config.desiredValues.payoutPercent,
    quantity: config.desiredValues.quantity,
    sprint: SPRINT
  }

  return stripUndefined({
    companion_id: config.companionId,
    companionId: config.companionId,
    actor_id: companion?.actor_id,
    profile_id: companion?.profile_id,
    combination_key: `real-${config.companionId}-${slug}`.slice(0, 180),
    label,
    name: label,
    title: label,
    description: `${label} — combinação real controlada criada pelo Sprint ${SPRINT}`,
    slug,
    type: config.desiredValues.mediaType,
    media_type: config.desiredValues.mediaType,
    kind: config.desiredValues.mediaType,
    category: config.desiredValues.category,
    style: config.desiredValues.style,
    environment: config.desiredValues.environment,
    pose: config.desiredValues.pose,
    prompt: config.desiredValues.promptBase,
    prompt_base: config.desiredValues.promptBase,
    prompt_template: config.desiredValues.promptBase,
    prompt_final: config.desiredValues.promptBase,
    final_prompt: config.desiredValues.promptBase,
    negative_prompt: 'unsafe, low quality, watermark, public exposure, explicit, minors',
    display_payload: {
      title: label,
      category: config.desiredValues.category,
      style: config.desiredValues.style,
      environment: config.desiredValues.environment,
      pose: config.desiredValues.pose,
      visible_to_client: false,
      admin_only: true,
      sprint: SPRINT
    },
    prompt_payload: {
      prompt_base: config.desiredValues.promptBase,
      final_prompt: config.desiredValues.promptBase,
      negative_prompt: 'unsafe, low quality, watermark, public exposure, explicit, minors',
      sprint: SPRINT
    },
    option_ids: [],
    guided_selections: {
      category: config.desiredValues.category,
      style: config.desiredValues.style,
      environment: config.desiredValues.environment,
      pose: config.desiredValues.pose,
      sprint: SPRINT
    },
    price_credits: config.desiredValues.priceCredits,
    credits_price: config.desiredValues.priceCredits,
    operational_cost_credits: config.desiredValues.operationalCostCredits,
    estimated_operational_cost_credits: config.desiredValues.operationalCostCredits,
    payout_percent: config.desiredValues.payoutPercent,
    revenue_share_percent: config.desiredValues.payoutPercent,
    active: true,
    enabled: true,
    is_active: true,
    target_stock: 1,
    min_stock_threshold: 0,
    visible: false,
    visible_to_client: false,
    admin_only: true,
    adminOnly: true,
    is_demo: false,
    demo: false,
    is_test: false,
    test: false,
    is_real_candidate: true,
    real_candidate: true,
    archived: false,
    status: 'draft',
    publication_status: 'draft',
    source: 'real_production_6_3E',
    job_origin: 'real_production_6_3E',
    media_origin: 'real_production_controlled_6_3E',
    finance_snapshot: {
      price_credits: config.desiredValues.priceCredits,
      operational_cost_credits: config.desiredValues.operationalCostCredits,
      payout_percent: config.desiredValues.payoutPercent,
      sprint: SPRINT
    },
    config: configPayload,
    metadata,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  })
}

async function tryReadTableColumns(tableName) {
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .limit(20)

  if (error) return { ok: false, columns: [], sampleRows: [], mediaTypeValues: [], error: error.message }
  const columns = data?.[0] ? Object.keys(data[0]) : []
  const mediaTypeValues = uniqueValues((data || []).map((row) => row?.media_type))
  return { ok: true, columns, sampleRows: data || [], mediaTypeValues, error: null }
}

async function adaptiveInsertMediaCombination(patch, options = {}) {
  let candidate = { ...patch }
  const removedColumns = []
  const mediaTypeAttempts = []
  const configuredMediaType = candidate.media_type
  const allowedMediaTypeCandidates = mediaTypeCandidates(configuredMediaType, options.existingMediaTypes || [])
  let lastError = null
  let mediaTypeIndex = 0

  for (let attempt = 1; attempt <= MAX_ADAPTIVE_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from('media_combinations')
      .insert(candidate)
      .select('*')
      .single()

    if (!error) {
      return {
        ok: true,
        row: data,
        removedColumns,
        mediaTypeAttempts,
        attempts: attempt,
        error: null,
        finalPatchKeys: Object.keys(candidate),
        finalMediaType: candidate.media_type || null
      }
    }

    lastError = error

    if (isMediaTypeConstraintError(error.message) && 'media_type' in candidate) {
      mediaTypeAttempts.push(candidate.media_type)
      mediaTypeIndex += 1

      if (mediaTypeIndex < allowedMediaTypeCandidates.length) {
        candidate = {
          ...candidate,
          media_type: allowedMediaTypeCandidates[mediaTypeIndex]
        }
        continue
      }

      break
    }

    const missingColumn = extractMissingColumn(error.message)
    if (!missingColumn || !(missingColumn in candidate)) break

    removedColumns.push(missingColumn)
    delete candidate[missingColumn]
  }

  return {
    ok: false,
    row: null,
    removedColumns,
    mediaTypeAttempts,
    attempts: MAX_ADAPTIVE_ATTEMPTS,
    error: lastError?.message || 'Falha desconhecida ao inserir combinação real controlada.',
    finalPatchKeys: Object.keys(candidate),
    finalMediaType: candidate.media_type || null
  }
}

async function safePostInspection(companionId, combinationId) {
  if (!companionId || !combinationId) return null

  try {
    const module = await import('./real-production-prep.service.js')
    const fn = module.inspectRealProductionCandidate || module.prepareRealProductionCandidate || module.default
    if (typeof fn !== 'function') return null

    const previousCompanion = process.env.REAL_PRODUCTION_COMPANION_ID
    const previousCombination = process.env.REAL_PRODUCTION_COMBINATION_ID
    process.env.REAL_PRODUCTION_COMPANION_ID = companionId
    process.env.REAL_PRODUCTION_COMBINATION_ID = combinationId

    try {
      return await fn({ dryRun: true })
    } finally {
      if (previousCompanion === undefined) delete process.env.REAL_PRODUCTION_COMPANION_ID
      else process.env.REAL_PRODUCTION_COMPANION_ID = previousCompanion

      if (previousCombination === undefined) delete process.env.REAL_PRODUCTION_COMBINATION_ID
      else process.env.REAL_PRODUCTION_COMBINATION_ID = previousCombination
    }
  } catch {
    return null
  }
}

export async function planRealProductionCombinationCreate(options = {}) {
  const config = getRealProductionCombinationCreateConfig()
  const dryRun = options.dryRun !== false
  const { blockers, warnings } = validateConfig(config)

  const companion = await fetchCompanion(config.companionId)
  if (config.companionId && companion.ok && !companion.found) blockers.push('companion_not_found')
  if (companion.error) warnings.push('companion_lookup_warning')

  const tableColumns = await tryReadTableColumns('media_combinations')
  if (!tableColumns.ok) warnings.push('media_combinations_schema_lookup_warning')

  const patch = buildCombinationPatch(config, companion.row)
  const knownColumns = tableColumns.columns
  const supportedPreview = knownColumns.length > 0
    ? Object.fromEntries(Object.entries(patch).filter(([key]) => knownColumns.includes(key)))
    : patch

  return {
    sprint: SPRINT,
    status: blockers.length > 0 ? 'BLOCKED_BY_CREATE_CONFIG' : 'READY_TO_CREATE_COMBINATION_DRY_RUN',
    dryRun,
    selected: {
      companionId: config.companionId,
      companionLabel: companionLabel(companion.row),
      combinationId: null,
      combinationLabel: config.desiredValues.combinationLabel
    },
    desiredValues: config.desiredValues,
    blockers,
    warnings,
    companion: {
      ok: companion.ok,
      found: companion.found,
      error: companion.error
    },
    schema: {
      mediaCombinationsLookupOk: tableColumns.ok,
      detectedColumnsCount: tableColumns.columns.length,
      detectedColumns: tableColumns.columns,
      detectedMediaTypes: tableColumns.mediaTypeValues || [],
      lookupError: tableColumns.error
    },
    plannedOperations: [
      {
        target: 'media_combinations',
        action: 'insert',
        found: false,
        supportedColumns: tableColumns.columns,
        patchPreview: redactPatchForLog(supportedPreview),
        willApply: false
      }
    ],
    nextEnvAfterCreate: {
      REAL_PRODUCTION_COMPANION_ID: config.companionId,
      REAL_PRODUCTION_COMBINATION_ID: '<preenchido após criação>',
      REAL_PRODUCTION_PRICE_CREDITS: config.desiredValues.priceCredits,
      REAL_PRODUCTION_OPERATIONAL_COST_CREDITS: config.desiredValues.operationalCostCredits,
      REAL_PRODUCTION_PAYOUT_PERCENT: config.desiredValues.payoutPercent
    },
    safety: baseSafety()
  }
}

export async function createRealProductionCombination(options = {}) {
  const config = getRealProductionCombinationCreateConfig()
  const forceApply = options.apply === true
  const dryRun = options.dryRun !== false && !forceApply
  const plan = await planRealProductionCombinationCreate({ dryRun: true })
  const blockers = [...plan.blockers]
  const warnings = [...plan.warnings]

  if (dryRun) {
    return {
      ...plan,
      status: blockers.length > 0 ? 'BLOCKED_BY_CREATE_CONFIG' : 'READY_TO_CREATE_COMBINATION_DRY_RUN',
      dryRun: true,
      safety: baseSafety()
    }
  }

  if (!config.shouldApply) blockers.push('mutation_env_not_allowed')
  if (config.confirmationInput !== REQUIRED_CREATE_PHRASE) blockers.push('confirmation_phrase_missing_or_invalid')

  if (blockers.length > 0) {
    return {
      ...plan,
      status: 'BLOCKED_BY_CONFIRMATION',
      dryRun: false,
      blockers,
      warnings,
      created: null,
      safety: baseSafety()
    }
  }

  const companion = await fetchCompanion(config.companionId)
  if (!companion.ok || !companion.found) {
    return {
      ...plan,
      status: 'BLOCKED_BY_COMPANION_LOOKUP',
      dryRun: false,
      blockers: ['companion_not_found_or_lookup_failed'],
      warnings,
      created: null,
      safety: baseSafety()
    }
  }

  const rawPatch = buildCombinationPatch(config, companion.row)
  const tableColumns = await tryReadTableColumns('media_combinations')
  const { filteredPatch, removedBySchema } = filterPatchByKnownColumns(rawPatch, tableColumns.columns)
  const insertResult = await adaptiveInsertMediaCombination(filteredPatch, { existingMediaTypes: tableColumns.mediaTypeValues || [] })

  if (!insertResult.ok) {
    return {
      ...plan,
      status: 'CREATE_FAILED_REVIEW_SCHEMA',
      dryRun: false,
      blockers: ['media_combination_insert_failed'],
      warnings: [...warnings, 'review_media_combinations_schema_and_patch_columns'],
      created: {
        ok: false,
        error: insertResult.error,
        removedColumns: [...removedBySchema, ...insertResult.removedColumns],
        finalPatchKeys: insertResult.finalPatchKeys,
        finalMediaType: insertResult.finalMediaType,
        mediaTypeAttempts: insertResult.mediaTypeAttempts,
        detectedColumns: tableColumns.columns,
        detectedMediaTypes: tableColumns.mediaTypeValues || []
      },
      safety: baseSafety()
    }
  }

  const createdId = insertResult.row?.id || null
  const postInspection = await safePostInspection(config.companionId, createdId)

  return {
    sprint: SPRINT,
    status: 'COMBINATION_CREATED_CONTROLLED',
    dryRun: false,
    selected: {
      companionId: config.companionId,
      companionLabel: companionLabel(companion.row),
      combinationId: createdId,
      combinationLabel: config.desiredValues.combinationLabel
    },
    desiredValues: config.desiredValues,
    blockers: [],
    warnings,
    created: {
      ok: true,
      combinationId: createdId,
      removedColumns: [...removedBySchema, ...insertResult.removedColumns],
      attempts: insertResult.attempts,
      finalPatchKeys: insertResult.finalPatchKeys,
      finalMediaType: insertResult.finalMediaType,
      mediaTypeAttempts: insertResult.mediaTypeAttempts,
      detectedColumns: tableColumns.columns,
      detectedMediaTypes: tableColumns.mediaTypeValues || []
    },
    postInspection,
    nextEnv: {
      REAL_PRODUCTION_COMPANION_ID: config.companionId,
      REAL_PRODUCTION_COMBINATION_ID: createdId,
      REAL_PRODUCTION_QUANTITY: 1,
      REAL_PRODUCTION_PRICE_CREDITS: config.desiredValues.priceCredits,
      REAL_PRODUCTION_OPERATIONAL_COST_CREDITS: config.desiredValues.operationalCostCredits,
      REAL_PRODUCTION_PAYOUT_PERCENT: config.desiredValues.payoutPercent
    },
    nextCommands: [
      'npm run config:actors:real-production-candidate',
      'npm run prep:actors:real-production-candidate',
      'npm run test:actors:real-production-readiness',
      'npm run test:actors:real-production-audit'
    ],
    safety: baseSafety({ databaseMutationExecutedByThisService: true })
  }
}

export async function testRealProductionCombinationCreateSafety() {
  const originalEnv = {
    REAL_PRODUCTION_COMPANION_ID: process.env.REAL_PRODUCTION_COMPANION_ID,
    REAL_PRODUCTION_COMBINATION_ID: process.env.REAL_PRODUCTION_COMBINATION_ID,
    REAL_PRODUCTION_QUANTITY: process.env.REAL_PRODUCTION_QUANTITY,
    RUN_6_3E_REAL_COMBINATION_CREATE: process.env.RUN_6_3E_REAL_COMBINATION_CREATE,
    ALLOW_REAL_COMBINATION_DATA_MUTATION: process.env.ALLOW_REAL_COMBINATION_DATA_MUTATION,
    REAL_COMBINATION_CREATE_CONFIRMATION_INPUT: process.env.REAL_COMBINATION_CREATE_CONFIRMATION_INPUT
  }

  try {
    delete process.env.REAL_PRODUCTION_COMPANION_ID
    delete process.env.REAL_PRODUCTION_COMBINATION_ID
    delete process.env.RUN_6_3E_REAL_COMBINATION_CREATE
    delete process.env.ALLOW_REAL_COMBINATION_DATA_MUTATION
    delete process.env.REAL_COMBINATION_CREATE_CONFIRMATION_INPUT
    process.env.REAL_PRODUCTION_QUANTITY = '1'

    const dryRunWithoutIds = await createRealProductionCombination({ dryRun: true })
    const blockedApply = await createRealProductionCombination({ dryRun: false, apply: true })

    process.env.REAL_PRODUCTION_QUANTITY = '2'
    const blockedQuantity = await createRealProductionCombination({ dryRun: true })

    return {
      sprint: SPRINT,
      dryRunWithoutIds,
      blockedApply,
      blockedQuantity,
      safety: baseSafety()
    }
  } finally {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}
