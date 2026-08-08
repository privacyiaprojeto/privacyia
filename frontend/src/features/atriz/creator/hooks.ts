import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getCreatorFinance,
  getCreatorMapping,
  getCreatorMappingRequirements,
  getCreatorOverview,
  getCreatorProducts,
  uploadCreatorMappingAsset,
} from '@/features/atriz/creator/api'

export const creatorQueryKeys = {
  overview: ['creator-dashboard', 'overview'] as const,
  mapping: ['creator-dashboard', 'mapping'] as const,
  mappingRequirements: ['creator-dashboard', 'mapping-requirements'] as const,
  products: ['creator-dashboard', 'products'] as const,
  finance: ['creator-dashboard', 'finance'] as const,
}

export function useCreatorOverview() {
  return useQuery({
    queryKey: creatorQueryKeys.overview,
    queryFn: getCreatorOverview,
  })
}

export function useCreatorMapping() {
  return useQuery({
    queryKey: creatorQueryKeys.mapping,
    queryFn: getCreatorMapping,
  })
}

export function useCreatorMappingRequirements() {
  return useQuery({
    queryKey: creatorQueryKeys.mappingRequirements,
    queryFn: getCreatorMappingRequirements,
  })
}

export function useUploadCreatorMappingAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: uploadCreatorMappingAsset,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.mapping }),
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.mappingRequirements }),
        queryClient.invalidateQueries({ queryKey: creatorQueryKeys.overview }),
      ])
    },
  })
}

export function useCreatorProducts() {
  return useQuery({
    queryKey: creatorQueryKeys.products,
    queryFn: getCreatorProducts,
  })
}

export function useCreatorFinance() {
  return useQuery({
    queryKey: creatorQueryKeys.finance,
    queryFn: getCreatorFinance,
  })
}
