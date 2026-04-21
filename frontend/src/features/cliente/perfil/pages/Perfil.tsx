import { LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { useLogout } from '@/features/auth/hooks/useLogout'
import { useAuthStore } from '@/shared/stores/useAuthStore'

export function Perfil() {
  const user = useAuthStore((state) => state.user)
  const { logout } = useLogout()

  return (
    <ClienteLayout>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6 md:p-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Perfil</h1>
          <p className="mt-1 text-sm text-zinc-400">Confira os dados da sessão atual e saia com segurança quando terminar.</p>
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-600/20 text-violet-300">
              <UserRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">{user?.name ?? 'Usuário autenticado'}</h2>
              <p className="text-sm text-zinc-400">Sessão atual ativa</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <Mail size={16} className="text-zinc-400" />
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">E-mail</p>
                <p className="text-sm text-zinc-200">{user?.email ?? 'Não informado'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <ShieldCheck size={16} className="text-zinc-400" />
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-500">Perfil</p>
                <p className="text-sm capitalize text-zinc-200">{user?.role ?? 'cliente'}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
          <h3 className="text-sm font-semibold text-zinc-100">Encerrar sessão</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Ao sair, o token local é removido. Como a sessão agora usa armazenamento de aba, fechar a aba também exigirá novo login.
          </p>

          <button
            type="button"
            onClick={logout}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500 active:scale-[0.98]"
          >
            <LogOut size={16} />
            Sair da conta
          </button>
        </section>
      </div>
    </ClienteLayout>
  )
}
