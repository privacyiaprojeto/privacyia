import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router'
import { Home } from '@/features/landing'
import { SignIn, ForgotPassword, ResetPassword, SignUp } from '@/features/auth'
import { ClienteDashboard } from '@/features/cliente'
import { Feed } from '@/features/cliente/feed'
import { Descobrir } from '@/features/cliente/descobrir'
import { Notificacoes } from '@/features/cliente/notificacoes'
import { ChatPage } from '@/features/cliente/chat'
import { Galeria } from '@/features/cliente/galeria'
import { GerarImagem, GerarVideo } from '@/features/cliente/nsfw'
import { Carteira } from '@/features/cliente/carteira'
import { Perfil } from '@/features/cliente/perfil'
import { AtrizPerfilPage } from '@/features/cliente/atriz-perfil'
import { AtrizDashboard } from '@/features/atriz'
import { AdmDashboard } from '@/features/adm'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import type { UserRole } from '@/shared/types/user'

interface GuardProps {
  allowedRoles?: UserRole[]
}

function RouteGuard({ allowedRoles }: GuardProps) {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  if (!token || !user) {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`)
    return <Navigate to={`/sign-in?redirect=${redirect}`} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallbackByRole: Record<UserRole, string> = {
      cliente: '/cliente/feed',
      atriz: '/atriz',
      adm: '/adm',
    }

    return <Navigate to={fallbackByRole[user.role]} replace />
  }

  return <Outlet />
}

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/sign-up" element={<SignUp />} />

        <Route element={<RouteGuard allowedRoles={['cliente']} />}>
          <Route path="/cliente" element={<ClienteDashboard />} />
          <Route path="/cliente/feed" element={<Feed />} />
          <Route path="/cliente/descobrir" element={<Descobrir />} />
          <Route path="/cliente/notificacoes" element={<Notificacoes />} />
          <Route path="/cliente/chat" element={<ChatPage />} />
          <Route path="/cliente/chat/:id" element={<ChatPage />} />
          <Route path="/cliente/galeria" element={<Galeria />} />
          <Route path="/cliente/gerar-imagem" element={<GerarImagem />} />
          <Route path="/cliente/gerar-video" element={<GerarVideo />} />
          <Route path="/cliente/carteira" element={<Carteira />} />
          <Route path="/cliente/perfil" element={<Perfil />} />
          <Route path="/cliente/atriz/:slug" element={<AtrizPerfilPage />} />
        </Route>

        <Route element={<RouteGuard allowedRoles={['atriz']} />}>
          <Route path="/atriz" element={<AtrizDashboard />} />
        </Route>

        <Route element={<RouteGuard allowedRoles={['adm']} />}>
          <Route path="/adm" element={<AdmDashboard />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
