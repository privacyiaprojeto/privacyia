import { api } from '@/shared/lib/axios'
import type { AlterarSenhaInput } from '@/features/cliente/perfil/types'

export async function alterarSenha(input: AlterarSenhaInput): Promise<void> {
  await api.post('/auth/change-password', input)
}
