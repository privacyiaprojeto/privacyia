import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useLogin } from '@/features/auth/hooks/useLogin'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { api } from '@/shared/lib/axios'
import { supabaseBrowser } from '@/shared/lib/supabaseBrowser'
import { parseApiError } from '@/shared/utils/parseApiError'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import type { LoginResponse } from '@/features/auth/types'

const rolePaths = {
  cliente: '/cliente/feed',
  atriz: '/atriz',
  adm: '/adm',
} as const

export function SignIn() {
  const mutation = useLogin()
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [searchParams] = useSearchParams()
  const [oauthError, setOauthError] = useState<string | null>(null)
  const [oauthLoading, setOauthLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function hydrateGoogleSession() {
      if (searchParams.get('oauth') !== 'google') return

      try {
        setOauthLoading(true)
        setOauthError(null)

        const { data, error } = await supabaseBrowser.auth.getSession()
        if (error || !data.session?.access_token) {
          throw error || new Error('Sessão OAuth não encontrada.')
        }

        const token = data.session.access_token

        const response = await api.get<LoginResponse>('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!active) return

        setAuth(token, response.data.user)
        navigate(rolePaths[response.data.user.role], { replace: true })
      } catch (error) {
        if (!active) return
        setOauthError(parseApiError(error))
      } finally {
        if (active) {
          setOauthLoading(false)
        }
      }
    }

    hydrateGoogleSession()
    return () => {
      active = false
    }
  }, [navigate, searchParams, setAuth])

  const infoMessage = useMemo(() => {
    if (oauthLoading) {
      return 'Conectando sua conta Google...'
    }

    const signup = searchParams.get('signup')
    const email = searchParams.get('email')
    const confirmed = searchParams.get('confirmed')
    const reset = searchParams.get('reset')

    if (reset === 'success') {
      return 'Senha redefinida com sucesso. Entre com sua nova senha para acessar a plataforma.'
    }

    if (confirmed === '1') {
      return 'E-mail confirmado. Agora entre com sua senha para acessar a plataforma.'
    }

    if (signup === 'confirm') {
      return email
        ? `Conta criada. Enviamos a confirmação para ${email}. Verifique sua caixa de entrada antes de entrar.`
        : 'Conta criada. Verifique seu e-mail antes de entrar.'
    }

    return null
  }, [oauthLoading, searchParams])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/80 p-8 shadow-2xl shadow-violet-950/40 backdrop-blur-sm">
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-br from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Privacy IA
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Entre na sua conta</p>
          </div>

          {oauthError && (
            <p className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {oauthError}
            </p>
          )}

          <LoginForm mutation={mutation} infoMessage={infoMessage} />
        </div>
      </div>
    </div>
  )
}
