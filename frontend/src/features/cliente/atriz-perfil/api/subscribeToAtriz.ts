import { api } from '@/shared/lib/axios'

export interface SubscribeResponse {
  success: boolean
  status: 'active'
}

export async function subscribeToAtriz(companionId: string): Promise<SubscribeResponse> {
  const { data } = await api.post<SubscribeResponse>(`/atrizes/${companionId}/assinar`)
  return data
}
