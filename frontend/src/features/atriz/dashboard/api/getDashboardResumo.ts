import { api } from '@/shared/lib/axios'
import type { DashboardData, PeriodoDashboard } from '@/features/atriz/dashboard/types'

export interface GetDashboardParams {
  periodo: PeriodoDashboard
  de?: string
  ate?: string
}

export async function getDashboard(params: GetDashboardParams): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/atriz/painel/dashboard', { params })
  return data
}
