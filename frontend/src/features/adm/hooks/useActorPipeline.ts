import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveActorPipelineProduct,
  authorizeActorIdentityPreparation,
  createActorPipelineProduction,
  getActorPipelineSummary,
  getActorIdentityDatasetReadiness,
  listActorPipelinePublicationProducts,
  listActorPipelineReviewProducts,
  publishActorPipelineProduct,
  prepareActorIdentityLoraReadiness,
  prepareActorIdentityTrainingExecutionPlan,
  startActorIdentityTraining,
  refreshActorIdentityTrainingStatus,
  startActorIdentityPreview,
  refreshActorIdentityPreviewStatus,
  runActorIdentityVideoForensicAudit,
  runActorIdentityTrainingTargetAudit,
  decideActorIdentityReview,
  registerActorIdentityDataset,
  rejectActorPipelineProduct,
  type ActorPipelineProductionPayload,
  type ActorPipelinePublicationPayload,
  type ActorIdentityPreparationAuthorizationPayload,
  type ActorIdentityDatasetRegistrationPayload,
  type ActorIdentityTrainingExecutionPlanPayload,
  type ActorIdentityTrainingStartPayload,
  type ActorIdentityPreviewStartPayload,
  type ActorIdentityForensicAuditPayload,
  type ActorIdentityTrainingTargetAuditPayload,
  type ActorIdentityReviewDecisionPayload,
} from '@/features/adm/api/actorPipelineApi'

export function useActorPipelineSummary(actorId?: string | null) {
  return useQuery({
    queryKey: ['admin-actor-pipeline-summary', actorId || 'none'],
    queryFn: () => getActorPipelineSummary(actorId as string),
    enabled: Boolean(actorId),
    staleTime: 3000,
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => {
      const state = String(query.state.data?.identityLora?.state || '')
      const previewState = String(query.state.data?.identityLora?.review?.preview?.status || '')
      return ['training_pending', 'training_in_progress'].includes(state) || ['submitting', 'queued', 'running'].includes(previewState) ? 10000 : false
    },
    refetchIntervalInBackground: false,
  })
}

export function useActorIdentityDatasetReadiness(actorId?: string | null) {
  return useQuery({
    queryKey: ['admin-actor-identity-dataset-readiness', actorId || 'none'],
    queryFn: () => getActorIdentityDatasetReadiness(actorId as string),
    enabled: Boolean(actorId),
  })
}

export function useStartActorIdentityPreview(actorId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityPreviewStartPayload) => startActorIdentityPreview(actorId as string, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-actor-pipeline-summary', actorId || 'none'] })
    },
  })
}

export function useRefreshActorIdentityPreviewStatus(actorId?: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshActorIdentityPreviewStatus(actorId as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-actor-pipeline-summary', actorId || 'none'] })
    },
  })
}


export function useRunActorIdentityVideoForensicAudit(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityForensicAuditPayload) => runActorIdentityVideoForensicAudit(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useRunActorIdentityTrainingTargetAudit(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityTrainingTargetAuditPayload) => runActorIdentityTrainingTargetAudit(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useDecideActorIdentityReview(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityReviewDecisionPayload) => decideActorIdentityReview(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useActorPipelineReviewProducts(actorId?: string | null) {
  return useQuery({
    queryKey: ['admin-actor-pipeline-review', actorId || 'none'],
    queryFn: () => listActorPipelineReviewProducts(actorId as string),
    enabled: Boolean(actorId),
    refetchInterval: 12000,
  })
}

export function useActorPipelinePublicationProducts(actorId?: string | null) {
  return useQuery({
    queryKey: ['admin-actor-pipeline-publication', actorId || 'none'],
    queryFn: () => listActorPipelinePublicationProducts(actorId as string),
    enabled: Boolean(actorId),
  })
}

function invalidateActorPipeline(queryClient: ReturnType<typeof useQueryClient>, actorId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin-actor-pipeline-summary', actorId] }),
    queryClient.invalidateQueries({ queryKey: ['admin-actor-identity-dataset-readiness', actorId] }),
    queryClient.invalidateQueries({ queryKey: ['admin-actor-pipeline-review', actorId] }),
    queryClient.invalidateQueries({ queryKey: ['admin-actor-pipeline-publication', actorId] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-assets'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-factory-summary'] }),
    queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
  ])
}

export function useAuthorizeActorIdentityPreparation(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityPreparationAuthorizationPayload) => authorizeActorIdentityPreparation(actorId, payload),
    onSuccess: async () => {
      await Promise.all([
        invalidateActorPipeline(queryClient, actorId),
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
      ])
    },
  })
}

export function useRegisterActorIdentityDataset(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityDatasetRegistrationPayload) => registerActorIdentityDataset(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function usePrepareActorIdentityLoraReadiness(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => prepareActorIdentityLoraReadiness(actorId),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function usePrepareActorIdentityTrainingExecutionPlan(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityTrainingExecutionPlanPayload) => prepareActorIdentityTrainingExecutionPlan(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useStartActorIdentityTraining(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorIdentityTrainingStartPayload) => startActorIdentityTraining(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useRefreshActorIdentityTrainingStatus(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshActorIdentityTrainingStatus(actorId),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useCreateActorPipelineProduction(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: ActorPipelineProductionPayload) => createActorPipelineProduction(actorId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}


export function useApproveActorPipelineProduct(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, notes }: { assetId: string; notes?: string }) => approveActorPipelineProduct(actorId, assetId, notes),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function useRejectActorPipelineProduct(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, reason }: { assetId: string; reason: string }) => rejectActorPipelineProduct(actorId, assetId, reason),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}

export function usePublishActorPipelineProduct(actorId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: ActorPipelinePublicationPayload }) => publishActorPipelineProduct(actorId, assetId, payload),
    onSuccess: async () => invalidateActorPipeline(queryClient, actorId),
  })
}
