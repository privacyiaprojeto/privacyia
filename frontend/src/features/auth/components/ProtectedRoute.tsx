import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import type { UserRole } from '@/shared/types/user'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

const defaultRolePath: Record<UserRole, string> = {
  cliente: '/cliente/feed',
  atriz: '/atriz',
  adm: '/adm',
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const token = useAuthStore((state) => state.token)
  const user = useAuthStore((state) => state.user)

  if (!token || !user) {
    const redirectTo = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={`/sign-in?redirect=${redirectTo}`} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={defaultRolePath[user.role]} replace />
  }

  return <Outlet />
}
