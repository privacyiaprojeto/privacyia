import { useState } from 'react'
import { useAtrizes } from '@/features/cliente/descobrir/hooks/useAtrizes'

type Tab = 'descobrir' | 'buscar'

function rotateList<T>(list: T[], startIndex: number) {
  if (!list.length) return []
  const offset = startIndex % list.length
  return [...list.slice(offset), ...list.slice(0, offset)]
}

export function useDescobrir() {
  const [tab, setTab] = useState<Tab>('descobrir')
  const [busca, setBusca] = useState('')
  const atrizesQuery = useAtrizes()
  const atrizes = atrizesQuery.data || []

  const atrizesFiltradas = busca.trim()
    ? atrizes.filter((atriz) => atriz.nome.toLowerCase().includes(busca.toLowerCase()))
    : atrizes

  const topCreators = atrizes.slice(0, 10)
  const bombandoNoChat = rotateList(atrizes, 2).slice(0, 10)
  const novosCriadores = rotateList(atrizes, 5).slice(0, 12)
  const rumoAoTopo = rotateList(atrizes, 8).slice(0, 8)
  const recentes = atrizes.slice(0, 5)

  return {
    tab,
    setTab,
    busca,
    setBusca,
    atrizesFiltradas,
    topCreators,
    bombandoNoChat,
    novosCriadores,
    rumoAoTopo,
    recentes,
    isLoading: atrizesQuery.isLoading,
    isError: atrizesQuery.isError,
  }
}
