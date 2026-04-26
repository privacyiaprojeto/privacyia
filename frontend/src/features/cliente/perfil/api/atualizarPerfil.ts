import { api } from '@/shared/lib/axios'
import type { AtualizarPerfilInput, PerfilCliente } from '@/features/cliente/perfil/types'

export async function atualizarPerfil(input: AtualizarPerfilInput): Promise<PerfilCliente> {
  const { data } = await api.patch<PerfilCliente>('/cliente/perfil', input)
  return data
}
