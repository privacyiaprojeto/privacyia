import type { Conversa, Mensagem } from '@/features/cliente/chat/types'

type ApiConversa = Conversa & {
  updatedAt?: string | null
  updated_at?: string | null
  createdAt?: string | null
  created_at?: string | null
}

type ApiMensagem = Mensagem & {
  createdAt?: string | null
  created_at?: string | null
}

export function formatChatClock(value?: string | null): string {
  const raw = String(value || '').trim()

  if (!raw) return ''

  // Já está no formato correto usado no chat.
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    return raw
  }

  const date = new Date(raw)

  if (Number.isNaN(date.getTime())) {
    return raw
  }

  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function getConversationTimestamp(conversa: ApiConversa): number {
  const rawDate =
    conversa.updatedAt ??
    conversa.updated_at ??
    conversa.createdAt ??
    conversa.created_at ??
    conversa.ultimaHora

  const timestamp = rawDate ? new Date(rawDate).getTime() : 0
  return Number.isNaN(timestamp) ? 0 : timestamp
}

export function normalizeConversa(conversa: ApiConversa): Conversa {
  return {
    ...conversa,
    ultimaHora: formatChatClock(conversa.ultimaHora),
  }
}

export function normalizeMensagem(mensagem: ApiMensagem): Mensagem {
  const rawTime = mensagem.criadaEm ?? mensagem.createdAt ?? mensagem.created_at

  return {
    ...mensagem,
    criadaEm: formatChatClock(rawTime),
  }
}

export function normalizeMensagens(list: ApiMensagem[] = []): Mensagem[] {
  return list.map(normalizeMensagem)
}
