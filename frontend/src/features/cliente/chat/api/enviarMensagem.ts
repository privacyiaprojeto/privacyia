import { api } from '@/shared/lib/axios'
import type { Mensagem } from '@/features/cliente/chat/types'
import { normalizeMensagem } from '@/features/cliente/chat/api/chatFormatters'

export async function enviarMensagem(conversaId: string, conteudo: string): Promise<Mensagem> {
  const { data } = await api.post<Mensagem>(`/chat/conversas/${conversaId}/mensagens`, { conteudo })
  return normalizeMensagem(data)
}
