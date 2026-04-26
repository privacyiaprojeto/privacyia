import { PostHeader } from '@/features/cliente/feed/components/PostHeader'
import { PostBannerStrip } from '@/features/cliente/feed/components/PostBannerStrip'
import { PostMedia } from '@/features/cliente/feed/components/PostMedia'
import { PostActions } from '@/features/cliente/feed/components/PostActions'
import { usePostCard } from '@/features/cliente/feed/hooks/usePostCard'
import type { Post } from '@/features/cliente/feed/types'

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  const { curtido, curtidas, salvo, handleCurtir, handleSalvar } = usePostCard(post)

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      <PostHeader atriz={post.atriz} />
      <PostMedia tipo={post.tipo} url={post.url} nome={post.atriz.nome} />
      <div className="px-3 py-2">
        <PostBannerStrip atriz={post.atriz} />
      </div>
      <PostActions
        atrizSlug={post.atriz.slug}
        curtido={curtido}
        salvo={salvo}
        curtidas={curtidas}
        onCurtir={handleCurtir}
        onSalvar={handleSalvar}
      />
    </article>
  )
}