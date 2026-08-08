import { supabaseAdmin } from '../config/supabase.js'
import { inspectRealProductionCandidate } from './real-production-prep.service.js'

export const REAL_PRODUCTION_CANDIDATE_CONFIG_SPRINT = '6.3D'
export const REQUIRED_CANDIDATE_CONFIG_CONFIRMATION_PHRASE = 'CONFIGURAR CANDIDATO REAL 6.3D'

const MAX_SAFE_QUANTITY = 1
const MUTATION_ENV = 'RUN_6_3D_REAL_CANDIDATE_CONFIG'
const MUTATION_ALLOW_ENV = 'ALLOW_REAL_CANDIDATE_DATA_MUTATION'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const SAFE_ACTIVE_STATUSES = new Set(['active', 'ativo', 'available', 'disponivel', 'published', 'publicado', 'approved', 'aprovado'])

const toBool = (value) => TRUTHY.has(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const cleanUuid = (value) => {
  const text = String(value ?? '').trim()
  if (!text) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null
}

const parsePositiveNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(String(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

const parsePercent = (value) => {
  const parsed = parsePositiveNumber(value)
  if (parsed === null) return null
  if (parsed > 100) return null
  return parsed
}

const nowIso = () => new Date().toISOString()

const buildSafety = ({ databaseMutationExecutedByThisService = false } = {}) => ({
  runPodCalledByThisService: false,
  r2RealUploadByThisService: false,
  destructiveDelete: false,
  paymentExecutedByThisService: false,
  walletChangedByThisService: false,
  publicClientUrlCreatedByThisService: false,
  realQueueJobCreated: false,
  databaseMutationExecutedByThisService,
  runPodMayBeCalledByWorkerAfterQueue: false
})

const pickFirstValue = (record, fields = []) => {
  if (!record) return null

  for (const field of fields) {
    if (hasValue(record[field])) return record[field]
  }

  return null
}

const normalizeLabel = (record = {}) => String(pickFirstValue(record, [
  'name',
  'nome',
  'display_name',
  'title',
  'label',
  'slug',
  'nickname',
  'apelido',
  'id'
]) ?? '')

const compactRow = (record = {}) => {
  if (!record) return null

  return {
    id: record.id ?? null,
    label: normalizeLabel(record) || null,
    status: pickFirstValue(record, ['status', 'publication_status', 'publicationStatus']) ?? null,
    visible: pickFirstValue(record, ['visible', 'is_visible', 'visible_to_client']) ?? null,
    active: pickFirstValue(record, ['active', 'is_active']) ?? null,
    priceCredits: pickFirstValue(record, ['price_credits', 'credits_price', 'sale_price_credits', 'credit_price']) ?? null,
    operationalCostCredits: pickFirstValue(record, [
      'operational_cost_credits',
      'estimated_operational_cost_credits',
      'cost_credits',
      'generation_cost_credits'
    ]) ?? null,
    payoutPercent: pickFirstValue(record, [
      'payout_percent',
      'actor_payout_percent',
      'payout_rate_percent',
      'revenue_share_percent'
    ]) ?? null,
    actorId: pickFirstValue(record, ['actor_id', 'ator_id', 'actress_id', 'atriz_id']) ?? null,
    updatedAt: pickFirstValue(record, ['updated_at', 'updatedAt']) ?? null
  }
}

const safeSelect = async ({ table, select = '*', filters = [], limit = 20, maybeSingle = false }) => {
  try {
    let query = supabaseAdmin.from(table).select(select)

    for (const filter of filters) {
      if (!filter || !filter.column || filter.value === undefined || filter.value === null) continue
      query = query.eq(filter.column, filter.value)
    }

    if (Number.isFinite(limit) && limit > 0) query = query.limit(limit)
    if (maybeSingle) query = query.maybeSingle()

    const { data, error } = await query

    if (error) {
      return {
        ok: false,
        table,
        data: maybeSingle ? null : [],
        error: error.message,
        code: error.code
      }
    }

    return {
      ok: true,
      table,
      data: data ?? (maybeSingle ? null : []),
      error: null,
      code: null
    }
  } catch (error) {
    return {
      ok: false,
      table,
      data: maybeSingle ? null : [],
      error: error?.message ?? 'Erro inesperado ao consultar tabela',
      code: error?.code ?? null
    }
  }
}

const safeUpdate = async ({ table, id, patch }) => {
  if (!id) {
    return {
      ok: false,
      table,
      id,
      data: null,
      error: 'id ausente',
      code: 'missing_id'
    }
  }

  if (!patch || Object.keys(patch).length === 0) {
    return {
      ok: true,
      table,
      id,
      data: null,
      error: null,
      code: 'nothing_to_update'
    }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) {
      return {
        ok: false,
        table,
        id,
        data: null,
        error: error.message,
        code: error.code
      }
    }

    return {
      ok: true,
      table,
      id,
      data,
      error: null,
      code: null
    }
  } catch (error) {
    return {
      ok: false,
      table,
      id,
      data: null,
      error: error?.message ?? 'Erro inesperado ao atualizar registro',
      code: error?.code ?? null
    }
  }
}

const setIfColumnExists = (patch, row, column, value) => {
  if (!row || !Object.prototype.hasOwnProperty.call(row, column)) return false
  patch[column] = value
  return true
}

const mergeMetadataIfExists = (patch, row, values) => {
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'metadata')) return false

  const base = row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata : {}
  patch.metadata = {
    ...base,
    realProductionCandidate: true,
    configuredBySprint: REAL_PRODUCTION_CANDIDATE_CONFIG_SPRINT,
    configuredAt: nowIso(),
    ...values
  }

  return true
}

const mergeFinanceSnapshotIfExists = (patch, row, values) => {
  if (!row || !Object.prototype.hasOwnProperty.call(row, 'finance_snapshot')) return false

  const base = row.finance_snapshot && typeof row.finance_snapshot === 'object' && !Array.isArray(row.finance_snapshot) ? row.finance_snapshot : {}
  patch.finance_snapshot = {
    ...base,
    price_credits: values.priceCredits ?? base.price_credits ?? null,
    operational_cost_credits: values.operationalCostCredits ?? base.operational_cost_credits ?? null,
    payout_percent: values.payoutPercent ?? base.payout_percent ?? null,
    configuredBySprint: REAL_PRODUCTION_CANDIDATE_CONFIG_SPRINT,
    configuredAt: nowIso()
  }

  return true
}

const buildCompanionPatch = ({ companion, payoutPercent }) => {
  const patch = {}

  for (const column of ['is_real_candidate', 'real_candidate', 'production_ready', 'is_production_ready']) {
    setIfColumnExists(patch, companion, column, true)
  }

  for (const column of ['is_compliant', 'compliant', 'kyc_approved', 'compliance_approved', 'approved_for_production']) {
    setIfColumnExists(patch, companion, column, true)
  }

  for (const column of ['is_demo', 'demo', 'is_test', 'test', 'mock', 'archived', 'admin_only', 'adminOnly']) {
    setIfColumnExists(patch, companion, column, false)
  }

  for (const column of ['visible', 'is_visible']) {
    setIfColumnExists(patch, companion, column, true)
  }

  for (const column of ['compliance_status', 'kyc_status', 'review_status', 'production_status']) {
    setIfColumnExists(patch, companion, column, 'approved')
  }

  if (Object.prototype.hasOwnProperty.call(companion || {}, 'status')) {
    const current = String(companion.status ?? '').trim().toLowerCase()
    patch.status = SAFE_ACTIVE_STATUSES.has(current) ? companion.status : 'active'
  }

  if (payoutPercent !== null) {
    for (const column of ['payout_percent', 'actor_payout_percent', 'payout_rate_percent', 'revenue_share_percent']) {
      setIfColumnExists(patch, companion, column, payoutPercent)
    }
  }

  setIfColumnExists(patch, companion, 'updated_at', nowIso())
  setIfColumnExists(patch, companion, 'updatedAt', nowIso())

  mergeMetadataIfExists(patch, companion, {
    candidateType: 'real_avatar',
    candidateConfigured: true,
    payoutPercent: payoutPercent ?? undefined
  })

  return patch
}

const buildCombinationPatch = ({ combination, priceCredits, operationalCostCredits, payoutPercent }) => {
  const patch = {}

  for (const column of ['is_real_candidate', 'real_candidate', 'production_ready', 'is_production_ready', 'approved_for_production']) {
    setIfColumnExists(patch, combination, column, true)
  }

  for (const column of ['is_demo', 'demo', 'is_test', 'test', 'mock', 'archived']) {
    setIfColumnExists(patch, combination, column, false)
  }

  // Segurança 6.3F: antes da geração real + QA + galeria protegida, a combinação deve continuar interna.
  // Não abrir visible_to_client=true neste sprint.
  for (const column of ['admin_only', 'adminOnly']) {
    setIfColumnExists(patch, combination, column, true)
  }

  for (const column of ['visible', 'is_visible', 'visible_to_client']) {
    setIfColumnExists(patch, combination, column, false)
  }

  if (Object.prototype.hasOwnProperty.call(combination || {}, 'status')) {
    const current = String(combination.status ?? '').trim().toLowerCase()
    patch.status = SAFE_ACTIVE_STATUSES.has(current) ? combination.status : 'active'
  }

  for (const column of ['publication_status', 'publicationStatus']) {
    setIfColumnExists(patch, combination, column, 'internal_ready')
  }

  setIfColumnExists(patch, combination, 'media_origin', 'real_production_controlled_6_3E')

  if (priceCredits !== null) {
    for (const column of ['price_credits', 'credits_price', 'sale_price_credits', 'credit_price']) {
      setIfColumnExists(patch, combination, column, priceCredits)
    }
  }

  if (operationalCostCredits !== null) {
    for (const column of [
      'operational_cost_credits',
      'estimated_operational_cost_credits',
      'cost_credits',
      'generation_cost_credits'
    ]) {
      setIfColumnExists(patch, combination, column, operationalCostCredits)
    }
  }

  if (payoutPercent !== null) {
    for (const column of ['payout_percent', 'actor_payout_percent', 'payout_rate_percent', 'revenue_share_percent']) {
      setIfColumnExists(patch, combination, column, payoutPercent)
    }
  }

  setIfColumnExists(patch, combination, 'updated_at', nowIso())
  setIfColumnExists(patch, combination, 'updatedAt', nowIso())

  mergeFinanceSnapshotIfExists(patch, combination, {
    priceCredits: priceCredits ?? undefined,
    operationalCostCredits: operationalCostCredits ?? undefined,
    payoutPercent: payoutPercent ?? undefined
  })

  mergeMetadataIfExists(patch, combination, {
    candidateType: 'real_media_combination',
    candidateConfigured: true,
    preProductionOnly: true,
    keepHiddenUntilGeneratedAndQaApproved: true,
    priceCredits: priceCredits ?? undefined,
    operationalCostCredits: operationalCostCredits ?? undefined,
    payoutPercent: payoutPercent ?? undefined
  })

  return patch
}

const patchSummary = (patch = {}) => Object.fromEntries(
  Object.entries(patch).map(([key, value]) => {
    if (key === 'metadata') return [key, '[metadata atualizado]']
    if (key === 'finance_snapshot') return [key, '[finance_snapshot atualizado]']
    return [key, value]
  })
)

const evaluateInputs = ({ companionId, combinationId, priceCredits, operationalCostCredits, payoutPercent, quantity }) => {
  const blockers = []

  if (!companionId) blockers.push('companion_id_required')
  if (!combinationId) blockers.push('combination_id_required')
  if (Number(quantity) !== MAX_SAFE_QUANTITY) blockers.push('quantity_limited_to_one')
  if (priceCredits === null) blockers.push('price_credits_required')
  if (operationalCostCredits === null) blockers.push('operational_cost_credits_required')
  if (payoutPercent === null) blockers.push('payout_percent_required')

  return blockers
}

const buildActionPlan = ({ blockers, companionId, combinationId, priceCredits, operationalCostCredits, payoutPercent }) => {
  const plan = []

  if (blockers.includes('companion_id_required')) plan.push('Definir REAL_PRODUCTION_COMPANION_ID com o UUID do avatar real aprovado.')
  if (blockers.includes('combination_id_required')) plan.push('Definir REAL_PRODUCTION_COMBINATION_ID com o UUID da combinação real de imagem.')
  if (blockers.includes('quantity_limited_to_one')) plan.push('Manter REAL_PRODUCTION_QUANTITY=1. Produção real controlada continua limitada a 1 item.')
  if (blockers.includes('price_credits_required')) plan.push('Definir REAL_PRODUCTION_PRICE_CREDITS com preço maior que zero.')
  if (blockers.includes('operational_cost_credits_required')) plan.push('Definir REAL_PRODUCTION_OPERATIONAL_COST_CREDITS com custo operacional estimado maior que zero.')
  if (blockers.includes('payout_percent_required')) plan.push('Definir REAL_PRODUCTION_PAYOUT_PERCENT entre 0 e 100 para regra de repasse do avatar/ator.')
  if (blockers.includes('companion_not_found')) plan.push('Conferir se o companionId existe na tabela companions.')
  if (blockers.includes('combination_not_found')) plan.push('Conferir se o combinationId existe na tabela media_combinations.')
  if (blockers.includes('no_supported_companion_columns')) plan.push('Schema atual de companions não possui colunas conhecidas para marcar conformidade automaticamente. Ajustar manualmente ou mapear coluna real.')
  if (blockers.includes('no_supported_combination_columns')) plan.push('Schema atual de media_combinations não possui colunas conhecidas para preço/custo/candidato real. Ajustar manualmente ou mapear coluna real.')
  if (blockers.includes('mutation_env_not_allowed')) plan.push(`Para aplicar de verdade, definir ${MUTATION_ENV}=true e ${MUTATION_ALLOW_ENV}=true.`)
  if (blockers.includes('confirmation_phrase_missing_or_invalid')) plan.push(`Para aplicar de verdade, informar a frase exata: ${REQUIRED_CANDIDATE_CONFIG_CONFIRMATION_PHRASE}`)

  if (companionId && combinationId) {
    plan.push(`Candidato alvo: companionId=${companionId}, combinationId=${combinationId}.`)
  }

  if (priceCredits !== null || operationalCostCredits !== null || payoutPercent !== null) {
    plan.push(`Valores desejados: preço=${priceCredits ?? 'pendente'} créditos, custo=${operationalCostCredits ?? 'pendente'} créditos, repasse=${payoutPercent ?? 'pendente'}%.`)
  }

  return plan
}

export function getRealProductionCandidateConfig() {
  return {
    sprint: REAL_PRODUCTION_CANDIDATE_CONFIG_SPRINT,
    requiredConfigurationPhrase: REQUIRED_CANDIDATE_CONFIG_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3A_REAL_E2E: toBool(process.env.RUN_6_3A_REAL_E2E),
      RUN_6_3C_REAL_PREP: toBool(process.env.RUN_6_3C_REAL_PREP),
      RUN_6_3D_REAL_CANDIDATE_CONFIG: toBool(process.env.RUN_6_3D_REAL_CANDIDATE_CONFIG),
      ALLOW_REAL_CANDIDATE_DATA_MUTATION: toBool(process.env.ALLOW_REAL_CANDIDATE_DATA_MUTATION),
      ENABLE_REAL_IMAGE_WORKER: toBool(process.env.ENABLE_REAL_IMAGE_WORKER),
      REAL_PRODUCTION_COMPANION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMPANION_ID),
      REAL_PRODUCTION_COMBINATION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMBINATION_ID),
      REAL_PRODUCTION_PRICE_CREDITS: parsePositiveNumber(process.env.REAL_PRODUCTION_PRICE_CREDITS),
      REAL_PRODUCTION_OPERATIONAL_COST_CREDITS: parsePositiveNumber(process.env.REAL_PRODUCTION_OPERATIONAL_COST_CREDITS),
      REAL_PRODUCTION_PAYOUT_PERCENT: parsePercent(process.env.REAL_PRODUCTION_PAYOUT_PERCENT)
    },
    safety: buildSafety()
  }
}

export async function configureRealProductionCandidate(input = {}) {
  const companionId = cleanUuid(input.companionId ?? process.env.REAL_PRODUCTION_COMPANION_ID)
  const combinationId = cleanUuid(input.combinationId ?? process.env.REAL_PRODUCTION_COMBINATION_ID)
  const quantity = Number(input.quantity ?? process.env.REAL_PRODUCTION_QUANTITY ?? 1)
  const priceCredits = parsePositiveNumber(input.priceCredits ?? process.env.REAL_PRODUCTION_PRICE_CREDITS)
  const operationalCostCredits = parsePositiveNumber(input.operationalCostCredits ?? process.env.REAL_PRODUCTION_OPERATIONAL_COST_CREDITS)
  const payoutPercent = parsePercent(input.payoutPercent ?? process.env.REAL_PRODUCTION_PAYOUT_PERCENT)
  const dryRun = input.dryRun !== undefined ? Boolean(input.dryRun) : !toBool(process.env.RUN_6_3D_REAL_CANDIDATE_CONFIG)
  const requestedApply = Boolean(input.apply) || toBool(process.env.RUN_6_3D_REAL_CANDIDATE_CONFIG)
  const mutationEnvAllowed = toBool(process.env.RUN_6_3D_REAL_CANDIDATE_CONFIG) && toBool(process.env.ALLOW_REAL_CANDIDATE_DATA_MUTATION)
  const confirmationPhrase = String(input.confirmationPhrase ?? process.env.REAL_CANDIDATE_CONFIG_CONFIRMATION_INPUT ?? '').trim()
  const confirmationOk = confirmationPhrase === REQUIRED_CANDIDATE_CONFIG_CONFIRMATION_PHRASE

  const blockers = evaluateInputs({
    companionId,
    combinationId,
    priceCredits,
    operationalCostCredits,
    payoutPercent,
    quantity
  })

  const companionResult = companionId
    ? await safeSelect({ table: 'companions', filters: [{ column: 'id', value: companionId }], maybeSingle: true })
    : { ok: true, data: null, error: null }

  const combinationResult = combinationId
    ? await safeSelect({ table: 'media_combinations', filters: [{ column: 'id', value: combinationId }], maybeSingle: true })
    : { ok: true, data: null, error: null }

  const companion = companionResult.ok ? companionResult.data : null
  const combination = combinationResult.ok ? combinationResult.data : null

  if (companionId && !companion) blockers.push('companion_not_found')
  if (combinationId && !combination) blockers.push('combination_not_found')

  const companionPatch = companion ? buildCompanionPatch({ companion, payoutPercent }) : {}
  const combinationPatch = combination ? buildCombinationPatch({ combination, priceCredits, operationalCostCredits, payoutPercent }) : {}

  if (companion && Object.keys(companionPatch).length === 0) blockers.push('no_supported_companion_columns')
  if (combination && Object.keys(combinationPatch).length === 0) blockers.push('no_supported_combination_columns')

  if (requestedApply && !mutationEnvAllowed) blockers.push('mutation_env_not_allowed')
  if (requestedApply && !confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')

  const plannedOperations = [
    {
      target: 'companions',
      action: 'update',
      id: companionId,
      found: Boolean(companion),
      supportedColumns: Object.keys(companionPatch),
      patchPreview: patchSummary(companionPatch),
      willApply: requestedApply && mutationEnvAllowed && confirmationOk && blockers.length === 0
    },
    {
      target: 'media_combinations',
      action: 'update',
      id: combinationId,
      found: Boolean(combination),
      supportedColumns: Object.keys(combinationPatch),
      patchPreview: patchSummary(combinationPatch),
      willApply: requestedApply && mutationEnvAllowed && confirmationOk && blockers.length === 0
    }
  ]

  const warnings = []
  if (payoutPercent !== null && !plannedOperations.some((op) => op.supportedColumns.some((column) => column.includes('payout') || column.includes('revenue_share')))) {
    warnings.push('payout_rule_may_require_dedicated_table')
  }

  const shouldApply = requestedApply && mutationEnvAllowed && confirmationOk && blockers.length === 0
  const appliedOperations = []
  let databaseMutationExecutedByThisService = false

  if (shouldApply) {
    const companionUpdate = await safeUpdate({ table: 'companions', id: companionId, patch: companionPatch })
    appliedOperations.push({
      target: 'companions',
      id: companionId,
      ok: companionUpdate.ok,
      code: companionUpdate.code,
      error: companionUpdate.error,
      updated: companionUpdate.ok && companionUpdate.code !== 'nothing_to_update'
    })

    const combinationUpdate = await safeUpdate({ table: 'media_combinations', id: combinationId, patch: combinationPatch })
    appliedOperations.push({
      target: 'media_combinations',
      id: combinationId,
      ok: combinationUpdate.ok,
      code: combinationUpdate.code,
      error: combinationUpdate.error,
      updated: combinationUpdate.ok && combinationUpdate.code !== 'nothing_to_update'
    })

    databaseMutationExecutedByThisService = appliedOperations.some((op) => op.updated)

    for (const op of appliedOperations) {
      if (!op.ok) blockers.push(`mutation_failed_${op.target}`)
    }
  }

  const postInspection = await inspectRealProductionCandidate({
    companionId,
    combinationId,
    quantity,
    confirmationPhrase: process.env.REAL_PRODUCTION_CONFIRMATION_INPUT || ''
  })

  const executionOnlyBlockers = new Set([
    'real_worker_enabled',
    'real_production_env_allowed',
    'confirmation_phrase_valid'
  ])

  const dataBlockersRemaining = (postInspection.blockers || []).filter((key) => !executionOnlyBlockers.has(key))

  let status = 'DRY_RUN_READY_TO_APPLY'
  if (blockers.length > 0 && !shouldApply) status = 'BLOCKED_BY_CONFIG'
  if (requestedApply && blockers.includes('mutation_env_not_allowed')) status = 'BLOCKED_BY_ENV'
  if (requestedApply && blockers.includes('confirmation_phrase_missing_or_invalid')) status = 'BLOCKED_BY_CONFIRMATION'
  if (shouldApply && databaseMutationExecutedByThisService && dataBlockersRemaining.length === 0) status = 'CONFIG_APPLIED_CANDIDATE_DATA_READY'
  if (shouldApply && databaseMutationExecutedByThisService && dataBlockersRemaining.length > 0) status = 'CONFIG_APPLIED_BUT_STILL_BLOCKED'
  if (shouldApply && !databaseMutationExecutedByThisService) status = 'NO_DATABASE_CHANGE_NEEDED_OR_UNSUPPORTED'

  return {
    sprint: REAL_PRODUCTION_CANDIDATE_CONFIG_SPRINT,
    status,
    dryRun: !shouldApply,
    requestedApply,
    mutationEnvAllowed,
    confirmationOk,
    selected: {
      companionId,
      companionLabel: companion ? normalizeLabel(companion) : null,
      combinationId,
      combinationLabel: combination ? normalizeLabel(combination) : null
    },
    desiredValues: {
      priceCredits,
      operationalCostCredits,
      payoutPercent,
      quantity
    },
    currentRows: {
      companion: compactRow(companion),
      combination: compactRow(combination)
    },
    blockers,
    warnings,
    actionPlan: buildActionPlan({
      blockers,
      companionId,
      combinationId,
      priceCredits,
      operationalCostCredits,
      payoutPercent
    }),
    plannedOperations,
    appliedOperations,
    postInspection: {
      status: postInspection.status,
      canProceedToRealExecution: postInspection.canProceedToRealExecution,
      blockers: postInspection.blockers,
      dataBlockersRemaining,
      selected: postInspection.selected
    },
    nextStepsWhenDataReady: [
      'Rodar npm run prep:actors:real-production-candidate para confirmar ausência de blockers de dados.',
      'Rodar npm run test:actors:real-production-readiness para conferir readiness geral.',
      'Só no momento da execução real, ligar envs 6.3A e frase de execução real.',
      'Rodar auditoria pré-run 6.3B antes e pós-job 6.3B depois.'
    ],
    safety: buildSafety({ databaseMutationExecutedByThisService })
  }
}
