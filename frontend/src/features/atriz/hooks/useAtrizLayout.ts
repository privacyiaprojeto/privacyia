import { useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/shared/stores/useAuthStore'

const PAGE_TITLES: Record<string, string> = {
  '/atriz': 'Dashboard',
  '/atriz/financeiro': 'Financeiro',  '/atriz/galeria': 'Galeria IA',
  '/atriz/assinantes': 'Assinantes',
  '/atriz/notificacoes': 'Notificações',
  '/atriz/configuracoes': 'Configurações',
}

export function useAtrizLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const pageTitle = PAGE_TITLES[pathname] ?? 'Painel'

  function logout() {
    clearAuth()
    navigate('/sign-in')
  }

  return { pathname, pageTitle, user, logout }
}
