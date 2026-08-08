import { Link } from 'react-router'
import clsx from 'clsx'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface AtrizCardHorizontalProps {
  atriz: AtrizPerfil
  className?: string
}

export function AtrizCardHorizontal({ atriz, className }: AtrizCardHorizontalProps) {
  const banner = atriz.banner || atriz.thumbnailUrl || atriz.avatar || '/images/avatar-placeholder.png'
  const avatar = atriz.avatar || atriz.thumbnailUrl || banner || '/images/avatar-placeholder.png'

  return (
    <Link
      // Lógica solicitada por Lorenzo: mantém Link/layout original e abre o perfil pelo ID real quando vier da API.
      to={`/cliente/atriz/${atriz.id}`}
      className={clsx(
        'group relative flex h-20 w-full items-end overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900 transition hover:border-violet-500/60 hover:shadow-lg hover:shadow-violet-950/20',
        className,
      )}
    >
      <img
        src={banner}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105"
      />

      <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />

      <div className="relative flex min-w-0 items-center gap-3 px-3 pb-3">
        <img
          src={avatar}
          alt={atriz.nome}
          className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20 object-cover bg-zinc-800"
        />
        <span className="max-w-[10rem] truncate text-left text-sm font-semibold text-white drop-shadow">
          {atriz.nome}
        </span>
      </div>
    </Link>
  )
}
