import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router'
import {
  Rss,
  Compass,
  Bell,
  MessageCircle,
  Images,
  Sparkles,
  Clapperboard,
  Wallet,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'
import { useAuthStore } from '@/shared/stores/useAuthStore'

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: Rss,           label: 'Feed',         path: '/cliente/feed'         },
  { icon: Compass,       label: 'Descobrir',     path: '/cliente/descobrir'    },
  { icon: Bell,          label: 'Notificações',  path: '/cliente/notificacoes' },
  { icon: MessageCircle, label: 'Chat',           path: '/cliente/chat'         },
  { icon: Images,        label: 'Galeria',       path: '/cliente/galeria'      },
  { icon: Sparkles,      label: 'Gerar Imagem',  path: '/cliente/gerar-imagem' },
  { icon: Clapperboard,  label: 'Gerar Vídeo',   path: '/cliente/gerar-video'  },
  { icon: Wallet,        label: 'Carteira',      path: '/cliente/carteira'     },
  { icon: User,          label: 'Perfil',        path: '/cliente/perfil'       },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const { user, clearAuth } = useAuthStore()

  function handleLogout() {
    clearAuth()
    navigate('/sign-in')
  }

  return (
    <aside
      className={clsx(
        'relative flex h-screen flex-col border-r border-zinc-800 bg-zinc-900 transition-all duration-300',
        collapsed ? 'w-[68px]' : 'w-60'
      )}
    >
      {/* Botão de colapsar */}
      <button
        onClick={() => setCollapsed((prev) => !prev)}
        className="absolute -right-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-400 transition hover:text-zinc-100"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* Logo */}
      <div className={clsx('flex items-center gap-3 px-4 py-5', collapsed && 'justify-center px-0')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600">
          <ShieldCheck size={16} className="text-white" />
        </div>
        {!collapsed && (
          <span className="bg-gradient-to-br from-violet-300 via-purple-400 to-violet-600 bg-clip-text text-sm font-bold tracking-tight text-transparent">
            Privacy IA
          </span>
        )}
      </div>

      {/* Divisor */}
      <div className="mx-3 h-px bg-zinc-800" />

      {/* Navegação */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {navItems.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={path}
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-violet-600/15 text-violet-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Rodapé */}
      <div>
        <div className="mx-3 h-px bg-zinc-800" />
        <div className="flex flex-col gap-0.5 p-3">

          {/* Configurações */}
          <NavLink
            to="/cliente/configuracoes"
            title={collapsed ? 'Configurações' : undefined}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                collapsed && 'justify-center px-2',
                isActive
                  ? 'bg-violet-600/15 text-violet-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              )
            }
          >
            <Settings size={18} className="shrink-0" />
            {!collapsed && <span>Configurações</span>}
          </NavLink>

          {/* Usuário + Sair */}
          <div
            className={clsx(
              'flex items-center rounded-lg px-3 py-2',
              collapsed ? 'flex-col gap-2 px-2' : 'justify-between'
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600/20">
                <User size={14} className="text-violet-400" />
              </div>
              {!collapsed && (
                <span className="truncate text-xs text-zinc-300">{user?.name}</span>
              )}
            </div>

            <button
              onClick={handleLogout}
              title="Sair"
              className="text-zinc-500 transition hover:text-red-400"
            >
              <LogOut size={collapsed ? 16 : 14} />
            </button>
          </div>

        </div>
      </div>
    </aside>
  )
}
