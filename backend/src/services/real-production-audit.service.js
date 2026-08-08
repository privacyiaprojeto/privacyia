import { supabaseAdmin } from '../config/supabase.js'
import {
  getRealProductionReadiness,
  REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE
} from './real-production-readiness.service.js'

export const REAL_PRODUCTION_AUDIT_SPRINT = '6.3B+6.3I'

const FINAL_OK_STATUSES = new Set(['qa_pending', 'available', 'completed', 'complete', 'done'])
const RUNNING_STATUSES = new Set(['queued', 'pending', 'running', 'processing', 'in_progress'])
const FAILED_STATUSES = new Set(['failed', 'error', 'erro', 'rejected', 'cancelled', 'canceled', 'stuck_failed'])

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

const toBool = (value) => ['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado']
  .includes(String(value ?? '').trim().toLowerCase())

const nowIso = () => new Date().toISOString()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const asArray = (data) => {
  if (!data) return []
  return Array.isArray(data) ? data : [data]
}

const uniqueById = (records = []) => {
  const map = new Map()

  for (const record of records) {
    if (!record) continue
    const key = record.id ?? JSON.stringify(record)
    if (!map.has(key)) map.set(key, record)
  }

  return Array.from(map.values())
}

const pickFirstValue = (record, fields = []) => {
  if (!record) return null

  for (const field of fields) {
    if (hasValue(record[field])) return record[field]
  }

  return null
}

const lower = (value) => String(value ?? '').trim().toLowerCase()

const getRecordStatus = (record = {}) => lower(pickFirstValue(record, [
  'status',
  'state',
  'publication_status',
  'publicationStatus',
  'media_job_status',
  'job_status'
]))

const getStorageKey = (record = {}) => pickFirstValue(record, [
  'storage_key',
  'r2_key',
  'object_key',
  'bucket_key',
  'file_key',
  'path',
  'media_path'
])

const getUrlValue = (record = {}) => pickFirstValue(record, [
  'public_url',
  'url',
  'image_url',
  'media_url',
  'protected_url',
  'protectedViewUrl',
  'view_url'
])

const parseDateMs = (value) => {
  if (!hasValue(value)) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

const ageMsFromDate = (value) => {
  const parsed = parseDateMs(value)
  if (!parsed) return null
  return Math.max(0, Date.now() - parsed)
}

const compactRow = (record = {}) => {
  if (!record) return null

  const createdAt = pickFirstValue(record, ['created_at', 'createdAt', 'queued_at', 'started_at']) ?? null
  const updatedAt = pickFirstValue(record, ['updated_at', 'updatedAt', 'completed_at', 'published_at']) ?? null

  return {
    id: record.id ?? null,
    status: getRecordStatus(record) || null,
    batchId: pickFirstValue(record, ['batch_id', 'media_generation_batch_id', 'generation_batch_id']) ?? null,
    batchItemId: pickFirstValue(record, ['batch_item_id', 'media_generation_batch_item_id', 'generation_batch_item_id']) ?? null,
    companionId: pickFirstValue(record, ['companion_id', 'avatar_id', 'actress_id', 'atriz_id', 'actor_id', 'ator_id']) ?? null,
    combinationId: pickFirstValue(record, ['combination_id', 'media_combination_id']) ?? null,
    variantId: pickFirstValue(record, ['variant_id', 'media_asset_variant_id', 'asset_variant_id']) ?? null,
    requiresQa: pickFirstValue(record, ['requires_qa', 'requiresQa']) ?? null,
    progress: pickFirstValue(record, ['progress', 'percent', 'progress_percent']) ?? null,
    storageKeyPresent: hasValue(getStorageKey(record)),
    urlPresent: hasValue(getUrlValue(record)),
    createdAt,
    updatedAt,
    ageMs: ageMsFromDate(createdAt)
  }
}

const buildSafety = ({ realQueueJobCreated = false, runPodMayBeCalledByWorkerAfterQueue = false } = {}) => ({
  runPodCalledByThisService: false,
  r2RealUploadByThisService: false,
  destructiveDelete: false,
  paymentExecutedByThisService: false,
  walletChangedByThisService: false,
  publicClientUrlCreatedByThisService: false,
  realQueueJobCreated,
  runPodMayBeCalledByWorkerAfterQueue
})

const safeSelect = async ({ table, select = '*', filters = [], limit = 20, maybeSingle = false } = {}) => {
  try {
    let query = supabaseAdmin.from(table).select(select)

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
        table,
        data: maybeSingle ? null : [],
        rows: [],
        error: error.message,
        code: error.code
      }
    }

    const rows = asArray(data)

    return {
      ok: true,
      table,
      data: data ?? (maybeSingle ? null : []),
      rows,
      error: null,
      code: null
    }
  } catch (error) {
    return {
      ok: false,
      table,
      data: maybeSingle ? null : [],
      rows: [],
      error: error?.message ?? 'Erro inesperado ao consultar tabela',
      code: error?.code ?? null
    }
  }
}

const findRowsByCandidateColumns = async ({ table, value, columns = [], limit = 20 } = {}) => {
  if (!hasValue(value)) {
    return {
      ok: false,
      table,
      value: null,
      rows: [],
      total: 0,
      attempts: [],
      error: 'Valor não informado para consulta por colunas candidatas'
    }
  }

  const attempts = []
  const found = []

  for (const column of columns) {
    const result = await safeSelect({
      table,
      filters: [{ column, value }],
      limit
    })

    attempts.push({
      column,
      ok: result.ok,
      total: result.rows.length,
      error: result.error,
      code: result.code
    })

    if (result.ok && result.rows.length > 0) found.push(...result.rows)
  }

  const rows = uniqueById(found)

  return {
    ok: attempts.some((attempt) => attempt.ok),
    table,
    value,
    rows,
    total: rows.length,
    attempts,
    error: rows.length > 0 ? null : 'Nenhum registro encontrado nas colunas candidatas'
  }
}

const findRecordById = async ({ table, id } = {}) => {
  if (!hasValue(id)) {
    return {
      ok: false,
      table,
      rows: [],
      row: null,
      error: 'id não informado'
    }
  }

  const result = await safeSelect({
    table,
    filters: [{ column: 'id', value: id }],
    maybeSingle: true,
    limit: 1
  })

  return {
    ...result,
    row: result.data ?? null,
    rows: asArray(result.data)
  }
}

const scanRecentRows = async ({ table, limit = 5 } = {}) => {
  const result = await safeSelect({ table, limit })

  return {
    ok: result.ok,
    table,
    totalReturned: result.rows.length,
    error: result.error,
    rows: result.rows.map(compactRow)
  }
}

const summarizeRows = ({ table, rows = [], source = null, attempts = [] } = {}) => ({
  table,
  source,
  total: rows.length,
  statuses: rows.map(compactRow),
  attempts
})

const collectStatuses = (...groups) => {
  const statuses = []

  for (const group of groups) {
    for (const row of group ?? []) {
      const status = getRecordStatus(row)
      if (status) statuses.push(status)
    }
  }

  return statuses
}

const hasAnyFinalOk = (rows = []) => rows.some((row) => {
  const status = getRecordStatus(row)
  return FINAL_OK_STATUSES.has(status) || pickFirstValue(row, ['requires_qa', 'requiresQa']) === true
})

const hasAnyFailed = (rows = []) => rows.some((row) => FAILED_STATUSES.has(getRecordStatus(row)))

const hasAnyRunning = (rows = []) => rows.some((row) => RUNNING_STATUSES.has(getRecordStatus(row)))

const buildStuckAnalysis = ({ batch = null, items = [], variants = [], generations = [], thresholdMs = 10 * 60 * 1000 } = {}) => {
  const operationalRows = [batch, ...items].filter(Boolean)
  const runningRows = operationalRows.filter((row) => RUNNING_STATUSES.has(getRecordStatus(row)))
  const failedRows = operationalRows.filter((row) => FAILED_STATUSES.has(getRecordStatus(row)))
  const finalRows = [...variants, ...generations, ...items].filter((row) => {
    const status = getRecordStatus(row)
    return FINAL_OK_STATUSES.has(status) || pickFirstValue(row, ['requires_qa', 'requiresQa']) === true
  })

  const rowAges = runningRows
    .map((row) => {
      const createdAt = pickFirstValue(row, ['created_at', 'createdAt', 'queued_at', 'started_at'])
      return {
        id: row.id ?? null,
        status: getRecordStatus(row),
        createdAt,
        ageMs: ageMsFromDate(createdAt)
      }
    })
    .filter((row) => Number.isFinite(row.ageMs))

  const maxAgeMs = rowAges.length > 0
    ? Math.max(...rowAges.map((row) => row.ageMs))
    : null

  const exactGeneratedMediaFound = variants.length > 0 || generations.length > 0
  const stuck = runningRows.length > 0 && finalRows.length === 0 && !exactGeneratedMediaFound && Number.isFinite(maxAgeMs) && maxAgeMs >= thresholdMs

  return {
    thresholdMs,
    thresholdMinutes: Math.round((thresholdMs / 60000) * 100) / 100,
    runningRows: rowAges,
    failedRows: failedRows.map(compactRow),
    finalRows: finalRows.map(compactRow),
    maxAgeMs,
    maxAgeMinutes: Number.isFinite(maxAgeMs) ? Math.round((maxAgeMs / 60000) * 100) / 100 : null,
    exactGeneratedMediaFound,
    stuck,
    stuckReason: stuck ? 'target_batch_or_item_running_without_exact_generated_media_after_threshold' : null
  }
}

const buildIntegrityFindings = ({
  batch = null,
  items = [],
  variants = [],
  generations = [],
  deliveries = [],
  galleryItems = [],
  creditLedger = [],
  strictTargetOnly = true
} = {}) => {
  const warnings = []
  const critical = []

  if (!batch) warnings.push('batch_not_found')
  if (items.length === 0) warnings.push('batch_item_not_found')
  if (variants.length === 0 && generations.length === 0) warnings.push('no_exact_generated_media_record_found_yet')

  if (deliveries.length > 0) critical.push('client_delivery_created_unexpectedly')
  if (galleryItems.length > 0) critical.push('gallery_item_created_unexpectedly')
  if (creditLedger.length > 0) critical.push('credit_ledger_created_unexpectedly')

  const publicUrlDetected = [...variants, ...generations, ...deliveries, ...galleryItems]
    .some((record) => hasValue(getUrlValue(record)))

  if (publicUrlDetected) critical.push('url_field_detected_review_needed')

  return {
    strictTargetOnly,
    warnings,
    critical,
    okForNoClientExposure: critical.length === 0
  }
}

const loadImageQueue = async () => {
  try {
    const module = await import('../queues/image.queue.js')
    const queue = module.imageQueue || module.default || module.queue

    if (!queue || typeof queue.getJob !== 'function') {
      return {
        ok: false,
        queue: null,
        error: 'imageQueue não foi encontrada ou não possui getJob()'
      }
    }

    return {
      ok: true,
      queue,
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      queue: null,
      error: error?.message ?? 'Não foi possível carregar image.queue.js'
    }
  }
}

const getQueueJobSnapshot = async ({ queueJobId = null } = {}) => {
  if (!hasValue(queueJobId)) {
    return {
      ok: false,
      found: false,
      queueJobId: null,
      state: null,
      name: null,
      attemptsMade: null,
      failedReason: null,
      error: 'queueJobId não informado'
    }
  }

  const queueLoad = await loadImageQueue()

  if (!queueLoad.ok) {
    return {
      ok: false,
      found: false,
      queueJobId,
      state: null,
      name: null,
      attemptsMade: null,
      failedReason: null,
      error: queueLoad.error
    }
  }

  try {
    const job = await queueLoad.queue.getJob(queueJobId)

    if (!job) {
      return {
        ok: true,
        found: false,
        queueJobId,
        state: null,
        name: null,
        attemptsMade: null,
        failedReason: null,
        error: null
      }
    }

    const state = typeof job.getState === 'function' ? await job.getState() : null

    return {
      ok: true,
      found: true,
      queueJobId,
      state,
      name: job.name ?? null,
      attemptsMade: job.attemptsMade ?? null,
      failedReason: job.failedReason ?? null,
      timestamp: job.timestamp ?? null,
      processedOn: job.processedOn ?? null,
      finishedOn: job.finishedOn ?? null,
      error: null
    }
  } catch (error) {
    return {
      ok: false,
      found: false,
      queueJobId,
      state: null,
      name: null,
      attemptsMade: null,
      failedReason: null,
      error: error?.message ?? 'Erro ao consultar job na fila'
    }
  }
}

export const auditRealProductionBeforeRun = async ({
  companionId = null,
  actorId = null,
  combinationId = null,
  requestedQuantity = 1,
  confirmationPhrase = '',
  includeRecentSnapshot = true
} = {}) => {
  const readiness = await getRealProductionReadiness({
    mode: 'real',
    requestedQuantity,
    companionId,
    actorId,
    combinationId,
    confirmationPhrase
  })

  const recentSnapshot = includeRecentSnapshot
    ? {
      batches: await scanRecentRows({ table: 'media_generation_batches', limit: 5 }),
      batchItems: await scanRecentRows({ table: 'media_generation_batch_items', limit: 5 }),
      variants: await scanRecentRows({ table: 'media_asset_variants', limit: 5 }),
      deliveries: await scanRecentRows({ table: 'user_media_deliveries', limit: 5 }),
      galleryItems: await scanRecentRows({ table: 'gallery_items', limit: 5 }),
      creditLedger: await scanRecentRows({ table: 'credit_ledger', limit: 5 })
    }
    : null

  return {
    sprint: REAL_PRODUCTION_AUDIT_SPRINT,
    name: 'Auditoria Pré-RunPod / Pré-Job Real',
    generatedAt: nowIso(),
    status: readiness.canStartReal ? 'READY_BUT_AUDIT_ONLY' : 'BLOCKED_BY_READINESS',
    canQueueRealJobAccordingToReadiness: readiness.canStartReal,
    requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
    selected: readiness.selected,
    readiness: {
      status: readiness.status,
      canStartSafe: readiness.canStartSafe,
      canStartReal: readiness.canStartReal,
      blockers: readiness.blockers,
      warnings: readiness.warnings,
      totalChecks: readiness.summary?.totalChecks ?? readiness.totalChecks ?? null,
      passed: readiness.summary?.passed ?? readiness.passed ?? null
    },
    recentSnapshot,
    safety: buildSafety({
      realQueueJobCreated: false,
      runPodMayBeCalledByWorkerAfterQueue: false
    }),
    notes: [
      'Esta auditoria é somente leitura.',
      'Ela não cria batch, não enfileira job, não chama RunPod, não usa R2, não cobra, não altera carteira e não deleta.'
    ]
  }
}

export const auditRealProductionAfterJob = async ({
  batchId = null,
  batchItemId = null,
  queueJobId = null,
  companionId = null,
  combinationId = null,
  stuckThresholdMinutes = Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10)
} = {}) => {
  const stuckThresholdMs = Math.max(1, Number(stuckThresholdMinutes) || 10) * 60 * 1000

  const batchResult = await findRecordById({ table: 'media_generation_batches', id: batchId })

  const itemsById = await findRecordById({ table: 'media_generation_batch_items', id: batchItemId })
  const itemsByBatchId = await findRowsByCandidateColumns({
    table: 'media_generation_batch_items',
    value: batchId,
    columns: ['batch_id', 'media_generation_batch_id', 'generation_batch_id'],
    limit: 20
  })

  const items = uniqueById([
    ...itemsById.rows,
    ...itemsByBatchId.rows
  ])

  const effectiveBatchItemIds = uniqueById(items).map((item) => item.id).filter(Boolean)
  if (hasValue(batchItemId) && !effectiveBatchItemIds.includes(batchItemId)) effectiveBatchItemIds.push(batchItemId)

  const variantQueries = []
  const generationQueries = []
  const deliveryQueries = []
  const galleryQueries = []
  const ledgerQueries = []

  if (hasValue(batchId)) {
    variantQueries.push(await findRowsByCandidateColumns({
      table: 'media_asset_variants',
      value: batchId,
      columns: ['batch_id', 'media_generation_batch_id', 'generation_batch_id'],
      limit: 20
    }))

    generationQueries.push(await findRowsByCandidateColumns({
      table: 'media_generations',
      value: batchId,
      columns: ['batch_id', 'media_generation_batch_id', 'generation_batch_id'],
      limit: 20
    }))

    ledgerQueries.push(await findRowsByCandidateColumns({
      table: 'credit_ledger',
      value: batchId,
      columns: ['reference_id', 'batch_id', 'media_generation_batch_id'],
      limit: 20
    }))
  }

  for (const id of effectiveBatchItemIds) {
    variantQueries.push(await findRowsByCandidateColumns({
      table: 'media_asset_variants',
      value: id,
      columns: ['batch_item_id', 'media_generation_batch_item_id', 'generation_batch_item_id', 'item_id'],
      limit: 20
    }))

    generationQueries.push(await findRowsByCandidateColumns({
      table: 'media_generations',
      value: id,
      columns: ['batch_item_id', 'media_generation_batch_item_id', 'generation_batch_item_id', 'media_job_id', 'job_id'],
      limit: 20
    }))

    ledgerQueries.push(await findRowsByCandidateColumns({
      table: 'credit_ledger',
      value: id,
      columns: ['reference_id', 'batch_item_id', 'media_generation_batch_item_id'],
      limit: 20
    }))
  }

  const variants = uniqueById(variantQueries.flatMap((query) => query.rows))
  const generations = uniqueById(generationQueries.flatMap((query) => query.rows))

  const variantIds = variants.map((variant) => variant.id).filter(Boolean)
  const generationIds = generations.map((generation) => generation.id).filter(Boolean)

  for (const id of [...variantIds, ...generationIds]) {
    deliveryQueries.push(await findRowsByCandidateColumns({
      table: 'user_media_deliveries',
      value: id,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20
    }))

    galleryQueries.push(await findRowsByCandidateColumns({
      table: 'gallery_items',
      value: id,
      columns: ['variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20
    }))

    ledgerQueries.push(await findRowsByCandidateColumns({
      table: 'credit_ledger',
      value: id,
      columns: ['reference_id', 'variant_id', 'media_asset_variant_id', 'asset_variant_id', 'media_generation_id', 'generation_id'],
      limit: 20
    }))
  }

  if (hasValue(queueJobId)) {
    ledgerQueries.push(await findRowsByCandidateColumns({
      table: 'credit_ledger',
      value: queueJobId,
      columns: ['reference_id', 'job_id', 'queue_job_id'],
      limit: 20
    }))
  }

  const deliveries = uniqueById(deliveryQueries.flatMap((query) => query.rows))
  const galleryItems = uniqueById(galleryQueries.flatMap((query) => query.rows))
  const creditLedger = uniqueById(ledgerQueries.flatMap((query) => query.rows))
  const queueJob = await getQueueJobSnapshot({ queueJobId })

  const allOperationalRows = [
    ...batchResult.rows,
    ...items,
    ...variants,
    ...generations
  ]

  const stuckAnalysis = buildStuckAnalysis({
    batch: batchResult.row,
    items,
    variants,
    generations,
    thresholdMs: stuckThresholdMs
  })

  const findings = buildIntegrityFindings({
    batch: batchResult.row,
    items,
    variants,
    generations,
    deliveries,
    galleryItems,
    creditLedger,
    strictTargetOnly: true
  })

  const status = findings.critical.length > 0
    ? 'CRITICAL_REVIEW_NEEDED'
    : stuckAnalysis.stuck
      ? 'REAL_JOB_STUCK_QUEUED_OR_RUNNING'
      : hasAnyFinalOk([...variants, ...generations, ...items])
        ? 'REAL_JOB_REACHED_QA_OR_COMPLETED_STATE'
        : hasAnyFailed(allOperationalRows)
          ? 'REAL_JOB_FAILED_OR_REJECTED'
          : hasAnyRunning(allOperationalRows)
            ? 'REAL_JOB_STILL_RUNNING_OR_QUEUED'
            : batchResult.row || items.length > 0 || variants.length > 0 || generations.length > 0
              ? 'POST_JOB_AUDIT_READ_ONLY'
              : 'AUDIT_TARGET_NOT_FOUND'

  return {
    sprint: REAL_PRODUCTION_AUDIT_SPRINT,
    name: 'Auditoria Pós-Job Real / Pós-RunPod — Strict Target Only',
    generatedAt: nowIso(),
    status,
    target: {
      batchId,
      batchItemId,
      queueJobId,
      companionId,
      combinationId
    },
    batch: {
      ok: batchResult.ok,
      error: batchResult.error,
      row: compactRow(batchResult.row)
    },
    items: summarizeRows({
      table: 'media_generation_batch_items',
      rows: items,
      source: 'id/batch_id',
      attempts: [...itemsByBatchId.attempts]
    }),
    generatedMedia: {
      strictTargetOnly: true,
      variants: summarizeRows({
        table: 'media_asset_variants',
        rows: variants,
        source: 'batch/batch_item_exact_only',
        attempts: variantQueries.flatMap((query) => query.attempts ?? [])
      }),
      generations: summarizeRows({
        table: 'media_generations',
        rows: generations,
        source: 'batch/batch_item/job_exact_only',
        attempts: generationQueries.flatMap((query) => query.attempts ?? [])
      })
    },
    queueAudit: queueJob,
    clientExposureAudit: {
      deliveries: summarizeRows({
        table: 'user_media_deliveries',
        rows: deliveries,
        source: 'exact_variant/generation_only',
        attempts: deliveryQueries.flatMap((query) => query.attempts ?? [])
      }),
      galleryItems: summarizeRows({
        table: 'gallery_items',
        rows: galleryItems,
        source: 'exact_variant/generation_only',
        attempts: galleryQueries.flatMap((query) => query.attempts ?? [])
      }),
      publicUrlDetected: [...variants, ...generations, ...deliveries, ...galleryItems]
        .some((record) => hasValue(getUrlValue(record)))
    },
    financeAudit: {
      creditLedger: summarizeRows({
        table: 'credit_ledger',
        rows: creditLedger,
        source: 'batch/batch_item/exact_variant/generation/job',
        attempts: ledgerQueries.flatMap((query) => query.attempts ?? [])
      })
    },
    statusSignals: {
      strictTargetOnly: true,
      statuses: collectStatuses(batchResult.rows, items, variants, generations),
      hasQaOrCompleted: hasAnyFinalOk([...variants, ...generations, ...items]),
      hasFailed: hasAnyFailed(allOperationalRows),
      hasRunning: hasAnyRunning(allOperationalRows)
    },
    stuckAnalysis,
    integrity: findings,
    safety: buildSafety({
      realQueueJobCreated: false,
      runPodMayBeCalledByWorkerAfterQueue: false
    }),
    notes: [
      'Esta auditoria é somente leitura.',
      'Sprint 6.3I: sucesso só é reconhecido se houver mídia gerada ligada ao batchId/batchItemId exato.',
      'Assets antigos por companionId/combinationId não contam como sucesso deste job.',
      'A presença de delivery, gallery item, ledger ou URL vinculados ao alvo indica revisão crítica, pois a produção 6.3A não deve vender nem expor cliente.'
    ]
  }
}

export const pollRealProductionAfterJobAudit = async ({
  batchId = null,
  batchItemId = null,
  queueJobId = null,
  companionId = null,
  combinationId = null,
  timeoutMs = 180000,
  intervalMs = 5000,
  stuckThresholdMinutes = Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10)
} = {}) => {
  const startedAt = Date.now()
  let lastAudit = null

  while (Date.now() - startedAt <= timeoutMs) {
    lastAudit = await auditRealProductionAfterJob({
      batchId,
      batchItemId,
      queueJobId,
      companionId,
      combinationId,
      stuckThresholdMinutes
    })

    if ([
      'REAL_JOB_REACHED_QA_OR_COMPLETED_STATE',
      'REAL_JOB_FAILED_OR_REJECTED',
      'REAL_JOB_STUCK_QUEUED_OR_RUNNING',
      'CRITICAL_REVIEW_NEEDED'
    ].includes(lastAudit.status)) {
      return {
        ...lastAudit,
        polling: {
          completed: true,
          elapsedMs: Date.now() - startedAt,
          timeoutMs,
          intervalMs
        }
      }
    }

    await sleep(intervalMs)
  }

  return {
    ...(lastAudit ?? {}),
    sprint: REAL_PRODUCTION_AUDIT_SPRINT,
    status: lastAudit?.status ?? 'POLL_TIMEOUT_WITHOUT_AUDIT',
    polling: {
      completed: false,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      intervalMs
    },
    safety: lastAudit?.safety ?? buildSafety()
  }
}

export const getRealProductionAuditConfig = () => ({
  sprint: REAL_PRODUCTION_AUDIT_SPRINT,
  requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
  mode: 'strict_target_only_6_3I',
  strictTargetOnly: true,
  stuckThresholdMinutes: Number(process.env.REAL_PRODUCTION_STUCK_THRESHOLD_MINUTES || 10),
  envHints: {
    RUN_6_3A_REAL_E2E: toBool(process.env.RUN_6_3A_REAL_E2E),
    ALLOW_REAL_SINGLE_ITEM_PRODUCTION: toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION),
    ENABLE_REAL_IMAGE_WORKER: [
      process.env.ENABLE_REAL_IMAGE_WORKER,
      process.env.REAL_IMAGE_WORKER,
      process.env.FACTORY_REAL_IMAGE_WORKER,
      process.env.RUNPOD_REAL_IMAGE_WORKER
    ].some(toBool)
  },
  safety: buildSafety()
})
