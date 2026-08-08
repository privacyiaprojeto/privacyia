import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createCreationItems,
  createCreationTitle,
  createGuidedCombinationDraft,
  createGuidedProductionBatch,
  createSafeGuidedProductionBatch,
  getCreationAvatars,
  getCreationTitles,
  previewCreationCombinations,
  updateClientModelVisibility,
  type PreviewCombinationsPayload,
  type SafeGuidedProductionBatchPayload,
} from '@/features/adm/api/creationAdminApi'

export function useCreationTitles() {
  return useQuery({
    queryKey: ['admin-creation-titles'],
    queryFn: getCreationTitles,
    retry: 1,
  })
}

export function useCreationAvatars() {
  return useQuery({
    queryKey: ['admin-creation-avatars'],
    queryFn: getCreationAvatars,
    retry: 1,
  })
}

export function useCreateCreationTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createCreationTitle,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-creation-titles'] })
    },
  })
}

export function useCreateCreationItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ titleId, items }: { titleId: string; items: Array<{ name: string; description?: string }> }) => createCreationItems(titleId, items),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-creation-titles'] })
    },
  })
}

export function usePreviewCreationCombinations() {
  return useMutation({
    mutationFn: (payload: PreviewCombinationsPayload) => previewCreationCombinations(payload),
  })
}

export function useCreateGuidedCombinationDraft() {
  return useMutation({
    mutationFn: (payload: PreviewCombinationsPayload) => createGuidedCombinationDraft(payload),
  })
}

function invalidateFactoryPlanningQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
  ])
}

export function useCreateGuidedProductionBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: PreviewCombinationsPayload & { requestedVariants?: number; generateRealMedia?: boolean; dryRunOnly?: boolean; enqueueJobs?: boolean; confirmationPhrase?: string }) => createGuidedProductionBatch(payload),
    onSuccess: async () => {
      await invalidateFactoryPlanningQueries(queryClient)
    },
  })
}

export function useCreateSafeGuidedProductionBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: SafeGuidedProductionBatchPayload) => createSafeGuidedProductionBatch(payload),
    onSuccess: async () => {
      await invalidateFactoryPlanningQueries(queryClient)
    },
  })
}


export function useUpdateClientModelVisibility() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ combinationId, visibleToClient, priceCredits, isActive }: { combinationId: string; visibleToClient: boolean; priceCredits?: number; isActive?: boolean }) => updateClientModelVisibility(combinationId, { visibleToClient, priceCredits, isActive }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-creation-titles'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-creation-client-models'] }),
      ])
    },
  })
}
