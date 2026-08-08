import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createM45ControlledBatch,
  inspectM45QaAsset,
  preflightM45ControlledBatch,
  rejectM45SimulatedQaAsset,
  type M45ControlledBatchPayload,
  type M45QaActionPayload,
} from '@/features/adm/api/m45OperationalActionsApi'

const M45_QUERY_KEYS = [
  ['admin-m4-5a-operational-dashboard'],
  ['admin-m4-5a-real-production-readiness'],
  ['admin-m4-5a-qa-assets'],
  ['admin-m4-5a-rejected-assets'],
  ['admin-m4-5a-batches'],
]

async function invalidateM45(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all(
    M45_QUERY_KEYS.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  )
}

export function useM45InspectQaAsset() {
  return useMutation({
    mutationKey: ['admin-m4-5c-inspect-qa-asset'],
    mutationFn: (payload: M45QaActionPayload) => inspectM45QaAsset(payload),
  })
}

export function useM45RejectSimulatedQaAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['admin-m4-5c-reject-simulated-qa-asset'],
    mutationFn: rejectM45SimulatedQaAsset,
    onSuccess: async () => {
      await invalidateM45(queryClient)
    },
  })
}

export function useM45PreflightControlledBatch() {
  return useMutation({
    mutationKey: ['admin-m4-5d-preflight-controlled-batch'],
    mutationFn: (payload: M45ControlledBatchPayload) => preflightM45ControlledBatch(payload),
  })
}

export function useM45CreateControlledBatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['admin-m4-5d-create-controlled-batch'],
    mutationFn: (payload: M45ControlledBatchPayload) => createM45ControlledBatch(payload),
    onSuccess: async () => {
      await invalidateM45(queryClient)
    },
  })
}
