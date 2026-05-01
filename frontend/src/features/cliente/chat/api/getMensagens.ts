import { api } from '@/shared/lib/axios'
import type { Mensagem } from '@/features/cliente/chat/types'
import { normalizeMensagens } from '@/features/cliente/chat/api/chatFormatters'

export async function getMensagens(conversaId: string): Promise<Mensagem[]> {
  const { data } = await api.get<Mensagem[]>(`/chat/conversas/${conversaId}/mensagens`)
  return normalizeMensagens(data)
}
