import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react'
import { supabaseBrowser } from '@/shared/lib/supabaseBrowser'
import { strongPasswordSchema } from '@/features/auth/types'
import { z } from 'zod'

const resetPasswordSchema = z
  .object({
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirme sua senha'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  })

type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

export function ResetPassword() {
  const navigate = useNavigate()
  const [sessionReady, setSessionReady] = useState(false)
  const [loadingSession, setLoadingSession] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  })

  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseBrowser.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) {
        setSessionReady(true)
      }
      setLoadingSession(false)
    })

    supabaseBrowser.auth.getSession().then(({ data, error }) => {
      if (error) {
        setGlobalError(error.message || 'Não foi possível validar o link de redefinição.')
        setLoadingSession(false)
        return
      }

      setSessionReady(Boolean(data.session))
      setLoadingSession(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function onSubmit(data: ResetPasswordInput) {
    setGlobalError(null)
    setSubmitting(true)

    const { error } = await supabaseBrowser.auth.updateUser({
      password: data.password,
    })

    setSubmitting(false)

    if (error) {
      setGlobalError(error.message || 'Não foi possível redefinir sua senha.')
      return
    }

    setSuccess(true)

    await supabaseBrowser.auth.signOut()
  }

  const passwordValue = watch('password') || ''

  const passwordChecks = useMemo(
    () => [
      { label: '8+ caracteres', ok: passwordValue.length >= 8 },
      { label: '1 maiúscula', ok: /[A-Z]/.test(passwordValue) },
      { label: '1 minúscula', ok: /[a-z]/.test(passwordValue) },
      { label: '1 número', ok: /[0-9]/.test(passwordValue) },
      { label: '1 símbolo', ok: /[^A-Za-z0-9]/.test(passwordValue) },
    ],
    [passwordValue],
  )

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

          {loadingSession ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-zinc-400">
              <Loader2 size={16} className="animate-spin" />
              Validando link...
            </div>
          ) : success ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <ShieldCheck size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-100">Senha redefinida</p>
                <p className="text-xs leading-5 text-zinc-400">
                  Sua senha foi atualizada com sucesso. Agora você já pode entrar com a nova senha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/sign-in?reset=success')}
                className="mt-2 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95"
              >
                Ir para o login
              </button>
            </div>
          ) : sessionReady ? (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
              {globalError && (
                <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {globalError}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder=" "
                    {...register('password')}
                    className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pr-10 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                  <label
                    htmlFor="password"
                    className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
                  >
                    Nova senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-200"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && <span className="text-xs text-red-400">{errors.password.message}</span>}
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
                <p className="mb-2 text-xs font-medium text-zinc-400">Sua senha precisa ter:</p>
                <div className="grid grid-cols-2 gap-2">
                  {passwordChecks.map((item) => (
                    <span
                      key={item.label}
                      className={`text-[11px] ${item.ok ? 'text-emerald-400' : 'text-zinc-500'}`}
                    >
                      {item.ok ? '✓' : '•'} {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="relative">
                  <input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder=" "
                    {...register('confirmPassword')}
                    className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pr-10 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                  />
                  <label
                    htmlFor="confirmPassword"
                    className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
                  >
                    Confirmar nova senha
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-200"
                    tabIndex={-1}
                    aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="text-xs text-red-400">{errors.confirmPassword.message}</span>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
                {submitting ? 'Salvando...' : 'Salvar nova senha'}
              </button>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                O link de redefinição é inválido ou expirou.
              </p>
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="w-full rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:border-violet-400/70 hover:bg-violet-500/20 hover:text-violet-200 active:scale-95"
              >
                Solicitar novo link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
