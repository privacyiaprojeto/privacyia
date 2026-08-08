import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const SPRINT = '6.2B'
const REQUIRED_ENV = 'ALLOW_DEMO_TEST_LOGICAL_ARCHIVE'
const CONFIRM_PHRASE = 'CONFIRMAR ARQUIVAMENTO LOGICO DE TESTES'

const TABLE_CONFIGS = [
  { key: 'companions', table: 'companions', label: 'Avatares/companions' },
  { key: 'batches', table: 'media_generation_batches', label: 'Lotes de produção' },
  { key: 'batchItems', table: 'media_generation_batch_items', label: 'Itens de lote' },
  { key: 'combinations', table: 'media_combinations', label: 'Combinações/produtos' },
  { key: 'assets', table: 'media_asset_variants', label: 'Variações/assets' },
  { key: 'deliveries', table: 'user_media_deliveries', label: 'Entregas do cliente' },
  { key: 'galleryItems', table: 'gallery_items', label: 'Itens de galeria' },
]

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizePositiveInteger(value, fallback = 500, max = 5000) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'sim'].includes(normalizeText(value))
}

function rowSearchText(row = {}) {
  return normalizeText([
    row.id,
    row.name,
    row.nome,
    row.display_name,
    row.title,
    row.label,
    row.slug,
    row.combination_key,
    row.delivery_source,
    row.batch_type,
    row.job_type,
    row.status,
    row.source,
  ].filter(Boolean).join(' '))
}

function metadataSearchText(row = {}) {
  try {
    return normalizeText(JSON.stringify(row?.metadata || {}))
  } catch {
    return ''
  }
}

function sourceLooksTechnical(source = '') {
  const normalized = normalizeText(source)
  return normalized.startsWith('sprint_')
    || normalized.includes('teste')
    || normalized.includes('test')
    || normalized.includes('safe-demo')
    || normalized.includes('demo-sofia')
    || normalized.includes('sem-runpod')
}

function metadataLooksTechnical(metadata = {}) {
  const safe = safeObject(metadata)
  const hygiene = safeObject(safe.hygiene)

  if (hygiene.archived === true || hygiene.status === 'archived_demo_test') return true
  if (safe.safeDemo === true || safe.demoOnly === true || safe.safeTest === true || safe.noRunPod === true) return true
  if (safe.demo === true || safe.isDemo === true || safe.test === true || safe.isTest === true) return true
  if (sourceLooksTechnical(safe.source)) return true

  const publication = safeObject(safe.productPublication || safe.clientPublication || safe.publication)
  if (sourceLooksTechnical(publication.source)) return true

  const text = metadataSearchText({ metadata: safe })
  return text.includes('avatar teste')
    || text.includes('avatar-teste')
    || text.includes('demo-sofia')
    || text.includes('safe-demo')
    || text.includes('sem runpod')
    || text.includes('sem-runpod')
}

function textLooksTechnical(row = {}) {
  const text = rowSearchText(row)

  return text.includes('avatar teste')
    || text.includes('avatar-teste')
    || text.includes('teste 6.')
    || text.includes('teste-6-')
    || text.includes('demo-6-')
    || text.includes('demo-sofia')
    || text.includes('safe-demo')
    || text.includes('sem-runpod')
}

export function isArchivedDemoOrTestRow(row = {}) {
  const metadata = safeObject(row?.metadata)
  const hygiene = safeObject(metadata.hygiene)

  if (hygiene.archived === true || hygiene.status === 'archived_demo_test') return true

  const hasHiddenClientFlag = row?.visible_to_client === false || row?.admin_only === true
  const hasInactiveFlag = row?.is_active === false || row?.active === false || row?.visible === false
  const hasUnpublishedFlag = row?.published === false || row?.is_published === false

  return isRowDemoOrTest(row) && (hasHiddenClientFlag || hasInactiveFlag || hasUnpublishedFlag)
}

function isRowDemoOrTest(row = {}) {
  return textLooksTechnical(row) || metadataLooksTechnical(row?.metadata || {})
}

function isCompanionDemoCandidate(row = {}) {
  return textLooksTechnical(row) || metadataLooksTechnical(row?.metadata || {})
}

function hasAny(values = []) {
  return values.some(Boolean)
}

async function safeSelectAll(table, limit = 1000) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    return {
      rows: [],
      unavailable: true,
      error: error.message,
    }
  }

  return {
    rows: data || [],
    unavailable: false,
    error: null,
  }
}

function uniq(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function candidateSummary(row = {}, reason = 'technical_demo_or_test') {
  return {
    id: row.id,
    label: row.name || row.nome || row.display_name || row.title || row.label || row.slug || row.combination_key || row.id,
    companionId: row.companion_id || null,
    combinationId: row.combination_id || null,
    batchId: row.batch_id || null,
    deliveryId: row.delivery_id || null,
    variantId: row.variant_id || row.asset_id || null,
    status: row.status || null,
    reason,
    alreadyArchived: isArchivedDemoOrTestRow(row),
  }
}

function findCandidates(snapshot = {}) {
  const companions = snapshot.companions?.rows || []
  const batches = snapshot.batches?.rows || []
  const batchItems = snapshot.batchItems?.rows || []
  const combinations = snapshot.combinations?.rows || []
  const assets = snapshot.assets?.rows || []
  const deliveries = snapshot.deliveries?.rows || []
  const galleryItems = snapshot.galleryItems?.rows || []

  const companionCandidates = companions.filter(isCompanionDemoCandidate)
  const demoCompanionIds = new Set(companionCandidates.map((row) => row.id).filter(Boolean))

  const batchCandidates = batches.filter((row) => (
    isRowDemoOrTest(row) || demoCompanionIds.has(row.companion_id)
  ))
  const demoBatchIds = new Set(batchCandidates.map((row) => row.id).filter(Boolean))

  const combinationCandidates = combinations.filter((row) => (
    isRowDemoOrTest(row) || demoCompanionIds.has(row.companion_id)
  ))
  const demoCombinationIds = new Set(combinationCandidates.map((row) => row.id).filter(Boolean))

  const assetCandidates = assets.filter((row) => (
    isRowDemoOrTest(row)
    || demoCompanionIds.has(row.companion_id)
    || demoCombinationIds.has(row.combination_id)
    || demoBatchIds.has(row.batch_id)
  ))
  const demoAssetIds = new Set(assetCandidates.map((row) => row.id).filter(Boolean))

  const batchItemCandidates = batchItems.filter((row) => (
    isRowDemoOrTest(row)
    || demoBatchIds.has(row.batch_id)
    || demoCompanionIds.has(row.companion_id)
    || demoCombinationIds.has(row.combination_id)
  ))
  const demoBatchItemIds = new Set(batchItemCandidates.map((row) => row.id).filter(Boolean))

  const deliveryCandidates = deliveries.filter((row) => (
    isRowDemoOrTest(row)
    || demoCompanionIds.has(row.companion_id)
    || demoCombinationIds.has(row.combination_id)
    || demoAssetIds.has(row.variant_id)
    || demoAssetIds.has(row.asset_id)
  ))
  const demoDeliveryIds = new Set(deliveryCandidates.map((row) => row.id).filter(Boolean))

  const galleryCandidates = galleryItems.filter((row) => (
    isRowDemoOrTest(row)
    || demoCompanionIds.has(row.companion_id)
    || demoDeliveryIds.has(row.delivery_id)
    || demoAssetIds.has(row.variant_id)
    || demoAssetIds.has(row.asset_id)
  ))

  const result = {
    companions: companionCandidates.map((row) => candidateSummary(row, 'avatar_teste_ou_demo')),
    batches: batchCandidates.map((row) => candidateSummary(row, 'lote_teste_ou_vinculado_a_demo')),
    batchItems: batchItemCandidates.map((row) => candidateSummary(row, 'item_lote_teste_ou_vinculado_a_demo')),
    combinations: combinationCandidates.map((row) => candidateSummary(row, 'combinacao_teste_ou_demo')),
    assets: assetCandidates.map((row) => candidateSummary(row, 'asset_teste_ou_demo')),
    deliveries: deliveryCandidates.map((row) => candidateSummary(row, 'entrega_teste_ou_vinculada_a_demo')),
    galleryItems: galleryCandidates.map((row) => candidateSummary(row, 'galeria_teste_ou_vinculada_a_demo')),
  }

  return {
    candidates: result,
    internalIds: {
      demoCompanionIds: [...demoCompanionIds],
      demoBatchIds: [...demoBatchIds],
      demoBatchItemIds: [...demoBatchItemIds],
      demoCombinationIds: [...demoCombinationIds],
      demoAssetIds: [...demoAssetIds],
      demoDeliveryIds: [...demoDeliveryIds],
    },
  }
}

function countCandidateGroups(candidates = {}) {
  return Object.fromEntries(Object.entries(candidates).map(([key, rows]) => [key, rows.length]))
}

function totalCandidates(candidates = {}) {
  return Object.values(candidates).reduce((total, rows) => total + (rows?.length || 0), 0)
}

function alreadyArchivedCandidates(candidates = {}) {
  return Object.values(candidates)
    .flat()
    .filter((row) => row.alreadyArchived)
    .length
}

function productPublicationHidden(metadata = {}) {
  const safe = safeObject(metadata)
  const now = new Date().toISOString()
  const hidePublication = (current = {}) => ({
    ...safeObject(current),
    status: 'hidden',
    hiddenAt: safeObject(current).hiddenAt || now,
    hiddenBy: SPRINT,
    reason: 'logical_archive_demo_test_data',
  })

  return {
    ...safe,
    productPublication: hidePublication(safe.productPublication || safe.clientPublication || safe.publication),
    clientPublication: hidePublication(safe.clientPublication || safe.productPublication || safe.publication),
  }
}

function buildArchiveMetadata(row = {}, reason = 'logical_archive_demo_test_data') {
  const current = productPublicationHidden(row.metadata || {})
  const previousHygiene = safeObject(current.hygiene)

  return {
    ...current,
    hygiene: {
      ...previousHygiene,
      archived: true,
      status: 'archived_demo_test',
      archivedAt: previousHygiene.archivedAt || new Date().toISOString(),
      archivedBySprint: SPRINT,
      reason,
      previousStatus: row.status || previousHygiene.previousStatus || null,
      previousVisibleToClient: row.visible_to_client ?? previousHygiene.previousVisibleToClient ?? null,
      previousAdminOnly: row.admin_only ?? previousHygiene.previousAdminOnly ?? null,
    },
  }
}


function getMissingColumn(error) {
  const message = String(error?.message || '')
  const match = message.match(/Could not find the '([^']+)' column/i) || message.match(/column "([^"]+)" of relation/i) || message.match(/column ([a-zA-Z0-9_]+) does not exist/i)
  return match?.[1] || null
}

function buildArchivePayload(row = {}, table = '') {
  const payload = {}
  const keys = new Set(Object.keys(row || {}))

  if (keys.has('metadata')) payload.metadata = buildArchiveMetadata(row)
  if (keys.has('visible_to_client')) payload.visible_to_client = false
  if (keys.has('admin_only')) payload.admin_only = true
  if (keys.has('is_active')) payload.is_active = false
  if (keys.has('active')) payload.active = false
  if (keys.has('visible')) payload.visible = false
  if (keys.has('published')) payload.published = false
  if (keys.has('is_published')) payload.is_published = false
  if (keys.has('updated_at')) payload.updated_at = new Date().toISOString()

  if (table === 'media_asset_variants') {
    if (keys.has('requires_qa')) payload.requires_qa = false
  }

  if (Object.keys(payload).length === 0) {
    payload.metadata = buildArchiveMetadata(row)
  }

  return payload
}

async function loadRowsByIds(table, ids = [], limit = 1000) {
  const cleanIds = uniq(ids).slice(0, limit)
  if (cleanIds.length === 0) return []

  const { data, error } = await supabaseAdmin
    .from(table)
    .select('*')
    .in('id', cleanIds)

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros para arquivamento lógico em ${table}.`, {
      table,
      error: error.message,
    })
  }

  return data || []
}

async function archiveRowsForGroup({ table, ids = [], limit = 1000 }) {
  const rows = await loadRowsByIds(table, ids, limit)
  const result = {
    table,
    requested: ids.length,
    updated: 0,
    skippedAlreadyArchived: 0,
    skippedUnsupportedSchema: 0,
    unsupportedSchema: [],
    failed: 0,
    failures: [],
  }

  for (const row of rows) {
    if (isArchivedDemoOrTestRow(row)) {
      result.skippedAlreadyArchived += 1
      continue
    }

    const payload = buildArchivePayload(row, table)
    let currentPayload = { ...payload }
    let updateResult = await supabaseAdmin
      .from(table)
      .update(currentPayload)
      .eq('id', row.id)

    while (updateResult.error) {
      const missingColumn = getMissingColumn(updateResult.error)
      if (!missingColumn || !Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) break
      delete currentPayload[missingColumn]
      if (Object.keys(currentPayload).length === 0) break
      updateResult = await supabaseAdmin
        .from(table)
        .update(currentPayload)
        .eq('id', row.id)
    }

    if (Object.keys(currentPayload).length === 0) {
      result.skippedUnsupportedSchema += 1
      result.unsupportedSchema.push({
        id: row.id,
        reason: 'Registro demo/teste identificado, mas a tabela não possui coluna segura para arquivamento lógico neste schema.',
      })
      continue
    }

    if (updateResult.error) {
      result.failed += 1
      result.failures.push({ id: row.id, error: updateResult.error.message })
      continue
    }

    result.updated += 1
  }

  return result
}

export async function getDemoTestDataHygieneAudit({ limit = 1000 } = {}) {
  const safeLimit = normalizePositiveInteger(limit, 1000, 5000)
  const snapshotEntries = await Promise.all(TABLE_CONFIGS.map(async (config) => [
    config.key,
    await safeSelectAll(config.table, safeLimit),
  ]))

  const snapshot = Object.fromEntries(snapshotEntries)
  const { candidates, internalIds } = findCandidates(snapshot)
  const unavailableTables = TABLE_CONFIGS
    .filter((config) => snapshot[config.key]?.unavailable)
    .map((config) => ({ key: config.key, table: config.table, error: snapshot[config.key]?.error }))

  return {
    mode: 'audit_only',
    sprint: SPRINT,
    destructiveDelete: false,
    runPodCalled: false,
    r2RealAccess: false,
    unavailableTables,
    summary: {
      totalCandidates: totalCandidates(candidates),
      alreadyArchived: alreadyArchivedCandidates(candidates),
      byGroup: countCandidateGroups(candidates),
      warning: 'Auditoria somente leitura. Nenhum dado foi apagado ou alterado.',
    },
    candidates,
    internalIds,
    guidance: {
      archive: `Para arquivar logicamente, use ${REQUIRED_ENV}=true e a frase: ${CONFIRM_PHRASE}.`,
      effect: 'Arquivamento lógico oculta produtos demo/teste do cliente e marca registros para relatórios financeiros ignorarem lixo técnico.',
      noDelete: 'Este serviço não executa DELETE, DROP, R2 ou RunPod.',
    },
  }
}

export async function archiveDemoTestDataLogically({
  dryRun = true,
  confirmPhrase = '',
  limit = 1000,
  reason = 'logical_archive_demo_test_data',
} = {}) {
  const audit = await getDemoTestDataHygieneAudit({ limit })
  const execute = !normalizeBoolean(dryRun)

  if (!execute) {
    return {
      ...audit,
      mode: 'dry_run_archive_preview',
      dryRun: true,
      executed: false,
      confirmationRequired: CONFIRM_PHRASE,
      archivePlan: audit.summary,
    }
  }

  if (String(process.env[REQUIRED_ENV] || '').toLowerCase() !== 'true') {
    throw new ApiError(409, `Arquivamento lógico bloqueado. Defina ${REQUIRED_ENV}=true para confirmar operação controlada.`)
  }

  if (String(confirmPhrase || '').trim() !== CONFIRM_PHRASE) {
    throw new ApiError(409, 'Frase de confirmação inválida para arquivamento lógico de dados demo/teste.', {
      expected: CONFIRM_PHRASE,
    })
  }

  const candidateIdsByGroup = Object.fromEntries(Object.entries(audit.candidates).map(([key, rows]) => [
    key,
    rows.map((row) => row.id).filter(Boolean),
  ]))

  const updates = []
  for (const config of TABLE_CONFIGS) {
    const ids = candidateIdsByGroup[config.key] || []
    if (ids.length === 0) {
      updates.push({ table: config.table, requested: 0, updated: 0, skippedAlreadyArchived: 0, skippedUnsupportedSchema: 0, unsupportedSchema: [], failed: 0, failures: [] })
      continue
    }

    updates.push(await archiveRowsForGroup({
      table: config.table,
      ids,
      limit,
      reason,
    }))
  }

  const updated = updates.reduce((total, item) => total + Number(item.updated || 0), 0)
  const skippedUnsupportedSchema = updates.reduce((total, item) => total + Number(item.skippedUnsupportedSchema || 0), 0)
  const failed = updates.reduce((total, item) => total + Number(item.failed || 0), 0)

  return {
    mode: 'executed_logical_archive',
    sprint: SPRINT,
    dryRun: false,
    executed: true,
    destructiveDelete: false,
    runPodCalled: false,
    r2RealAccess: false,
    summary: {
      before: audit.summary,
      updated,
      skippedUnsupportedSchema,
      failed,
      byTable: updates,
    },
    guidance: {
      effect: 'Produtos demo/teste foram marcados como arquivados/ocultos sem apagar histórico. Registros sem coluna segura de arquivamento são reportados como incompatíveis com o schema, não como falha destrutiva.',
      next: 'Rode novamente a auditoria/Admin 360 para confirmar redução da poluição técnica nos relatórios.',
    },
  }
}
