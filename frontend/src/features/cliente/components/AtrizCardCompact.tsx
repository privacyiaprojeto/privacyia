import { Link } from 'react-router'
import clsx from 'clsx'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface AtrizCardCompactProps {
  atriz: AtrizPerfil
  posicao?: number
  className?: string
}

export function AtrizCardCompact({ atriz, posicao, className }: AtrizCardCompactProps) {
  return (
    <Link
      to={`/cliente/atriz/${atriz.slug}`}
      className={clsx('flex flex-col items-center gap-2', className)}
    >
      {/* Banner 4:5 */}
      <div className="relative w-52">
        <div className="aspect-[4/5] w-full overflow-hidden rounded-xl">
          <img
            src={atriz.banner}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        </div>

        {/* Número de posição — inferior esquerdo do banner */}
        {posicao !== undefined && (
          <span className="absolute bottom-6 left-3 text-5xl font-black leading-none text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            {posicao}
          </span>
        )}

        {/* Avatar — sobrepõe a borda inferior do banner */}
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2">
          <img
            src={atriz.avatar}
            alt={atriz.nome}
            className="h-9 w-9 rounded-full border-2 border-zinc-900 object-cover"
          />
        </div>
      </div>

      {/* Nome */}
      <span className="w-52 truncate text-center text-xs text-zinc-300">
        {atriz.nome}
      </span>
    </Link>
  )
}
