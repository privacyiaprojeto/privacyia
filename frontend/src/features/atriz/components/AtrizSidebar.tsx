import { NavLink } from 'react-router'
import { LayoutDashboard, Wallet, Images, Users, Bell, Settings, LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import type { User } from '@/shared/types/user'

interface AtrizSidebarProps {
  user: User | null
  onLogout: () => void
}

const NAV_MAIN = [
  { label: 'Dashboard',     icon: LayoutDashboard, to: '/atriz',               end: true },
  { label: 'Financeiro',    icon: Wallet,           to: '/atriz/financeiro',    end: false },
  { label: 'Galeria',       icon: Images,           to: '/atriz/galeria',       end: false },
  { label: 'Assinantes',    icon: Users,            to: '/atriz/assinantes',    end: false },
  { label: 'Notificações',  icon: Bell,             to: '/atriz/notificacoes',  end: false },
] as const

const NAV_BOTTOM = [
  { label: 'Configurações', icon: Settings, to: '/atriz/configuracoes', end: false },
] as const

const NAV_ITEM_BASE = 'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors'
const NAV_ITEM_ACTIVE = 'bg-pink-500/15 text-pink-400'
const NAV_ITEM_IDLE = 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'

function navClass({ isActive }: { isActive: boolean }) {
  return clsx(NAV_ITEM_BASE, isActive ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)
}

export function AtrizSidebar({ user, onLogout }: AtrizSidebarProps) {
  const initials = (user?.name ?? 'A')
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()

  return (
    <aside className="flex h-screen w-64 flex-shrink-0 flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center gap-2 border-b border-zinc-800 px-5">
        <span className="text-xl font-bold text-zinc-100">Privacy</span>
        <span className="text-xl font-bold text-pink-500">IA</span>
        <span className="ml-1 rounded-md bg-pink-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-pink-400">
          Studio
        </span>
      </div>

      {/* Nav principal */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {NAV_MAIN.map(({ label, icon: Icon, to, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Nav inferior + user */}
      <div className="flex-shrink-0 border-t border-zinc-800 px-3 py-4 space-y-0.5">
        {NAV_BOTTOM.map(({ label, icon: Icon, to, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <Icon size={18} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}

        {/* Usuário */}
        <div className="mt-3 flex items-center gap-3 rounded-xl bg-zinc-800/60 p-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/20 text-sm font-bold text-pink-400">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-100">{user?.name ?? 'Atriz'}</p>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          <button
            onClick={onLogout}
            className="flex-shrink-0 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  )
}
