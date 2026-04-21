import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { formatConversationTime } from '../utils/date.js'
import { maybeGenerateAutoReply } from './openrouter.service.js'

function mapConversation(row) {
  const lastMessage = row.messages?.[0]
  return {
    id: row.id,
    atriz: {
      id: row.companions.id,
      nome: row.companions.name,
      avatar: row.companions.avatar_url,
      online: row.companions.is_online ?? false,
    },
    ultimaMensagem: lastMessage?.content || row.last_message_preview || 'Conversa iniciada',
    ultimaHora: formatConversationTime(lastMessage?.created_at || row.updated_at || row.created_at),
    naoLidas: 0,
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    conversaId: row.conversation_id,
    conteudo: row.content,
    de: row.sender_type,
    criadaEm: formatConversationTime(row.created_at),
  }
}

export async function listConversations(profileId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      created_at,
      updated_at,
      last_message_preview,
      companions:companion_id (
        id,
        name,
        avatar_url,
        is_online
      ),
      messages (
        id,
        content,
        created_at
      )
    `)
    .eq('profile_id', profileId)
    .order('updated_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao buscar conversas.', error)
  }

  const normalized = (data || []).map((row) => ({
    ...row,
    messages: (row.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 1),
  }))

  return normalized.map(mapConversation)
}

export async function listMessages(profileId, conversationId) {
  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (conversationError) {
    throw new ApiError(500, 'Erro ao validar conversa.', conversationError)
  }

  if (!conversation) {
    throw new ApiError(404, 'Conversa não encontrada.')
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id, content, sender_type, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao buscar mensagens.', error)
  }

  return (data || []).map(mapMessage)
}

export async function sendMessage({ profileId, conversationId, conteudo }) {
  const { data: conversation, error: conversationError } = await supabaseAdmin
    .from('conversations')
    .select('id, companion_id')
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (conversationError) {
    throw new ApiError(500, 'Erro ao validar conversa.', conversationError)
  }

  if (!conversation) {
    throw new ApiError(404, 'Conversa não encontrada.')
  }

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'cliente',
      content: conteudo,
    })
    .select('id, conversation_id, content, sender_type, created_at')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar mensagem.', error)
  }

  await supabaseAdmin
    .from('conversations')
    .update({
      last_message_preview: conteudo.slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)

  maybeGenerateAutoReply({
    profileId,
    companionId: conversation.companion_id,
    conversationId,
    userMessage: conteudo,
  }).catch((error) => {
    console.error('⚠️ Falha ao tentar gerar resposta automática:', error.message)
  })

  return mapMessage(data)
}
