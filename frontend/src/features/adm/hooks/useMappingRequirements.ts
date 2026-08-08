import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMappingRequirement,
  getMappingRequirements,
  inactivateMappingRequirement,
  updateMappingRequirement,
  type CreateMappingRequirementPayload,
  type UpdateMappingRequirementPayload,
} from '@/features/adm/api/mappingRequirementsApi'

export const mappingRequirementQueryKeys = {
  all: ['admin-mapping-requirements'] as const,
  list: (includeInactive: boolean) => ['admin-mapping-requirements', { includeInactive }] as const,
}

export function useMappingRequirements(includeInactive = true) {
  return useQuery({
    queryKey: mappingRequirementQueryKeys.list(includeInactive),
    queryFn: () => getMappingRequirements(includeInactive),
  })
}

function useInvalidateMappingRequirements() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: mappingRequirementQueryKeys.all }),
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard', 'mapping'] }),
      queryClient.invalidateQueries({ queryKey: ['creator-dashboard', 'mapping-requirements'] }),
    ])
  }
}

export function useCreateMappingRequirement() {
  const invalidate = useInvalidateMappingRequirements()
  return useMutation({
    mutationFn: (payload: CreateMappingRequirementPayload) => createMappingRequirement(payload),
    onSuccess: invalidate,
  })
}

export function useUpdateMappingRequirement() {
  const invalidate = useInvalidateMappingRequirements()
  return useMutation({
    mutationFn: ({ requirementId, payload }: { requirementId: string; payload: UpdateMappingRequirementPayload }) => updateMappingRequirement(requirementId, payload),
    onSuccess: invalidate,
  })
}

export function useInactivateMappingRequirement() {
  const invalidate = useInvalidateMappingRequirements()
  return useMutation({
    mutationFn: inactivateMappingRequirement,
    onSuccess: invalidate,
  })
}
