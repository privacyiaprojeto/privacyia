import { LogOut } from 'lucide-react'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import { useLogout } from '@/features/auth/hooks/useLogout'

export function AtrizDashboard() {
  const user = useAuthStore((s) => s.user)
  const { logout } = useLogout()

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-900 p-6">
      <div className="rounded-2xl border border-zinc-700 bg-zinc-800 p-10 text-center">
        <span className="inline-block rounded-full bg-pink-500/20 px-4 py-1 text-sm font-medium text-pink-400">
          atriz
        </span>
        <h1 className="mt-4 text-2xl font-bold text-zinc-100">Painel da Atriz</h1>
        <p className="mt-2 text-zinc-400">Olá, <span className="text-zinc-200">{user?.name}</span></p>
        <p className="mt-1 text-xs text-zinc-500">{user?.email}</p>

        <button
          type="button"
          onClick={logout}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </div>
  )
}
