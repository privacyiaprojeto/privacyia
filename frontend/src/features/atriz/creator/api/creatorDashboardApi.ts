import { api } from '@/shared/lib/axios'
import type {
  CreatorFinanceResponse,
  CreatorMappingRequirementsResponse,
  CreatorMappingResponse,
  CreatorOverviewResponse,
  CreatorProductsResponse,
  UploadCreatorMaterialInput,
  UploadCreatorMaterialResponse,
} from '@/features/atriz/creator/types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

function unwrapCreatorResponse<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data
  }

  return payload as T
}

export async function getCreatorOverview(): Promise<CreatorOverviewResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorOverviewResponse> | CreatorOverviewResponse>('/api/actor/creator/overview')
  return unwrapCreatorResponse(data)
}

export async function getCreatorMapping(): Promise<CreatorMappingResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorMappingResponse> | CreatorMappingResponse>('/api/actor/creator/mapping')
  return unwrapCreatorResponse(data)
}

export async function getCreatorMappingRequirements(): Promise<CreatorMappingRequirementsResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorMappingRequirementsResponse> | CreatorMappingRequirementsResponse>('/api/actor/mapping/requirements')
  return unwrapCreatorResponse(data)
}

export async function getCreatorProducts(): Promise<CreatorProductsResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorProductsResponse> | CreatorProductsResponse>('/api/actor/creator/products')
  return unwrapCreatorResponse(data)
}

export async function getCreatorFinance(): Promise<CreatorFinanceResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorFinanceResponse> | CreatorFinanceResponse>('/api/actor/creator/finance')
  return unwrapCreatorResponse(data)
}

export async function uploadCreatorMaterial(input: UploadCreatorMaterialInput): Promise<UploadCreatorMaterialResponse> {
  const { data } = await api.post<ApiEnvelope<UploadCreatorMaterialResponse> | UploadCreatorMaterialResponse>('/api/actor/mapping/assets/upload', input)
  return unwrapCreatorResponse(data)
}
