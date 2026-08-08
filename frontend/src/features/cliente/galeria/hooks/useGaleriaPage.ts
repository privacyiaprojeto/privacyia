import { useMemo, useState } from 'react'
import { useGaleria } from '@/features/cliente/galeria/hooks/useGaleria'
import { useDebounce } from '@/shared/hooks/useDebounce'

export function useGaleriaPage() {
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState<'todos' | 'imagem' | 'video' | 'audio'>('todos')
  const buscaDebounced = useDebounce(busca, 300)
  const { data, isLoading, refetch } = useGaleria(buscaDebounced || undefined)

  const entregas = useMemo(() => {
    const items = data?.items || []
    if (tipo === 'todos') return items

    return items.filter((item) => {
      const mediaType = String(item.asset?.mediaType || item.combination?.mediaType || '').toLowerCase()
      if (tipo === 'imagem') return ['imagem', 'image', 'foto', 'photo', 'picture'].includes(mediaType)
      if (tipo === 'video') return mediaType.includes('video') || mediaType.includes('vídeo') || mediaType.includes('live_action')
      if (tipo === 'audio') return mediaType.includes('audio') || mediaType.includes('áudio') || mediaType.includes('voice') || mediaType.includes('live_audio')
      return true
    })
  }, [data?.items, tipo])

  const resumo = useMemo(() => {
    const items = data?.items || []
    const totalCreditos = items.reduce((sum, item) => sum + Number(item.pricing?.totalPriceCredits || 0), 0)
    const avatars = new Set(items.map((item) => item.companion?.id).filter(Boolean))

    return {
      total: items.length,
      totalCreditos,
      avatars: avatars.size,
    }
  }, [data?.items])

  return {
    busca,
    setBusca,
    tipo,
    setTipo,
    entregas,
    resumo,
    isLoading,
    refetch,
  }
}
