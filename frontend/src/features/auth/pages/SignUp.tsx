import { useNavigate } from 'react-router'
import { useSignUp } from '@/features/auth/hooks/useSignUp'
import { SignUpForm } from '@/features/auth/components/SignUpForm'

export function SignUp() {
  const navigate = useNavigate()
  const mutation = useSignUp()

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950">

      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-4">
        <div className="rounded-2xl border border-violet-500/20 bg-zinc-900/80 p-8 shadow-2xl shadow-violet-950/40 backdrop-blur-sm">

          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-br from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              Privacy IA
            </h1>
            <p className="mt-2 text-sm text-zinc-400">Crie sua conta</p>
          </div>

          <SignUpForm mutation={mutation} />

          {/* Já tem conta */}
          <p className="mt-5 text-center text-xs text-zinc-500">
            Já tem uma conta?{' '}
            <button
              type="button"
              onClick={() => navigate('/sign-in')}
              className="font-medium text-violet-400 transition hover:text-violet-300"
            >
              Entrar
            </button>
          </p>

        </div>
      </div>
    </div>
  )
}
