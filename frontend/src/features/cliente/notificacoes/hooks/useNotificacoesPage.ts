import { useState } from 'react'
import { useNotificacoes } from '@/features/cliente/notificacoes/hooks/useNotificacoes'
import { usePreferencias } from '@/features/cliente/notificacoes/hooks/usePreferencias'
import { useMarcarTodasLidas } from '@/features/cliente/notificacoes/hooks/useMarcarTodasLidas'

export function useNotificacoesPage() {
  const [modalAberto, setModalAberto] = useState(false)

  const { data: todas = [], isLoading, isError, error } = useNotificacoes()
  const { data: preferencias } = usePreferencias()
  const { mutate: lerTudo, isPending: lendoTudo } = useMarcarTodasLidas()

  const visiveis = todas.filter((n) => {
    if (!preferencias) return true
    if (n.tipo === 'marketing' && !preferencias.marketing) return false
    if (n.tipo === 'sistema' && !preferencias.sistema) return false
    return true
  })

  const temNaoLida = visiveis.some((n) => !n.lida)

  return {
    modalAberto,
    setModalAberto,
    visiveis,
    preferencias,
    temNaoLida,
    isLoading,
    isError,
    error,
    lerTudo,
    lendoTudo,
  }
}