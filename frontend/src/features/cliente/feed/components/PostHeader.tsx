import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router'
import { MoreHorizontal } from 'lucide-react'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface PostHeaderProps {
  atriz: AtrizPerfil
}

const MENU_ITEMS = ['Silenciar atriz', 'Denunciar', 'Ocultar post']

export function PostHeader({ atriz }: PostHeaderProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="flex items-center justify-between px-3 py-2">
      <Link
        to={`/cliente/atriz/${atriz.slug}`}
        className="flex items-center gap-2"
      >
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-500/40"
        />
        <span className="text-sm font-semibold text-zinc-100">{atriz.nome}</span>
      </Link>

      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <MoreHorizontal size={18} />
        </button>

        {open && (
          <div className="absolute right-0 top-9 z-10 w-44 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
            {MENU_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setOpen(false)}
                className="w-full px-4 py-2.5 text-left text-sm text-zinc-300 transition hover:bg-zinc-800"
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
