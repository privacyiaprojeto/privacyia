import { Link } from 'react-router'
import { Heart, MessageCircle, Bookmark, User } from 'lucide-react'
import clsx from 'clsx'

interface PostActionsProps {
  atrizSlug: string
  curtido: boolean
  salvo: boolean
  curtidas: number
  onCurtir: () => void
  onSalvar: () => void
}

export function PostActions({ atrizSlug, curtido, salvo, curtidas, onCurtir, onSalvar }: PostActionsProps) {
  return (
    <div className="flex items-center gap-4 px-3 py-2">
      {/* Ir ao perfil */}
      <Link
        to={`/cliente/atriz/${atrizSlug}`}
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
      >
        <User size={18} />
      </Link>

      {/* Curtir */}
      <button
        type="button"
        onClick={onCurtir}
        className="flex items-center gap-1.5 text-zinc-400 transition hover:text-pink-400"
      >
        <Heart
          size={28}
          className={clsx('transition', curtido && 'fill-pink-500 text-pink-500')}
        />
        <span className="text-xs tabular-nums text-zinc-400">{curtidas}</span>
      </button>

      {/* Comentar */}
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
      >
        <MessageCircle size={28} />
      </button>

      {/* Salvar na galeria */}
      <button
        type="button"
        onClick={onSalvar}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-violet-400"
      >
        <Bookmark
          size={28}
          className={clsx('transition', salvo && 'fill-violet-500 text-violet-500')}
        />
      </button>
    </div>
  )
}
