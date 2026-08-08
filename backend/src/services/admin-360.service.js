import { getAdminFinancialSalesReport } from './admin-finance.service.js'
import { getActorPayoutFinanceReport } from './actor-finance.service.js'
import { getOperationalMarginReport } from './operational-cost.service.js'

function safeNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function mergeRankingRows(salesRows = [], marginRows = [], limit = 10) {
  const map = new Map()

  for (const row of salesRows || []) {
    if (!row?.id) continue
    map.set(row.id, {
      id: row.id,
      label: row.label || 'Sem nome',
      sales: safeNumber(row.sales),
      paidSales: safeNumber(row.paidSales),
      freeDeliveries: safeNumber(row.freeDeliveries),
      grossCredits: safeNumber(row.credits),
      estimatedPayoutCredits: 0,
      estimatedOperationalCostCredits: 0,
      estimatedMarginCredits: 0,
      marginPercent: 0,
      missingCost: 0,
      companion: row.companion || null,
      mediaType: row.mediaType || null,
      signaturePath: Array.isArray(row.signaturePath) ? row.signaturePath : [],
    })
  }

  for (const row of marginRows || []) {
    if (!row?.id) continue
    const current = map.get(row.id) || {
      id: row.id,
      label: row.label || 'Sem nome',
      sales: safeNumber(row.sales),
      paidSales: safeNumber(row.sales),
      freeDeliveries: 0,
      grossCredits: safeNumber(row.grossCredits),
      companion: row.companion || null,
      mediaType: row.mediaType || null,
      signaturePath: Array.isArray(row.signaturePath) ? row.signaturePath : [],
    }

    current.label = current.label || row.label || 'Sem nome'
    current.sales = Math.max(safeNumber(current.sales), safeNumber(row.sales))
    current.paidSales = Math.max(safeNumber(current.paidSales), safeNumber(row.sales))
    current.grossCredits = Math.max(safeNumber(current.grossCredits), safeNumber(row.grossCredits))
    current.estimatedPayoutCredits = safeNumber(row.estimatedPayoutCredits)
    current.estimatedOperationalCostCredits = safeNumber(row.estimatedOperationalCostCredits)
    current.estimatedMarginCredits = safeNumber(row.estimatedMarginCredits)
    current.marginPercent = safeNumber(row.marginPercent)
    current.missingCost = safeNumber(row.missingCost)
    current.companion = current.companion || row.companion || null
    current.mediaType = current.mediaType || row.mediaType || null
    current.signaturePath = current.signaturePath?.length ? current.signaturePath : Array.isArray(row.signaturePath) ? row.signaturePath : []

    map.set(row.id, current)
  }

  return [...map.values()]
    .sort((a, b) => safeNumber(b.estimatedMarginCredits) - safeNumber(a.estimatedMarginCredits) || safeNumber(b.grossCredits) - safeNumber(a.grossCredits) || safeNumber(b.sales) - safeNumber(a.sales))
    .slice(0, limit)
}

function buildActionItems({ salesReport, actorReport, marginReport }) {
  const items = []
  const missingPayoutRule = safeNumber(actorReport?.summary?.missingPayoutRule)
  const missingCost = safeNumber(marginReport?.summary?.missingCost)
  const negativeMargin = safeNumber(marginReport?.summary?.negativeMargin)
  const paidSales = safeNumber(salesReport?.summary?.paidSales)
  const revenue = safeNumber(salesReport?.summary?.totalCredits)

  if (missingPayoutRule > 0) {
    items.push({
      type: 'missing_payout_rule',
      severity: 'warning',
      title: 'Atores com venda sem regra de repasse',
      description: `${missingPayoutRule} vínculo(s) venderam, mas ainda não têm percentual de repasse configurado.`,
      count: missingPayoutRule,
    })
  }

  if (missingCost > 0) {
    items.push({
      type: 'missing_operational_cost',
      severity: 'warning',
      title: 'Vendas sem custo operacional configurado',
      description: `${missingCost} venda(s) ainda não têm custo por produto/lote. A margem pode estar maior do que a real.`,
      count: missingCost,
    })
  }

  if (negativeMargin > 0) {
    items.push({
      type: 'negative_margin',
      severity: 'danger',
      title: 'Produtos com margem negativa',
      description: `${negativeMargin} venda(s) ficaram com margem estimada negativa depois de repasse e custo.`,
      count: negativeMargin,
    })
  }

  if (paidSales === 0 || revenue === 0) {
    items.push({
      type: 'no_sales',
      severity: 'info',
      title: 'Sem vendas cobradas no período',
      description: 'Acompanhe publicação, preço e estoque de produtos para ativar novas vendas.',
      count: 0,
    })
  }

  if (items.length === 0) {
    items.push({
      type: 'healthy_operation',
      severity: 'success',
      title: 'Operação financeira sem alerta crítico',
      description: 'Receita, repasse e custo estão configurados para as vendas encontradas no período.',
      count: paidSales,
    })
  }

  return items
}

export async function getAdmin360FinancialReport({
  period = '30d',
  companionId = null,
  mediaType = null,
  limit = 500,
  offset = 0,
} = {}) {
  const [salesReport, actorReport, marginReport] = await Promise.all([
    getAdminFinancialSalesReport({ period, companionId, mediaType, limit, offset }),
    getActorPayoutFinanceReport({ period, limit, offset }),
    getOperationalMarginReport({ period, companionId, mediaType, limit, offset }),
  ])

  const grossCredits = safeNumber(salesReport?.summary?.totalCredits || marginReport?.summary?.grossCredits)
  const estimatedPayoutCredits = safeNumber(actorReport?.summary?.estimatedPayoutCredits || marginReport?.summary?.estimatedPayoutCredits)
  const platformBeforeCostsCredits = safeNumber(marginReport?.summary?.platformBeforeCostsCredits || grossCredits - estimatedPayoutCredits)
  const estimatedOperationalCostCredits = safeNumber(marginReport?.summary?.estimatedOperationalCostCredits)
  const estimatedMarginCredits = safeNumber(marginReport?.summary?.estimatedMarginCredits || platformBeforeCostsCredits - estimatedOperationalCostCredits)

  return {
    summary: {
      period,
      totalDeliveries: safeNumber(salesReport?.summary?.totalDeliveries),
      paidSales: safeNumber(salesReport?.summary?.paidSales),
      freeDeliveries: safeNumber(salesReport?.summary?.freeDeliveries),
      uniqueCustomers: safeNumber(salesReport?.summary?.uniqueCustomers),
      uniqueCompanions: safeNumber(salesReport?.summary?.uniqueCompanions),
      grossCredits,
      paidCredits: safeNumber(salesReport?.summary?.paidCredits),
      averageTicketCredits: safeNumber(salesReport?.summary?.averageTicketCredits),
      estimatedPayoutCredits,
      platformBeforeCostsCredits,
      estimatedOperationalCostCredits,
      estimatedMarginCredits,
      marginPercent: grossCredits > 0 ? Math.round((estimatedMarginCredits / grossCredits) * 10000) / 100 : 0,
      actorsReadyForReview: safeNumber(actorReport?.summary?.actorsReadyForReview),
      missingPayoutRule: safeNumber(actorReport?.summary?.missingPayoutRule),
      costConfigured: safeNumber(marginReport?.summary?.costConfigured),
      missingCost: safeNumber(marginReport?.summary?.missingCost),
      negativeMargin: safeNumber(marginReport?.summary?.negativeMargin),
    },
    rankings: {
      byCompanion: mergeRankingRows(salesReport?.rankings?.byCompanion, marginReport?.rankings?.byCompanion, 10),
      byCombination: mergeRankingRows(salesReport?.rankings?.byCombination, marginReport?.rankings?.byCombination, 10),
      byMediaType: salesReport?.rankings?.byMediaType || [],
    },
    actionItems: buildActionItems({ salesReport, actorReport, marginReport }),
    snapshots: {
      sales: salesReport?.summary || null,
      actorPayouts: actorReport?.summary || null,
      operationalMargin: marginReport?.summary || null,
    },
    recent: {
      sales: salesReport?.recentSales?.slice(0, 10) || [],
      margins: marginReport?.recentMargins?.slice(0, 10) || [],
      actorPayouts: actorReport?.items?.slice(0, 10) || [],
    },
    guidance: {
      mode: 'Painel consolidado somente leitura. Não cobra cliente, não paga ator/atriz, não altera carteira e não altera custo real.',
      formula: 'Margem estimada = receita bruta - repasse estimado - custo operacional estimado.',
      priority: 'Corrija primeiro produtos sem custo, depois atores sem regra de repasse e por fim produtos com margem negativa.',
    },
  }
}
