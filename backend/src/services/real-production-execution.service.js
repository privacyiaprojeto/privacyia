import { supabaseAdmin } from '../config/supabase.js'
import {
  getRealProductionReadiness,
  REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE
} from './real-production-readiness.service.js'

export { REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE }

export const REAL_PRODUCTION_EXECUTION_SPRINT = '6.3A'
export const REAL_PRODUCTION_JOB_NAME = process.env.FACTORY_REAL_IMAGE_JOB_NAME || 'factory.real.image.item'

// Sprint 6.3H: o schema atual de media_generation_batches aceita batch_type apenas em:
// factory, restock, rework, admin_test, premium_studio.
// Para a primeira produção real controlada da Fábrica, o tipo canônico é factory.
const ALLOWED_REAL_PRODUCTION_BATCH_TYPES = new Set(['factory', 'restock', 'rework', 'admin_test', 'premium_studio'])

const resolveRealProductionBatchType = () => {
  const requested = String(process.env.REAL_PRODUCTION_BATCH_TYPE || '').trim()

  if (ALLOWED_REAL_PRODUCTION_BATCH_TYPES.has(requested)) return requested

  return 'factory'
}

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])

const toBool = (value) => TRUTHY.has(String(value ?? '').trim().toLowerCase())

const hasValue = (value) => {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

const nowIso = () => new Date().toISOString()

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const pickFirstValue = (record, fields = []) => {
  if (!record) return null

  for (const field of fields) {
    if (hasValue(record[field])) return record[field]
  }

  return null
}

const buildSafety = ({ runPodMayBeCalledByWorkerAfterQueue = false, realQueueJobCreated = false } = {}) => ({
  runPodCalledByThisService: false,
  r2RealUploadByThisService: false,
  destructiveDelete: false,
  paymentExecuted: false,
  walletChanged: false,
  publicClientUrlCreated: false,
  realQueueJobCreated,
  runPodMayBeCalledByWorkerAfterQueue
})

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

const loadImageQueue = async () => {
  try {
    const module = await import('../queues/image.queue.js')
    const queue = module.imageQueue || module.default || module.queue

    if (!queue || typeof queue.add !== 'function') {
      return {
        ok: false,
        queue: null,
        error: 'imageQueue não foi encontrada ou não possui método add()'
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

const CANONICAL_EXECUTABLE_ITEM_STATUSES = ['planned', 'approved_to_queue', 'queued']
const CANONICAL_IN_FLIGHT_ITEM_STATUSES = new Set(['processing', 'running'])
const CANONICAL_FINAL_ITEM_STATUSES = new Set(['qa_pending', 'completed', 'available', 'failed', 'rejected', 'cancelled'])

const normalizeStatus = (value) => String(value ?? '').trim().toLowerCase()

const getItemCombinationId = (item = {}) => pickFirstValue(item, [
  'combination_id',
  'media_combination_id',
  'combinationId',
  'mediaCombinationId'
])

const getItemCompanionId = (item = {}, batch = {}) => pickFirstValue(item, [
  'companion_id',
  'avatar_id',
  'companionId',
  'avatarId'
]) || pickFirstValue(batch, [
  'companion_id',
  'avatar_id',
  'companionId',
  'avatarId'
])

const getItemActorId = (item = {}, batch = {}) => pickFirstValue(item, [
  'actor_profile_id',
  'actor_id',
  'atriz_id',
  'actress_id',
  'actorProfileId'
]) || pickFirstValue(batch, [
  'actor_profile_id',
  'actor_id',
  'atriz_id',
  'actress_id',
  'actorProfileId'
])

const loadCanonicalExecutionContext = async ({ batchId, batchItemId } = {}) => {
  if (!hasValue(batchId) || !hasValue(batchItemId)) {
    return {
      ok: false,
      status: 'BATCH_AND_ITEM_IDS_REQUIRED',
      reason: 'batchId e batchItemId existentes são obrigatórios para executar o contrato canônico da fábrica.',
      batch: null,
      batchItem: null,
    }
  }

  const [batchResult, itemResult] = await Promise.all([
    safeSelect({
      table: 'media_generation_batches',
      filters: [{ column: 'id', value: batchId }],
      maybeSingle: true,
    }),
    safeSelect({
      table: 'media_generation_batch_items',
      filters: [{ column: 'id', value: batchItemId }],
      maybeSingle: true,
    }),
  ])

  if (!batchResult.ok || !batchResult.data) {
    return {
      ok: false,
      status: 'CANONICAL_BATCH_NOT_FOUND',
      reason: 'O lote planejado informado não foi encontrado.',
      batch: null,
      batchItem: itemResult.data || null,
      details: batchResult,
    }
  }

  if (!itemResult.ok || !itemResult.data) {
    return {
      ok: false,
      status: 'CANONICAL_BATCH_ITEM_NOT_FOUND',
      reason: 'O item físico planejado informado não foi encontrado.',
      batch: batchResult.data,
      batchItem: null,
      details: itemResult,
    }
  }

  const batch = batchResult.data
  const batchItem = itemResult.data

  if (String(batchItem.batch_id || '') !== String(batchId)) {
    return {
      ok: false,
      status: 'BATCH_ITEM_SCOPE_MISMATCH',
      reason: 'O item informado não pertence ao lote informado.',
      batch,
      batchItem,
    }
  }

  const requestedVariants = Math.max(Number(batchItem.requested_variants || 1) || 1, 1)
  const variantNumber = Math.max(Number(batchItem.variant_number || 1) || 1, 1)
  const generatedVariants = Math.max(Number(batchItem.generated_variants || 0) || 0, 0)
  const status = normalizeStatus(batchItem.status)

  if (requestedVariants !== 1) {
    return {
      ok: false,
      status: 'LEGACY_MULTI_VARIANT_ITEM_BLOCKED',
      reason: 'Este item pertence ao modelo legado com múltiplas variações em uma única linha. Gere um novo lote no modelo canônico.',
      batch,
      batchItem,
      canonical: {
        requestedVariants,
        variantNumber,
        expectedRequestedVariants: 1,
      },
    }
  }

  if (generatedVariants > 0 || CANONICAL_FINAL_ITEM_STATUSES.has(status)) {
    return {
      ok: false,
      status: 'BATCH_ITEM_ALREADY_FINALIZED',
      reason: 'O item físico já possui resultado ou atingiu um estado final e não pode ser enfileirado novamente nesta rota.',
      batch,
      batchItem,
      canonical: {
        requestedVariants,
        variantNumber,
        generatedVariants,
        status,
      },
    }
  }

  return {
    ok: true,
    status: 'CANONICAL_BATCH_ITEM_READY',
    reason: null,
    batch,
    batchItem,
    canonical: {
      requestedVariants,
      variantNumber,
      generatedVariants,
      status,
      combinationId: getItemCombinationId(batchItem),
      companionId: getItemCompanionId(batchItem, batch),
      actorId: getItemActorId(batchItem, batch),
      queueJobId: pickFirstValue(batchItem, ['queue_job_id', 'queueJobId']),
      idempotencyKey: pickFirstValue(batchItem, ['idempotency_key', 'idempotencyKey']),
    },
  }
}

const refreshCanonicalBatchProgress = async (batchId) => {
  if (!hasValue(batchId)) return null

  const { data: rows, error } = await supabaseAdmin
    .from('media_generation_batch_items')
    .select('id,status')
    .eq('batch_id', batchId)

  if (error) {
    return {
      ok: false,
      error: error.message,
    }
  }

  const counters = {
    total: 0,
    queued: 0,
    processing: 0,
    qaPending: 0,
    completed: 0,
    failed: 0,
  }

  for (const row of rows || []) {
    const status = normalizeStatus(row.status)
    counters.total += 1

    if (['planned', 'approved_to_queue', 'queued'].includes(status)) counters.queued += 1
    else if (['processing', 'running'].includes(status)) counters.processing += 1
    else if (status === 'qa_pending') counters.qaPending += 1
    else if (['completed', 'available'].includes(status)) counters.completed += 1
    else if (['failed', 'rejected', 'cancelled'].includes(status)) counters.failed += 1
  }

  let batchStatus = 'planned'

  if (counters.processing > 0) batchStatus = 'processing'
  else if (counters.queued > 0) batchStatus = 'approved_to_queue'
  else if (counters.qaPending > 0) batchStatus = 'qa_pending'
  else if (counters.failed > 0 && counters.completed === 0) batchStatus = 'failed'
  else if (counters.total > 0 && counters.completed + counters.failed === counters.total) batchStatus = 'completed'

  const payload = {
    status: batchStatus,
    total_items: counters.total,
    total_count: counters.total,
    queued_items: counters.queued,
    processing_items: counters.processing,
    qa_pending_items: counters.qaPending,
    completed_items: counters.completed,
    failed_items: counters.failed,
    updated_at: nowIso(),
    ...(counters.processing > 0 ? { started_at: nowIso() } : {}),
  }

  const { data, error: updateError } = await supabaseAdmin
    .from('media_generation_batches')
    .update(payload)
    .eq('id', batchId)
    .select('*')
    .maybeSingle()

  return {
    ok: !updateError,
    error: updateError?.message || null,
    data: data || null,
    counters,
  }
}

const claimCanonicalBatchItem = async ({
  context,
  queueJobId,
  queueJobName,
  adminProfileId,
  metadata,
}) => {
  const batchItem = context.batchItem
  const currentMetadata = batchItem.metadata && typeof batchItem.metadata === 'object' && !Array.isArray(batchItem.metadata)
    ? batchItem.metadata
    : {}
  const timestamp = nowIso()
  const idempotencyKey = context.canonical.idempotencyKey || `factory-real:${context.batch.id}:${batchItem.id}`

  const payload = {
    status: 'processing',
    queue_job_id: queueJobId,
    queue_job_name: queueJobName,
    idempotency_key: idempotencyKey,
    queued_at: timestamp,
    processing_started_at: timestamp,
    updated_at: timestamp,
    metadata: {
      ...currentMetadata,
      canonicalExecution: {
        contract: 'one_item_one_physical_variant',
        batchId: context.batch.id,
        batchItemId: batchItem.id,
        variantNumber: context.canonical.variantNumber,
        queueJobId,
        queueJobName,
        requestedBy: adminProfileId,
        claimedAt: timestamp,
        ...metadata,
      },
    },
  }

  const { data, error } = await supabaseAdmin
    .from('media_generation_batch_items')
    .update(payload)
    .eq('id', batchItem.id)
    .eq('batch_id', context.batch.id)
    .in('status', CANONICAL_EXECUTABLE_ITEM_STATUSES)
    .select('*')
    .maybeSingle()

  if (error) {
    return {
      ok: false,
      status: 'FAILED_TO_CLAIM_BATCH_ITEM',
      reason: 'Não foi possível reservar o item físico para a fila.',
      error: error.message,
      data: null,
    }
  }

  if (!data) {
    return {
      ok: false,
      status: 'BATCH_ITEM_ALREADY_CLAIMED',
      reason: 'O item foi reservado por outro processo ou não está mais em estado executável.',
      error: null,
      data: null,
    }
  }

  return {
    ok: true,
    status: 'BATCH_ITEM_CLAIMED',
    reason: null,
    error: null,
    data,
    previousStatus: normalizeStatus(batchItem.status),
    idempotencyKey,
  }
}

const rollbackCanonicalBatchItemClaim = async ({ context, claim, error }) => {
  if (!claim?.ok || !context?.batchItem?.id) return null

  const currentMetadata = claim.data?.metadata && typeof claim.data.metadata === 'object' && !Array.isArray(claim.data.metadata)
    ? claim.data.metadata
    : {}

  const { data, error: rollbackError } = await supabaseAdmin
    .from('media_generation_batch_items')
    .update({
      status: claim.previousStatus || 'planned',
      queue_job_id: null,
      queue_job_name: null,
      queued_at: null,
      processing_started_at: null,
      updated_at: nowIso(),
      metadata: {
        ...currentMetadata,
        canonicalQueueFailure: {
          message: String(error?.message || error || 'Falha ao adicionar job à fila.').slice(0, 1000),
          failedAt: nowIso(),
        },
      },
    })
    .eq('id', context.batchItem.id)
    .eq('batch_id', context.batch.id)
    .select('*')
    .maybeSingle()

  return {
    ok: !rollbackError,
    data: data || null,
    error: rollbackError?.message || null,
  }
}

export const previewRealSingleItemExecution = async ({
  batchId = null,
  batchItemId = null,
  companionId = null,
  actorId = null,
  combinationId = null,
  confirmationPhrase = '',
  requestedQuantity = 1
} = {}) => {
  const context = await loadCanonicalExecutionContext({ batchId, batchItemId })

  if (!context.ok) {
    return {
      sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
      name: 'Execução Real Canônica de 1 Item Físico',
      status: 'BLOCKED_BY_CANONICAL_CONTRACT',
      canQueueRealJob: false,
      queued: false,
      reason: context.reason,
      canonicalContext: context,
      requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
      safety: buildSafety(),
    }
  }

  const effectiveCompanionId = companionId || context.canonical.companionId
  const effectiveActorId = actorId || context.canonical.actorId
  const effectiveCombinationId = combinationId || context.canonical.combinationId

  if (
    (companionId && String(companionId) !== String(context.canonical.companionId)) ||
    (combinationId && String(combinationId) !== String(context.canonical.combinationId))
  ) {
    return {
      sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
      name: 'Execução Real Canônica de 1 Item Físico',
      status: 'BLOCKED_BY_SCOPE_MISMATCH',
      canQueueRealJob: false,
      queued: false,
      reason: 'Os IDs de companion/combinação do payload não correspondem ao item físico selecionado.',
      canonicalContext: context,
      requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
      safety: buildSafety(),
    }
  }

  const readiness = await getRealProductionReadiness({
    mode: 'real',
    requestedQuantity,
    companionId: effectiveCompanionId,
    actorId: effectiveActorId,
    combinationId: effectiveCombinationId,
    confirmationPhrase
  })

  const itemStatus = normalizeStatus(context.batchItem.status)
  const alreadyInFlight = CANONICAL_IN_FLIGHT_ITEM_STATUSES.has(itemStatus) && hasValue(context.canonical.queueJobId)
  const executableStatus = CANONICAL_EXECUTABLE_ITEM_STATUSES.includes(itemStatus)

  return {
    sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
    name: 'Execução Real Canônica de 1 Item Físico',
    status: alreadyInFlight
      ? 'ALREADY_QUEUED_OR_PROCESSING'
      : readiness.canStartReal && executableStatus
        ? 'READY_TO_QUEUE_EXISTING_BATCH_ITEM'
        : 'BLOCKED_BY_READINESS',
    canQueueRealJob: readiness.canStartReal && executableStatus,
    queued: alreadyInFlight,
    reason: alreadyInFlight
      ? 'O item físico já possui job associado e está em processamento.'
      : executableStatus
        ? null
        : `Status atual do item não é executável: ${itemStatus || 'desconhecido'}.`,
    readiness,
    requiredConfirmationPhrase: REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
    selected: {
      ...readiness.selected,
      batchId: context.batch.id,
      batchItemId: context.batchItem.id,
      variantNumber: context.canonical.variantNumber,
    },
    batch: context.batch,
    batchItem: context.batchItem,
    canonicalContext: context.canonical,
    safety: buildSafety({
      runPodMayBeCalledByWorkerAfterQueue: readiness.safety.runPodMayBeCalledByWorkerAfterQueue,
      realQueueJobCreated: false
    })
  }
}

export const executeRealSingleItemProduction = async ({
  batchId = null,
  batchItemId = null,
  companionId = null,
  actorId = null,
  combinationId = null,
  confirmationPhrase = '',
  requestedQuantity = 1,
  adminProfileId = null,
  executeQueue = false,
  metadata = {}
} = {}) => {
  const preview = await previewRealSingleItemExecution({
    batchId,
    batchItemId,
    companionId,
    actorId,
    combinationId,
    confirmationPhrase,
    requestedQuantity,
  })

  if (preview.status === 'ALREADY_QUEUED_OR_PROCESSING') {
    return {
      ...preview,
      queued: true,
      queueJob: {
        id: preview.canonicalContext?.queueJobId || null,
        name: preview.batchItem?.queue_job_name || REAL_PRODUCTION_JOB_NAME,
        batchId: preview.batch?.id || batchId,
        batchItemId: preview.batchItem?.id || batchItemId,
      },
    }
  }

  if (!preview.canQueueRealJob) {
    return {
      ...preview,
      queued: false,
      queueJob: null,
    }
  }

  if (!executeQueue) {
    return {
      ...preview,
      status: 'READY_NOT_QUEUED',
      queued: false,
      reason: 'Checklist aprovado, mas executeQueue=false. O item planejado permanece intacto.',
      queueJob: null,
      safety: buildSafety(),
    }
  }

  const hardEnvLocks = {
    ALLOW_REAL_SINGLE_ITEM_PRODUCTION: toBool(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION),
    ENABLE_REAL_IMAGE_WORKER: [
      process.env.ENABLE_REAL_IMAGE_WORKER,
      process.env.REAL_IMAGE_WORKER,
      process.env.FACTORY_REAL_IMAGE_WORKER,
      process.env.RUNPOD_REAL_IMAGE_WORKER
    ].some(toBool),
    RUN_6_3A_REAL_E2E: toBool(process.env.RUN_6_3A_REAL_E2E),
    confirmationPhraseValid: String(confirmationPhrase ?? '').trim() === REQUIRED_REAL_PRODUCTION_CONFIRMATION_PHRASE,
    requestedQuantityValid: Number(requestedQuantity) === 1
  }

  if (!Object.values(hardEnvLocks).every(Boolean)) {
    return {
      ...preview,
      status: 'BLOCKED_BY_HARD_LOCKS',
      queued: false,
      reason: 'As travas finais de execução real não foram todas armadas. O item planejado não foi alterado.',
      hardEnvLocks,
      queueJob: null,
      safety: buildSafety(),
    }
  }

  const queueLoad = await loadImageQueue()

  if (!queueLoad.ok) {
    return {
      ...preview,
      status: 'FAILED_TO_LOAD_FACTORY_QUEUE',
      queued: false,
      reason: 'A fila isolada de imagem não pôde ser carregada. O item planejado não foi alterado.',
      queueError: queueLoad.error,
      hardEnvLocks,
      queueJob: null,
      safety: buildSafety(),
    }
  }

  const context = await loadCanonicalExecutionContext({ batchId, batchItemId })

  if (!context.ok) {
    return {
      ...preview,
      status: 'BLOCKED_BY_CANONICAL_CONTRACT',
      queued: false,
      reason: context.reason,
      canonicalContext: context,
      hardEnvLocks,
      queueJob: null,
      safety: buildSafety(),
    }
  }

  const queueJobId = `factory-real-canonical-${context.batchItem.id}`
  const claim = await claimCanonicalBatchItem({
    context,
    queueJobId,
    queueJobName: REAL_PRODUCTION_JOB_NAME,
    adminProfileId,
    metadata,
  })

  if (!claim.ok) {
    const latestContext = await loadCanonicalExecutionContext({ batchId, batchItemId })

    if (
      latestContext.ok &&
      CANONICAL_IN_FLIGHT_ITEM_STATUSES.has(normalizeStatus(latestContext.batchItem.status)) &&
      hasValue(latestContext.canonical.queueJobId)
    ) {
      return {
        ...preview,
        status: 'ALREADY_QUEUED_OR_PROCESSING',
        queued: true,
        reason: 'O item físico já foi reservado por outra solicitação.',
        hardEnvLocks,
        batch: latestContext.batch,
        batchItem: latestContext.batchItem,
        canonicalContext: latestContext.canonical,
        queueJob: {
          id: latestContext.canonical.queueJobId,
          name: latestContext.batchItem.queue_job_name || REAL_PRODUCTION_JOB_NAME,
          batchId: latestContext.batch.id,
          batchItemId: latestContext.batchItem.id,
        },
        safety: buildSafety({
          runPodMayBeCalledByWorkerAfterQueue: true,
          realQueueJobCreated: false,
        }),
      }
    }

    return {
      ...preview,
      status: claim.status,
      queued: false,
      reason: claim.reason,
      claimError: claim.error,
      hardEnvLocks,
      queueJob: null,
      safety: buildSafety(),
    }
  }

  await refreshCanonicalBatchProgress(context.batch.id)

  const jobPayload = {
    sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
    batchId: context.batch.id,
    batchItemId: context.batchItem.id,
    companionId: context.canonical.companionId,
    combinationId: context.canonical.combinationId,
    variantNumber: context.canonical.variantNumber,
    requestedVariants: 1,
    requestedQuantity: 1,
    idempotencyKey: claim.idempotencyKey,
    mode: 'real_single_item_controlled',
    batchType: resolveRealProductionBatchType(),
    realImageWorker: true,
    runPodAllowed: true,
    uploadToR2: true,
    publicClientUrlAllowed: false,
    paymentAllowed: false,
    walletChangeAllowed: false,
    destructiveDeleteAllowed: false,
    source: 'admin_real_production_canonical',
    metadata: {
      ...metadata,
      canonicalItemModel: 'one_item_one_physical_variant',
      originalBatchId: context.batch.id,
      originalBatchItemId: context.batchItem.id,
    },
  }

  let job

  try {
    job = await queueLoad.queue.add(
      REAL_PRODUCTION_JOB_NAME,
      jobPayload,
      {
        jobId: queueJobId,
        removeOnComplete: false,
        removeOnFail: false,
        attempts: 1
      }
    )
  } catch (error) {
    const rollback = await rollbackCanonicalBatchItemClaim({ context, claim, error })
    await refreshCanonicalBatchProgress(context.batch.id)

    return {
      ...preview,
      status: 'FAILED_TO_QUEUE_EXISTING_BATCH_ITEM',
      queued: false,
      reason: 'O item foi reservado, mas o BullMQ recusou o job. A reserva foi revertida.',
      queueError: error?.message || 'Falha desconhecida ao adicionar job.',
      rollback,
      hardEnvLocks,
      batch: context.batch,
      batchItem: rollback?.data || context.batchItem,
      queueJob: null,
      safety: buildSafety(),
    }
  }

  const refreshedContext = await loadCanonicalExecutionContext({ batchId, batchItemId })
  const batchProgress = await refreshCanonicalBatchProgress(context.batch.id)

  return {
    sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
    name: 'Execução Real Canônica de 1 Item Físico',
    status: 'EXISTING_BATCH_ITEM_QUEUED',
    queued: true,
    reason: 'O job foi associado ao item físico existente. Nenhum lote ou item adicional foi criado.',
    readiness: preview.readiness,
    selected: preview.selected,
    hardEnvLocks,
    batchTypeResolved: resolveRealProductionBatchType(),
    batch: batchProgress?.data || refreshedContext.batch || context.batch,
    batchItem: refreshedContext.batchItem || claim.data,
    canonicalContext: refreshedContext.canonical || context.canonical,
    queueJob: {
      id: job.id,
      name: job.name,
      batchId: context.batch.id,
      batchItemId: context.batchItem.id,
      variantNumber: context.canonical.variantNumber,
    },
    safety: buildSafety({
      runPodMayBeCalledByWorkerAfterQueue: true,
      realQueueJobCreated: true
    })
  }
}

export const auditRealSingleItemProduction = async ({ batchId = null, batchItemId = null } = {}) => {
  const batchResult = batchId
    ? await safeSelect({
      table: 'media_generation_batches',
      filters: [{ column: 'id', value: batchId }],
      maybeSingle: true
    })
    : { ok: false, data: null, error: 'batchId não informado' }

  const itemResult = batchItemId
    ? await safeSelect({
      table: 'media_generation_batch_items',
      filters: [{ column: 'id', value: batchItemId }],
      maybeSingle: true
    })
    : batchId
      ? await safeSelect({
        table: 'media_generation_batch_items',
        filters: [{ column: 'batch_id', value: batchId }],
        limit: 5
      })
      : { ok: false, data: [], error: 'batchItemId/batchId não informado' }

  const itemRecords = Array.isArray(itemResult.data)
    ? itemResult.data
    : itemResult.data
      ? [itemResult.data]
      : []

  const firstItem = itemRecords[0] ?? null
  const effectiveBatchItemId = batchItemId ?? firstItem?.id ?? null

  const variantsByBatchItem = effectiveBatchItemId
    ? await safeSelect({
      table: 'media_asset_variants',
      filters: [{ column: 'batch_item_id', value: effectiveBatchItemId }],
      limit: 10
    })
    : { ok: false, data: [], error: 'batchItemId não encontrado para consultar variants' }

  const variantsByBatch = batchId
    ? await safeSelect({
      table: 'media_asset_variants',
      filters: [{ column: 'batch_id', value: batchId }],
      limit: 10
    })
    : { ok: false, data: [], error: 'batchId não informado para consultar variants' }

  const variants = [
    ...(Array.isArray(variantsByBatchItem.data) ? variantsByBatchItem.data : []),
    ...(Array.isArray(variantsByBatch.data) ? variantsByBatch.data : [])
  ]

  const uniqueVariants = Array.from(new Map(variants.map((variant) => [variant.id, variant])).values())

  const batchStatus = pickFirstValue(batchResult.data, ['status', 'state'])
  const itemStatuses = itemRecords.map((record) => ({
    id: record.id,
    status: pickFirstValue(record, ['status', 'state']),
    progress: pickFirstValue(record, ['progress', 'percent', 'progress_percent'])
  }))

  const variantStatuses = uniqueVariants.map((record) => ({
    id: record.id,
    status: pickFirstValue(record, ['status', 'publication_status', 'publicationStatus', 'state']),
    requiresQa: pickFirstValue(record, ['requires_qa', 'requiresQa']),
    storageKeyPresent: hasValue(pickFirstValue(record, ['storage_key', 'r2_key', 'object_key', 'path'])),
    publicUrlPresent: hasValue(pickFirstValue(record, ['public_url', 'url', 'image_url']))
  }))

  const finalStatuses = new Set([
    String(batchStatus ?? '').toLowerCase(),
    ...itemStatuses.map((item) => String(item.status ?? '').toLowerCase()),
    ...variantStatuses.map((item) => String(item.status ?? '').toLowerCase())
  ])

  const isQaPending = finalStatuses.has('qa_pending') || variantStatuses.some((variant) => variant.requiresQa === true)
  const isFailed = finalStatuses.has('failed') || finalStatuses.has('error') || finalStatuses.has('rejected')
  const isStillRunning = ['queued', 'running', 'processing'].some((status) => finalStatuses.has(status))

  return {
    sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
    name: 'Auditoria Pós-Job da Produção Real Controlada de 1 Item',
    batchId,
    batchItemId: effectiveBatchItemId,
    status: isQaPending
      ? 'QA_PENDING_DETECTED'
      : isFailed
        ? 'FAILED_OR_REJECTED_DETECTED'
        : isStillRunning
          ? 'STILL_RUNNING_OR_QUEUED'
          : 'AUDIT_READ_ONLY',
    batch: {
      ok: batchResult.ok,
      error: batchResult.error,
      id: batchResult.data?.id ?? null,
      status: batchStatus ?? null
    },
    items: {
      ok: itemResult.ok,
      error: itemResult.error,
      total: itemRecords.length,
      statuses: itemStatuses
    },
    variants: {
      total: uniqueVariants.length,
      statuses: variantStatuses,
      queryByBatchItemOk: variantsByBatchItem.ok,
      queryByBatchOk: variantsByBatch.ok
    },
    safety: buildSafety({
      runPodMayBeCalledByWorkerAfterQueue: false,
      realQueueJobCreated: false
    })
  }
}

export const pollRealSingleItemProductionAudit = async ({
  batchId,
  batchItemId = null,
  timeoutMs = 180000,
  intervalMs = 5000
} = {}) => {
  const startedAt = Date.now()
  let lastAudit = null

  while (Date.now() - startedAt <= timeoutMs) {
    lastAudit = await auditRealSingleItemProduction({ batchId, batchItemId })

    if (['QA_PENDING_DETECTED', 'FAILED_OR_REJECTED_DETECTED'].includes(lastAudit.status)) {
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
    sprint: REAL_PRODUCTION_EXECUTION_SPRINT,
    status: lastAudit?.status ?? 'POLL_TIMEOUT_WITHOUT_AUDIT',
    polling: {
      completed: false,
      elapsedMs: Date.now() - startedAt,
      timeoutMs,
      intervalMs
    }
  }
}
