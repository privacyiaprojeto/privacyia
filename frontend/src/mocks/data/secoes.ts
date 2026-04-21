import { mockAtrizes } from '@/mocks/data/atrizes'

export interface Secao {
  id: string
  titulo: string
  atrizes: typeof mockAtrizes
}

// Embaralha para simular dados diferentes por seção
function pick(indices: number[]) {
  return indices.map((i) => mockAtrizes[i % mockAtrizes.length])
}

export const secoes: Secao[] = [
  {
    id: 'mais-cresceram',
    titulo: 'Mais cresceram',
    atrizes: pick([3, 7, 1, 9, 5, 0, 6]),
  },
  {
    id: 'em-alta',
    titulo: 'Em alta',
    atrizes: pick([6, 2, 8, 4, 10, 1, 3]),
  },
  {
    id: 'gratuitas',
    titulo: 'Perfis gratuitos',
    atrizes: pick([0, 5, 9, 2, 7, 4, 8]),
  },
  {
    id: 'bombando-chat',
    titulo: 'Bombando no chat',
    atrizes: pick([8, 3, 6, 0, 10, 2, 5]),
  },
  {
    id: 'ao-vivo',
    titulo: 'Chamadas ao vivo',
    atrizes: pick([1, 4, 7, 10, 3, 9, 6]),
  },
  {
    id: 'novas',
    titulo: 'Das mais novas',
    atrizes: pick([10, 6, 2, 8, 0, 4, 9]),
  },
]
