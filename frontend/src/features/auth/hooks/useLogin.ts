import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { login } from '@/features/auth/api/login'
import { parseApiError } from '@/shared/utils/parseApiError'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import type { LoginInput } from '@/features/auth/types'

const rolePaths = {
  cliente: '/cliente/feed',
  atriz: '/atriz',
  adm: '/adm',
} as const

export function useLogin() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (data: LoginInput) => {
      try {
        return await login(data)
      } catch (error) {
        throw new Error(parseApiError(error))
      }
    },
    onSuccess: (data) => {
      setAuth(data.token, data.user)
      navigate(rolePaths[data.user.role])
    },
  })
}
