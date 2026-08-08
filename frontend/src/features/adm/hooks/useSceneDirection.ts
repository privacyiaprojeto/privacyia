import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  completeBaseSceneUpload,
  createBaseScenePreview,
  createBaseSceneUploadSession,
  createSceneDirection,
  getProductSplits,
  listBaseScenes,
  listSceneCastingCandidates,
  listSceneDirections,
  listSplitBeneficiaries,
  replaceProductSplits,
  updateBaseScene,
  uploadBaseSceneFile,
  type BaseSceneType,
  type CreateSceneDirectionPayload,
  type ProductSplitDto,
} from '@/features/adm/api/sceneDirectionApi'

export function useBaseScenes(includeInactive = false) {
  return useQuery({
    queryKey: ['admin-scene-direction-base-scenes', includeInactive],
    queryFn: () => listBaseScenes(includeInactive),
  })
}

export function useCreateBaseScene() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ title, description, slotsCount, sceneType, file }: { title: string; description: string; slotsCount: number; sceneType?: BaseSceneType; file: File }) => {
      const session = await createBaseSceneUploadSession({
        title,
        description,
        slotsCount,
        sceneType: sceneType || (slotsCount === 1 ? 'scene_solo_f' : slotsCount === 3 ? 'scene_trio' : 'scene_duo_mf'),
        filename: file.name,
        contentType: 'video/mp4',
        byteSize: file.size,
      })
      await uploadBaseSceneFile(session.upload.url, file)
      return completeBaseSceneUpload(session.scene.id)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-scene-direction-base-scenes'] })
    },
  })
}

export function useUpdateBaseScene() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sceneId, payload }: { sceneId: string; payload: Parameters<typeof updateBaseScene>[1] }) => updateBaseScene(sceneId, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-scene-direction-base-scenes'] })
    },
  })
}

export function useBaseScenePreview() {
  return useMutation({ mutationFn: (sceneId: string) => createBaseScenePreview(sceneId) })
}

export function useSceneCastingCandidates() {
  return useQuery({
    queryKey: ['admin-scene-direction-casting-candidates'],
    queryFn: listSceneCastingCandidates,
  })
}

export function useSceneDirections() {
  return useQuery({
    queryKey: ['admin-scene-directions'],
    queryFn: listSceneDirections,
    refetchInterval: (query) => {
      const items = query.state.data?.items || []
      return items.some((item) => ['queued', 'processing'].includes(item.status)) ? 8000 : false
    },
  })
}

export function useCreateSceneDirection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSceneDirectionPayload) => createSceneDirection(payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-scene-directions'] })
    },
  })
}

export function useSplitBeneficiaries() {
  return useQuery({
    queryKey: ['admin-scene-direction-beneficiaries'],
    queryFn: listSplitBeneficiaries,
  })
}

export function useProductSplits(productId?: string | null) {
  return useQuery({
    queryKey: ['admin-product-splits', productId || 'none'],
    queryFn: () => getProductSplits(productId as string),
    enabled: Boolean(productId),
  })
}

export function useReplaceProductSplits() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ productId, splits }: { productId: string; splits: ProductSplitDto[] }) => replaceProductSplits(productId, splits),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['admin-product-splits', variables.productId] })
    },
  })
}
