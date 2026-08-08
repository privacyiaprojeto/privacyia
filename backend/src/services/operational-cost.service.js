import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { isArchivedDemoOrTestRow } from './demo-test-hygiene.service.js'

const DELIVERIES_TABLE = 'user_media_deliveries'
const ASSETS_TABLE = 'media_asset_variants'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const COMBINATIONS_TABLE = 'media_combinations'
const COMPANIONS_TABLE = 'companions'
const ACTORS_TABLE = 'actor_profiles'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'

function safeNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function normalizePositiveInteger(value, fallback = 300, max = 2000) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function normalizeOffset(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return 0
  return parsed
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return code === '42703' || message.includes('does not exist') || message.includes('column')
}

async function getRowsByIds(table, ids, columns = '*') {
  const cleanIds = uniqueValues(ids)
  if (cleanIds.length === 0) return new Map()

  const runQuery = async (selectColumns) => supabaseAdmin
    .from(table)
    .select(selectColumns)
    .in('id', cleanIds)

  let { data, error } = await runQuery(columns)

  if (error && columns !== '*' && isMissingColumnError(error)) {
    const fallback = await runQuery('*')
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table} para custo operacional.`, {
      table,
      error: error.message,
    })
  }

  return new Map((data || []).map((row) => [row.id, row]))
}

async function getRowsByColumnValues(table, column, values, columns = '*') {
  const cleanValues = uniqueValues(values)
  if (cleanValues.length === 0) return []

  const runQuery = async (selectColumns) => supabaseAdmin
    .from(table)
    .select(selectColumns)
    .in(column, cleanValues)

  let { data, error } = await runQuery(columns)

  if (error && columns !== '*' && isMissingColumnError(error)) {
    const fallback = await runQuery('*')
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table} para custo operacional.`, {
      table,
      column,
      error: error.message,
    })
  }

  return data || []
}

function startOfDay(date = new Date()) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function daysAgoIso(days) {
  const date = startOfDay(new Date())
  date.setDate(date.getDate() - Number(days || 0))
  return date.toISOString()
}

function applyDateRange(query, range = {}) {
  const period = String(range.period || '30d')
  const startDate = range.startDate || range.start_date || null
  const endDate = range.endDate || range.end_date || null

  if (startDate) query = query.gte('created_at', startDate)
  else if (period !== 'all') {
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30
    query = query.gte('created_at', daysAgoIso(days))
  }

  if (endDate) query = query.lte('created_at', endDate)

  return query
}

function normalizeText(value) {
  return String(value || '').trim()
}

function signaturePath(combination = {}) {
  const guidedSelections = combination?.guided_selections || combination?.metadata?.guidedSelections || []
  if (!Array.isArray(guidedSelections)) return []

  return guidedSelections
    .map((item) => {
      const title = normalizeText(item?.titleName || item?.dimensionName || item?.title || item?.category)
      const option = normalizeText(item?.itemName || item?.optionName || item?.name || item?.label)
      if (!title && !option) return null
      if (!title) return option
      if (!option) return title
      return `${title}: ${option}`
    })
    .filter(Boolean)
}

function readFirstPositiveNumber(...values) {
  for (const value of values) {
    const parsed = safeNumber(value)
    if (parsed > 0) return parsed
  }
  return 0
}

function readFirstNonNegativeNumberOrNull(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue
    if (typeof value === 'string' && !value.trim()) continue

    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed >= 0) return parsed
  }

  return null
}

function readCostFromObject(row = {}, keys = []) {
  const metadata = row?.metadata || {}
  const finance = metadata?.finance || {}
  const operational = metadata?.operationalCost || metadata?.operational_cost || {}
  const cost = metadata?.cost || {}

  const candidates = []
  for (const key of keys) {
    candidates.push(row?.[key], metadata?.[key], finance?.[key], operational?.[key], cost?.[key])
  }

  return readFirstPositiveNumber(...candidates)
}

function resolveAssetCostCredits(asset = {}, batch = {}) {
  const directAssetCost = readCostFromObject(asset, [
    'operational_cost_credits',
    'operationalCostCredits',
    'production_cost_credits',
    'productionCostCredits',
    'cost_credits',
    'costCredits',
  ])

  if (directAssetCost > 0) {
    return {
      credits: directAssetCost,
      source: 'asset',
      sourceLabel: 'Custo individual do produto',
      configured: true,
    }
  }

  const batchCost = readCostFromObject(batch, [
    'operational_cost_credits',
    'operationalCostCredits',
    'production_cost_credits',
    'productionCostCredits',
    'estimated_cost_credits',
    'estimatedCostCredits',
    'actual_cost_credits',
    'actualCostCredits',
    'cost_credits',
    'costCredits',
  ])

  const generatedCount = readFirstPositiveNumber(
    batch?.approved_count,
    batch?.generated_count,
    batch?.requested_count,
    batch?.metadata?.approvedCount,
    batch?.metadata?.generatedCount,
    batch?.metadata?.requestedCount,
  )

  if (batchCost > 0) {
    const distributed = generatedCount > 1 ? Math.round((batchCost / generatedCount) * 100) / 100 : batchCost
    return {
      credits: distributed,
      source: 'batch_distributed',
      sourceLabel: 'Custo do lote rateado por produto',
      configured: true,
    }
  }

  return {
    credits: 0,
    source: 'not_configured',
    sourceLabel: 'Custo ainda não configurado',
    configured: false,
  }
}

function resolveActualRunPodCostUsd(asset = {}, batchItem = {}, batch = {}) {
  const itemTelemetry = batchItem?.telemetry || batchItem?.metadata?.telemetry || {}
  const assetTelemetry = asset?.telemetry || asset?.metadata?.telemetry || asset?.qa_payload?.telemetry || {}
  const batchTelemetry = batch?.telemetry || batch?.metadata?.telemetry || {}

  const actualCostUsd = readFirstNonNegativeNumberOrNull(
    batchItem?.actual_cost_usd,
    itemTelemetry?.totals?.actualCostUsd,
    itemTelemetry?.totals?.actual_cost_usd,
    itemTelemetry?.latest?.actualCostUsd,
    itemTelemetry?.latest?.actual_cost_usd,
    asset?.actual_cost_usd,
    assetTelemetry?.totals?.actualCostUsd,
    assetTelemetry?.latest?.actualCostUsd,
    batch?.actual_cost_usd,
    batchTelemetry?.totals?.actualCostUsd,
  )
  const costStatus = String(
    batchItem?.cost_status || itemTelemetry?.latest?.costStatus || itemTelemetry?.latest?.cost_status || '',
  ).trim()
  const costCaptured = actualCostUsd !== null && (
    batchItem?.actual_cost_usd !== null && batchItem?.actual_cost_usd !== undefined ||
    ['captured', 'calculated'].includes(costStatus)
  )

  if (costCaptured) {
    return {
      usd: Math.round(actualCostUsd * 100000000) / 100000000,
      configured: true,
      source: batchItem?.actual_cost_usd != null ? 'batch_item_native' : 'telemetry',
      sourceLabel: 'Custo real capturado do job RunPod',
      provider: batchItem?.provider_name || itemTelemetry?.latest?.provider || 'runpod',
      providerJobId: batchItem?.provider_job_id || itemTelemetry?.latest?.providerJobId || null,
      executionTimeMs: safeNumber(
        batchItem?.execution_time_ms || itemTelemetry?.totals?.executionTimeMs,
      ),
    }
  }

  return {
    usd: 0,
    configured: false,
    source: 'not_captured',
    sourceLabel: 'Custo real do job ainda não capturado',
    provider: batchItem?.provider_name || null,
    providerJobId: batchItem?.provider_job_id || null,
    executionTimeMs: safeNumber(batchItem?.execution_time_ms),
  }
}

function normalizePercentToBps(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  if (parsed > 0 && parsed <= 100) return Math.round(parsed * 100)
  return Math.min(Math.round(parsed), 10000)
}

function readPayoutBpsFromMetadata(metadata = {}, financeSnapshot = {}) {
  const candidates = [
    metadata?.finance?.payoutRateBps,
    metadata?.finance?.actorShareBps,
    metadata?.finance?.revenueShareBps,
    metadata?.payoutRateBps,
    metadata?.actorShareBps,
    metadata?.revenueShareBps,
    financeSnapshot?.payoutRateBps,
    financeSnapshot?.actorShareBps,
    financeSnapshot?.revenueShareBps,
  ]

  for (const candidate of candidates) {
    const parsed = Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(Math.round(parsed), 10000)
  }

  const percentCandidates = [
    metadata?.finance?.payoutPercent,
    metadata?.finance?.actorSharePercent,
    metadata?.finance?.revenueSharePercent,
    metadata?.payoutPercent,
    metadata?.actorSharePercent,
    metadata?.revenueSharePercent,
    financeSnapshot?.payoutPercent,
    financeSnapshot?.actorSharePercent,
    financeSnapshot?.revenueSharePercent,
  ]

  for (const candidate of percentCandidates) {
    const parsed = normalizePercentToBps(candidate)
    if (parsed > 0) return parsed
  }

  return 0
}

function groupBy(items, keyBuilder) {
  const map = new Map()
  for (const item of items) {
    const key = keyBuilder(item)
    const current = map.get(key) || []
    current.push(item)
    map.set(key, current)
  }
  return map
}

function buildRanking(rows, keyBuilder, labelBuilder, extraBuilder = () => ({}), limit = 10) {
  return [...groupBy(rows, keyBuilder).entries()]
    .map(([key, items]) => {
      const grossCredits = items.reduce((total, item) => total + safeNumber(item.revenue.grossCredits), 0)
      const payoutCredits = items.reduce((total, item) => total + safeNumber(item.payout.estimatedPayoutCredits), 0)
      const operationalCostCredits = items.reduce((total, item) => total + safeNumber(item.cost.estimatedOperationalCostCredits), 0)
      const actualOperationalCostUsd = items.reduce((total, item) => total + safeNumber(item.cost.actualOperationalCostUsd), 0)
      const marginCredits = grossCredits - payoutCredits - operationalCostCredits

      return {
        id: key || 'sem-identificacao',
        label: labelBuilder(items[0], key),
        sales: items.length,
        grossCredits,
        estimatedPayoutCredits: payoutCredits,
        estimatedOperationalCostCredits: operationalCostCredits,
        actualOperationalCostUsd: Math.round(actualOperationalCostUsd * 100000000) / 100000000,
        estimatedMarginCredits: marginCredits,
        marginPercent: grossCredits > 0 ? Math.round((marginCredits / grossCredits) * 10000) / 100 : 0,
        missingCost: items.filter((item) => !item.cost.configured).length,
        ...extraBuilder(items[0], key),
      }
    })
    .sort((a, b) => b.estimatedMarginCredits - a.estimatedMarginCredits || b.grossCredits - a.grossCredits)
    .slice(0, limit)
}

async function loadDeliveries({ period = '30d', companionId = null, mediaType = null, limit = 500, offset = 0 } = {}) {
  const safeLimit = normalizePositiveInteger(limit, 500, 2000)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  query = applyDateRange(query, { period })
  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query
  if (error) throw new ApiError(500, 'Erro ao carregar entregas para custo operacional.', error)

  const deliveries = (data || []).filter((delivery) => !isArchivedDemoOrTestRow(delivery))
  const assetsById = await getRowsByIds(ASSETS_TABLE, deliveries.map((delivery) => delivery.variant_id), '*')
  const combinationsById = await getRowsByIds(COMBINATIONS_TABLE, deliveries.map((delivery) => delivery.combination_id), '*')
  const companionsById = await getRowsByIds(COMPANIONS_TABLE, deliveries.map((delivery) => delivery.companion_id), 'id, name, nome, slug')
  const batchIds = deliveries
    .map((delivery) => assetsById.get(delivery.variant_id)?.batch_id)
    .filter(Boolean)
  const batchItemIds = deliveries
    .map((delivery) => assetsById.get(delivery.variant_id)?.batch_item_id)
    .filter(Boolean)
  const batchesById = await getRowsByIds(BATCHES_TABLE, batchIds, '*')
  const batchItemsById = await getRowsByIds(BATCH_ITEMS_TABLE, batchItemIds, '*')

  const mapped = deliveries.map((delivery) => {
    const asset = assetsById.get(delivery.variant_id) || {}
    const combination = combinationsById.get(delivery.combination_id) || {}
    const companion = companionsById.get(delivery.companion_id) || null
    const batch = batchesById.get(asset?.batch_id) || {}
    const batchItem = batchItemsById.get(asset?.batch_item_id) || {}

    return {
      delivery,
      asset,
      combination,
      companion,
      batch,
      batchItem,
    }
  })

  const filtered = mediaType && mediaType !== 'all'
    ? mapped.filter((item) => String(item.asset?.media_type || item.combination?.media_type || '').toLowerCase() === String(mediaType).toLowerCase())
    : mapped

  return {
    rows: filtered,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: filtered.length,
      hasMore: deliveries.length === safeLimit,
    },
  }
}

async function loadPayoutRulesByCompanion(companionIds = []) {
  const authorizations = await getRowsByColumnValues(
    AUTHORIZATIONS_TABLE,
    'companion_id',
    companionIds,
    '*',
  )

  const actorsById = await getRowsByIds(ACTORS_TABLE, authorizations.map((item) => item.actor_profile_id), '*')
  const grouped = groupBy(authorizations, (row) => row.companion_id)
  const result = new Map()

  for (const [companionId, rows] of grouped.entries()) {
    const sorted = [...rows].sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    const authorization = sorted[0]
    const actor = actorsById.get(authorization?.actor_profile_id) || null
    const bps = readPayoutBpsFromMetadata(actor?.metadata || {}, authorization?.finance_snapshot || {})

    result.set(companionId, {
      bps,
      percent: Math.round((bps / 100) * 100) / 100,
      configured: bps > 0,
      actor: actor
        ? {
            id: actor.id,
            displayName: actor.display_name || actor.name || actor.nome || 'Ator/Atriz sem nome',
          }
        : null,
      authorization: authorization
        ? {
            id: authorization.id,
            status: authorization.status || null,
          }
        : null,
    })
  }

  return result
}

function mapOperationalMarginRow({ delivery, asset, combination, companion, batch, batchItem }, payoutRule = {}) {
  const grossCredits = safeNumber(delivery.total_price_credits || delivery.universal_credits_used || delivery.companion_credits_used)
  const cost = resolveAssetCostCredits(asset, batch)
  const actualRunPodCost = resolveActualRunPodCostUsd(asset, batchItem, batch)
  const estimatedPayoutCredits = Math.round((grossCredits * safeNumber(payoutRule.bps)) / 10000)
  const platformBeforeCostsCredits = grossCredits - estimatedPayoutCredits
  const estimatedMarginCredits = platformBeforeCostsCredits - cost.credits

  return {
    id: delivery.id,
    createdAt: delivery.created_at || null,
    charged: grossCredits > 0,
    revenue: {
      grossCredits,
      source: 'user_media_deliveries',
    },
    payout: {
      actor: payoutRule.actor || null,
      ruleConfigured: Boolean(payoutRule.configured),
      payoutPercent: payoutRule.percent || 0,
      estimatedPayoutCredits,
    },
    cost: {
      estimatedOperationalCostCredits: cost.credits,
      actualOperationalCostUsd: actualRunPodCost.usd,
      actualCostConfigured: actualRunPodCost.configured,
      actualCostSource: actualRunPodCost.source,
      actualCostSourceLabel: actualRunPodCost.sourceLabel,
      provider: actualRunPodCost.provider,
      providerJobId: actualRunPodCost.providerJobId,
      executionTimeMs: actualRunPodCost.executionTimeMs,
      source: cost.source,
      sourceLabel: cost.sourceLabel,
      configured: cost.configured,
    },
    margin: {
      platformBeforeCostsCredits,
      estimatedMarginCredits,
      marginPercent: grossCredits > 0 ? Math.round((estimatedMarginCredits / grossCredits) * 10000) / 100 : 0,
      status: !cost.configured ? 'missing_cost' : estimatedMarginCredits >= 0 ? 'positive' : 'negative',
    },
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || companion.nome || null,
          slug: companion.slug || null,
        }
      : {
          id: delivery.companion_id,
        },
    product: {
      deliveryId: delivery.id,
      combinationId: delivery.combination_id || null,
      mediaType: asset?.media_type || combination?.media_type || null,
      signaturePath: signaturePath(combination),
      batchId: asset?.batch_id || null,
      batchItemId: asset?.batch_item_id || null,
    },
  }
}

function summarize(rows = [], period = '30d') {
  const grossCredits = rows.reduce((total, row) => total + safeNumber(row.revenue.grossCredits), 0)
  const estimatedPayoutCredits = rows.reduce((total, row) => total + safeNumber(row.payout.estimatedPayoutCredits), 0)
  const estimatedOperationalCostCredits = rows.reduce((total, row) => total + safeNumber(row.cost.estimatedOperationalCostCredits), 0)
  const actualOperationalCostUsd = rows.reduce((total, row) => total + safeNumber(row.cost.actualOperationalCostUsd), 0)
  const platformBeforeCostsCredits = grossCredits - estimatedPayoutCredits
  const estimatedMarginCredits = platformBeforeCostsCredits - estimatedOperationalCostCredits

  return {
    period,
    totalDeliveries: rows.length,
    paidSales: rows.filter((row) => row.charged).length,
    grossCredits,
    estimatedPayoutCredits,
    platformBeforeCostsCredits,
    estimatedOperationalCostCredits,
    actualOperationalCostUsd: Math.round(actualOperationalCostUsd * 100000000) / 100000000,
    estimatedMarginCredits,
    marginPercent: grossCredits > 0 ? Math.round((estimatedMarginCredits / grossCredits) * 10000) / 100 : 0,
    costConfigured: rows.filter((row) => row.cost.configured).length,
    actualCostCaptured: rows.filter((row) => row.cost.actualCostConfigured).length,
    missingCost: rows.filter((row) => !row.cost.configured).length,
    negativeMargin: rows.filter((row) => row.margin.status === 'negative').length,
  }
}

export async function getOperationalMarginReport({
  period = '30d',
  companionId = null,
  mediaType = null,
  limit = 500,
  offset = 0,
} = {}) {
  const { rows: rawRows, pagination } = await loadDeliveries({ period, companionId, mediaType, limit, offset })
  const payoutRulesByCompanion = await loadPayoutRulesByCompanion(rawRows.map((row) => row.delivery.companion_id))

  const rows = rawRows
    .map((row) => mapOperationalMarginRow(row, payoutRulesByCompanion.get(row.delivery.companion_id) || {}))
    .filter((row) => row.charged)

  return {
    summary: summarize(rows, period),
    rankings: {
      byCompanion: buildRanking(
        rows,
        (row) => row.companion.id,
        (row) => row.companion.name || row.companion.slug || 'Avatar sem nome',
        (row) => ({ companion: row.companion }),
      ),
      byCombination: buildRanking(
        rows,
        (row) => row.product.combinationId,
        (row) => row.product.signaturePath?.join(' • ') || 'Combinação sem assinatura',
        (row) => ({ companion: row.companion, mediaType: row.product.mediaType, signaturePath: row.product.signaturePath }),
      ),
    },
    recentMargins: rows.slice(0, 30),
    pagination,
    guidance: {
      mode: 'Leitura e cálculo. Este relatório não altera cobrança, carteira, entregas, repasses ou custo real.',
      costSource: 'Custo em créditos permanece estimado. O custo real em USD vem do batch_item canônico e da telemetria imutável do RunPod.',
      marginFormula: 'Margem estimada = receita bruta em créditos - repasse estimado do ator - custo operacional estimado.',
      nextStep: 'Depois da validação, o Admin pode ganhar tela para configurar custos por lote/produto sem pagamento automático.',
    },
  }
}
