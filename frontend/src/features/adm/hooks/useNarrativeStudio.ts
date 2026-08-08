import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createNarrativeDraft,
  getNarrativeStudioSpec,
  getNarrativeProductionConfig,
  inspectNarrativeProduction,
  listNarrativeDrafts,
  previewNarrativeProduct,
  previewNarrativeProduction,
  requestNarrativeProduction,
  type NarrativeStudioPayload,
} from '@/features/adm/api/narrativeStudioApi'

export function useNarrativeStudioSpec() {
  return useQuery({
    queryKey: ['admin-narrative-studio-spec'],
    queryFn: getNarrativeStudioSpec,
    retry: 1,
  })
}


export function useNarrativeDrafts() {
  return useQuery({
    queryKey: ['admin-narrative-studio-drafts'],
    queryFn: () => listNarrativeDrafts({ limit: 30 }),
    retry: 1,
  })
}

export function usePreviewNarrativeProduct() {
  return useMutation({
    mutationFn: (payload: NarrativeStudioPayload) => previewNarrativeProduct(payload),
  })
}

export function useCreateNarrativeDraft() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: NarrativeStudioPayload) => createNarrativeDraft(payload),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-factory-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-creation-client-models'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-narrative-studio-drafts'] }),
      ])
    },
  })
}


export function useNarrativeProductionConfig() {
  return useQuery({
    queryKey: ['admin', 'narrative-studio', 'production', 'config'],
    queryFn: getNarrativeProductionConfig,
  })
}

export function useNarrativeProductionInspect(draftId?: string) {
  return useQuery({
    queryKey: ['admin', 'narrative-studio', 'production', 'inspect', draftId || 'all'],
    queryFn: () => inspectNarrativeProduction(draftId),
  })
}

export function usePreviewNarrativeProduction() {
  return useMutation({
    mutationFn: previewNarrativeProduction,
  })
}

export function useRequestNarrativeProduction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: requestNarrativeProduction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'narrative-studio'] })
    },
  })
}
