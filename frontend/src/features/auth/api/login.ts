import { api } from '@/shared/lib/axios'
import type { LoginInput, LoginResponse } from '@/features/auth/types'

export async function login(data: LoginInput): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/auth/login', data)
  return response.data
}
