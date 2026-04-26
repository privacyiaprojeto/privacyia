import { useQuery } from '@tanstack/react-query'
import { getDashboard, type GetDashboardParams } from '@/features/atriz/dashboard/api/getDashboardResumo'

export function useDashboard(params: GetDashboardParams) {
  return useQuery({
    queryKey: ['atriz-painel-dashboard', params],
    queryFn: () => getDashboard(params),
  })
}
