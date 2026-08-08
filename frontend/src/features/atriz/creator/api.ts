import { api } from '@/shared/lib/axios'
import type {
  CreatorFinanceResponse,
  CreatorMappingRequirementsResponse,
  CreatorMappingResponse,
  CreatorOverviewResponse,
  CreatorProductsResponse,
  UploadCreatorAssetInput,
  UploadCreatorAssetResponse,
} from '@/features/atriz/creator/types'

interface ApiEnvelope<T> {
  success: boolean
  data: T
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload && 'success' in payload) {
    return (payload as ApiEnvelope<T>).data
  }
  return payload as T
}

export async function getCreatorOverview(): Promise<CreatorOverviewResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorOverviewResponse>>('/api/actor/creator/overview')
  return unwrap(data)
}

export async function getCreatorMapping(): Promise<CreatorMappingResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorMappingResponse>>('/api/actor/creator/mapping')
  return unwrap(data)
}

export async function getCreatorMappingRequirements(): Promise<CreatorMappingRequirementsResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorMappingRequirementsResponse>>('/api/actor/mapping/requirements')
  return unwrap(data)
}

export async function uploadCreatorMappingAsset(input: UploadCreatorAssetInput): Promise<UploadCreatorAssetResponse> {
  const { data } = await api.post<ApiEnvelope<UploadCreatorAssetResponse>>('/api/actor/mapping/assets/upload', input)
  return unwrap(data)
}

export async function getCreatorProducts(): Promise<CreatorProductsResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorProductsResponse>>('/api/actor/creator/products')
  return unwrap(data)
}

export async function getCreatorFinance(): Promise<CreatorFinanceResponse> {
  const { data } = await api.get<ApiEnvelope<CreatorFinanceResponse>>('/api/actor/creator/finance')
  return unwrap(data)
}
