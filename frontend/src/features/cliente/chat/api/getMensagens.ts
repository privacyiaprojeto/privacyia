import { api } from '@/shared/lib/axios'
import type { Mensagem } from '@/features/cliente/chat/types'

export async function getMensagens(conversaId: string): Promise<Mensagem[]> {
  const { data } = await api.get<Mensagem[]>(`/chat/conversas/${conversaId}/mensagens`)
  return data
}
