import { NavLink } from 'react-router'
import { Home, Search, MessageCircle, Flame, Images, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'

interface NavItem {
  icon: LucideIcon
  label: string
  path: string
}

const navItems: NavItem[] = [
  { icon: Home,          label: 'Feed',       path: '/cliente/feed'         },
  { icon: Search,        label: 'Descobrir',  path: '/cliente/descobrir'    },
  { icon: MessageCircle, label: 'Chat',       path: '/cliente/chat'         },
  { icon: Flame,         label: 'Gerar NSFW', path: '/cliente/gerar-imagem' },
  { icon: Images,        label: 'Galeria',    path: '/cliente/galeria'      },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-center gap-2 border-t border-zinc-800 bg-zinc-900">
      {navItems.map(({ icon: Icon, label, path }) => (
        <NavLink
          key={path}
          to={path}
          className={({ isActive }) =>
            clsx(
              'flex flex-col items-center gap-1 px-30 py-3 text-[10px] transition',
              isActive
                ? 'text-violet-400'
                : 'text-white hover:text-zinc-300'
            )
          }
        >
          <Icon size={20} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
