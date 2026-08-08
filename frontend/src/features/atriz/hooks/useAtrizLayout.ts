import { useLocation, useNavigate } from 'react-router'
import { useAuthStore } from '@/shared/stores/useAuthStore'

const PAGE_TITLES: Record<string, string> = {
  '/atriz': 'Visão Geral',
  '/atriz/financeiro': 'Financeiro',
  '/atriz/mapeamento': 'Estúdio de Mapeamento',
  '/atriz/produtos': 'Meus Produtos',
  '/atriz/notificacoes': 'Notificações',
  '/atriz/configuracoes': 'Configurações',
  '/atriz/suporte': 'Suporte',
}

const CONFIG_SECTION_TITLES: Record<string, string> = {
  materiais: 'Envio de Materiais',
  suporte: 'Suporte',
  conta: 'Dados da Conta',
  pagamentos: 'Dados de Recebimento',
}

export function useAtrizLayout() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const section = new URLSearchParams(search).get('section') || ''
  const pageTitle = pathname === '/atriz/configuracoes' && section
    ? CONFIG_SECTION_TITLES[section] || PAGE_TITLES[pathname]
    : PAGE_TITLES[pathname] ?? 'Painel'

  function logout() {
    clearAuth()
    navigate('/sign-in')
  }

  return { pathname, pageTitle, user, logout }
}
