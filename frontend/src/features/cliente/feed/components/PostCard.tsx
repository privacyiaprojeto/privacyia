import { useState } from 'react'
import { PostHeader } from '@/features/cliente/feed/components/PostHeader'
import { PostBannerStrip } from '@/features/cliente/feed/components/PostBannerStrip'
import { PostMedia } from '@/features/cliente/feed/components/PostMedia'
import { PostActions } from '@/features/cliente/feed/components/PostActions'
import { useCurtirPost } from '@/features/cliente/feed/hooks/useCurtirPost'
import { useSalvarPost } from '@/features/cliente/feed/hooks/useSalvarPost'
import type { Post } from '@/features/cliente/feed/types'

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  const [curtido, setCurtido] = useState(post.curtido)
  const [curtidas, setCurtidas] = useState(post.curtidas)
  const [salvo, setSalvo] = useState(post.salvo)

  const curtirMutation = useCurtirPost()
  const salvarMutation = useSalvarPost()

  function handleCurtir() {
    const novo = !curtido
    setCurtido(novo)
    setCurtidas((n) => n + (novo ? 1 : -1))
    curtirMutation.mutate(post.id)
  }

  function handleSalvar() {
    setSalvo((v) => !v)
    salvarMutation.mutate(post.id)
  }

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
