import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { SocialLogin } from '@/features/auth/components/SocialLogin'
import { loginSchema, type LoginInput } from '@/features/auth/types'
import type { UseMutationResult } from '@tanstack/react-query'
import type { LoginResponse } from '@/features/auth/types'

interface LoginFormProps {
  mutation: UseMutationResult<LoginResponse, Error, LoginInput>
  infoMessage?: string | null
}

export function LoginForm({ mutation, infoMessage }: LoginFormProps) {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-5">
      {infoMessage && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {infoMessage}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder=" "
            {...register('email')}
            className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <label
            htmlFor="email"
            className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
          >
            E-mail
          </label>
        </div>
        {errors.email && <span className="text-xs text-red-400">{errors.email.message}</span>}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="relative">
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder=" "
            {...register('password')}
            className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pr-10 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
          />
          <label
            htmlFor="password"
            className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
          >
            Senha
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
        <button
          type="button"
          onClick={() => navigate('/forgot-password')}
          className="self-end text-xs text-zinc-500 transition hover:text-violet-400"
        >
          Esqueceu sua senha?
        </button>
      </div>

      {mutation.isError && (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {mutation.error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="mt-1 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 active:scale-95 disabled:opacity-50"
      >
        {mutation.isPending ? 'Entrando...' : 'Entrar'}
      </button>

      <SocialLogin />

      <p className="text-center text-xs text-zinc-500">
        Não tem uma conta?{' '}
        <button
          type="button"
          onClick={() => navigate('/sign-up')}
          className="font-medium text-violet-400 transition hover:text-violet-300"
        >
          Criar uma agora
        </button>
      </p>
    </form>
  )
}
