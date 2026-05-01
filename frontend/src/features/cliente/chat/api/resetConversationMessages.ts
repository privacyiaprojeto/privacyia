import { api } from '@/shared/lib/axios'
import type { Mensagem } from '@/features/cliente/chat/types'
import { normalizeMensagem } from '@/features/cliente/chat/api/chatFormatters'

export interface ResetConversationResponse {
  id: string
  reset: boolean
  mensagem?: Mensagem | null
}

export async function resetConversationMessages(conversaId: string): Promise<ResetConversationResponse> {
  const { data } = await api.delete<ResetConversationResponse>(`/chat/conversas/${conversaId}/mensagens`)

  return {
    ...data,
    mensagem: data.mensagem ? normalizeMensagem(data.mensagem) : null,
  }
}
