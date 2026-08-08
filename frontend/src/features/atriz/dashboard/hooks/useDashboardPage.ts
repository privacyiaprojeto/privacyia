import { useMemo, useState } from 'react'
import { useCreatorFinance, useCreatorOverview, useCreatorProducts } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import type { CreatorSale } from '@/features/atriz/creator/types'
import type { DashboardData, PeriodoDashboard } from '@/features/atriz/dashboard/types'

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function weekAgoIso() {
  const date = new Date()
  date.setDate(date.getDate() - 7)
  return date.toISOString().split('T')[0]
}

function periodBounds(periodo: PeriodoDashboard, de: string, ate: string) {
  const end = periodo === 'personalizado' && ate ? new Date(`${ate}T23:59:59.999`) : new Date()
  const start = periodo === 'personalizado' && de ? new Date(`${de}T00:00:00.000`) : new Date(end)

  if (periodo === 'diario') start.setHours(0, 0, 0, 0)
  if (periodo === 'semanal') start.setDate(start.getDate() - 6)
  if (periodo === 'mensal') start.setDate(start.getDate() - 29)

  return { start, end }
}

function salesInPeriod(sales: CreatorSale[], periodo: PeriodoDashboard, de: string, ate: string) {
  const { start, end } = periodBounds(periodo, de, ate)
  return sales.filter((sale) => {
    if (!sale.createdAt) return false
    const createdAt = new Date(sale.createdAt)
    return !Number.isNaN(createdAt.getTime()) && createdAt >= start && createdAt <= end
  })
}

function buildChart(sales: CreatorSale[]) {
  const totals = new Map<string, { timestamp: number; value: number }>()

  for (const sale of sales) {
    if (!sale.createdAt) continue
    const date = new Date(sale.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const key = date.toISOString().slice(0, 10)
    const current = totals.get(key) || { timestamp: date.getTime(), value: 0 }
    current.value += Number(sale.netPayoutCredits || 0)
    totals.set(key, current)
  }

  return [...totals.entries()]
    .sort(([, left], [, right]) => left.timestamp - right.timestamp)
    .map(([key, entry]) => ({
      label: new Date(`${key}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      valor: entry.value,
    }))
}

export function useDashboardPage() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('mensal')
  const [de, setDe] = useState(weekAgoIso())
  const [ate, setAte] = useState(todayIso())
  const overviewQuery = useCreatorOverview()
  const productsQuery = useCreatorProducts()
  const financeQuery = useCreatorFinance()

  const data = useMemo<DashboardData | undefined>(() => {
    const overview = overviewQuery.data
    const products = productsQuery.data
    const finance = financeQuery.data
    if (!overview || !products || !finance) return undefined

    const filteredSales = salesInPeriod(finance.recentSales || [], periodo, de, ate)
    const periodNetCredits = filteredSales.reduce((total, sale) => total + Number(sale.netPayoutCredits || 0), 0)
    const periodGrossCredits = filteredSales.reduce((total, sale) => total + Number(sale.grossCredits || 0), 0)

    const saleActivities = filteredSales.slice(0, 5).map((sale) => ({
      id: `sale-${sale.id}`,
      tipo: 'ganho' as const,
      descricao: `Venda de ${sale.productTitle}`,
      valor: sale.netPayoutCredits,
      criadaEm: sale.createdAt || overview.actor.updatedAt || new Date().toISOString(),
    }))

    const securityActivities = (overview.security.pendencies || []).slice(0, 3).map((pendency) => ({
      id: `pendency-${pendency.code}`,
      tipo: 'mensagem' as const,
      descricao: pendency.title,
      criadaEm: overview.security.mappingCase?.updatedAt || overview.actor.updatedAt || new Date().toISOString(),
    }))

    return {
      resumo: {
        ganhosMes: periodNetCredits,
        totalAssinantes: filteredSales.length,
        mensagensIA: overview.overview.activeProducts,
        imagensGeradas: overview.overview.pendingSecurityItems,
        creditosGastos: periodGrossCredits,
      },
      grafico: buildChart(filteredSales),
      atividades: [...saleActivities, ...securityActivities]
        .sort((left, right) => new Date(right.criadaEm).getTime() - new Date(left.criadaEm).getTime()),
      publication: {
        ok: true,
        publishedProducts: products.summary.activeProducts,
        hiddenProducts: products.summary.totalApprovedVariants,
        pendingProducts: overview.overview.pendingSecurityItems,
        products: products.products.map((product) => ({
          id: product.id,
          title: product.title,
          mediaType: product.mediaType,
          status: product.status,
          clientVisible: product.clientVisible,
          actorVisible: true,
          priceCredits: product.priceCredits,
          updatedAt: product.updatedAt,
        })),
        clientMediaVisibleBeforePurchase: false,
        protectedDeliveryOnly: true,
      },
    }
  }, [ate, de, financeQuery.data, overviewQuery.data, periodo, productsQuery.data])

  return {
    periodo,
    setPeriodo,
    de,
    setDe,
    ate,
    setAte,
    data,
    isLoading: overviewQuery.isLoading || productsQuery.isLoading || financeQuery.isLoading,
    isError: overviewQuery.isError || productsQuery.isError || financeQuery.isError,
  }
}
