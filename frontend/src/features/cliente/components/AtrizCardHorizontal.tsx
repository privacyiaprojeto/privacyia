import { Link } from 'react-router'
import clsx from 'clsx'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface AtrizCardHorizontalProps {
  atriz: AtrizPerfil
  className?: string
}

export function AtrizCardHorizontal({ atriz, className }: AtrizCardHorizontalProps) {
  return (
    <Link
      to={`/cliente/atriz/${atriz.slug}`}
      className={clsx(
        'group relative flex h-24 w-full items-end overflow-hidden rounded-2xl',
        className,
      )}
    >
      {/* Banner como fundo */}
      <img
        src={atriz.banner}
        alt=""
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
      />

      {/* Gradiente da esquerda para legibilidade */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />

      {/* Avatar + nome */}
      <div className="relative flex items-center gap-3 px-4 pb-4">
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20 object-cover"
        />
        <span className="max-w-[10rem] truncate text-left text-sm font-semibold text-white drop-shadow">
          {atriz.nome}
        </span>
      </div>
    </Link>
  )
}
