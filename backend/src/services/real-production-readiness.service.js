import { supabaseAdmin } from '../config/supabase.js'

export const REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE = 'CONFIRMAR PRODUCAO REAL DE 1 ITEM'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const APPROVED_VALUES = new Set([
  'approved',
  'aprovado',
  'verified',
  'verificado',
  'compliant',
  'conforme',
  'ok',
  'active',
  'ativo'
])

const BLOCKER = 'blocker'
const WARNING = 'warning'
const INFO = 'info'

const toBool = (value) => TRUTHY.has(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const normalizeString = (value) => String(value ?? '').trim().toLowerCase()

const numberFromRecord = (record, fields = []) => {
  if (!record) return null

  for (const field of fields) {
    if (record[field] === null || record[field] === undefined || record[field] === '') continue

    const parsed = Number(record[field])
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

const numberFromNestedRecord = (record, objectField, fields = []) => {
  const source = record && typeof record === 'object' && record[objectField] && typeof record[objectField] === 'object' && !Array.isArray(record[objectField])
    ? record[objectField]
    : null

  return numberFromRecord(source, fields)
}

const isControlledRealCombination = (record) => {
  if (!record || typeof record !== 'object') return false

  const metadata = record.metadata && typeof record.metadata === 'object' && !Array.isArray(record.metadata) ? record.metadata : {}
  const financeSnapshot = record.finance_snapshot && typeof record.finance_snapshot === 'object' && !Array.isArray(record.finance_snapshot) ? record.finance_snapshot : {}
  const displayPayload = record.display_payload && typeof record.display_payload === 'object' && !Array.isArray(record.display_payload) ? record.display_payload : {}
  const promptPayload = record.prompt_payload && typeof record.prompt_payload === 'object' && !Array.isArray(record.prompt_payload) ? record.prompt_payload : {}

  const haystack = [
    record.media_origin,
    record.source,
    metadata.media_origin,
    metadata.source,
    metadata.sprint,
    metadata.createdBySprint,
    financeSnapshot.sprint,
    displayPayload.sprint,
    promptPayload.sprint
  ].filter(hasValue).join(' ').toLowerCase()

  return haystack.includes('real_production_controlled') || haystack.includes('6.3e')
}

const pickFirstValue = (record, fields = []) => {
  if (!record) return null

  for (const field of fields) {
    if (hasValue(record[field])) return record[field]
  }

  return null
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

const safeCount = async ({ table, filters = [] }) => {
  try {
    let query = supabaseAdmin.from(table).select('id', { count: 'exact', head: true })

    for (const filter of filters) {
      if (!filter || !filter.column || filter.value === undefined || filter.value === null) continue
      query = query.eq(filter.column, filter.value)
    }

    const { count, error } = await query

    if (error) {
      return {
        ok: false,
        table,
        count: 0,
        error: error.message,
        code: error.code
      }
    }

    return {
      ok: true,
      table,
      count: count ?? 0,
      error: null,
      code: null
    }
  } catch (error) {
    return {
      ok: false,
      table,
      count: 0,
      error: error?.message ?? 'Erro inesperado ao contar registros',
      code: error?.code ?? null
    }
  }
}

const buildItem = ({ key, label, ok, severity = BLOCKER, humanMessage, technical, evidence = {} }) => ({
  key,
  label,
  ok: Boolean(ok),
  severity,
  humanMessage,
  technical,
  evidence
})

const findExistingCompanion = async ({ companionId, actorId }) => {
  if (companionId) {
    const exact = await safeSelect({
      table: 'companions',
      filters: [{ column: 'id', value: companionId }],
      maybeSingle: true
    })

    return {
      record: exact.ok ? exact.data : null,
      source: exact.ok ? 'companions.id' : 'companions.error',
      error: exact.error
    }
  }

  if (actorId) {
    const byActor = await safeSelect({
      table: 'companions',
      filters: [{ column: 'actor_id', value: actorId }],
      limit: 5
    })

    if (byActor.ok && Array.isArray(byActor.data) && byActor.data.length > 0) {
      return {
        record: byActor.data[0],
        source: 'companions.actor_id',
        error: null
      }
    }
  }

  const list = await safeSelect({ table: 'companions', limit: 25 })

  if (!list.ok) {
    return {
      record: null,
      source: 'companions.error',
      error: list.error
    }
  }

  const records = Array.isArray(list.data) ? list.data : []
  const preferred = records.find((record) => {
    const visible = pickFirstValue(record, ['visible_to_client', 'visible', 'is_visible'])
    const archived = pickFirstValue(record, ['archived', 'is_archived'])
    const status = normalizeString(pickFirstValue(record, ['status', 'publication_status', 'publicationStatus']))

    if (visible === false) return false
    if (archived === true) return false
    if (['archived', 'arquivado', 'hidden', 'oculto', 'deleted', 'removido'].includes(status)) return false

    return true
  })

  return {
    record: preferred ?? records[0] ?? null,
    source: 'companions.first_available',
    error: null
  }
}

const findExistingCombination = async ({ combinationId, companion }) => {
  if (combinationId) {
    const exact = await safeSelect({
      table: 'media_combinations',
      filters: [{ column: 'id', value: combinationId }],
      maybeSingle: true
    })

    return {
      record: exact.ok ? exact.data : null,
      source: exact.ok ? 'media_combinations.id' : 'media_combinations.error',
      error: exact.error
    }
  }

  const list = await safeSelect({ table: 'media_combinations', limit: 50 })

  if (!list.ok) {
    return {
      record: null,
      source: 'media_combinations.error',
      error: list.error
    }
  }

  const records = Array.isArray(list.data) ? list.data : []
  const companionId = companion?.id

  const candidates = companionId
    ? records.filter((record) => [
      record.companion_id,
      record.avatar_id,
      record.actress_id,
      record.atriz_id,
      record.character_id
    ].some((value) => value === companionId))
    : records

  const usable = candidates.find((record) => {
    const status = normalizeString(pickFirstValue(record, ['status', 'publication_status', 'publicationStatus']))
    const visible = pickFirstValue(record, ['visible_to_client', 'visible', 'is_visible'])
    const adminOnly = pickFirstValue(record, ['admin_only', 'adminOnly'])

    if (['archived', 'arquivado', 'deleted', 'removido'].includes(status)) return false

    // Combinação controlada 6.3E fica oculta/admin_only até gerar mídia real e passar por QA.
    if (isControlledRealCombination(record)) return true

    if (visible === false) return false
    if (adminOnly === true) return false
    if (['hidden', 'oculto'].includes(status)) return false

    return true
  })

  return {
    record: usable ?? candidates[0] ?? records[0] ?? null,
    source: companionId ? 'media_combinations.by_companion_or_first' : 'media_combinations.first_available',
    error: null
  }
}


const complianceSignalFromObject = (source) => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ok: false, field: null, value: null, reason: 'no_nested_compliance_signal' }
  }

  const fields = [
    'status',
    'compliance_status',
    'complianceStatus',
    'kyc_status',
    'kycStatus',
    'verification_status',
    'verificationStatus',
    'approval_status',
    'approvalStatus'
  ]

  for (const field of fields) {
    if (!hasValue(source[field])) continue
    const value = normalizeString(source[field])
    if (APPROVED_VALUES.has(value)) {
      return { ok: true, field, value: source[field], reason: 'nested_approved_status_found' }
    }
  }

  const booleanFields = [
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
  ]

  for (const field of booleanFields) {
    if (!hasValue(source[field])) continue
    const value = normalizeString(source[field])
    if (APPROVED_VALUES.has(value) || TRUTHY.has(value)) {
      return { ok: true, field, value: source[field], reason: 'nested_boolean_compliance_found' }
    }
  }

  return { ok: false, field: null, value: null, reason: 'no_nested_compliance_signal' }
}

const isCombinationAvatarComplianceApproved = (combination, companionId = null) => {
  if (!combination) {
    return { ok: false, field: null, value: null, reason: 'combination_not_found' }
  }

  if (hasValue(combination.avatar_production_authorization_id)) {
    return {
      ok: true,
      field: 'media_combinations.avatar_production_authorization_id',
      value: combination.avatar_production_authorization_id,
      reason: 'avatar_production_authorization_id_found'
    }
  }

  const roots = [
    ['metadata', combination.metadata],
    ['display_payload', combination.display_payload],
    ['prompt_payload', combination.prompt_payload],
    ['finance_snapshot', combination.finance_snapshot]
  ]

  for (const [rootName, root] of roots) {
    if (!root || typeof root !== 'object' || Array.isArray(root)) continue

    const directSignal = complianceSignalFromObject(root)
    if (directSignal.ok) {
      const signalCompanionId = root.companion_id || root.companionId || root.avatar_id || root.avatarId
      if (!signalCompanionId || !companionId || signalCompanionId === companionId) {
        return {
          ...directSignal,
          field: `${rootName}.${directSignal.field}`,
          reason: `${directSignal.reason}_in_${rootName}`
        }
      }
    }

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
      if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue

      const nestedSignal = complianceSignalFromObject(nested)
      if (!nestedSignal.ok) continue

      const signalCompanionId = nested.companion_id || nested.companionId || nested.avatar_id || nested.avatarId
      if (signalCompanionId && companionId && signalCompanionId !== companionId) continue

      return {
        ...nestedSignal,
        field: `${rootName}.${nestedKey}.${nestedSignal.field}`,
        reason: `${nestedSignal.reason}_in_combination_snapshot`
      }
    }
  }

  return { ok: false, field: null, value: null, reason: 'no_combination_avatar_compliance_signal_found' }
}

const isCompanionCompliant = (companion, combination = null) => {
  if (!companion) {
    return {
      ok: false,
      value: null,
      field: null,
      reason: 'avatar_not_found'
    }
  }

  const fields = [
    'kyc_status',
    'kycStatus',
    'compliance_status',
    'complianceStatus',
    'verification_status',
    'verificationStatus',
    'identity_status',
    'identityStatus',
    'document_status',
    'documentStatus',
    'onboarding_status',
    'onboardingStatus',
    'status'
  ]

  for (const field of fields) {
    if (!hasValue(companion[field])) continue

    const value = normalizeString(companion[field])

    if (APPROVED_VALUES.has(value)) {
      return {
        ok: true,
        value: companion[field],
        field,
        reason: 'approved_status_found'
      }
    }
  }

  const combinationCompliance = isCombinationAvatarComplianceApproved(combination, companion?.id ?? null)

  if (combinationCompliance.ok) {
    return {
      ok: true,
      value: combinationCompliance.value,
      field: combinationCompliance.field,
      reason: combinationCompliance.reason
    }
  }

  return {
    ok: false,
    value: null,
    field: null,
    reason: 'no_approved_compliance_field_found'
  }
}

const checkRuleTable = async ({ tableNames, fields, targetId }) => {
  for (const table of tableNames) {
    const result = await safeSelect({ table, limit: 30 })

    if (!result.ok) continue

    const records = Array.isArray(result.data) ? result.data : []
    const matchingRecords = targetId
      ? records.filter((record) => [
        record.companion_id,
        record.avatar_id,
        record.actress_id,
        record.atriz_id,
        record.actor_id,
        record.ator_id,
        record.profile_id,
        record.media_combination_id,
        record.combination_id
      ].some((value) => value === targetId))
      : records

    const found = (matchingRecords.length > 0 ? matchingRecords : records).find((record) => {
      const status = normalizeString(pickFirstValue(record, ['status', 'publication_status', 'publicationStatus']))
      const active = pickFirstValue(record, ['active', 'is_active', 'enabled'])
      const archived = pickFirstValue(record, ['archived', 'is_archived'])
      const numericValue = numberFromRecord(record, fields)

      if (active === false) return false
      if (archived === true) return false
      if (['archived', 'arquivado', 'disabled', 'desativado', 'deleted', 'removido'].includes(status)) return false

      return Number.isFinite(numericValue) && numericValue > 0
    })

    if (found) {
      return {
        ok: true,
        table,
        recordId: found.id ?? null,
        value: numberFromRecord(found, fields),
        error: null
      }
    }
  }

  return {
    ok: false,
    table: null,
    recordId: null,
    value: null,
    error: null
  }
}

const checkProcessingJobs = async () => {
  const statusesToCheck = ['processing', 'running', 'queued']
  const results = []

  for (const status of statusesToCheck) {
    const result = await safeCount({
      table: 'media_jobs',
      filters: [{ column: 'status', value: status }]
    })

    results.push({ status, ...result })
  }

  const supported = results.some((result) => result.ok)
  const total = results.filter((result) => result.ok).reduce((sum, result) => sum + Number(result.count ?? 0), 0)

  return {
    supported,
    total,
    results
  }
}

export const getRealProductionReadiness = async ({
  mode = 'safe_preflight',
  requestedQuantity = 1,
  companionId = null,
  actorId = null,
  combinationId = null,
  confirmationPhrase = ''
} = {}) => {
  const runPodCalled = false
  const r2RealUpload = false
  const destructiveDelete = false
  const paymentExecuted = false
  const walletChanged = false

  const isRealMode = ['real', 'real_production', 'real_single_item'].includes(String(mode ?? '').trim())
  const normalizedConfirmationPhrase = String(confirmationPhrase ?? '').trim()
  const envRealAllowed = toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION)
  const realWorkerEnabled = [
    process.env.ENABLE_REAL_IMAGE_WORKER,
    process.env.REAL_IMAGE_WORKER,
    process.env.FACTORY_REAL_IMAGE_WORKER,
    process.env.RUNPOD_REAL_IMAGE_WORKER
  ].some(toBool)

  const runpodEndpoint = pickFirstValue(process.env, [
    'RUNPOD_IMAGE_ENDPOINT_ID',
    'RUNPOD_ENDPOINT_ID',
    'RUNPOD_SERVERLESS_ENDPOINT_ID'
  ])

  const runpodApiKey = pickFirstValue(process.env, [
    'RUNPOD_API_KEY',
    'RUNPOD_TOKEN'
  ])

  const r2Bucket = pickFirstValue(process.env, [
    'R2_BUCKET_NAME',
    'CLOUDFLARE_R2_BUCKET',
    'CLOUDFLARE_R2_BUCKET_NAME'
  ])

  const r2Account = pickFirstValue(process.env, [
    'R2_ACCOUNT_ID',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_R2_ACCOUNT_ID'
  ])

  const r2AccessKey = pickFirstValue(process.env, [
    'R2_ACCESS_KEY_ID',
    'CLOUDFLARE_R2_ACCESS_KEY_ID',
    'AWS_ACCESS_KEY_ID'
  ])

  const r2SecretKey = pickFirstValue(process.env, [
    'R2_SECRET_ACCESS_KEY',
    'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
    'AWS_SECRET_ACCESS_KEY'
  ])

  const effectiveCompanionId = companionId || process.env.REAL_PRODUCTION_COMPANION_ID || null
  const effectiveCombinationId = combinationId || process.env.REAL_PRODUCTION_COMBINATION_ID || null

  const companionResult = await findExistingCompanion({ companionId: effectiveCompanionId, actorId })
  const companion = companionResult.record
  const combinationResult = await findExistingCombination({ combinationId: effectiveCombinationId, companion })
  const combination = combinationResult.record

  const companionCompliance = isCompanionCompliant(companion, combination)

  const priceCredits = numberFromRecord(combination, [
    'price_credits',
    'credits_price',
    'priceCredits',
    'credit_price',
    'credits',
    'valor_creditos'
  ])

  const directOperationalCost = numberFromRecord(combination, [
    'operational_cost_credits',
    'estimated_operational_cost_credits',
    'operationalCostCredits',
    'cost_credits',
    'costCredits'
  ]) || numberFromNestedRecord(combination, 'finance_snapshot', [
    'operational_cost_credits',
    'estimated_operational_cost_credits',
    'operationalCostCredits',
    'cost_credits',
    'costCredits'
  ])

  const costRule = directOperationalCost && directOperationalCost > 0
    ? {
      ok: true,
      table: combination?.finance_snapshot ? 'media_combinations.finance_snapshot' : 'media_combinations',
      recordId: combination?.id ?? null,
      value: directOperationalCost,
      error: null
    }
    : await checkRuleTable({
      tableNames: [
        'media_operational_cost_rules',
        'operational_cost_rules',
        'media_cost_rules',
        'actor_operational_cost_rules',
        'companion_operational_cost_rules'
      ],
      fields: ['cost_credits', 'operational_cost_credits', 'estimated_cost_credits', 'credits'],
      targetId: combination?.id ?? companion?.id ?? null
    })

  const directPayout = numberFromRecord(combination, [
    'payout_percent',
    'payout_percentage',
    'actor_payout_percent',
    'repasse_percentual',
    'repasse_percent'
  ]) || numberFromNestedRecord(combination, 'finance_snapshot', [
    'payout_percent',
    'payout_percentage',
    'actor_payout_percent',
    'revenue_share_percent',
    'repasse_percentual',
    'repasse_percent'
  ])

  const payoutRule = directPayout && directPayout > 0
    ? {
      ok: true,
      table: combination?.finance_snapshot ? 'media_combinations.finance_snapshot' : 'media_combinations',
      recordId: combination?.id ?? null,
      value: directPayout,
      error: null
    }
    : await checkRuleTable({
      tableNames: [
        'actor_payout_rules',
        'companion_payout_rules',
        'media_payout_rules',
        'payout_rules',
        'repasse_regras'
      ],
      fields: ['payout_percent', 'payout_percentage', 'percentage', 'percentual', 'repasse_percentual', 'repasse_percent'],
      targetId: companion?.id ?? null
    })

  const processingJobs = await checkProcessingJobs()

  const items = [
    buildItem({
      key: 'quantity_limited_to_one',
      label: 'Quantidade limitada a 1 item',
      ok: Number(requestedQuantity) === 1,
      severity: BLOCKER,
      humanMessage: Number(requestedQuantity) === 1
        ? 'A produção está limitada a exatamente 1 item.'
        : 'A produção real controlada só pode liberar 1 item por vez.',
      technical: 'requestedQuantity must be exactly 1',
      evidence: { requestedQuantity: Number(requestedQuantity) }
    }),
    buildItem({
      key: 'avatar_selected',
      label: 'Avatar selecionado',
      ok: Boolean(companion?.id),
      severity: BLOCKER,
      humanMessage: companion?.id
        ? 'Existe um avatar selecionado para o checklist.'
        : 'Nenhum avatar foi encontrado para validar a produção.',
      technical: companionResult.error ?? companionResult.source,
      evidence: { companionId: companion?.id ?? null, source: companionResult.source }
    }),
    buildItem({
      key: 'avatar_compliant',
      label: 'Avatar conforme/KYC aprovado',
      ok: companionCompliance.ok,
      severity: BLOCKER,
      humanMessage: companionCompliance.ok
        ? 'O avatar possui indicação de conformidade/aprovação.'
        : 'O avatar ainda não possui evidência segura de conformidade/aprovação.',
      technical: companionCompliance.reason,
      evidence: {
        field: companionCompliance.field,
        value: companionCompliance.value
      }
    }),
    buildItem({
      key: 'combination_selected',
      label: 'Produto/combinação selecionado',
      ok: Boolean(combination?.id),
      severity: BLOCKER,
      humanMessage: combination?.id
        ? 'Existe um produto/combinação selecionado para validação.'
        : 'Nenhum produto/combinação foi encontrado para validar a produção.',
      technical: combinationResult.error ?? combinationResult.source,
      evidence: { combinationId: combination?.id ?? null, source: combinationResult.source }
    }),
    buildItem({
      key: 'price_configured',
      label: 'Preço configurado',
      ok: Number.isFinite(priceCredits) && priceCredits > 0,
      severity: BLOCKER,
      humanMessage: Number.isFinite(priceCredits) && priceCredits > 0
        ? `Preço encontrado: ${priceCredits} créditos.`
        : 'Preço não encontrado ou preço zerado. Não libere venda/produção real sem preço.',
      technical: 'media_combinations.price_credits or compatible price field must be > 0',
      evidence: { priceCredits }
    }),
    buildItem({
      key: 'operational_cost_configured',
      label: 'Custo operacional configurado',
      ok: costRule.ok,
      severity: BLOCKER,
      humanMessage: costRule.ok
        ? `Custo operacional encontrado: ${costRule.value} créditos.`
        : 'Custo operacional não encontrado. Sem isso, o Admin não enxerga margem real.',
      technical: 'operational cost rule/direct cost must be > 0',
      evidence: {
        table: costRule.table,
        recordId: costRule.recordId,
        value: costRule.value
      }
    }),
    buildItem({
      key: 'payout_rule_configured',
      label: 'Regra de repasse configurada',
      ok: payoutRule.ok,
      severity: BLOCKER,
      humanMessage: payoutRule.ok
        ? `Regra de repasse encontrada: ${payoutRule.value}%.`
        : 'Regra de repasse não encontrada. Sem isso, o financeiro de atores fica incompleto.',
      technical: 'payout rule/direct payout must be > 0',
      evidence: {
        table: payoutRule.table,
        recordId: payoutRule.recordId,
        value: payoutRule.value
      }
    }),
    buildItem({
      key: 'runpod_configured',
      label: 'RunPod configurado',
      ok: hasValue(runpodEndpoint) && hasValue(runpodApiKey),
      severity: BLOCKER,
      humanMessage: hasValue(runpodEndpoint) && hasValue(runpodApiKey)
        ? 'RunPod possui endpoint e chave configurados no ambiente.'
        : 'RunPod ainda não possui endpoint e/ou chave no ambiente.',
      technical: 'RUNPOD_IMAGE_ENDPOINT_ID/RUNPOD_API_KEY or compatible envs must be present',
      evidence: {
        hasEndpoint: hasValue(runpodEndpoint),
        hasApiKey: hasValue(runpodApiKey)
      }
    }),
    buildItem({
      key: 'r2_configured',
      label: 'Cloudflare R2 configurado',
      ok: [r2Bucket, r2Account, r2AccessKey, r2SecretKey].every(hasValue),
      severity: BLOCKER,
      humanMessage: [r2Bucket, r2Account, r2AccessKey, r2SecretKey].every(hasValue)
        ? 'R2 possui bucket, conta, access key e secret configurados.'
        : 'R2 ainda não possui todas as variáveis mínimas configuradas.',
      technical: 'R2 bucket/account/access/secret envs must be present',
      evidence: {
        hasBucket: hasValue(r2Bucket),
        hasAccount: hasValue(r2Account),
        hasAccessKey: hasValue(r2AccessKey),
        hasSecretKey: hasValue(r2SecretKey)
      }
    }),
    buildItem({
      key: 'real_worker_enabled',
      label: 'Worker real habilitado',
      ok: realWorkerEnabled,
      severity: isRealMode ? BLOCKER : WARNING,
      humanMessage: realWorkerEnabled
        ? 'Worker real marcado como habilitado no ambiente.'
        : 'Worker real não está habilitado. Isso é esperado em teste seguro.',
      technical: 'ENABLE_REAL_IMAGE_WORKER/REAL_IMAGE_WORKER/FACTORY_REAL_IMAGE_WORKER compatible env must be true for real execution',
      evidence: { realWorkerEnabled }
    }),
    buildItem({
      key: 'real_production_env_allowed',
      label: 'Produção real liberada no ambiente',
      ok: envRealAllowed,
      severity: BLOCKER,
      humanMessage: envRealAllowed
        ? 'O ambiente permite produção real controlada.'
        : 'O ambiente NÃO permite produção real controlada. Isso protege contra acidente.',
      technical: 'ALLOW_REAL_SINGLE_ITEM_PRODUCTION must be true for real execution',
      evidence: {
        ALLOW_REAL_SINGLE_ITEM_PRODUCTION: String(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION ?? 'false')
      }
    }),
    buildItem({
      key: 'confirmation_phrase_valid',
      label: 'Frase de confirmação validada',
      ok: normalizedConfirmationPhrase === REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
      severity: BLOCKER,
      humanMessage: normalizedConfirmationPhrase === REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE
        ? 'A frase de confirmação está correta.'
        : 'A frase de confirmação obrigatória ainda não foi digitada corretamente.',
      technical: 'confirmationPhrase must match required phrase exactly',
      evidence: {
        requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
        received: normalizedConfirmationPhrase ? '[provided]' : '[empty]'
      }
    }),
    buildItem({
      key: 'no_processing_jobs',
      label: 'Sem fila crítica em andamento',
      ok: processingJobs.supported ? processingJobs.total === 0 : true,
      severity: WARNING,
      humanMessage: processingJobs.supported
        ? processingJobs.total === 0
          ? 'Nenhum job crítico em andamento foi encontrado.'
          : `Existem ${processingJobs.total} jobs em fila/processamento. Evite iniciar produção real agora.`
        : 'Tabela de jobs não pôde ser validada. O checklist seguiu sem travar por compatibilidade.',
      technical: 'media_jobs queued/processing/running count',
      evidence: {
        supported: processingJobs.supported,
        total: processingJobs.total
      }
    })
  ]

  const blockerFailures = items.filter((item) => item.severity === BLOCKER && !item.ok)
  const warningFailures = items.filter((item) => item.severity === WARNING && !item.ok)

  const safeRequiredKeys = ['quantity_limited_to_one', 'avatar_selected', 'combination_selected']
  const safeFailures = items.filter((item) => safeRequiredKeys.includes(item.key) && !item.ok)

  const canStartSafe = safeFailures.length === 0
  const canStartReal = blockerFailures.length === 0

  return {
    sprint: '6.2E',
    name: 'Checklist Operacional / Readiness de Produção Real',
    mode,
    requestedQuantity: Number(requestedQuantity),
    canStartSafe,
    canStartReal,
    status: canStartReal ? 'GO_REAL_READY' : canStartSafe ? 'SAFE_ONLY' : 'NO_GO',
    requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
    summary: {
      totalChecks: items.length,
      passed: items.filter((item) => item.ok).length,
      blockers: blockerFailures.length,
      warnings: warningFailures.length,
      blockerKeys: blockerFailures.map((item) => item.key),
      warningKeys: warningFailures.map((item) => item.key)
    },
    selected: {
      companionId: companion?.id ?? null,
      combinationId: combination?.id ?? null
    },
    checklist: items,
    safety: {
      runPodCalled,
      r2RealUpload,
      destructiveDelete,
      paymentExecuted,
      walletChanged,
      runPodMayBeCalledByWorkerAfterQueue: Boolean(canStartReal && isRealMode && realWorkerEnabled),
      realProductionEnvAllowed: envRealAllowed,
      realWorkerEnabled
    }
  }
}
