import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { isArchivedDemoOrTestRow } from './demo-test-hygiene.service.js'

const DELIVERIES_TABLE = 'user_media_deliveries'
const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'
const PROFILES_TABLE = 'profiles'
const COMPANIONS_TABLE = 'companions'
const CREDIT_LEDGER_TABLE = 'credit_ledger'

function normalizePositiveInteger(value, fallback = 100, max = 1000) {
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
    // Alguns schemas antigos/atuais não possuem colunas opcionais como name/nome/title.
    // Para o relatório financeiro não cair inteiro por causa disso, fazemos fallback para *.
    // A resposta pública continua sanitizada em mapDeliverySale e rankings.
    const fallbackResult = await runQuery('*')
    data = fallbackResult.data
    error = fallbackResult.error
  }

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
      table,
      error: error.message,
    })
  }

  return new Map((data || []).map((row) => [row.id, row]))
}

function safeNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
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

function sumCredits(items = []) {
  return items.reduce((total, item) => total + safeNumber(
    item.credits || item.total_price_credits || item.universal_credits_used || item.companion_credits_used,
  ), 0)
}

function mapDeliverySale({ delivery, profile, companion, combination, asset }) {
  const totalCredits = safeNumber(delivery.total_price_credits || delivery.universal_credits_used || delivery.companion_credits_used)

  return {
    id: delivery.id,
    createdAt: delivery.created_at || null,
    deliverySource: delivery.delivery_source || null,
    charged: totalCredits > 0,
    credits: totalCredits,
    profile: profile
      ? {
          id: profile.id,
          email: profile.email || null,
          name: profile.name || profile.nome || null,
          role: profile.role || null,
        }
      : {
          id: delivery.profile_id,
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
      assetId: delivery.variant_id || null,
      combinationId: delivery.combination_id || null,
      mediaType: asset?.media_type || combination?.media_type || null,
      variantNumber: asset?.variant_number || null,
      combinationTitle: combination?.title || combination?.name || null,
      signaturePath: signaturePath(combination),
    },
    ledger: {
      companionCreditLedgerId: delivery.companion_credit_ledger_id || null,
      universalCreditLedgerId: delivery.universal_credit_ledger_id || null,
    },
    protectedViewUrl: `/media/deliveries/${delivery.id}/protected-view`,
  }
}

function buildRankingFromSales(sales, keyGetter, labelGetter, extraGetter = () => ({}), limit = 10) {
  return [...groupBy(sales, keyGetter).entries()]
    .map(([key, rows]) => ({
      id: key || 'sem-identificacao',
      label: labelGetter(rows[0], key),
      sales: rows.length,
      credits: rows.reduce((total, row) => total + safeNumber(row.credits), 0),
      paidSales: rows.filter((row) => row.charged).length,
      freeDeliveries: rows.filter((row) => !row.charged).length,
      ...extraGetter(rows[0], key),
    }))
    .sort((a, b) => b.credits - a.credits || b.sales - a.sales)
    .slice(0, limit)
}

async function loadDeliveries({ period = '30d', limit = 300, offset = 0, companionId = null, mediaType = null } = {}) {
  const safeLimit = normalizePositiveInteger(limit, 300, 1000)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  query = applyDateRange(query, { period })

  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao carregar vendas/entregas para o financeiro Admin.', error)
  }

  const deliveries = (data || []).filter((delivery) => !isArchivedDemoOrTestRow(delivery))
  const assetsById = await getRowsByIds(
    ASSETS_TABLE,
    deliveries.map((delivery) => delivery.variant_id),
    'id, media_type, variant_number, status, combination_id, companion_id',
  )
  const combinationsById = await getRowsByIds(
    COMBINATIONS_TABLE,
    deliveries.map((delivery) => delivery.combination_id),
    'id, combination_key, title, name, media_type, price_credits, guided_selections, metadata, companion_id',
  )
  const profilesById = await getRowsByIds(
    PROFILES_TABLE,
    deliveries.map((delivery) => delivery.profile_id),
    'id, email, name, nome, role',
  )
  const companionsById = await getRowsByIds(
    COMPANIONS_TABLE,
    deliveries.map((delivery) => delivery.companion_id),
    'id, name, nome, slug',
  )

  const mapped = deliveries.map((delivery) => mapDeliverySale({
    delivery,
    profile: profilesById.get(delivery.profile_id),
    companion: companionsById.get(delivery.companion_id),
    combination: combinationsById.get(delivery.combination_id),
    asset: assetsById.get(delivery.variant_id),
  }))

  const filtered = mediaType && mediaType !== 'all'
    ? mapped.filter((item) => String(item.product.mediaType || '').toLowerCase() === String(mediaType).toLowerCase())
    : mapped

  return {
    deliveries: filtered,
    rawCount: deliveries.length,
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: filtered.length,
      hasMore: deliveries.length === safeLimit,
    },
  }
}

async function loadLedgerSummary({ period = '30d', companionId = null } = {}) {
  let query = supabaseAdmin
    .from(CREDIT_LEDGER_TABLE)
    .select('id, profile_id, direction, amount, reason, reference_type, reference_id, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  query = applyDateRange(query, { period })

  const { data, error } = await query

  if (error) {
    // Ledger é importante, mas a tela financeira não deve cair inteira se uma coluna antiga variar.
    return {
      available: false,
      error: error.message,
      entries: 0,
      creditIn: 0,
      creditOut: 0,
    }
  }

  const rows = data || []
  const filteredRows = companionId
    ? rows.filter((row) => String(row.reference_id || '') === String(companionId))
    : rows

  return {
    available: true,
    entries: filteredRows.length,
    creditIn: filteredRows
      .filter((row) => ['entrada', 'in', 'credit'].includes(String(row.direction || '').toLowerCase()))
      .reduce((total, row) => total + safeNumber(row.amount), 0),
    creditOut: filteredRows
      .filter((row) => ['saida', 'saída', 'out', 'debit'].includes(String(row.direction || '').toLowerCase()))
      .reduce((total, row) => total + safeNumber(row.amount), 0),
  }
}

export async function getAdminFinancialSalesReport({
  period = '30d',
  companionId = null,
  mediaType = null,
  limit = 300,
  offset = 0,
} = {}) {
  const [{ deliveries, pagination }, ledger] = await Promise.all([
    loadDeliveries({ period, companionId, mediaType, limit, offset }),
    loadLedgerSummary({ period, companionId }),
  ])

  const paidSales = deliveries.filter((delivery) => delivery.charged)
  const freeDeliveries = deliveries.filter((delivery) => !delivery.charged)
  const totalCredits = sumCredits(deliveries)
  const paidCredits = sumCredits(paidSales)
  const uniqueCustomers = new Set(deliveries.map((delivery) => delivery.profile.id).filter(Boolean)).size
  const uniqueCompanions = new Set(deliveries.map((delivery) => delivery.companion.id).filter(Boolean)).size
  const uniqueCombinations = new Set(deliveries.map((delivery) => delivery.product.combinationId).filter(Boolean)).size

  const byCompanion = buildRankingFromSales(
    deliveries,
    (row) => row.companion.id,
    (row) => row.companion.name || row.companion.slug || 'Avatar sem nome',
    (row) => ({ companion: row.companion }),
  )

  const byMediaType = buildRankingFromSales(
    deliveries,
    (row) => row.product.mediaType || 'sem-tipo',
    (row, key) => key || 'Sem tipo de mídia',
  )

  const byCombination = buildRankingFromSales(
    deliveries,
    (row) => row.product.combinationId,
    (row) => row.product.signaturePath?.join(' • ') || row.product.combinationTitle || 'Combinação sem assinatura',
    (row) => ({
      companion: row.companion,
      mediaType: row.product.mediaType || null,
      signaturePath: row.product.signaturePath || [],
    }),
  )

  return {
    summary: {
      period,
      totalDeliveries: deliveries.length,
      paidSales: paidSales.length,
      freeDeliveries: freeDeliveries.length,
      totalCredits,
      paidCredits,
      averageTicketCredits: paidSales.length ? Math.round((paidCredits / paidSales.length) * 100) / 100 : 0,
      uniqueCustomers,
      uniqueCompanions,
      uniqueCombinations,
      ledger,
    },
    rankings: {
      byCompanion,
      byMediaType,
      byCombination,
    },
    recentSales: deliveries.slice(0, 30),
    pagination,
    guidance: {
      reopens: 'Reabertura da mesma entrega não gera nova entrega nem nova cobrança. Ela aparece como entrega existente no Cliente, não como venda duplicada.',
      sourceOfTruth: 'Receita bruta em créditos calculada a partir de user_media_deliveries.total_price_credits e campos de créditos usados.',
      nextStep: 'A próxima camada deve cruzar esta receita com repasse de atores e custo operacional.',
    },
  }
}
