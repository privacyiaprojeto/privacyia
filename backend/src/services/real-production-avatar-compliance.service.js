import { supabaseAdmin } from '../config/supabase.js'
import { inspectRealProductionCandidate } from './real-production-prep.service.js'

export const REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT = '6.3G'
export const REQUIRED_AVATAR_COMPLIANCE_CONFIRMATION_PHRASE = 'MARCAR AVATAR CONFORME 6.3G'

const MAX_SAFE_QUANTITY = 1
const MUTATION_ENV = 'RUN_6_3G_REAL_AVATAR_COMPLIANCE'
const MUTATION_ALLOW_ENV = 'ALLOW_REAL_AVATAR_COMPLIANCE_MUTATION'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const APPROVED_STATUS = 'approved'

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

const nowIso = () => new Date().toISOString()

const buildSafety = ({ databaseMutationExecutedByThisService = false } = {}) => ({
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

const safeSelectById = async ({ table, id }) => {
  if (!id) {
    return { ok: false, table, data: null, error: 'id ausente', code: 'missing_id' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) {
      return { ok: false, table, data: null, error: error.message, code: error.code }
    }

    return { ok: true, table, data: data ?? null, error: null, code: null }
  } catch (error) {
    return {
      ok: false,
      table,
      data: null,
      error: error?.message ?? 'Erro inesperado ao consultar registro',
      code: error?.code ?? null
    }
  }
}

const safeSelectList = async ({ table, limit = 20 }) => {
  try {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(limit)
    if (error) return { ok: false, table, data: [], error: error.message, code: error.code }
    return { ok: true, table, data: Array.isArray(data) ? data : [], error: null, code: null }
  } catch (error) {
    return {
      ok: false,
      table,
      data: [],
      error: error?.message ?? 'Erro inesperado ao consultar tabela',
      code: error?.code ?? null
    }
  }
}

const safeUpdate = async ({ table, id, patch }) => {
  if (!id) return { ok: false, table, id, data: null, error: 'id ausente', code: 'missing_id' }
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: true, table, id, data: null, error: null, code: 'nothing_to_update' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(patch)
      .eq('id', id)
      .select('*')
      .maybeSingle()

    if (error) return { ok: false, table, id, data: null, error: error.message, code: error.code }
    return { ok: true, table, id, data, error: null, code: null }
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


const safeInsert = async ({ table, patch }) => {
  if (!patch || Object.keys(patch).length === 0) {
    return { ok: false, table, data: null, error: 'payload vazio', code: 'empty_payload' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(patch)
      .select('*')
      .maybeSingle()

    if (error) return { ok: false, table, data: null, error: error.message, code: error.code }
    return { ok: true, table, data, error: null, code: null }
  } catch (error) {
    return {
      ok: false,
      table,
      data: null,
      error: error?.message ?? 'Erro inesperado ao inserir registro',
      code: error?.code ?? null
    }
  }
}

const safeSelectAuthorizationsByCompanion = async ({ companionId }) => {
  if (!companionId) {
    return { ok: false, table: 'avatar_production_authorizations', data: [], error: 'companion_id ausente', code: 'missing_companion_id' }
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('avatar_production_authorizations')
      .select('*')
      .eq('companion_id', companionId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) return { ok: false, table: 'avatar_production_authorizations', data: [], error: error.message, code: error.code }
    return { ok: true, table: 'avatar_production_authorizations', data: Array.isArray(data) ? data : [], error: null, code: null }
  } catch (error) {
    return {
      ok: false,
      table: 'avatar_production_authorizations',
      data: [],
      error: error?.message ?? 'Erro inesperado ao consultar autorizações do avatar',
      code: error?.code ?? null
    }
  }
}

const isUsableAuthorization = (row) => {
  if (!row) return false
  const status = String(row.status ?? '').trim().toLowerCase()
  if (!['approved', 'aprovado', 'authorized', 'autorizado', 'active', 'ativo', 'valid', 'valido', 'válido'].includes(status)) return false
  if (row.revoked_at) return false
  if (row.ends_at && new Date(row.ends_at).getTime() < Date.now()) return false
  return true
}

const buildAuthorizationInsertPatch = ({ authorizationColumns, complianceSnapshot, approvedBy = null }) => {
  const rowShape = Object.fromEntries((authorizationColumns || []).map((column) => [column, null]))
  const patch = {}
  const supportedColumns = []

  const set = (column, value) => {
    if (!Object.prototype.hasOwnProperty.call(rowShape, column)) return false
    patch[column] = value
    supportedColumns.push(column)
    return true
  }

  set('companion_id', complianceSnapshot.companion_id)
  set('status', APPROVED_STATUS)
  set('authorized_for_content_types', ['imagem'])
  set('starts_at', complianceSnapshot.approved_at)
  set('authorization_note', complianceSnapshot.note)
  set('terms_snapshot', {
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    scope: 'single_real_production_controlled',
    client_exposure_allowed: false,
    runpod_allowed_by_this_step: false
  })
  set('finance_snapshot', {
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    companion_id: complianceSnapshot.companion_id,
    combination_id: complianceSnapshot.combination_id
  })
  set('metadata', {
    realProductionAvatarCompliance: complianceSnapshot,
    avatar_compliance: complianceSnapshot,
    createdBySprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    clientExposureAllowed: false
  })
  set('authorized_by_profile_id', approvedBy || null)
  set('created_at', nowIso())
  set('updated_at', nowIso())

  // Evita enviar null em campos opcionais que podem ter FK rígida, como authorized_by_profile_id.
  for (const [key, value] of Object.entries({ ...patch })) {
    if (value === null || value === undefined) delete patch[key]
  }

  return { patch, supportedColumns }
}

const setIfColumnExists = (patch, row, column, value) => {
  if (!row || !Object.prototype.hasOwnProperty.call(row, column)) return false
  patch[column] = value
  return true
}

const mergeObjectColumnIfExists = (patch, row, column, values) => {
  if (!row || !Object.prototype.hasOwnProperty.call(row, column)) return false

  const base = row[column] && typeof row[column] === 'object' && !Array.isArray(row[column]) ? row[column] : {}
  patch[column] = {
    ...base,
    ...values
  }

  return true
}

const compactCompanion = (record) => {
  if (!record) return null

  return {
    id: record.id ?? null,
    label: normalizeLabel(record) || null,
    slug: record.slug ?? null,
    status: pickFirstValue(record, ['status', 'kyc_status', 'compliance_status', 'verification_status']) ?? null,
    visible: pickFirstValue(record, ['visible', 'is_visible', 'visible_to_client']) ?? null,
    archivedAt: record.archived_at ?? null,
    deletedAt: record.deleted_at ?? null,
    supportedColumns: Object.keys(record)
  }
}

const compactCombination = (record) => {
  if (!record) return null

  return {
    id: record.id ?? null,
    label: normalizeLabel(record) || null,
    companionId: record.companion_id ?? null,
    mediaType: record.media_type ?? null,
    mediaOrigin: record.media_origin ?? null,
    visibleToClient: record.visible_to_client ?? null,
    adminOnly: record.admin_only ?? null,
    priceCredits: record.price_credits ?? null,
    avatarProductionAuthorizationId: record.avatar_production_authorization_id ?? null,
    supportedColumns: Object.keys(record)
  }
}

const buildComplianceSnapshot = ({ companionId, combinationId, approvedBy = null, note = null }) => {
  const timestamp = nowIso()

  return {
    status: APPROVED_STATUS,
    approved: true,
    compliant: true,
    real_production_compliant: true,
    companion_id: companionId,
    combination_id: combinationId,
    approved_by: approvedBy || 'admin_controlled',
    approved_at: timestamp,
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    note: note || 'Conformidade controlada para primeira produção real de 1 item. Não expõe cliente e não aciona worker.'
  }
}

const buildCompanionPatch = ({ companion, complianceSnapshot }) => {
  const patch = {}
  const supportedColumns = []

  for (const [column, value] of [
    ['is_compliant', true],
    ['kyc_approved', true],
    ['approved_for_production', true],
    ['production_ready', true],
    ['factory_ready', true],
    ['compliance_status', APPROVED_STATUS],
    ['kyc_status', APPROVED_STATUS],
    ['verification_status', APPROVED_STATUS],
    ['identity_status', APPROVED_STATUS],
    ['document_status', APPROVED_STATUS]
  ]) {
    if (setIfColumnExists(patch, companion, column, value)) supportedColumns.push(column)
  }

  if (mergeObjectColumnIfExists(patch, companion, 'metadata', {
    realProductionAvatarCompliance: complianceSnapshot,
    avatar_compliance: complianceSnapshot,
    updatedBySprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    updatedAt: nowIso()
  })) {
    supportedColumns.push('metadata')
  }

  if (setIfColumnExists(patch, companion, 'updated_at', nowIso())) supportedColumns.push('updated_at')

  return { patch, supportedColumns }
}

const buildCombinationPatch = ({ combination, complianceSnapshot }) => {
  const patch = {}
  const supportedColumns = []

  // A combinação deve permanecer oculta do cliente até a geração real, QA e entrega controlada.
  if (setIfColumnExists(patch, combination, 'admin_only', true)) supportedColumns.push('admin_only')
  if (setIfColumnExists(patch, combination, 'visible_to_client', false)) supportedColumns.push('visible_to_client')
  if (setIfColumnExists(patch, combination, 'media_origin', 'real_production_controlled_6_3E')) supportedColumns.push('media_origin')

  if (mergeObjectColumnIfExists(patch, combination, 'metadata', {
    realProductionAvatarCompliance: complianceSnapshot,
    avatar_compliance: complianceSnapshot,
    updatedBySprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    updatedAt: nowIso()
  })) {
    supportedColumns.push('metadata')
  }

  if (mergeObjectColumnIfExists(patch, combination, 'display_payload', {
    avatarCompliance: {
      status: complianceSnapshot.status,
      approved: true,
      sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT
    }
  })) {
    supportedColumns.push('display_payload')
  }

  if (setIfColumnExists(patch, combination, 'updated_at', nowIso())) supportedColumns.push('updated_at')

  return { patch, supportedColumns }
}


const detectAvatarAuthorizationStorage = async ({ companionId }) => {
  const tableScan = await safeSelectList({ table: 'avatar_production_authorizations', limit: 5 })
  const existingScan = await safeSelectAuthorizationsByCompanion({ companionId })
  const existingUsable = existingScan.ok ? existingScan.data.find(isUsableAuthorization) || null : null
  const detectedColumns = tableScan.ok && tableScan.data[0]
    ? Object.keys(tableScan.data[0])
    : existingScan.ok && existingScan.data[0]
      ? Object.keys(existingScan.data[0])
      : [
          'id',
          'companion_id',
          'actor_profile_id',
          'kyc_case_id',
          'status',
          'authorized_for_content_types',
          'starts_at',
          'ends_at',
          'authorization_note',
          'terms_snapshot',
          'finance_snapshot',
          'metadata',
          'authorized_by_profile_id',
          'revoked_at',
          'revoked_by_profile_id',
          'created_at',
          'updated_at'
        ]

  return {
    table: 'avatar_production_authorizations',
    ok: tableScan.ok || existingScan.ok,
    tableScan,
    existingScan,
    existingUsable,
    detectedColumns,
    error: tableScan.error || existingScan.error || null
  }
}

const buildCombinationPatchWithAuthorization = ({ combination, complianceSnapshot, authorizationId = null }) => {
  const result = buildCombinationPatch({ combination, complianceSnapshot })
  if (authorizationId && setIfColumnExists(result.patch, combination, 'avatar_production_authorization_id', authorizationId)) {
    result.supportedColumns.push('avatar_production_authorization_id')
  }
  return result
}

export function getRealProductionAvatarComplianceConfig() {
  return {
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    requiredCompliancePhrase: REQUIRED_AVATAR_COMPLIANCE_CONFIRMATION_PHRASE,
    envHints: {
      RUN_6_3G_REAL_AVATAR_COMPLIANCE: toBool(process.env.RUN_6_3G_REAL_AVATAR_COMPLIANCE),
      ALLOW_REAL_AVATAR_COMPLIANCE_MUTATION: toBool(process.env.ALLOW_REAL_AVATAR_COMPLIANCE_MUTATION),
      RUN_6_3A_REAL_E2E: toBool(process.env.RUN_6_3A_REAL_E2E),
      ALLOW_REAL_SINGLE_ITEM_PRODUCTION: toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION),
      ENABLE_REAL_IMAGE_WORKER: toBool(process.env.ENABLE_REAL_IMAGE_WORKER),
      REAL_PRODUCTION_COMPANION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMPANION_ID),
      REAL_PRODUCTION_COMBINATION_ID: cleanUuid(process.env.REAL_PRODUCTION_COMBINATION_ID),
      REAL_PRODUCTION_QUANTITY: Number(process.env.REAL_PRODUCTION_QUANTITY || 1)
    },
    safety: buildSafety()
  }
}

export async function configureRealProductionAvatarCompliance(options = {}) {
  const companionId = cleanUuid(options.companionId || process.env.REAL_PRODUCTION_COMPANION_ID)
  const combinationId = cleanUuid(options.combinationId || process.env.REAL_PRODUCTION_COMBINATION_ID)
  const quantity = Number(options.quantity || process.env.REAL_PRODUCTION_QUANTITY || 1)
  const apply = options.apply === true || toBool(process.env.RUN_6_3G_REAL_AVATAR_COMPLIANCE)
  const mutationEnvAllowed = toBool(process.env.RUN_6_3G_REAL_AVATAR_COMPLIANCE) && toBool(process.env.ALLOW_REAL_AVATAR_COMPLIANCE_MUTATION)
  const confirmationPhrase = String(options.confirmationPhrase || process.env.REAL_AVATAR_COMPLIANCE_CONFIRMATION_INPUT || '').trim()
  const confirmationOk = confirmationPhrase === REQUIRED_AVATAR_COMPLIANCE_CONFIRMATION_PHRASE
  const dryRun = options.dryRun === true || !apply

  const blockers = []
  const warnings = []

  if (!companionId) blockers.push('companion_id_required')
  if (!combinationId) blockers.push('combination_id_required')
  if (quantity !== MAX_SAFE_QUANTITY) blockers.push('quantity_limited_to_one')

  const companionResult = companionId ? await safeSelectById({ table: 'companions', id: companionId }) : { ok: false, data: null, error: 'companion_id_required' }
  const combinationResult = combinationId ? await safeSelectById({ table: 'media_combinations', id: combinationId }) : { ok: false, data: null, error: 'combination_id_required' }

  const companion = companionResult.data
  const combination = combinationResult.data

  if (companionId && !companion) blockers.push('companion_not_found')
  if (combinationId && !combination) blockers.push('combination_not_found')
  if (companion && combination?.companion_id && combination.companion_id !== companion.id) blockers.push('combination_not_linked_to_companion')

  const complianceSnapshot = buildComplianceSnapshot({
    companionId,
    combinationId,
    approvedBy: options.approvedBy || process.env.REAL_AVATAR_COMPLIANCE_APPROVED_BY || 'admin_controlled',
    note: options.note || process.env.REAL_AVATAR_COMPLIANCE_NOTE || null
  })

  const authorizationStorage = await detectAvatarAuthorizationStorage({ companionId })
  const authorizationInsertPlan = authorizationStorage.ok && !authorizationStorage.existingUsable
    ? buildAuthorizationInsertPatch({
        authorizationColumns: authorizationStorage.detectedColumns,
        complianceSnapshot,
        approvedBy: options.approvedBy || process.env.REAL_AVATAR_COMPLIANCE_APPROVED_BY || null
      })
    : { patch: {}, supportedColumns: [] }

  const plannedAuthorizationId = authorizationStorage.existingUsable?.id || '<novo id após insert>'

  const companionPatchPlan = companion ? buildCompanionPatch({ companion, complianceSnapshot }) : { patch: {}, supportedColumns: [] }
  const combinationPatchPlan = combination
    ? buildCombinationPatchWithAuthorization({
        combination,
        complianceSnapshot,
        authorizationId: authorizationStorage.existingUsable?.id || null
      })
    : { patch: {}, supportedColumns: [] }

  if (authorizationStorage.ok) {
    warnings.push(authorizationStorage.existingUsable
      ? 'using_existing_avatar_production_authorization'
      : 'will_create_avatar_production_authorization_when_confirmed')
  } else if (companionPatchPlan.supportedColumns.length === 1 && companionPatchPlan.supportedColumns[0] === 'updated_at') {
    warnings.push('avatar_authorization_table_unavailable_using_combination_metadata')
  }

  const hasDedicatedAuthorizationStorage = authorizationStorage.ok
  const hasFallbackStorage = Object.keys(combinationPatchPlan.patch).includes('metadata') || Object.keys(companionPatchPlan.patch).includes('metadata')

  if (!hasDedicatedAuthorizationStorage && !hasFallbackStorage) {
    blockers.push('no_supported_compliance_storage_found')
  }

  if (apply && !mutationEnvAllowed) blockers.push('mutation_env_not_allowed')
  if (apply && !confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')

  const plannedOperations = [
    {
      target: 'avatar_production_authorizations',
      action: authorizationStorage.existingUsable ? 'reuse' : 'insert',
      id: authorizationStorage.existingUsable?.id || null,
      found: authorizationStorage.ok,
      supportedColumns: authorizationInsertPlan.supportedColumns,
      patchPreview: authorizationStorage.existingUsable
        ? {
            id: authorizationStorage.existingUsable.id,
            status: authorizationStorage.existingUsable.status,
            companion_id: authorizationStorage.existingUsable.companion_id,
            reused: true
          }
        : Object.keys(authorizationInsertPlan.patch).length > 0
          ? Object.fromEntries(Object.keys(authorizationInsertPlan.patch).map((key) => [
              key,
              ['metadata', 'terms_snapshot', 'finance_snapshot'].includes(key) ? `[${key}/avatar authorization]` : authorizationInsertPlan.patch[key]
            ]))
          : {},
      willApply: !authorizationStorage.existingUsable && apply && mutationEnvAllowed && confirmationOk && blockers.filter((key) => !['mutation_env_not_allowed', 'confirmation_phrase_missing_or_invalid'].includes(key)).length === 0
    },
    {
      target: 'companions',
      action: 'update',
      id: companionId,
      found: Boolean(companion),
      supportedColumns: companionPatchPlan.supportedColumns,
      patchPreview: Object.keys(companionPatchPlan.patch).length > 0
        ? Object.fromEntries(Object.keys(companionPatchPlan.patch).map((key) => [key, key === 'metadata' ? '[metadata/avatar compliance atualizado]' : companionPatchPlan.patch[key]]))
        : {},
      willApply: apply && mutationEnvAllowed && confirmationOk && blockers.filter((key) => !['mutation_env_not_allowed', 'confirmation_phrase_missing_or_invalid'].includes(key)).length === 0
    },
    {
      target: 'media_combinations',
      action: 'update',
      id: combinationId,
      found: Boolean(combination),
      supportedColumns: combinationPatchPlan.supportedColumns,
      patchPreview: Object.keys(combinationPatchPlan.patch).length > 0
        ? Object.fromEntries(Object.keys(combinationPatchPlan.patch).map((key) => [key, ['metadata', 'display_payload'].includes(key) ? `[${key}/avatar compliance atualizado]` : combinationPatchPlan.patch[key]]))
        : {},
      willApply: apply && mutationEnvAllowed && confirmationOk && blockers.filter((key) => !['mutation_env_not_allowed', 'confirmation_phrase_missing_or_invalid'].includes(key)).length === 0
    }
  ]

  const canApply = apply && mutationEnvAllowed && confirmationOk && blockers.length === 0
  const appliedOperations = []
  let databaseMutationExecutedByThisService = false

  if (canApply) {
    let effectiveAuthorizationId = authorizationStorage.existingUsable?.id || null

    if (authorizationStorage.ok && !effectiveAuthorizationId) {
      const authorizationInsert = await safeInsert({
        table: 'avatar_production_authorizations',
        patch: authorizationInsertPlan.patch
      })
      effectiveAuthorizationId = authorizationInsert.data?.id || null
      appliedOperations.push({
        target: 'avatar_production_authorizations',
        ok: authorizationInsert.ok,
        id: effectiveAuthorizationId,
        error: authorizationInsert.error,
        code: authorizationInsert.code
      })
      databaseMutationExecutedByThisService = authorizationInsert.ok || databaseMutationExecutedByThisService
    } else if (effectiveAuthorizationId) {
      appliedOperations.push({
        target: 'avatar_production_authorizations',
        ok: true,
        id: effectiveAuthorizationId,
        error: null,
        code: 'reused_existing_authorization'
      })
    }

    const companionUpdate = await safeUpdate({ table: 'companions', id: companionId, patch: companionPatchPlan.patch })
    appliedOperations.push({ target: 'companions', ok: companionUpdate.ok, error: companionUpdate.error, code: companionUpdate.code })
    databaseMutationExecutedByThisService = companionUpdate.ok || databaseMutationExecutedByThisService

    const finalCombinationPatchPlan = combination
      ? buildCombinationPatchWithAuthorization({
          combination,
          complianceSnapshot,
          authorizationId: effectiveAuthorizationId
        })
      : combinationPatchPlan

    const combinationUpdate = await safeUpdate({ table: 'media_combinations', id: combinationId, patch: finalCombinationPatchPlan.patch })
    appliedOperations.push({ target: 'media_combinations', ok: combinationUpdate.ok, error: combinationUpdate.error, code: combinationUpdate.code })
    databaseMutationExecutedByThisService = combinationUpdate.ok || databaseMutationExecutedByThisService

    for (const op of appliedOperations) {
      if (!op.ok) blockers.push(`${op.target}_update_failed`)
    }
  }

  let postInspection = null
  if (companionId && combinationId) {
    postInspection = await inspectRealProductionCandidate({
      companionId,
      combinationId,
      quantity,
      confirmationPhrase: '',
      includeReadiness: true
    })
  }

  let status = 'DRY_RUN_READY_TO_APPLY'
  if (blockers.length > 0 && apply) status = 'BLOCKED_BY_CONFIRMATION'
  else if (blockers.length > 0) status = 'BLOCKED_BY_AVATAR_COMPLIANCE_CONFIG'
  else if (canApply && databaseMutationExecutedByThisService) status = 'AVATAR_COMPLIANCE_MARKED_CONTROLLED'

  if (!apply && blockers.length === 0) status = 'DRY_RUN_READY_TO_APPLY'

  return {
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    status,
    dryRun,
    requestedApply: apply,
    mutationEnvAllowed,
    confirmationOk,
    selected: {
      companionId,
      companionLabel: normalizeLabel(companion) || null,
      combinationId,
      combinationLabel: normalizeLabel(combination) || null
    },
    companion: {
      ok: companionResult.ok,
      found: Boolean(companion),
      error: companionResult.error,
      data: compactCompanion(companion)
    },
    combination: {
      ok: combinationResult.ok,
      found: Boolean(combination),
      error: combinationResult.error,
      data: compactCombination(combination)
    },
    authorizationStorage: {
      table: 'avatar_production_authorizations',
      ok: authorizationStorage.ok,
      existingAuthorizationId: authorizationStorage.existingUsable?.id || null,
      detectedColumns: authorizationStorage.detectedColumns,
      error: authorizationStorage.error
    },
    complianceSnapshotPreview: {
      status: complianceSnapshot.status,
      approved: complianceSnapshot.approved,
      companion_id: complianceSnapshot.companion_id,
      combination_id: complianceSnapshot.combination_id,
      sprint: complianceSnapshot.sprint,
      approved_at: complianceSnapshot.approved_at
    },
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    plannedOperations,
    appliedOperations,
    postInspection,
    nextCommandsWhenApplied: [
      'npm run prep:actors:real-production-candidate',
      'npm run test:actors:real-production-readiness',
      'npm run test:actors:real-production-audit'
    ],
    safety: buildSafety({ databaseMutationExecutedByThisService })
  }
}

export async function auditAvatarComplianceTables() {
  const candidateTables = [
    'avatar_production_authorizations',
    'avatar_production_authorization',
    'companion_production_authorizations',
    'companion_kyc',
    'companion_compliance',
    'actor_kyc',
    'actor_compliance',
    'kyc_verifications'
  ]

  const results = []

  for (const table of candidateTables) {
    const result = await safeSelectList({ table, limit: 5 })
    results.push({
      table,
      ok: result.ok,
      totalReturned: Array.isArray(result.data) ? result.data.length : 0,
      detectedColumns: Array.isArray(result.data) && result.data[0] ? Object.keys(result.data[0]) : [],
      error: result.error
    })
  }

  return {
    sprint: REAL_PRODUCTION_AVATAR_COMPLIANCE_SPRINT,
    results,
    safety: buildSafety()
  }
}
