import { api } from '@/shared/lib/axios'

type GenerateMessageAudioResponse = {
  audioUrl: string
  cached: boolean
}

export async function generateMessageAudio(
  conversationId: string,
  messageId: string
): Promise<GenerateMessageAudioResponse> {
  const { data } = await api.post<GenerateMessageAudioResponse>(
    `/chat/conversas/${conversationId}/mensagens/${messageId}/audio`
  )

  return data
}
