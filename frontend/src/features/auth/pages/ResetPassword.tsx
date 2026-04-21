import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Check, Loader2, X } from 'lucide-react'
import { supabaseBrowser } from '@/shared/lib/supabaseBrowser'
import { strongPasswordSchema } from '@/features/auth/types'

interface PasswordRule {
  label: string
  test: (value: string) => boolean
}

const passwordRules: PasswordRule[] = [
  { label: 'Mínimo de 8 caracteres', test: (v) => v.length >= 8 },
  { label: 'Pelo menos uma letra maiúscula', test: (v) => /[A-Z]/.test(v) },
  { label: 'Pelo menos uma letra minúscula', test: (v) => /[a-z]/.test(v) },
  { label: 'Pelo menos um número', test: (v) => /[0-9]/.test(v) },
  { label: 'Pelo menos um símbolo', test: (v) => /[^A-Za-z0-9]/.test(v) },
]

export function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkingLink, setCheckingLink] = useState(true)

  useEffect(() => {
    let mounted = true

    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
        setCheckingLink(false)
      }
    })

    supabaseBrowser.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) {
        setError(error.message)
        setCheckingLink(false)
        return
      }

      if (data.session) {
        setReady(true)
      }

      setCheckingLink(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const rules = useMemo(
    () =>
      passwordRules.map((rule) => ({
        ...rule,
        passed: rule.test(password),
      })),
    [password],
  )

  async function handleSubmit() {
    setError(null)

    const parsed = strongPasswordSchema.safeParse(password)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || 'Senha inválida.')
      return
    }

    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.')
      return
    }

    setLoading(true)

    const { error } = await supabaseBrowser.auth.updateUser({
      password,
    })

    setLoading(false)

    if (error) {
      setError(error.message || 'Não foi possível redefinir a senha.')
      return
    }

    await supabaseBrowser.auth.signOut()
    setSuccess(true)

    setTimeout(() => {
      navigate('/sign-in?reset=success')
    }, 1200)
  }

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
            <p className="mt-2 text-sm text-zinc-400">Definir nova senha</p>
          </div>

          {checkingLink ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <Loader2 size={24} className="animate-spin text-violet-400" />
              <p className="text-sm text-zinc-400">Validando seu link de recuperação...</p>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <Check size={22} />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-zinc-200">Senha atualizada</p>
                <p className="text-xs text-zinc-400">Redirecionando você para a tela de login...</p>
              </div>
            </div>
          ) : !ready ? (
            <div className="flex flex-col gap-5 text-center">
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                Seu link de recuperação está inválido ou expirou. Solicite um novo e-mail para continuar.
              </p>

              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95"
              >
                Solicitar novo link
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-xs leading-5 text-zinc-500">
                Digite sua nova senha. Ela deve seguir os mesmos critérios de segurança do cadastro.
              </p>

              <div className="relative">
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <label
                  htmlFor="password"
                  className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
                >
                  Nova senha
                </label>
              </div>

              <div className="relative">
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder=" "
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <label
                  htmlFor="confirmPassword"
                  className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
                >
                  Confirmar nova senha
                </label>
              </div>

              {password.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                  {rules.map((rule) => (
                    <li key={rule.label} className="flex items-center gap-2">
                      <span className={rule.passed ? 'text-violet-400' : 'text-zinc-600'}>
                        {rule.passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                      </span>
                      <span className={`text-xs transition ${rule.passed ? 'text-zinc-300' : 'text-zinc-600'}`}>
                        {rule.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {error && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Salvando...' : 'Salvar nova senha'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/sign-in')}
                className="flex items-center justify-center gap-1.5 text-xs text-zinc-500 transition hover:text-violet-400"
              >
                <ArrowLeft size={13} />
                Voltar ao login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
