import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export type SceneUploadStatus = 'uploading' | 'ready' | 'failed'
export type SceneDirectionStatus = 'planned' | 'queued' | 'processing' | 'qa_pending' | 'completed' | 'failed' | 'cancelled'
export type BeneficiaryType = 'actor' | 'company'
export type BaseSceneType = 'scene_solo_f' | 'scene_solo_m' | 'scene_duo_mf' | 'scene_duo_ff' | 'scene_duo_mm' | 'scene_trio'

export interface BaseSceneDto {
  id: string
  title: string
  description: string
  slotsCount: number
  sceneType: BaseSceneType | null
  contentType: string
  byteSize: number | null
  uploadStatus: SceneUploadStatus
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
  previewEndpoint: string | null
}

export interface BaseSceneUploadSessionResponse {
  scene: BaseSceneDto
  upload: {
    url: string
    method: 'PUT'
    contentType: 'video/mp4'
    expiresInSeconds: number
  }
}

export interface SceneCastingCandidateDto {
  actorProfileId: string
  companionId: string
  authorizationId: string
  displayName: string
  legalName?: string | null
  email?: string | null
  beneficiaryType: BeneficiaryType
  companion?: {
    id: string
    name: string
    slug?: string | null
    avatarUrl?: string | null
  } | null
}

export interface SceneDirectionCastSlot {
  slotIndex: number
  participantType: 'actor' | 'virtual_extra'
  actorProfileId?: string | null
  companionId?: string | null
  authorizationId?: string | null
  displayName: string
  companionName?: string | null
  extraType?: string | null
  customDescription?: string | null
}

export interface SceneDirectionDto {
  id: string
  baseSceneId: string | null
  productionMode: 'v2v' | 'i2v'
  slotsCount: number
  castSlots: SceneDirectionCastSlot[]
  prompt: string
  status: SceneDirectionStatus
  queueJobId?: string | null
  outputAssetId?: string | null
  errorMessage?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface CreateSceneDirectionPayload {
  baseSceneId?: string | null
  productionMode: 'v2v' | 'i2v'
  slots: Array<
    | { slotIndex: number; participantType: 'actor'; actorProfileId: string; companionId?: string | null }
    | { slotIndex: number; participantType: 'virtual_extra'; extraType: 'generic_black_man' | 'generic_white_muscular_man' | 'generic_asian_woman' | 'custom'; customDescription?: string }
  >
  prompt: string
  execute?: boolean
}

export interface CreateSceneDirectionResponse {
  direction: SceneDirectionDto
  processing: {
    requested: boolean
    queued: boolean
    queueEnabled: boolean
    workersEnabled: boolean
    message: string
  }
}

export interface SplitBeneficiaryDto {
  id: string
  type: BeneficiaryType
  name: string
  legalName?: string | null
  email?: string | null
  active: boolean
}

export interface ProductSplitDto {
  id?: string
  productId?: string
  beneficiaryId: string
  beneficiaryType: BeneficiaryType
  beneficiaryName: string
  splitPercentage: number
  displayOnStorefront: boolean
  sortOrder: number
}

export interface ProductSplitsResponse {
  productId: string
  items: ProductSplitDto[]
  summary: {
    beneficiariesPercent: number
    platformPercent: number
    beneficiariesCount: number
  }
  message?: string
}

export async function listBaseScenes(includeInactive = false): Promise<{ items: BaseSceneDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: BaseSceneDto[] }>>('/api/admin/scene-direction/base-scenes', {
    params: { includeInactive },
  })
  return data.data
}

export async function createBaseSceneUploadSession(payload: {
  title: string
  description: string
  slotsCount: number
  sceneType: BaseSceneType
  filename: string
  contentType: 'video/mp4'
  byteSize: number
}): Promise<BaseSceneUploadSessionResponse> {
  const { data } = await api.post<ApiEnvelope<BaseSceneUploadSessionResponse>>('/api/admin/scene-direction/base-scenes/upload-session', payload)
  return data.data
}

export async function uploadBaseSceneFile(uploadUrl: string, file: File): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4' },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Não foi possível enviar o vídeo para o cofre privado. Tente novamente.')
  }
}

export async function completeBaseSceneUpload(sceneId: string): Promise<{ scene: BaseSceneDto; message: string }> {
  const { data } = await api.post<ApiEnvelope<{ scene: BaseSceneDto; message: string }>>(`/api/admin/scene-direction/base-scenes/${sceneId}/complete`)
  return data.data
}

export async function updateBaseScene(sceneId: string, payload: Partial<Pick<BaseSceneDto, 'title' | 'description' | 'slotsCount' | 'sceneType' | 'isActive'>>): Promise<{ scene: BaseSceneDto; message: string }> {
  const { data } = await api.patch<ApiEnvelope<{ scene: BaseSceneDto; message: string }>>(`/api/admin/scene-direction/base-scenes/${sceneId}`, payload)
  return data.data
}

export async function createBaseScenePreview(sceneId: string): Promise<{ scene: BaseSceneDto; preview: { url: string; contentType: string; expiresInSeconds: number; public: false } }> {
  const { data } = await api.get<ApiEnvelope<{ scene: BaseSceneDto; preview: { url: string; contentType: string; expiresInSeconds: number; public: false } }>>(`/api/admin/scene-direction/base-scenes/${sceneId}/preview`)
  return data.data
}

export async function listSceneCastingCandidates(): Promise<{ items: SceneCastingCandidateDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: SceneCastingCandidateDto[] }>>('/api/admin/scene-direction/casting-candidates')
  return data.data
}

export async function createSceneDirection(payload: CreateSceneDirectionPayload): Promise<CreateSceneDirectionResponse> {
  const { data } = await api.post<ApiEnvelope<CreateSceneDirectionResponse>>('/api/admin/scene-direction/directions', payload)
  return data.data
}

export async function listSceneDirections(): Promise<{ items: SceneDirectionDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: SceneDirectionDto[] }>>('/api/admin/scene-direction/directions')
  return data.data
}

export async function listSplitBeneficiaries(): Promise<{ items: SplitBeneficiaryDto[] }> {
  const { data } = await api.get<ApiEnvelope<{ items: SplitBeneficiaryDto[] }>>('/api/admin/scene-direction/beneficiaries')
  return data.data
}

export async function getProductSplits(productId: string): Promise<ProductSplitsResponse> {
  const { data } = await api.get<ApiEnvelope<ProductSplitsResponse>>(`/api/admin/scene-direction/products/${productId}/splits`)
  return data.data
}

export async function replaceProductSplits(productId: string, splits: ProductSplitDto[]): Promise<ProductSplitsResponse> {
  const { data } = await api.put<ApiEnvelope<ProductSplitsResponse>>(`/api/admin/scene-direction/products/${productId}/splits`, { splits })
  return data.data
}
