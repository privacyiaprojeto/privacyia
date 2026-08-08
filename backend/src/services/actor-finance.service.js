import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { isArchivedDemoOrTestRow } from './demo-test-hygiene.service.js'

const DELIVERIES_TABLE = 'user_media_deliveries'
const ACTORS_TABLE = 'actor_profiles'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const PAYOUT_METHODS_TABLE = 'actor_payout_method_requests'

function normalizePositiveInteger(value, fallback = 100, max = 1000) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function safeNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}


function normalizeOffset(value) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) return 0
  return parsed
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

function mapDeliverySale(delivery = {}, companion = null) {
  const credits = safeNumber(delivery.total_price_credits || delivery.universal_credits_used || delivery.companion_credits_used)

  return {
    id: delivery.id,
    createdAt: delivery.created_at || null,
    charged: credits > 0,
    credits,
    deliverySource: delivery.delivery_source || null,
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || companion.nome || null,
          slug: companion.slug || null,
        }
      : {
          id: delivery.companion_id,
          name: null,
          slug: null,
        },
    product: {
      mediaType: delivery.media_type || null,
      signaturePath: [],
    },
  }
}

async function loadSalesForActorFinance({ period = '30d', limit = 500, offset = 0 } = {}) {
  const safeLimit = normalizePositiveInteger(limit, 500, 2000)
  const safeOffset = normalizeOffset(offset)

  let query = supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  query = applyDateRange(query, { period })

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao carregar vendas/entregas para financeiro de atores.', error)
  }

  const deliveries = (data || []).filter((delivery) => !isArchivedDemoOrTestRow(delivery))
  const companionsById = await getRowsByIds(
    'companions',
    deliveries.map((delivery) => delivery.companion_id),
    'id, name, nome, slug',
  )

  return {
    sales: deliveries.map((delivery) => mapDeliverySale(delivery, companionsById.get(delivery.companion_id))),
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: deliveries.length,
      hasMore: deliveries.length === safeLimit,
    },
  }
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
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
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
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
      table,
      column,
      error: error.message,
    })
  }

  return data || []
}

function normalizePercentToBps(value) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  if (parsed > 0 && parsed <= 100) return Math.round(parsed * 100)
  return Math.min(Math.round(parsed), 10000)
}


function normalizeMediaTypePayouts(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  const allowedKeys = ['image', 'audio', 'video', 'liveAction']

  return allowedKeys.reduce((acc, key) => {
    const rule = source[key] && typeof source[key] === 'object' ? source[key] : {}
    const rawPercent = rule.payoutPercent ?? rule.percent ?? rule.actorPercent ?? null
    const rawBps = rule.payoutRateBps ?? rule.actorShareBps ?? rule.bps ?? null
    const bps = rawBps !== null && rawBps !== undefined
      ? Math.min(Math.max(Math.round(Number(rawBps || 0)), 0), 10000)
      : normalizePercentToBps(rawPercent)

    acc[key] = {
      payoutRateBps: bps,
      payoutPercent: Math.round((bps / 100) * 100) / 100,
    }
    return acc
  }, {})
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

function buildPayoutRule(actor = {}, authorization = null) {
  const actorMetadata = actor?.metadata || {}
  const authFinance = authorization?.finance_snapshot || {}
  const bps = readPayoutBpsFromMetadata(actorMetadata, authFinance)
  const mediaTypePayouts = actorMetadata?.finance?.mediaTypePayouts || authFinance?.mediaTypePayouts || {}
  const hasMediaTypePayout = Object.values(mediaTypePayouts || {}).some((rule) => safeNumber(rule?.payoutRateBps || rule?.bps) > 0)

  let source = 'not_configured'
  if (readPayoutBpsFromMetadata(actorMetadata, {}) > 0 || actorMetadata?.finance?.mediaTypePayouts) source = 'actor_profile'
  else if (readPayoutBpsFromMetadata({}, authFinance) > 0 || authFinance?.mediaTypePayouts) source = 'authorization'

  return {
    bps,
    percent: Math.round((bps / 100) * 100) / 100,
    source,
    configured: bps > 0 || hasMediaTypePayout,
    note: actorMetadata?.finance?.payoutNote || authFinance?.payoutNote || null,
    updatedAt: actorMetadata?.finance?.payoutConfiguredAt || null,
    updatedByProfileId: actorMetadata?.finance?.payoutConfiguredByProfileId || null,
    mediaTypePayouts,
  }
}

function mapActor(actor = {}) {
  return {
    id: actor.id,
    displayName: actor.display_name || actor.name || actor.nome || 'Ator/Atriz sem nome',
    email: actor.email || null,
    status: actor.status || null,
    productionStatus: actor.production_status || null,
    kycStatus: actor.kyc_status || null,
  }
}

function mapPayoutMethod(method = null) {
  if (!method) {
    return {
      status: 'not_configured',
      payoutType: null,
      pixKeyMasked: null,
      bankName: null,
      accountLast4: null,
      reviewedAt: null,
    }
  }

  return {
    status: method.status || null,
    payoutType: method.payout_type || null,
    pixKeyMasked: method.pix_key_masked || null,
    bankName: method.bank_name || null,
    accountLast4: method.account_last4 || null,
    reviewedAt: method.reviewed_at || null,
  }
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

function buildActorFinanceRow({ actor, authorization, companion, sales, payoutMethod }) {
  const payoutRule = buildPayoutRule(actor, authorization)
  const grossCredits = sales.reduce((total, sale) => total + safeNumber(sale.credits), 0)
  const paidSales = sales.filter((sale) => sale.charged).length
  const freeDeliveries = sales.filter((sale) => !sale.charged).length
  const estimatedPayoutCredits = Math.round((grossCredits * payoutRule.bps) / 10000)
  const payoutReady = grossCredits > 0 && payoutRule.configured

  return {
    actor: mapActor(actor),
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || companion.nome || null,
          slug: companion.slug || null,
        }
      : {
          id: authorization?.companion_id || null,
          name: null,
          slug: null,
        },
    authorization: authorization
      ? {
          id: authorization.id,
          status: authorization.status || null,
          startsAt: authorization.starts_at || null,
          endsAt: authorization.ends_at || null,
          authorizedForContentTypes: authorization.authorized_for_content_types || [],
        }
      : null,
    sales: {
      deliveries: sales.length,
      paidSales,
      freeDeliveries,
      grossCredits,
      averageTicketCredits: paidSales ? Math.round((grossCredits / paidSales) * 100) / 100 : 0,
      recent: sales.slice(0, 5).map((sale) => ({
        id: sale.id,
        createdAt: sale.createdAt,
        credits: safeNumber(sale.credits),
        charged: Boolean(sale.charged),
        mediaType: sale.product?.mediaType || null,
        signaturePath: sale.product?.signaturePath || [],
      })),
    },
    payout: {
      rule: payoutRule,
      grossCredits,
      estimatedPayoutCredits,
      platformEstimatedCredits: Math.max(grossCredits - estimatedPayoutCredits, 0),
      status: payoutReady ? 'pending_calculation' : grossCredits > 0 ? 'missing_rule' : 'no_sales',
      readyForReview: payoutReady,
      paymentMethod: mapPayoutMethod(payoutMethod),
    },
  }
}

function summarizeRows(rows = []) {
  const grossCredits = rows.reduce((total, row) => total + safeNumber(row.sales.grossCredits), 0)
  const estimatedPayoutCredits = rows.reduce((total, row) => total + safeNumber(row.payout.estimatedPayoutCredits), 0)
  const missingRule = rows.filter((row) => row.sales.grossCredits > 0 && !row.payout.rule.configured).length

  return {
    actorsWithSales: rows.filter((row) => row.sales.grossCredits > 0).length,
    actorsReadyForReview: rows.filter((row) => row.payout.readyForReview).length,
    missingPayoutRule: missingRule,
    grossCredits,
    estimatedPayoutCredits,
    platformEstimatedCredits: Math.max(grossCredits - estimatedPayoutCredits, 0),
    paidSales: rows.reduce((total, row) => total + safeNumber(row.sales.paidSales), 0),
    totalDeliveries: rows.reduce((total, row) => total + safeNumber(row.sales.deliveries), 0),
  }
}

async function loadAuthorizationsByCompanion(companionIds = []) {
  const rows = await getRowsByColumnValues(
    AUTHORIZATIONS_TABLE,
    'companion_id',
    companionIds,
    'id, companion_id, actor_profile_id, status, starts_at, ends_at, authorized_for_content_types, finance_snapshot, metadata, created_at, updated_at',
  )

  const activePriority = (row) => (row.status === 'active' ? 0 : 1)
  const grouped = groupBy(rows, (row) => row.companion_id)
  const result = new Map()

  for (const [companionId, authorizations] of grouped.entries()) {
    const sorted = [...authorizations].sort((a, b) => activePriority(a) - activePriority(b) || String(b.created_at || '').localeCompare(String(a.created_at || '')))
    result.set(companionId, sorted[0])
  }

  return result
}

async function loadPayoutMethodsByActor(actorIds = []) {
  const rows = await getRowsByColumnValues(
    PAYOUT_METHODS_TABLE,
    'actor_profile_id',
    actorIds,
    'id, actor_profile_id, status, payout_type, holder_name, pix_key_masked, bank_name, account_last4, reviewed_at, created_at, updated_at',
  )

  const grouped = groupBy(rows, (row) => row.actor_profile_id)
  const result = new Map()

  for (const [actorId, methods] of grouped.entries()) {
    const sorted = [...methods].sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))
    result.set(actorId, sorted[0])
  }

  return result
}

export async function getActorPayoutFinanceReport({ period = '30d', limit = 500, offset = 0 } = {}) {
  const { sales, pagination } = await loadSalesForActorFinance({ period, limit, offset })
  const companionIds = uniqueValues(sales.map((sale) => sale.companion?.id))
  const authorizationsByCompanion = await loadAuthorizationsByCompanion(companionIds)
  const actorIds = uniqueValues([...authorizationsByCompanion.values()].map((authorization) => authorization?.actor_profile_id))
  const actorsById = await getRowsByIds(
    ACTORS_TABLE,
    actorIds,
    'id, display_name, email, status, kyc_status, production_status, metadata',
  )
  const payoutMethodsByActor = await loadPayoutMethodsByActor(actorIds)
  const salesByCompanion = groupBy(sales, (sale) => sale.companion?.id || 'sem-avatar')

  const rows = [...salesByCompanion.entries()].map(([companionId, companionSales]) => {
    const authorization = authorizationsByCompanion.get(companionId) || null
    const actor = authorization?.actor_profile_id ? actorsById.get(authorization.actor_profile_id) : null

    if (!actor) {
      const firstSale = companionSales[0] || {}
      return {
        actor: {
          id: null,
          displayName: 'Ator/Atriz não vinculado',
          email: null,
          status: 'missing_link',
          productionStatus: null,
          kycStatus: null,
        },
        companion: firstSale.companion || { id: companionId, name: null, slug: null },
        authorization: authorization
          ? {
              id: authorization.id,
              status: authorization.status || null,
              startsAt: authorization.starts_at || null,
              endsAt: authorization.ends_at || null,
              authorizedForContentTypes: authorization.authorized_for_content_types || [],
            }
          : null,
        sales: {
          deliveries: companionSales.length,
          paidSales: companionSales.filter((sale) => sale.charged).length,
          freeDeliveries: companionSales.filter((sale) => !sale.charged).length,
          grossCredits: companionSales.reduce((total, sale) => total + safeNumber(sale.credits), 0),
          averageTicketCredits: 0,
          recent: companionSales.slice(0, 5).map((sale) => ({
            id: sale.id,
            createdAt: sale.createdAt,
            credits: safeNumber(sale.credits),
            charged: Boolean(sale.charged),
            mediaType: sale.product?.mediaType || null,
            signaturePath: sale.product?.signaturePath || [],
          })),
        },
        payout: {
          rule: {
            bps: 0,
            percent: 0,
            source: 'missing_actor_link',
            configured: false,
            note: null,
            updatedAt: null,
            updatedByProfileId: null,
          },
          grossCredits: companionSales.reduce((total, sale) => total + safeNumber(sale.credits), 0),
          estimatedPayoutCredits: 0,
          platformEstimatedCredits: companionSales.reduce((total, sale) => total + safeNumber(sale.credits), 0),
          status: 'missing_actor_link',
          readyForReview: false,
          paymentMethod: mapPayoutMethod(null),
        },
      }
    }

    return buildActorFinanceRow({
      actor,
      authorization,
      companion: companionSales[0]?.companion || null,
      sales: companionSales,
      payoutMethod: payoutMethodsByActor.get(actor.id) || null,
    })
  })
    .sort((a, b) => safeNumber(b.sales.grossCredits) - safeNumber(a.sales.grossCredits))

  return {
    summary: {
      period,
      salesSource: 'admin_financial_sales_report',
      ...summarizeRows(rows),
    },
    items: rows,
    guidance: {
      mode: 'Leitura e cálculo. Este relatório não executa pagamento e não altera carteira do cliente.',
      payoutRule: 'Repasse estimado usa a regra configurada no ator ou no vínculo/autorização do avatar. Sem regra, a venda fica como pendente de configuração.',
      nextStep: 'Após validar o cálculo, a próxima etapa pode criar fechamento mensal e status aprovado/pago, sem pagamento automático.',
    },
    pagination,
  }
}

export async function updateActorPayoutRule(actorId, payload = {}, { adminProfileId = null } = {}) {
  if (!actorId) throw new ApiError(400, 'Ator/Atriz obrigatório para configurar regra de repasse.')

  const rawPercent = payload.payoutPercent ?? payload.percent ?? payload.actorSharePercent ?? null
  const rawBps = payload.payoutRateBps ?? payload.actorShareBps ?? null
  const bps = rawBps !== null && rawBps !== undefined
    ? Math.min(Math.max(Math.round(Number(rawBps || 0)), 0), 10000)
    : normalizePercentToBps(rawPercent)

  if (!Number.isFinite(bps) || bps < 0 || bps > 10000) {
    throw new ApiError(400, 'Percentual de repasse inválido. Use valor entre 0 e 100%.')
  }

  const { data: actor, error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, display_name, email, status, kyc_status, production_status, metadata')
    .eq('id', actorId)
    .maybeSingle()

  if (actorError) throw new ApiError(500, 'Erro ao buscar ator/atriz para configurar repasse.', actorError)
  if (!actor) throw new ApiError(404, 'Ator/Atriz não encontrado para configurar repasse.')

  const metadata = actor.metadata && typeof actor.metadata === 'object' ? actor.metadata : {}
  const mediaTypePayouts = normalizeMediaTypePayouts(payload.mediaTypeSplits || payload.mediaTypePayouts || metadata.finance?.mediaTypePayouts || {})
  const nextMetadata = {
    ...metadata,
    finance: {
      ...(metadata.finance || {}),
      payoutRateBps: bps,
      payoutPercent: Math.round((bps / 100) * 100) / 100,
      payoutNote: payload.note || payload.notes || metadata.finance?.payoutNote || null,
      payoutConfiguredAt: new Date().toISOString(),
      payoutConfiguredByProfileId: adminProfileId,
      mediaTypePayouts,
      mediaTypeSplits: mediaTypePayouts,
      ruleKind: 'current_actor_media_type_split',
      source: 'admin_actor_finance_panel',
      retroactiveRecalculation: false,
    },
  }

  const updateCandidates = [
    {
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
      updated_by_profile_id: adminProfileId,
    },
    {
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    },
    {
      metadata: nextMetadata,
    },
  ]

  let updated = null
  let lastError = null

  for (const updatePayload of updateCandidates) {
    const { data, error } = await supabaseAdmin
      .from(ACTORS_TABLE)
      .update(updatePayload)
      .eq('id', actorId)
      .select('id, display_name, email, status, kyc_status, production_status, metadata')
      .maybeSingle()

    if (!error) {
      updated = data
      break
    }

    lastError = error
    if (!isMissingColumnError(error)) break
  }

  if (!updated) throw new ApiError(500, 'Erro ao salvar regra de repasse do ator/atriz.', lastError)

  return {
    actor: mapActor(updated),
    payoutRule: buildPayoutRule(updated),
  }
}
