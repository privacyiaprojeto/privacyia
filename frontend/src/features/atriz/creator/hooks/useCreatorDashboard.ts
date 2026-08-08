import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCreatorFinance,
  getCreatorMapping,
  getCreatorMappingRequirements,
  getCreatorOverview,
  getCreatorProducts,
  uploadCreatorMaterial,
} from '@/features/atriz/creator/api/creatorDashboardApi'

export const CREATOR_QUERY_KEYS = {
  overview: ['creator-dashboard', 'overview'] as const,
  mapping: ['creator-dashboard', 'mapping'] as const,
  mappingRequirements: ['creator-dashboard', 'mapping-requirements'] as const,
  products: ['creator-dashboard', 'products'] as const,
  finance: ['creator-dashboard', 'finance'] as const,
}

export function useCreatorOverview() {
  return useQuery({
    queryKey: CREATOR_QUERY_KEYS.overview,
    queryFn: getCreatorOverview,
    staleTime: 30_000,
  })
}

export function useCreatorMapping() {
  return useQuery({
    queryKey: CREATOR_QUERY_KEYS.mapping,
    queryFn: getCreatorMapping,
    staleTime: 30_000,
  })
}

export function useCreatorMappingRequirements() {
  return useQuery({
    queryKey: CREATOR_QUERY_KEYS.mappingRequirements,
    queryFn: getCreatorMappingRequirements,
    staleTime: 30_000,
  })
}

export function useCreatorProducts() {
  return useQuery({
    queryKey: CREATOR_QUERY_KEYS.products,
    queryFn: getCreatorProducts,
    staleTime: 30_000,
  })
}

export function useCreatorFinance() {
  return useQuery({
    queryKey: CREATOR_QUERY_KEYS.finance,
    queryFn: getCreatorFinance,
    staleTime: 30_000,
  })
}

export function useUploadCreatorMaterial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadCreatorMaterial,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: CREATOR_QUERY_KEYS.mapping }),
        queryClient.invalidateQueries({ queryKey: CREATOR_QUERY_KEYS.mappingRequirements }),
        queryClient.invalidateQueries({ queryKey: CREATOR_QUERY_KEYS.overview }),
      ])
    },
  })
}
