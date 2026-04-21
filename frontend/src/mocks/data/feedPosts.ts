import { mockAtrizes } from '@/mocks/data/atrizes'
import type { Post, Top10Item } from '@/features/cliente/feed/types'
import type { AtrizPerfil } from '@/shared/types/atriz'

function toAtrizPerfil(id: string): AtrizPerfil {
  const a = mockAtrizes.find((x) => x.id === id)!
  return { id: a.id, slug: a.slug, nome: a.nome, avatar: a.avatar, banner: a.banner }
}

export const feedPosts: Post[] = [
  { id: 'p1', atriz: toAtrizPerfil('1'), tipo: 'foto', url: 'https://picsum.photos/seed/sofia-post1/480/600', curtidas: 342, comentarios: 18, curtido: false, salvo: false },
  { id: 'p2', atriz: toAtrizPerfil('2'), tipo: 'video', url: mockAtrizes[1].videoUrl, curtidas: 518, comentarios: 34, curtido: false, salvo: false },
  { id: 'p3', atriz: toAtrizPerfil('3'), tipo: 'foto', url: 'https://picsum.photos/seed/luna-post1/480/600', curtidas: 204, comentarios: 9, curtido: true, salvo: false },
  { id: 'p4', atriz: toAtrizPerfil('4'), tipo: 'foto', url: 'https://picsum.photos/seed/aria-post1/480/600', curtidas: 631, comentarios: 41, curtido: false, salvo: true },
  { id: 'p5', atriz: toAtrizPerfil('5'), tipo: 'video', url: mockAtrizes[4].videoUrl, curtidas: 290, comentarios: 22, curtido: false, salvo: false },
]

export const sugestoesMock: AtrizPerfil[] = [2, 6, 7, 8, 9, 10].map((i) =>
  toAtrizPerfil(String(i)),
)

export const top10Mock: Top10Item[] = mockAtrizes.slice(0, 10).map((_, i) => ({
  posicao: i + 1,
  atriz: toAtrizPerfil(String(i + 1)),
}))
