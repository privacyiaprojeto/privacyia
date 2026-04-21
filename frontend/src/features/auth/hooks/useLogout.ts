import { useNavigate } from 'react-router'
import { queryClient } from '@/shared/lib/queryClient'
import { useAuthStore } from '@/shared/stores/useAuthStore'

export function useLogout() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((state) => state.clearAuth)

  function logout() {
    clearAuth()
    queryClient.clear()
    navigate('/sign-in', { replace: true })
  }

  return { logout }
}
