import { useState } from 'react'
import { useGaleria } from '@/features/cliente/galeria/hooks/useGaleria'
import { useDebounce } from '@/shared/hooks/useDebounce'

export function useGaleriaPage() {
  const [busca, setBusca] = useState('')
  const buscaDebounced = useDebounce(busca, 300)
  const { data: atrizes = [], isLoading } = useGaleria(buscaDebounced || undefined)

  return { busca, setBusca, atrizes, isLoading }
}