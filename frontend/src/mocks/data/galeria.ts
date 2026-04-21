import { mockAtrizes } from '@/mocks/data/atrizes'
import type { GaleriaAtriz } from '@/features/cliente/galeria/types'

export const galeriaAtrizes: GaleriaAtriz[] = mockAtrizes.map((a, i) => ({
  id: a.id,
  slug: a.slug,
  nome: a.nome,
  avatar: a.avatar,
  banner: a.banner,
  assinaturaAtiva: i % 3 !== 2,
  totalMidias: 4 + (i * 3) % 11,
  previewUrl: `https://picsum.photos/seed/${a.slug}-gal/400/400`,
}))
