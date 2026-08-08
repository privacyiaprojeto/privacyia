import { useQuery } from '@tanstack/react-query'
import {
  getM45Batches,
  getM45OperationalDashboard,
  getM45QaAssets,
  getM45RealProductionReadiness,
  getM45RejectedAssets,
} from '@/features/adm/api/m45OperationalApi'

export function useM45OperationalDashboard() {
  return useQuery({
    queryKey: ['admin-m4-5a-operational-dashboard'],
    queryFn: () => getM45OperationalDashboard(6),
    retry: 1,
  })
}

export function useM45RealProductionReadiness() {
  return useQuery({
    queryKey: ['admin-m4-5a-real-production-readiness'],
    queryFn: getM45RealProductionReadiness,
    retry: 1,
  })
}

export function useM45QaAssets() {
  return useQuery({
    queryKey: ['admin-m4-5a-qa-assets'],
    queryFn: () => getM45QaAssets(6),
    retry: 1,
  })
}

export function useM45RejectedAssets() {
  return useQuery({
    queryKey: ['admin-m4-5a-rejected-assets'],
    queryFn: () => getM45RejectedAssets(6),
    retry: 1,
  })
}

export function useM45Batches() {
  return useQuery({
    queryKey: ['admin-m4-5a-batches'],
    queryFn: () => getM45Batches(6),
    retry: 1,
  })
}
