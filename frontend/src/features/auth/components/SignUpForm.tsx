import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, X } from 'lucide-react'
import type { UseMutationResult } from '@tanstack/react-query'
import {
  signUpSchema,
  type SignUpInput,
  type SignUpResponse,
} from '@/features/auth/types'
import { SocialLogin } from '@/features/auth/components/SocialLogin'

interface PasswordRule {
  label: string
  test: (value: string) => boolean
}

const passwordRules: PasswordRule[] = [
  { label: 'Mínimo de 8 caracteres', test: (value) => value.length >= 8 },
  { label: 'Pelo menos uma maiúscula', test: (value) => /[A-Z]/.test(value) },
  { label: 'Pelo menos uma minúscula', test: (value) => /[a-z]/.test(value) },
  { label: 'Pelo menos um número', test: (value) => /[0-9]/.test(value) },
  { label: 'Pelo menos um símbolo', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

interface FloatingInputProps {
  id: string
  type?: string
  label: string
  autoComplete?: string
  registration: ReturnType<ReturnType<typeof useForm<SignUpInput>>['register']>
  error?: string
}

function FloatingInput({ id, type = 'text', label, autoComplete, registration, error }: FloatingInputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <input
          id={id}
          type={type}
          autoComplete={autoComplete}
          placeholder=" "
          {...registration}
          className="peer w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 pb-2 pt-5 text-sm text-zinc-100 outline-none transition focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
        />
        <label
          htmlFor={id}
          className="pointer-events-none absolute left-3 top-1.5 text-xs text-zinc-400 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-sm peer-placeholder-shown:text-zinc-500 peer-focus:top-1.5 peer-focus:text-xs peer-focus:text-violet-400"
        >
          {label}
        </label>
      </div>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  )
}

interface SignUpFormProps {
  mutation: UseMutationResult<SignUpResponse, Error, SignUpInput>
}

export function SignUpForm({ mutation }: SignUpFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
  })

  const passwordValue = useWatch({ control, name: 'password', defaultValue: '' })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-5">
      <FloatingInput
        id="username"
        label="Nome de usuário"
        autoComplete="username"
        registration={register('username')}
        error={errors.username?.message}
      />

      <FloatingInput
        id="email"
        type="email"
        label="E-mail"
        autoComplete="email"
        registration={register('email')}
        error={errors.email?.message}
      />

      <div className="flex flex-col gap-2">
        <FloatingInput
          id="password"
          type="password"
          label="Senha"
          autoComplete="new-password"
          registration={register('password')}
          error={errors.password?.message}
        />

        {passwordValue.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2.5">
            {passwordRules.map((rule) => {
              const passed = rule.test(passwordValue)
              return (
                <li key={rule.label} className="flex items-center gap-2">
                  <span className={passed ? 'text-violet-400' : 'text-zinc-600'}>
                    {passed ? <Check size={12} strokeWidth={3} /> : <X size={12} strokeWidth={3} />}
                  </span>
                  <span className={`text-xs transition ${passed ? 'text-zinc-300' : 'text-zinc-600'}`}>
                    {rule.label}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
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
        {mutation.isPending ? 'Criando conta...' : 'Criar conta'}
      </button>

      <SocialLogin />
    </form>
  )
}
