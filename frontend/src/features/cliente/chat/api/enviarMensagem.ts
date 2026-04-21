import { api } from '@/shared/lib/axios'
import type { Mensagem } from '@/features/cliente/chat/types'

export async function enviarMensagem(conversaId: string, conteudo: string): Promise<Mensagem> {
  const { data } = await api.post<Mensagem>(`/chat/conversas/${conversaId}/mensagens`, { conteudo })
  return data
}
