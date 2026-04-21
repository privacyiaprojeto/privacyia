import { Link } from 'react-router'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface PostBannerStripProps {
  atriz: AtrizPerfil
}

export function PostBannerStrip({ atriz }: PostBannerStripProps) {
  return (
    <Link
      to={`/cliente/atriz/${atriz.slug}`}
      className="relative flex h-28 w-1/2 overflow-hidden rounded-xl"
    >
      {/* Banner de fundo */}
      <img
        src={atriz.banner}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />

      {/* Gradiente */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Avatar + nome — centralizados na altura, ancorados à esquerda */}
      <div className="absolute inset-y-0 left-3 right-3 flex items-center gap-2">
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-16 w-16 shrink-0 rounded-full border-2 border-white/40 object-cover"
        />
        <span className="truncate rounded-md bg-black/40 px-1.5 py-0.5 text-sm font-bold text-white backdrop-blur-sm">
          {atriz.nome}
        </span>
      </div>
    </Link>
  )
}
