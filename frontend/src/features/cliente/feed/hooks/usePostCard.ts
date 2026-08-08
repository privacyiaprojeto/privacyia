import { useState } from 'react'
import { useCurtirPost } from '@/features/cliente/feed/hooks/useCurtirPost'
import { useSalvarPost } from '@/features/cliente/feed/hooks/useSalvarPost'
import type { Post } from '@/features/cliente/feed/types'

export function usePostCard(post: Post) {
  const [curtido, setCurtido] = useState(post.curtido)
  const [curtidas, setCurtidas] = useState(post.curtidas)
  const [salvo, setSalvo] = useState(post.salvo)

  const curtirMutation = useCurtirPost()
  const salvarMutation = useSalvarPost()

  function handleCurtir() {
    const novo = !curtido
    setCurtido(novo)
    setCurtidas((n) => n + (novo ? 1 : -1))
    if (!post.readOnly) curtirMutation.mutate(post.id)
  }

  function handleSalvar() {
    setSalvo((v) => !v)
    if (!post.readOnly) salvarMutation.mutate(post.id)
  }

  return { curtido, curtidas, salvo, handleCurtir, handleSalvar }
}