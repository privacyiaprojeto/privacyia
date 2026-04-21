import { Link } from 'react-router'
import { ShieldCheck, Bell, Wallet, User, LogOut } from 'lucide-react'
import clsx from 'clsx'
import { useScrollDirection } from '@/shared/hooks/useScrollDirection'
import { useCarteira } from '@/features/cliente/carteira/hooks/useCarteira'
import { useLogout } from '@/features/auth/hooks/useLogout'

export function Header() {
  const scrollDirection = useScrollDirection()
  const { data: carteira } = useCarteira()
  const { logout } = useLogout()

  return (
    <header
      className={clsx(
        'fixed inset-x-0 top-0 z-40 flex h-20 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-6 transition-transform duration-300',
        scrollDirection === 'down' ? '-translate-y-full' : 'translate-y-0'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600">
          <ShieldCheck size={14} className="text-white" />
        </div>
        <span className="bg-gradient-to-br from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-sm font-bold tracking-tight text-transparent">
          Privacy IA
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Link
          to="/cliente/carteira"
          className="flex h-9 items-center gap-2 rounded-full bg-zinc-800 px-3 text-white transition hover:bg-zinc-700"
        >
          <Wallet size={18} />
          <span className="text-sm font-medium">{carteira?.creditos ?? 0}</span>
        </Link>

        <Link
          to="/cliente/notificacoes"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white transition hover:bg-zinc-700"
          aria-label="Ir para notificações"
          title="Notificações"
        >
          <Bell size={18} />
        </Link>

        <Link
          to="/cliente/perfil"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white transition hover:bg-zinc-700"
          aria-label="Ir para perfil"
          title="Perfil"
        >
          <User size={18} />
        </Link>

        <button
          type="button"
          onClick={logout}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white transition hover:bg-red-600"
          aria-label="Sair da conta"
          title="Sair"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  )
}
