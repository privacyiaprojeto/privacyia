import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { usePerfil } from '@/features/cliente/perfil/hooks/usePerfil'
import { useAtualizarPerfil } from '@/features/cliente/perfil/hooks/useAtualizarPerfil'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import { useCreditos } from '@/shared/hooks/useCreditos'

export function usePerfilPage() {
  const navigate = useNavigate()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const { data: perfil, isLoading } = usePerfil()
  const { data: creditosData } = useCreditos()
  const atualizar = useAtualizarPerfil()

  const [promptLocal, setPromptLocal] = useState('')
  const [modalDados, setModalDados] = useState(false)

  useEffect(() => {
    if (perfil) setPromptLocal(perfil.promptTom)
  }, [perfil])

  const promptDirty = perfil != null && promptLocal !== perfil.promptTom

  function handleLogout() {
    clearAuth()
    navigate('/sign-in')
  }

  function handleSalvarPrompt() {
    atualizar.mutate({ promptTom: promptLocal })
  }

  return {
    perfil,
    isLoading,
    creditosData,
    atualizar,
    promptLocal,
    setPromptLocal,
    promptDirty,
    modalDados,
    setModalDados,
    handleLogout,
    handleSalvarPrompt,
  }
}