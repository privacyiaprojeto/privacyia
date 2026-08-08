import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveKycAsset,
  approveKycCase,
  authorizeAvatarProduction,
  blockActorProfile,
  createActorKycCase,
  createActorProfile,
  createKycAssetEditedCopy,
  generateActorInvite,
  getActorKycCases,
  getActorProfiles,
  getAvatarComplianceReport,
  getAvatarProductionAuthorizations,
  getKycCase,
  getKycCaseMappingChecklist,
  registerKycAsset,
  reclassifyKycAsset,
  rejectKycAsset,
  rejectKycCase,
  revokeAvatarProductionAuthorization,
  unblockActorProfile,
  type AuthorizeAvatarProductionPayload,
  type CreateActorPayload,
  type CreateKycCasePayload,
  type CreateKycAssetEditedCopyPayload,
  type RegisterKycAssetPayload,
} from '@/features/adm/api/actorComplianceApi'

export function useActorProfiles(search = '') {
  return useQuery({
    queryKey: ['admin-actors', search],
    queryFn: () => getActorProfiles({ includeBlocked: true, search }),
    retry: 1,
    staleTime: 5000,
    refetchOnWindowFocus: 'always',
    refetchInterval: (query) => {
      const items = query.state.data?.items || []
      return items.some((actor) => ['queued', 'training'].includes(String(actor.identity?.status || ''))) ? 15000 : 60000
    },
    refetchIntervalInBackground: false,
  })
}

export function useCreateActorProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: CreateActorPayload) => createActorProfile(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-actors'] })
    },
  })
}

export function useBlockActorProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ actorId, reason }: { actorId: string; reason: string }) => blockActorProfile(actorId, reason),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-avatar-authorizations'] }),
      ])
    },
  })
}

export function useUnblockActorProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ actorId, reason }: { actorId: string; reason: string }) => unblockActorProfile(actorId, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-actors'] })
    },
  })
}

export function useGenerateActorInvite() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ actorId, email, expiresInDays }: { actorId: string; email?: string; expiresInDays?: number }) => generateActorInvite(actorId, { email, expiresInDays }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-actors'] })
    },
  })
}

export function useActorKycCases(actorId?: string | null) {
  return useQuery({
    queryKey: ['admin-actor-kyc-cases', actorId],
    queryFn: () => getActorKycCases(String(actorId)),
    enabled: Boolean(actorId),
    retry: 1,
  })
}

export function useKycCase(kycCaseId?: string | null) {
  return useQuery({
    queryKey: ['admin-kyc-case', kycCaseId],
    queryFn: () => getKycCase(String(kycCaseId)),
    enabled: Boolean(kycCaseId),
    retry: 1,
  })
}

export function useCreateActorKycCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ actorId, payload }: { actorId: string; payload: CreateKycCasePayload }) => createActorKycCase(actorId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', variables.actorId] }),
      ])
    },
  })
}


export function useKycCaseMappingChecklist(kycCaseId?: string | null) {
  return useQuery({
    queryKey: ['admin-kyc-case-mapping-checklist', kycCaseId],
    queryFn: () => getKycCaseMappingChecklist(String(kycCaseId)),
    enabled: Boolean(kycCaseId),
    retry: 1,
  })
}

export function useRegisterKycAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kycCaseId, payload }: { kycCaseId: string; payload: RegisterKycAssetPayload }) => registerKycAsset(kycCaseId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', variables.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', variables.kycCaseId] }),
      ])
    },
  })
}

export function useCreateKycAssetEditedCopy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, payload }: { assetId: string; payload: CreateKycAssetEditedCopyPayload }) => createKycAssetEditedCopy(assetId, payload),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.item.actorProfileId] }),
      ])
    },
  })
}

export function useReclassifyKycAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, mappingRequirementId, note }: { assetId: string; mappingRequirementId: string; note?: string }) => reclassifyKycAsset(assetId, mappingRequirementId, note),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.item.actorProfileId] }),
      ])
    },
  })
}

export function useApproveKycAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, note }: { assetId: string; note?: string }) => approveKycAsset(assetId, note),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.item.actorProfileId] }),
      ])
    },
  })
}

export function useRejectKycAsset() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId, reason }: { assetId: string; reason: string }) => rejectKycAsset(assetId, reason),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.item.kycCaseId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.item.actorProfileId] }),
      ])
    },
  })
}

export function useApproveKycCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kycCaseId, note }: { kycCaseId: string; note?: string }) => approveKycCase(kycCaseId, note),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.actorProfileId] }),
      ])
    },
  })
}

export function useRejectKycCase() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ kycCaseId, reason }: { kycCaseId: string; reason: string }) => rejectKycCase(kycCaseId, reason),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case', data.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-kyc-case-mapping-checklist', data.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-actor-kyc-cases', data.actorProfileId] }),
      ])
    },
  })
}



export function useAvatarComplianceReport(avatarId?: string | null, checkR2 = false, contentType?: string | null) {
  return useQuery({
    queryKey: ['admin-avatar-compliance-report', avatarId, checkR2, contentType || null],
    queryFn: () => getAvatarComplianceReport(String(avatarId), { checkR2, contentType }),
    enabled: Boolean(avatarId),
    retry: 1,
  })
}

export function useAvatarComplianceReports(
  avatars: Array<{ id?: string | null }>,
  contentType?: string | null,
  checkR2 = false,
) {
  return useQueries({
    queries: avatars.map((avatar) => ({
      queryKey: ['admin-avatar-compliance-report', avatar.id || null, checkR2, contentType || null],
      queryFn: () => getAvatarComplianceReport(String(avatar.id), { checkR2, contentType }),
      enabled: Boolean(avatar.id),
      retry: 1,
    })),
  })
}

export function useAvatarProductionAuthorizations(avatarId?: string | null) {
  return useQuery({
    queryKey: ['admin-avatar-authorizations', avatarId],
    queryFn: () => getAvatarProductionAuthorizations(String(avatarId)),
    enabled: Boolean(avatarId),
    retry: 1,
  })
}

export function useAuthorizeAvatarProduction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ avatarId, payload }: { avatarId: string; payload: AuthorizeAvatarProductionPayload }) => authorizeAvatarProduction(avatarId, payload),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-avatar-authorizations', variables.avatarId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-avatar-compliance-report', variables.avatarId] }),
      ])
    },
  })
}

export function useRevokeAvatarProductionAuthorization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ authorizationId, reason }: { authorizationId: string; reason: string }) => revokeAvatarProductionAuthorization(authorizationId, reason),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-actors'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-avatar-authorizations', data.item.companionId] }),
        queryClient.invalidateQueries({ queryKey: ['admin-avatar-compliance-report', data.item.companionId] }),
      ])
    },
  })
}
