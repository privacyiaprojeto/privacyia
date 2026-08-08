import { supabaseAdmin } from '../config/supabase.js'

const SPRINT = '6.3C'
const DEFAULT_CONFIRMATION_PHRASE = 'CONFIRMAR PRODUCAO REAL DE 1 ITEM'
const MAX_SAFE_QUANTITY = 1

const SAFETY_BASELINE = Object.freeze({
  runPodCalledByThisService: false,
  r2RealUploadByThisService: false,
  destructiveDelete: false,
  paymentExecutedByThisService: false,
  walletChangedByThisService: false,
  publicClientUrlCreatedByThisService: false,
  realQueueJobCreated: false,
  databaseMutationExecutedByThisService: false,
  runPodMayBeCalledByWorkerAfterQueue: false
})

const TRUTHY_VALUES = new Set(['true', 'yes', 'sim', '1', 'approved', 'aprovado', 'compliant', 'verified', 'active', 'available', 'ready', 'ok'])
const BAD_TEST_WORDS = ['fake', 'teste', 'test', 'demo', 'mock', 'exemplo', 'sample', 'sandbox']
const ARCHIVED_STATUS = new Set(['archived', 'arquivado', 'deleted', 'deletado', 'hidden', 'oculto', 'inactive', 'inativo', 'rejected', 'rejeitado'])

function envBool(name) {
  return String(process.env[name] || '').trim().toLowerCase() === 'true'
}

function cleanUuid(value) {
  const text = String(value || '').trim()
  if (!text) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function valueIsTruthy(value) {
  if (value === true) return true
  if (value === false || value === null || value === undefined) return false
  return TRUTHY_VALUES.has(String(value).trim().toLowerCase())
}

function pickFirstValue(row, keys) {
  if (!row || typeof row !== 'object') return null
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key) && row[key] !== null && row[key] !== undefined && row[key] !== '') {
      return row[key]
    }
  }
  return null
}

function compactRowEvidence(row, keys) {
  const evidence = {}
  if (!row || typeof row !== 'object') return evidence
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) evidence[key] = row[key]
  }
  return evidence
}

function normalizeLabel(row) {
  const value = pickFirstValue(row, ['name', 'nome', 'display_name', 'title', 'label', 'slug', 'nickname', 'apelido', 'id'])
  return value ? String(value) : null
}

function nestedObject(row, key) {
  const value = row && typeof row === 'object' ? row[key] : null
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function pickNumberFromNested(row, objectKey, keys) {
  const source = nestedObject(row, objectKey)
  if (!source) return null
  return asNumber(pickFirstValue(source, keys))
}

function isControlledRealCombination(row) {
  if (!row || typeof row !== 'object') return false

  const mediaOrigin = String(pickFirstValue(row, ['media_origin', 'source', 'job_origin']) || '').toLowerCase()
  const metadata = nestedObject(row, 'metadata') || {}
  const financeSnapshot = nestedObject(row, 'finance_snapshot') || {}
  const displayPayload = nestedObject(row, 'display_payload') || {}
  const promptPayload = nestedObject(row, 'prompt_payload') || {}

  const controlledSignals = [
    mediaOrigin,
    String(metadata.media_origin || metadata.source || metadata.createdBySprint || metadata.sprint || '').toLowerCase(),
    String(financeSnapshot.sprint || '').toLowerCase(),
    String(displayPayload.sprint || '').toLowerCase(),
    String(promptPayload.sprint || '').toLowerCase()
  ].join(' ')

  return controlledSignals.includes('real_production_controlled') || controlledSignals.includes('6.3e')
}

function hasBadTestWord(row) {
  if (isControlledRealCombination(row)) return false

  const haystack = [
    normalizeLabel(row),
    row?.slug,
    row?.description,
    row?.descricao,
    row?.metadata ? JSON.stringify(row.metadata) : null,
    row?.notes,
    row?.observacoes
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return BAD_TEST_WORDS.some((word) => haystack.includes(word))
}

function isArchivedOrHidden(row) {
  if (!row || typeof row !== 'object') return false

  const controlledRealCombination = isControlledRealCombination(row)
  const statusValue = pickFirstValue(row, ['status', 'publication_status', 'publicationStatus', 'visibility_status', 'visibilityStatus'])
  if (statusValue && ARCHIVED_STATUS.has(String(statusValue).trim().toLowerCase())) return true

  if (row.archived_at || row.deleted_at || row.cleanup_after) return true

  // Antes da primeira geração real, a combinação controlada precisa ficar oculta do cliente.
  // Portanto visible_to_client=false/admin_only=true não é arquivamento nesta fase.
  if (!controlledRealCombination && (row.visible === false || row.visible_to_client === false || row.is_visible === false)) return true
  if (!controlledRealCombination && (row.adminOnly === true || row.admin_only === true)) return true

  return false
}

function buildCheck(key, passed, label, message, evidence = {}, severity = 'blocker') {
  return {
    key,
    passed: Boolean(passed),
    severity: passed ? 'ok' : severity,
    label,
    message,
    evidence
  }
}

function addCheck(collection, blockers, warnings, check) {
  collection.push(check)
  if (!check.passed && check.severity === 'blocker') blockers.push(check.key)
  if (!check.passed && check.severity === 'warning') warnings.push(check.key)
}

async function safeSelect(table, select = '*', options = {}) {
  const { limit = 20, eq = null, orderBy = null } = options

  try {
    let query = supabaseAdmin.from(table).select(select).limit(limit)

    if (eq && eq.column && eq.value !== undefined && eq.value !== null) {
      query = query.eq(eq.column, eq.value)
    }

    if (orderBy) {
      query = query.order(orderBy.column, { ascending: Boolean(orderBy.ascending) })
    }

    const { data, error } = await query
    if (error) return { ok: false, table, rows: [], error: error.message }
    return { ok: true, table, rows: Array.isArray(data) ? data : [], error: null }
  } catch (error) {
    return { ok: false, table, rows: [], error: error?.message || String(error) }
  }
}

async function safeSelectById(table, id) {
  if (!id) return { ok: true, table, row: null, error: null }

  try {
    const { data, error } = await supabaseAdmin.from(table).select('*').eq('id', id).maybeSingle()
    if (error) return { ok: false, table, row: null, error: error.message }
    return { ok: true, table, row: data || null, error: null }
  } catch (error) {
    return { ok: false, table, row: null, error: error?.message || String(error) }
  }
}

async function findCompanion(companionId = null) {
  const table = 'companions'

  if (companionId) {
    const byId = await safeSelectById(table, companionId)
    return {
      table,
      requestedId: companionId,
      selected: byId.row,
      source: byId.row ? 'env_id' : 'env_id_not_found',
      error: byId.error,
      lookup: byId
    }
  }

  const list = await safeSelect(table, '*', { limit: 50, orderBy: { column: 'created_at', ascending: false } })
  const rows = list.rows || []
  const selected = rows.find((row) => !isArchivedOrHidden(row) && !hasBadTestWord(row)) || rows[0] || null

  return {
    table,
    requestedId: null,
    selected,
    source: selected ? 'auto_candidate' : 'not_found',
    error: list.error,
    lookup: list
  }
}

async function findCombination(combinationId = null) {
  const table = 'media_combinations'

  if (combinationId) {
    const byId = await safeSelectById(table, combinationId)
    return {
      table,
      requestedId: combinationId,
      selected: byId.row,
      source: byId.row ? 'env_id' : 'env_id_not_found',
      error: byId.error,
      lookup: byId
    }
  }

  const list = await safeSelect(table, '*', { limit: 50, orderBy: { column: 'created_at', ascending: false } })
  const rows = list.rows || []
  const selected = rows.find((row) => !isArchivedOrHidden(row) && !hasBadTestWord(row)) || rows[0] || null

  return {
    table,
    requestedId: null,
    selected,
    source: selected ? 'auto_candidate' : 'not_found',
    error: list.error,
    lookup: list
  }
}


function readAvatarComplianceSignalFromObject(source) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { passed: false, source: null, evidence: null }
  }

  const status = pickFirstValue(source, [
    'status',
    'compliance_status',
    'complianceStatus',
    'kyc_status',
    'kycStatus',
    'verification_status',
    'verificationStatus',
    'approval_status',
    'approvalStatus'
  ])

  const booleanSignal = pickFirstValue(source, [
    'approved',
    'approved_for_production',
    'approvedForProduction',
    'compliant',
    'is_compliant',
    'isCompliant',
    'kyc_approved',
    'kycApproved',
    'production_ready',
    'productionReady',
    'real_production_compliant',
    'realProductionCompliant'
  ])

  const sprint = pickFirstValue(source, ['sprint', 'configuredBySprint', 'approvedBySprint'])
  const approvedAt = pickFirstValue(source, ['approved_at', 'approvedAt', 'configuredAt', 'validatedAt'])
  const companionId = pickFirstValue(source, ['companion_id', 'companionId', 'avatar_id', 'avatarId'])

  const passed = valueIsTruthy(status) || valueIsTruthy(booleanSignal)

  return {
    passed,
    source: passed ? 'nested_avatar_compliance_signal' : null,
    evidence: {
      status: status ?? null,
      booleanSignal: booleanSignal ?? null,
      sprint: sprint ?? null,
      approvedAt: approvedAt ?? null,
      companionId: companionId ?? null
    }
  }
}

function extractAvatarComplianceFromCombination(combination, companionId = null) {
  if (!combination || typeof combination !== 'object') {
    return { passed: false, source: null, evidence: null }
  }

  if (combination.avatar_production_authorization_id) {
    return {
      passed: true,
      source: 'media_combinations.avatar_production_authorization_id',
      evidence: {
        avatarProductionAuthorizationId: combination.avatar_production_authorization_id,
        companionId: combination.companion_id ?? null
      }
    }
  }

  const candidates = []
  const metadata = nestedObject(combination, 'metadata')
  const displayPayload = nestedObject(combination, 'display_payload')
  const promptPayload = nestedObject(combination, 'prompt_payload')
  const financeSnapshot = nestedObject(combination, 'finance_snapshot')

  for (const [rootKey, root] of [
    ['metadata', metadata],
    ['display_payload', displayPayload],
    ['prompt_payload', promptPayload],
    ['finance_snapshot', financeSnapshot]
  ]) {
    if (!root) continue

    candidates.push([`${rootKey}`, root])

    for (const nestedKey of [
      'avatarCompliance',
      'avatar_compliance',
      'realProductionAvatarCompliance',
      'real_production_avatar_compliance',
      'avatarProductionCompliance',
      'avatar_production_compliance',
      'avatarProductionAuthorization',
      'avatar_production_authorization',
      'compliance',
      'kyc'
    ]) {
      const nested = root[nestedKey]
      if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
        candidates.push([`${rootKey}.${nestedKey}`, nested])
      }
    }
  }

  for (const [source, value] of candidates) {
    const signal = readAvatarComplianceSignalFromObject(value)
    if (!signal.passed) continue

    const signalCompanionId = signal.evidence?.companionId
    if (signalCompanionId && companionId && signalCompanionId !== companionId) continue

    return {
      passed: true,
      source,
      evidence: signal.evidence
    }
  }

  return { passed: false, source: null, evidence: null }
}

function evaluateCompanion(row, combination = null) {
  if (!row) {
    return {
      passed: false,
      reasons: ['companion_not_found'],
      label: null,
      evidence: {}
    }
  }

  const label = normalizeLabel(row)
  const evidence = compactRowEvidence(row, [
    'id',
    'name',
    'nome',
    'display_name',
    'slug',
    'status',
    'kyc_status',
    'kycStatus',
    'compliance_status',
    'complianceStatus',
    'is_compliant',
    'isCompliant',
    'approved_for_production',
    'approvedForProduction',
    'production_ready',
    'productionReady',
    'factory_ready',
    'factoryReady',
    'visible',
    'visible_to_client',
    'adminOnly',
    'archived_at',
    'deleted_at'
  ])

  const explicitSignals = [
    row.is_compliant,
    row.isCompliant,
    row.kyc_approved,
    row.kycApproved,
    row.approved_for_production,
    row.approvedForProduction,
    row.production_ready,
    row.productionReady,
    row.factory_ready,
    row.factoryReady,
    row.compliance_status,
    row.complianceStatus,
    row.kyc_status,
    row.kycStatus,
    row.status
  ]

  const combinationCompliance = extractAvatarComplianceFromCombination(combination, row?.id || null)
  const hasExplicitApproval = explicitSignals.some(valueIsTruthy) || combinationCompliance.passed
  const archived = isArchivedOrHidden(row)
  const looksLikeTest = hasBadTestWord(row)

  const reasons = []
  if (!hasExplicitApproval) reasons.push('missing_explicit_compliance_signal')
  if (archived) reasons.push('companion_hidden_archived_or_inactive')
  if (looksLikeTest) reasons.push('companion_looks_like_test_or_demo')

  return {
    passed: hasExplicitApproval && !archived && !looksLikeTest,
    reasons,
    label,
    evidence: {
      ...evidence,
      avatarComplianceFromCombination: combinationCompliance.passed ? combinationCompliance : null
    }
  }
}

function evaluateCombination(row) {
  if (!row) {
    return {
      passed: false,
      reasons: ['combination_not_found'],
      label: null,
      evidence: {},
      priceCredits: null,
      inlineOperationalCostCredits: null,
      inlinePayoutPercent: null,
      controlledRealCombination: false
    }
  }

  const controlledRealCombination = isControlledRealCombination(row)
  const label = normalizeLabel(row)
  const evidence = compactRowEvidence(row, [
    'id',
    'name',
    'nome',
    'label',
    'slug',
    'status',
    'media_type',
    'mediaType',
    'type',
    'price_credits',
    'priceCredits',
    'credits',
    'valor_creditos',
    'sale_price_credits',
    'operational_cost_credits',
    'estimated_operational_cost_credits',
    'cost_credits',
    'visible_to_client',
    'admin_only',
    'adminOnly',
    'media_origin',
    'finance_snapshot',
    'archived_at',
    'deleted_at'
  ])

  const priceCredits = asNumber(
    pickFirstValue(row, ['price_credits', 'priceCredits', 'credits', 'valor_creditos', 'sale_price_credits', 'salePriceCredits'])
  ) || pickNumberFromNested(row, 'finance_snapshot', ['price_credits', 'priceCredits', 'credits'])

  const inlineOperationalCostCredits = asNumber(
    pickFirstValue(row, [
      'operational_cost_credits',
      'operationalCostCredits',
      'estimated_operational_cost_credits',
      'estimatedOperationalCostCredits',
      'cost_credits',
      'costCredits'
    ])
  ) || pickNumberFromNested(row, 'finance_snapshot', [
    'operational_cost_credits',
    'operationalCostCredits',
    'estimated_operational_cost_credits',
    'cost_credits',
    'costCredits'
  ])

  const inlinePayoutPercent = asNumber(
    pickFirstValue(row, [
      'payout_percent',
      'payoutPercent',
      'payout_percentage',
      'actor_payout_percent',
      'revenue_share_percent',
      'repasse_percent'
    ])
  ) || pickNumberFromNested(row, 'finance_snapshot', [
    'payout_percent',
    'payoutPercent',
    'payout_percentage',
    'actor_payout_percent',
    'revenue_share_percent',
    'repasse_percent'
  ])

  const archived = isArchivedOrHidden(row)
  const looksLikeTest = hasBadTestWord(row) && !controlledRealCombination
  const mediaType = String(pickFirstValue(row, ['media_type', 'mediaType', 'type', 'kind']) || '').toLowerCase()
  const isImageCompatible = !mediaType || mediaType.includes('image') || mediaType.includes('imagem') || mediaType === 'photo' || mediaType === 'foto'

  const reasons = []
  if (archived) reasons.push('combination_hidden_archived_or_inactive')
  if (looksLikeTest) reasons.push('combination_looks_like_test_or_demo')
  if (!isImageCompatible) reasons.push('combination_not_image_type')

  return {
    passed: !archived && !looksLikeTest && isImageCompatible,
    reasons,
    label,
    evidence: {
      ...evidence,
      controlledRealCombination,
      financeSnapshotRecognized: Boolean(row.finance_snapshot)
    },
    priceCredits,
    inlineOperationalCostCredits,
    inlinePayoutPercent,
    controlledRealCombination
  }
}

async function findOperationalCost({ companionId, combinationId, inlineOperationalCostCredits }) {
  if (inlineOperationalCostCredits !== null && inlineOperationalCostCredits > 0) {
    return {
      configured: true,
      value: inlineOperationalCostCredits,
      source: 'media_combinations.inline_cost',
      row: null,
      attempts: []
    }
  }

  const tables = [
    'media_operational_cost_rules',
    'media_operational_costs',
    'operational_cost_rules',
    'operational_costs',
    'companion_operational_cost_rules'
  ]

  const attempts = []

  for (const table of tables) {
    const result = await safeSelect(table, '*', { limit: 50 })
    attempts.push({ table, ok: result.ok, totalReturned: result.rows.length, error: result.error })

    if (!result.ok) continue

    const row = result.rows.find((candidate) => {
      const byCombination = combinationId && [candidate.combination_id, candidate.media_combination_id, candidate.mediaCombinationId].includes(combinationId)
      const byCompanion = companionId && [candidate.companion_id, candidate.avatar_id, candidate.actor_companion_id].includes(companionId)
      return byCombination || byCompanion
    })

    if (!row) continue

    const costValue = asNumber(
      pickFirstValue(row, [
        'cost_credits',
        'costCredits',
        'operational_cost_credits',
        'operationalCostCredits',
        'estimated_cost_credits',
        'estimatedCostCredits',
        'credits',
        'value_credits',
        'valueCredits'
      ])
    )

    if (costValue !== null && costValue > 0) {
      return {
        configured: true,
        value: costValue,
        source: table,
        row: compactRowEvidence(row, ['id', 'companion_id', 'combination_id', 'media_combination_id', 'cost_credits', 'operational_cost_credits', 'credits', 'active', 'status']),
        attempts
      }
    }
  }

  return {
    configured: false,
    value: null,
    source: null,
    row: null,
    attempts
  }
}

async function findPayoutRule({ companionId, companionRow, combinationRow, inlinePayoutPercent }) {
  if (inlinePayoutPercent !== null && inlinePayoutPercent > 0) {
    return {
      configured: true,
      source: 'media_combinations.finance_snapshot_or_inline_payout',
      payoutPercent: inlinePayoutPercent,
      fixedCredits: null,
      row: compactRowEvidence(combinationRow, ['id', 'media_origin', 'finance_snapshot', 'payout_percent', 'revenue_share_percent']),
      attempts: []
    }
  }

  const actorId = pickFirstValue(companionRow, ['actor_id', 'atriz_id', 'actress_id', 'creator_id', 'owner_actor_id'])

  const tables = [
    'actor_payout_rules',
    'companion_payout_rules',
    'media_payout_rules',
    'payout_rules',
    'creator_payout_rules'
  ]

  const attempts = []

  for (const table of tables) {
    const result = await safeSelect(table, '*', { limit: 100 })
    attempts.push({ table, ok: result.ok, totalReturned: result.rows.length, error: result.error })

    if (!result.ok) continue

    const row = result.rows.find((candidate) => {
      const byCompanion = companionId && [candidate.companion_id, candidate.avatar_id, candidate.actor_companion_id].includes(companionId)
      const byActor = actorId && [candidate.actor_id, candidate.atriz_id, candidate.actress_id, candidate.creator_id].includes(actorId)
      return byCompanion || byActor
    })

    if (!row) continue

    const pct = asNumber(
      pickFirstValue(row, [
        'payout_percent',
        'payoutPercent',
        'percentage',
        'percent',
        'repasse_percent',
        'repassePercent',
        'share_percent',
        'sharePercent'
      ])
    )

    const fixedCredits = asNumber(
      pickFirstValue(row, ['payout_credits', 'payoutCredits', 'fixed_credits', 'fixedCredits', 'credits'])
    )

    if ((pct !== null && pct > 0) || (fixedCredits !== null && fixedCredits > 0)) {
      return {
        configured: true,
        source: table,
        payoutPercent: pct,
        fixedCredits,
        row: compactRowEvidence(row, ['id', 'actor_id', 'atriz_id', 'companion_id', 'avatar_id', 'payout_percent', 'percentage', 'repasse_percent', 'fixed_credits', 'credits', 'active', 'status']),
        attempts
      }
    }
  }

  return {
    configured: false,
    source: null,
    payoutPercent: null,
    fixedCredits: null,
    row: null,
    attempts
  }
}

async function runReadinessSafely(args) {
  try {
    const module = await import('./real-production-readiness.service.js')
    const fn =
      module.evaluateRealProductionReadiness ||
      module.getRealProductionReadiness ||
      module.buildRealProductionReadinessChecklist ||
      module.checkRealProductionReadiness ||
      module.default

    if (typeof fn !== 'function') {
      return { ok: false, status: 'READINESS_FUNCTION_NOT_FOUND', error: null, data: null }
    }

    const data = await fn(args)
    return { ok: true, status: data?.status || null, error: null, data }
  } catch (error) {
    return { ok: false, status: 'READINESS_IMPORT_OR_EXECUTION_FAILED', error: error?.message || String(error), data: null }
  }
}

export function getRealProductionPrepConfig() {
  return {
    sprint: SPRINT,
    requiredConfirmationPhrase: process.env.REAL_PRODUCTION_CONFIRMATION_PHRASE || DEFAULT_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3A_REAL_E2E: envBool('RUN_6_3A_REAL_E2E'),
      RUN_6_3C_REAL_PREP: envBool('RUN_6_3C_REAL_PREP'),
      ALLOW_REAL_SINGLE_ITEM_PRODUCTION: envBool('ALLOW_REAL_SINGLE_ITEM_PRODUCTION'),
      ENABLE_REAL_IMAGE_WORKER: envBool('ENABLE_REAL_IMAGE_WORKER'),
      REAL_PRODUCTION_COMPANION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMPANION_ID),
      REAL_PRODUCTION_COMBINATION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMBINATION_ID)
    },
    safety: { ...SAFETY_BASELINE }
  }
}

export async function inspectRealProductionCandidate(input = {}) {
  const companionId = cleanUuid(input.companionId || process.env.REAL_PRODUCTION_COMPANION_ID)
  const combinationId = cleanUuid(input.combinationId || process.env.REAL_PRODUCTION_COMBINATION_ID)
  const quantity = Number(input.quantity || 1)
  const confirmationPhrase = String(input.confirmationPhrase || '').trim()
  const requiredConfirmationPhrase = process.env.REAL_PRODUCTION_CONFIRMATION_PHRASE || DEFAULT_CONFIRMATION_PHRASE

  const checks = []
  const blockers = []
  const warnings = []

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'quantity_limited_to_one',
      quantity === MAX_SAFE_QUANTITY,
      'Quantidade limitada a 1 item',
      quantity === MAX_SAFE_QUANTITY
        ? 'Quantidade segura para primeira execução real controlada.'
        : 'A preparação real controlada aceita somente 1 item por execução.',
      { quantity, maxSafeQuantity: MAX_SAFE_QUANTITY }
    )
  )

  const companionLookup = await findCompanion(companionId)
  const combinationLookup = await findCombination(combinationId)
  const companion = companionLookup.selected
  const combination = combinationLookup.selected
  const companionEvaluation = evaluateCompanion(companion, combination)
  const combinationEvaluation = evaluateCombination(combination)

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'avatar_selected',
      Boolean(companion),
      'Avatar selecionado',
      companion ? 'Existe um avatar alvo para preparação.' : 'Nenhum avatar foi encontrado para preparação.',
      {
        requestedId: companionId,
        selectedId: companion?.id || null,
        source: companionLookup.source,
        error: companionLookup.error || null
      }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'combination_selected',
      Boolean(combination),
      'Combinação selecionada',
      combination ? 'Existe uma combinação de mídia alvo para preparação.' : 'Nenhuma combinação foi encontrada para preparação.',
      {
        requestedId: combinationId,
        selectedId: combination?.id || null,
        source: combinationLookup.source,
        error: combinationLookup.error || null
      }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'avatar_compliant',
      companionEvaluation.passed,
      'Avatar conforme para produção real',
      companionEvaluation.passed
        ? 'O avatar possui sinal explícito de aprovação/conformidade e não parece demo/teste/arquivado.'
        : 'O avatar ainda não possui sinal explícito de conformidade ou parece demo/teste/arquivado.',
      {
        reasons: companionEvaluation.reasons,
        label: companionEvaluation.label,
        evidence: companionEvaluation.evidence
      }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'combination_real_candidate',
      combinationEvaluation.passed,
      'Combinação real candidata',
      combinationEvaluation.passed
        ? 'A combinação não parece demo/teste/arquivada e é compatível com imagem.'
        : 'A combinação parece inválida, demo/teste/arquivada ou não compatível com imagem.',
      {
        reasons: combinationEvaluation.reasons,
        label: combinationEvaluation.label,
        evidence: combinationEvaluation.evidence
      }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'price_configured',
      combinationEvaluation.priceCredits !== null && combinationEvaluation.priceCredits > 0,
      'Preço configurado',
      combinationEvaluation.priceCredits !== null && combinationEvaluation.priceCredits > 0
        ? 'A combinação possui preço em créditos maior que zero.'
        : 'A combinação ainda não possui preço em créditos maior que zero.',
      { priceCredits: combinationEvaluation.priceCredits }
    )
  )

  const operationalCost = await findOperationalCost({
    companionId: companion?.id || companionId,
    combinationId: combination?.id || combinationId,
    inlineOperationalCostCredits: combinationEvaluation.inlineOperationalCostCredits
  })

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'operational_cost_configured',
      operationalCost.configured,
      'Custo operacional configurado',
      operationalCost.configured
        ? 'Existe custo operacional estimado para o item/combinação/avatar.'
        : 'Não foi encontrado custo operacional estimado para esse item.',
      {
        value: operationalCost.value,
        source: operationalCost.source,
        row: operationalCost.row,
        attempts: operationalCost.attempts
      }
    )
  )

  const payoutRule = await findPayoutRule({
    companionId: companion?.id || companionId,
    companionRow: companion,
    combinationRow: combination,
    inlinePayoutPercent: combinationEvaluation.inlinePayoutPercent
  })

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'payout_rule_configured',
      payoutRule.configured,
      'Regra de repasse configurada',
      payoutRule.configured
        ? 'Existe regra de repasse vinculada ao avatar/ator.'
        : 'Não foi encontrada regra de repasse vinculada ao avatar/ator.',
      {
        source: payoutRule.source,
        payoutPercent: payoutRule.payoutPercent,
        fixedCredits: payoutRule.fixedCredits,
        row: payoutRule.row,
        attempts: payoutRule.attempts
      }
    )
  )

  const realWorkerEnabled = envBool('ENABLE_REAL_IMAGE_WORKER')
  const realProductionEnvAllowed = envBool('ALLOW_REAL_SINGLE_ITEM_PRODUCTION') && envBool('RUN_6_3A_REAL_E2E')
  const confirmationOk = confirmationPhrase === requiredConfirmationPhrase

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'real_worker_enabled',
      realWorkerEnabled,
      'Worker real habilitado explicitamente',
      realWorkerEnabled
        ? 'ENABLE_REAL_IMAGE_WORKER=true está ativo.'
        : 'ENABLE_REAL_IMAGE_WORKER ainda não está ativo. Isso deve permanecer falso até o momento da execução real.',
      { ENABLE_REAL_IMAGE_WORKER: realWorkerEnabled }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'real_production_env_allowed',
      realProductionEnvAllowed,
      'Produção real liberada explicitamente no ambiente',
      realProductionEnvAllowed
        ? 'RUN_6_3A_REAL_E2E=true e ALLOW_REAL_SINGLE_ITEM_PRODUCTION=true estão ativos.'
        : 'Ambiente real ainda não está liberado. Isso é esperado antes da execução real.',
      {
        RUN_6_3A_REAL_E2E: envBool('RUN_6_3A_REAL_E2E'),
        ALLOW_REAL_SINGLE_ITEM_PRODUCTION: envBool('ALLOW_REAL_SINGLE_ITEM_PRODUCTION')
      }
    )
  )

  addCheck(
    checks,
    blockers,
    warnings,
    buildCheck(
      'confirmation_phrase_valid',
      confirmationOk,
      'Frase obrigatória confirmada',
      confirmationOk
        ? 'A frase de confirmação confere exatamente com a frase obrigatória.'
        : 'A frase obrigatória ainda não foi fornecida ou não confere.',
      { requiredConfirmationPhrase, provided: confirmationPhrase ? 'provided' : 'missing' }
    )
  )

  const readiness = await runReadinessSafely({
    companionId: companion?.id || companionId,
    combinationId: combination?.id || combinationId,
    quantity,
    confirmationPhrase
  })

  if (!readiness.ok) {
    addCheck(
      checks,
      blockers,
      warnings,
      buildCheck(
        'readiness_service_available',
        false,
        'Readiness 6.2E disponível',
        'Não foi possível executar o serviço de readiness 6.2E. A preparação continua, mas a execução real deve permanecer bloqueada até validar isso.',
        { status: readiness.status, error: readiness.error },
        'warning'
      )
    )
  }

  const hasCriticalCandidate = Boolean(companion && combination)
  const canProceedToRealExecution = blockers.length === 0 && hasCriticalCandidate
  const status = canProceedToRealExecution ? 'READY_FOR_SINGLE_REAL_EXECUTION' : hasCriticalCandidate ? 'BLOCKED_BY_PREP' : 'NO_CANDIDATE'

  const actionPlan = buildActionPlan({
    blockers,
    requiredConfirmationPhrase,
    selected: {
      companionId: companion?.id || null,
      combinationId: combination?.id || null
    }
  })

  return {
    sprint: SPRINT,
    status,
    canProceedToRealExecution,
    canRunRealCommand: canProceedToRealExecution,
    selected: {
      companionId: companion?.id || null,
      companionLabel: companionEvaluation.label,
      combinationId: combination?.id || null,
      combinationLabel: combinationEvaluation.label
    },
    checksSummary: {
      totalChecks: checks.length,
      passed: checks.filter((check) => check.passed).length,
      blockers: blockers.length,
      warnings: warnings.length
    },
    blockers,
    warnings,
    checks,
    readiness,
    actionPlan,
    nextCommandsWhenReady: canProceedToRealExecution
      ? [
          'npm run audit:actors:real-production-job',
          'npm run run:actors:real-production-single',
          'npm run audit:actors:real-production-job'
        ]
      : [],
    safety: { ...SAFETY_BASELINE }
  }
}

function buildActionPlan({ blockers, requiredConfirmationPhrase, selected }) {
  const plan = []

  if (blockers.includes('avatar_selected')) {
    plan.push('Definir REAL_PRODUCTION_COMPANION_ID com o UUID de um avatar real.')
  }

  if (blockers.includes('avatar_compliant')) {
    plan.push('Marcar/validar o avatar real como conforme/aprovado no cadastro administrativo. Evite avatar demo, teste, fake ou arquivado.')
  }

  if (blockers.includes('combination_selected')) {
    plan.push('Definir REAL_PRODUCTION_COMBINATION_ID com o UUID de uma combinação real de imagem.')
  }

  if (blockers.includes('combination_real_candidate')) {
    plan.push('Usar uma combinação real de imagem, controlada internamente e que não seja demo/teste/arquivada; antes da geração real ela deve permanecer oculta do cliente.')
  }

  if (blockers.includes('price_configured')) {
    plan.push('Configurar preço em créditos maior que zero para a combinação real antes de qualquer execução produtiva.')
  }

  if (blockers.includes('operational_cost_configured')) {
    plan.push('Configurar custo operacional estimado em créditos para permitir cálculo de margem antes da venda.')
  }

  if (blockers.includes('payout_rule_configured')) {
    plan.push('Configurar regra de repasse do ator/avatar antes de produzir item monetizável.')
  }

  if (blockers.includes('real_worker_enabled')) {
    plan.push('Somente no momento da execução real, definir ENABLE_REAL_IMAGE_WORKER=true.')
  }

  if (blockers.includes('real_production_env_allowed')) {
    plan.push('Somente no momento da execução real, definir RUN_6_3A_REAL_E2E=true e ALLOW_REAL_SINGLE_ITEM_PRODUCTION=true.')
  }

  if (blockers.includes('confirmation_phrase_valid')) {
    plan.push(`Somente no momento da execução real, informar a frase exata: ${requiredConfirmationPhrase}`)
  }

  if (blockers.includes('quantity_limited_to_one')) {
    plan.push('Reduzir a quantidade para exatamente 1 item.')
  }

  if (selected.companionId && selected.combinationId) {
    plan.push(`Candidato atual: companionId=${selected.companionId}, combinationId=${selected.combinationId}.`)
  }

  return plan
}
