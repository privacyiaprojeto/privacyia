import { api } from '@/shared/lib/axios'
import type { PerfilCliente } from '@/features/cliente/perfil/types'

export async function getPerfil(): Promise<PerfilCliente> {
  const { data } = await api.get<PerfilCliente>('/cliente/perfil')
  return data
}
