import { api } from '@/shared/lib/axios'
import type { SignUpInput, SignUpResponse } from '@/features/auth/types'

export async function signUp(data: SignUpInput): Promise<SignUpResponse> {
  const response = await api.post<SignUpResponse>('/auth/sign-up', data)
  return response.data
}
