import { useState } from 'react'
import type { PreferenciasNotificacao } from '@/features/cliente/notificacoes/types'
import { useSalvarPreferencias } from '@/features/cliente/notificacoes/hooks/useSalvarPreferencias'

export function useModalPreferencias(preferencias: PreferenciasNotificacao) {
  const [local, setLocal] = useState<PreferenciasNotificacao>(preferencias)
  const { mutate: salvar } = useSalvarPreferencias()

  function handleToggle(campo: keyof PreferenciasNotificacao) {
    const novoValor = !local[campo]
    setLocal((prev) => ({ ...prev, [campo]: novoValor }))
    salvar({ [campo]: novoValor })
  }

  return { local, handleToggle }
}