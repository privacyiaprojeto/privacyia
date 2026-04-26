import { useMutation } from '@tanstack/react-query'
import { alterarSenha } from '@/features/cliente/perfil/api/alterarSenha'

export function useAlterarSenha() {
  return useMutation({ mutationFn: alterarSenha })
}
