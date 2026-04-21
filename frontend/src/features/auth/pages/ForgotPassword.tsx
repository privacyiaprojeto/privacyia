import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { supabaseBrowser } from '@/shared/lib/supabaseBrowser'

export function ForgotPassword() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit() {
    setError(null)

    if (!email.trim()) {
      setError('Informe seu e-mail.')
      return
    }

    setLoading(true)

    const { error } = await supabaseBrowser.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message || 'Não foi possível enviar o e-mail de recuperação.')
      return
    }

    setSubmittedEmail(email.trim())
    setSuccess(true)
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
            <p className="mt-2 text-sm text-zinc-400">Recuperação de senha</p>
          </div>

          {success ? (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
                <MailCheck size={22} />
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-zinc-200">Confira seu e-mail</p>
                <p className="text-xs leading-5 text-zinc-400">
                  {submittedEmail
                    ? `Se o endereço ${submittedEmail} existir na plataforma, enviaremos um link para redefinir sua senha.`
                    : 'Se o e-mail existir na plataforma, enviaremos um link para redefinir sua senha.'}
                </p>
              </div>

              <button
                onClick={() => navigate('/sign-in')}
                className="mt-2 w-full rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:border-violet-400/70 hover:bg-violet-500/20 hover:text-violet-200 active:scale-95"
              >
                Voltar ao login
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-xs leading-5 text-zinc-500">
                Informe seu e-mail e enviaremos um link para você criar uma nova senha.
              </p>

              <div className="relative">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                />
                <label
                  htmlFor="email"
                  className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
                >
                  E-mail
                </label>
              </div>

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
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
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
