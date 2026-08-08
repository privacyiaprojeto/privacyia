import { Link } from 'react-router'
import type { Post } from '@/features/cliente/feed/types'

interface PostBannerStripProps {
  post: Post
}

function productLabel(post: Post) {
  const product = post.produto
  if (!product) return post.atriz.nome

  const mediaLabels: Record<string, string> = {
    image: 'Imagem',
    video: 'Vídeo',
    short_video: 'Vídeo curto',
    live_action: 'Live Action',
    audio: 'Áudio',
    live_audio: 'Áudio Live',
    audio_live: 'Áudio Live',
  }
  const media = mediaLabels[product.tipo] || 'Conteúdo'
  const price = Number(product.precoCreditos || 0)

  return price > 0
    ? `${product.nome} • ${media} • ${price} créditos`
    : `${product.nome} • ${media}`
}

export function PostBannerStrip({ post }: PostBannerStripProps) {
  const { atriz } = post

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

      {/* Avatar + produto — centralizados na altura, ancorados à esquerda */}
      <div className="absolute inset-y-0 left-3 right-3 flex items-center gap-2">
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-16 w-16 shrink-0 rounded-full border-2 border-white/40 object-cover"
        />
        <span className="truncate rounded-md bg-black/40 px-1.5 py-0.5 text-sm font-bold text-white backdrop-blur-sm">
          {productLabel(post)}
        </span>
      </div>
    </Link>
  )
}
