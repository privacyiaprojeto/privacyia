import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { signUp } from '@/features/auth/api/signUp'
import { parseApiError } from '@/shared/utils/parseApiError'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import type { SignUpInput } from '@/features/auth/types'

export function useSignUp() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: async (data: SignUpInput) => {
      try {
        return await signUp(data)
      } catch (error) {
        throw new Error(parseApiError(error))
      }
    },
    onSuccess: (data) => {
      if (data.token && data.user) {
        setAuth(data.token, data.user)
        navigate('/cliente/feed')
        return
      }

      const email = encodeURIComponent(data.email || '')
      navigate(`/sign-in?signup=confirm&email=${email}`)
    },
  })
}
