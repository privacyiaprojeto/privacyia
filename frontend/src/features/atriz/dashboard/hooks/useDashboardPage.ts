import { useState } from 'react'
import type { PeriodoDashboard } from '@/features/atriz/dashboard/types'
import { useDashboard } from '@/features/atriz/dashboard/hooks/useDashboardResumo'

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function weekAgoIso() {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return d.toISOString().split('T')[0]
}

export function useDashboardPage() {
  const [periodo, setPeriodo] = useState<PeriodoDashboard>('mensal')
  const [de, setDe] = useState(weekAgoIso())
  const [ate, setAte] = useState(todayIso())

  const query = useDashboard({
    periodo,
    de: periodo === 'personalizado' ? de : undefined,
    ate: periodo === 'personalizado' ? ate : undefined,
  })

  return {
    periodo,
    setPeriodo,
    de,
    setDe,
    ate,
    setAte,
    data: query.data,
    isLoading: query.isLoading,
  }
}
