import { supabaseAdmin } from '../config/supabase.js'
import { auditRealProductionAfterJob } from './real-production-audit.service.js'

export const REAL_PRODUCTION_WATCHDOG_SPRINT = '6.3I'
export const REQUIRED_STUCK_GUARD_CONFIRMATION_PHRASE = 'MARCAR JOB 6.3I COMO STUCK FAILED'

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const RUNNING_STATUSES = new Set(['queued', 'pending', 'running', 'processing', 'in_progress'])

const toBool = (value) => TRUTHY.has(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const nowIso = () => new Date().toISOString()

const lower = (value) => String(value ?? '').trim().toLowerCase()

const asObject = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

const parseMissingColumn = (message = '') => {
  const patterns = [
    /Could not find the '([^']+)' column/i,
    /column "([^"]+)" of relation/i,
    /record "[^"]+" has no field "([^"]+)"/i,
    /column ([a-zA-Z0-9_]+) does not exist/i
  ]

  for (const pattern of patterns) {
    const match = String(message ?? '').match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

const isMissingColumnError = (error) => {
  const message = String(error?.message ?? '')
  const code = String(error?.code ?? '')

  return code === 'PGRST204' || /schema cache|column|does not exist|has no field/i.test(message)
}

const stripUndefined = (record = {}) => Object.fromEntries(
  Object.entries(record).filter(([, value]) => value !== undefined)
)

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

const safeSelect = async ({ table, filters = [], maybeSingle = false, limit = 20 } = {}) => {
  try {
    let query = supabaseAdmin.from(table).select('*')

    for (const filter of filters) {
      if (!filter?.column || filter.value === undefined || filter.value === null) continue
      query = query.eq(filter.column, filter.value)
    }

    if (Number.isFinite(limit) && limit > 0) query = query.limit(limit)
    if (maybeSingle) query = query.maybeSingle()

    const { data, error } = await query

    if (error) {
      return {
        ok: false,
        data: maybeSingle ? null : [],
        rows: [],
        error: error.message,
        code: error.code
      }
    }

    return {
      ok: true,
      data: data ?? (maybeSingle ? null : []),
      rows: Array.isArray(data) ? data : data ? [data] : [],
      error: null,
      code: null
    }
  } catch (error) {
    return {
      ok: false,
      data: maybeSingle ? null : [],
      rows: [],
      error: error?.message ?? 'Erro inesperado ao consultar tabela',
      code: error?.code ?? null
    }
  }
}

const safeUpdateAdaptive = async ({ table, id, patch, returning = '*' } = {}) => {
  if (!hasValue(id)) {
    return {
      ok: false,
      table,
      data: null,
      removedColumns: [],
      error: 'id não informado para update',
      code: 'MISSING_ID'
    }
  }

  let payload = stripUndefined({ ...patch })
  const removedColumns = []

  for (let attempt = 1; attempt <= 20; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .update(payload)
      .eq('id', id)
      .select(returning)
      .maybeSingle()

    if (!error) {
      return {
        ok: true,
        table,
        data,
        removedColumns,
        error: null,
        code: null
      }
    }

    const missingColumn = parseMissingColumn(error.message)

    if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
      removedColumns.push(missingColumn)
      const { [missingColumn]: _ignored, ...nextPayload } = payload
      payload = nextPayload
      continue
    }

    if (isMissingColumnError(error)) {
      const optionalColumns = [
        'failed_at',
        'completed_at',
        'updated_at',
        'progress',
        'progress_percent',
        'failed_items',
        'processing_items',
        'queued_items',
        'completed_items',
        'qa_pending_items',
        'metadata',
        'generation_payload',
        'generation_params'
      ]

      const removable = optionalColumns.find((column) => Object.prototype.hasOwnProperty.call(payload, column))

      if (removable) {
        removedColumns.push(removable)
        const { [removable]: _ignored, ...nextPayload } = payload
        payload = nextPayload
        continue
      }
    }

    return {
      ok: false,
      table,
      data: null,
      removedColumns,
      error: error.message,
      code: error.code
    }
  }

  return {
    ok: false,
    table,
    data: null,
    removedColumns,
    error: 'Falha ao atualizar após múltiplas adaptações de schema',
    code: 'ADAPTIVE_UPDATE_EXHAUSTED'
  }
}

const getStatus = (record) => lower(record?.status ?? record?.state ?? '')

const buildStuckPatch = ({ currentMetadata = {}, reason, batchId, batchItemId, queueJobId, note = null } = {}) => ({
  status: 'failed',
  failed_at: nowIso(),
  completed_at: nowIso(),
  updated_at: nowIso(),
  progress: 0,
  progress_percent: 0,
  metadata: {
    ...asObject(currentMetadata),
    sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
    stuck_guard: {
      status: 'marked_failed_stuck',
      reason,
      batchId,
      batchItemId,
      queueJobId,
      note,
      markedAt: nowIso(),
      destructiveDelete: false,
      paymentExecuted: false,
      walletChanged: false,
      publicClientUrlCreated: false
    }
  }
})

export const inspectRealProductionStuckJob = async ({
  batchId = null,
  batchItemId = null,
  queueJobId = null,
  companionId = null,
  combinationId = null,
  stuckThresholdMinutes = Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10)
} = {}) => {
  const audit = await auditRealProductionAfterJob({
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
    stuckThresholdMinutes
  })

  const canMarkFailed = audit.status === 'REAL_JOB_STUCK_QUEUED_OR_RUNNING' &&
    audit.integrity?.critical?.length === 0 &&
    audit.generatedMedia?.variants?.total === 0 &&
    audit.generatedMedia?.generations?.total === 0

  return {
    sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
    name: 'Watchdog de Custo / Job Stuck Guard',
    generatedAt: nowIso(),
    status: canMarkFailed ? 'STUCK_GUARD_READY_TO_MARK_FAILED' : 'STUCK_GUARD_READ_ONLY',
    canMarkFailed,
    target: {
      batchId,
      batchItemId,
      queueJobId,
      companionId,
      combinationId
    },
    audit: {
      status: audit.status,
      batch: audit.batch,
      items: audit.items,
      generatedMedia: audit.generatedMedia,
      queueAudit: audit.queueAudit,
      clientExposureAudit: {
        deliveriesTotal: audit.clientExposureAudit?.deliveries?.total ?? null,
        galleryItemsTotal: audit.clientExposureAudit?.galleryItems?.total ?? null,
        publicUrlDetected: audit.clientExposureAudit?.publicUrlDetected ?? null
      },
      financeAudit: {
        creditLedgerTotal: audit.financeAudit?.creditLedger?.total ?? null
      },
      stuckAnalysis: audit.stuckAnalysis,
      integrity: audit.integrity
    },
    safety: buildSafety()
  }
}

export const markRealProductionStuckJobFailed = async ({
  batchId = null,
  batchItemId = null,
  queueJobId = null,
  companionId = null,
  combinationId = null,
  confirmationPhrase = '',
  apply = false,
  stuckThresholdMinutes = Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10),
  note = null
} = {}) => {
  const inspection = await inspectRealProductionStuckJob({
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
    stuckThresholdMinutes
  })

  const mutationEnvAllowed = toBool(process.env.RUN_6_3I_STUCK_GUARD_MUTATION) && toBool(process.env.ALLOW_6_3I_MARK_STUCK_FAILED)
  const confirmationOk = String(confirmationPhrase ?? '').trim() === REQUIRED_STUCK_GUARD_CONFIRMATION_PHRASE
  const requestedApply = Boolean(apply)

  const blockers = []
  if (!inspection.canMarkFailed) blockers.push('job_not_eligible_for_stuck_failed_mark')
  if (requestedApply && !mutationEnvAllowed) blockers.push('mutation_env_not_allowed')
  if (requestedApply && !confirmationOk) blockers.push('confirmation_phrase_missing_or_invalid')

  if (!requestedApply || blockers.length > 0) {
    return {
      sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
      name: 'Watchdog de Custo / Marcação Segura de Stuck Job',
      status: requestedApply ? 'BLOCKED_BY_STUCK_GUARD' : 'DRY_RUN_READY_TO_MARK_FAILED_IF_ALLOWED',
      dryRun: true,
      requestedApply,
      mutationEnvAllowed,
      confirmationOk,
      requiredConfirmationPhrase: REQUIRED_STUCK_GUARD_CONFIRMATION_PHRASE,
      blockers,
      inspection,
      plannedOperations: inspection.canMarkFailed
        ? [
          {
            target: 'media_generation_batch_items',
            id: batchItemId,
            action: 'mark_failed_stuck',
            willApply: false
          },
          {
            target: 'media_generation_batches',
            id: batchId,
            action: 'mark_failed_stuck',
            willApply: false
          }
        ]
        : [],
      appliedOperations: [],
      safety: buildSafety()
    }
  }

  const batchResult = await safeSelect({
    table: 'media_generation_batches',
    filters: [{ column: 'id', value: batchId }],
    maybeSingle: true,
    limit: 1
  })

  const itemResult = await safeSelect({
    table: 'media_generation_batch_items',
    filters: [{ column: 'id', value: batchItemId }],
    maybeSingle: true,
    limit: 1
  })

  const currentBatchStatus = getStatus(batchResult.data)
  const currentItemStatus = getStatus(itemResult.data)

  if (!RUNNING_STATUSES.has(currentBatchStatus) && !RUNNING_STATUSES.has(currentItemStatus)) {
    return {
      sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
      name: 'Watchdog de Custo / Marcação Segura de Stuck Job',
      status: 'BLOCKED_BY_CURRENT_STATUS_NOT_RUNNING',
      blockers: ['current_status_not_running_or_queued'],
      current: {
        batchStatus: currentBatchStatus,
        itemStatus: currentItemStatus
      },
      inspection,
      appliedOperations: [],
      safety: buildSafety()
    }
  }

  const reason = 'stuck_queued_or_running_after_real_enqueue_without_exact_generated_media'

  const itemPatch = buildStuckPatch({
    currentMetadata: itemResult.data?.metadata,
    reason,
    batchId,
    batchItemId,
    queueJobId,
    note
  })

  const batchPatch = {
    ...buildStuckPatch({
      currentMetadata: batchResult.data?.metadata,
      reason,
      batchId,
      batchItemId,
      queueJobId,
      note
    }),
    failed_items: 1,
    processing_items: 0,
    queued_items: 0
  }

  const itemUpdate = await safeUpdateAdaptive({
    table: 'media_generation_batch_items',
    id: batchItemId,
    patch: itemPatch
  })

  const batchUpdate = await safeUpdateAdaptive({
    table: 'media_generation_batches',
    id: batchId,
    patch: batchPatch
  })

  const postInspection = await inspectRealProductionStuckJob({
    batchId,
    batchItemId,
    queueJobId,
    companionId,
    combinationId,
    stuckThresholdMinutes
  })

  return {
    sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
    name: 'Watchdog de Custo / Marcação Segura de Stuck Job',
    status: itemUpdate.ok && batchUpdate.ok ? 'STUCK_JOB_MARKED_FAILED_CONTROLLED' : 'STUCK_JOB_MARK_FAILED_PARTIAL_OR_FAILED',
    dryRun: false,
    requestedApply,
    mutationEnvAllowed,
    confirmationOk,
    requiredConfirmationPhrase: REQUIRED_STUCK_GUARD_CONFIRMATION_PHRASE,
    blockers: [],
    inspection,
    appliedOperations: [
      {
        target: 'media_generation_batch_items',
        id: batchItemId,
        ok: itemUpdate.ok,
        removedColumns: itemUpdate.removedColumns,
        error: itemUpdate.error,
        code: itemUpdate.code
      },
      {
        target: 'media_generation_batches',
        id: batchId,
        ok: batchUpdate.ok,
        removedColumns: batchUpdate.removedColumns,
        error: batchUpdate.error,
        code: batchUpdate.code
      }
    ],
    postInspection,
    safety: buildSafety({
      databaseMutationExecutedByThisService: itemUpdate.ok || batchUpdate.ok
    })
  }
}

export const getRealProductionWatchdogConfig = () => ({
  sprint: REAL_PRODUCTION_WATCHDOG_SPRINT,
  requiredConfirmationPhrase: REQUIRED_STUCK_GUARD_CONFIRMATION_PHRASE,
  stuckThresholdMinutes: Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10),
  envHints: {
    RUN_6_3I_STUCK_GUARD_MUTATION: toBool(process.env.RUN_6_3I_STUCK_GUARD_MUTATION),
    ALLOW_6_3I_MARK_STUCK_FAILED: toBool(process.env.ALLOW_6_3I_MARK_STUCK_FAILED),
    RUN_6_3A_REAL_E2E: toBool(process.env.RUN_6_3A_REAL_E2E),
    ALLOW_REAL_SINGLE_ITEM_PRODUCTION: toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION),
    ENABLE_REAL_IMAGE_WORKER: toBool(process.env.ENABLE_REAL_IMAGE_WORKER)
  },
  safety: buildSafety()
})
