import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { formatConversationTime } from '../utils/date.js'
import { maybeGenerateAutoReply, streamAutoReply } from './openrouter.service.js'
import { recallMemories, saveMemory } from './memory.service.js'
import { generateMessageAudio as generateTtsMessageAudio } from './tts.service.js'

const DEFAULT_RELATIONSHIP_TYPE = 'desconhecidos'
const DEFAULT_CURRENT_MOOD = 'natural'
const MEMORY_SIMILARITY_THRESHOLD = 0.78

function sanitizePersonaValue(value, fallback) {
  const clean = String(value || '').trim()
  return clean || fallback
}

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
    relationshipType: row.relationship_type || DEFAULT_RELATIONSHIP_TYPE,
    currentMood: row.current_mood || DEFAULT_CURRENT_MOOD,
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
    audioUrl: row.audio_url || null,
    audioAllowed: row.audio_allowed !== false,
    audioStatus: row.audio_status || 'none',
    audioProvider: row.audio_provider || null,
    audioVoiceProfileId: row.audio_voice_profile_id || null,
  }
}

async function getOwnedConversation(profileId, conversationId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, profile_id, companion_id, relationship_type, current_mood')
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar conversa.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Conversa não encontrada.')
  }

  return data
}

async function getConversationByPair(profileId, companionId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      profile_id,
      companion_id,
      relationship_type,
      current_mood,
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
    .eq('companion_id', companionId)
    .order('updated_at', { ascending: false })
    .limit(1)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar conversa existente.', error)
  }

  const row = data?.[0] || null

  if (!row) {
    return null
  }

  return {
    ...row,
    messages: (row.messages || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 1),
  }
}

async function getConversationById(profileId, conversationId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      profile_id,
      companion_id,
      relationship_type,
      current_mood,
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
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .limit(1)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar conversa.', error)
  }

  const row = data?.[0] || null

  if (!row) {
    throw new ApiError(404, 'Conversa não encontrada.')
  }

  return {
    ...row,
    messages: (row.messages || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 1),
  }
}

async function getCompanionById(companionId) {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, system_prompt, avatar_url, bio, is_active')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar dados da atriz.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Atriz não encontrada.')
  }

  if (data.is_active === false) {
    throw new ApiError(400, 'Esta atriz está indisponível no momento.')
  }

  return data
}

async function getRecentMessages(conversationId, limit = 12) {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, sender_type, content, created_at, audio_url, audio_allowed, audio_status, audio_provider, audio_voice_profile_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar histórico recente da conversa.', error)
  }

  return (data || []).slice().reverse()
}

async function updateConversationPreview(conversationId, text) {
  await supabaseAdmin
    .from('conversations')
    .update({
      last_message_preview: String(text || '').slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}

async function insertAssistantMessage(conversationId, reply) {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'atriz',
      content: reply,
    })
    .select('id, conversation_id, content, sender_type, created_at, audio_url, audio_allowed, audio_status, audio_provider, audio_voice_profile_id')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar resposta automática.', error)
  }

  return data
}

async function createReplyNotification({ profileId, companionId, companionName, reply }) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .insert({
      profile_id: profileId,
      type: 'marketing',
      category: 'nova_publicacao',
      title: `${companionName || 'Sua companion'} respondeu sua mensagem`,
      description: String(reply || '').slice(0, 140),
      payload: { atrizId: companionId },
    })

  if (error) {
    console.error('⚠️ Falha ao criar notificação de resposta:', error.message)
  }
}

function truncateText(value, max = 1200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function buildMemoryText({
  companionName,
  relationshipType,
  currentMood,
  userMessage,
  assistantReply,
}) {
  const cliente = truncateText(userMessage, 900)
  const atriz = truncateText(assistantReply, 1200)

  return [
    `Memória da relação entre cliente e ${companionName || 'atriz'}:`,
    `Tipo de relacionamento atual: ${relationshipType || DEFAULT_RELATIONSHIP_TYPE}.`,
    `Humor atual da personagem: ${currentMood || DEFAULT_CURRENT_MOOD}.`,
    `Cliente disse: ${cliente}`,
    `${companionName || 'Atriz'} respondeu: ${atriz}`,
  ].join('\n')
}

async function recallSafeMemories(profileId, companionId, queryText) {
  try {
    return await recallMemories(
      profileId,
      companionId,
      queryText,
      8,
      MEMORY_SIMILARITY_THRESHOLD,
    )
  } catch (error) {
    console.error('⚠️ Falha ao recuperar memórias vetoriais:', error.message)
    return []
  }
}

async function saveSafeMemory({ profileId, companionId, companionName, conversation, userMessage, assistantReply }) {
  try {
    const memoryText = buildMemoryText({
      companionName,
      relationshipType: conversation.relationship_type,
      currentMood: conversation.current_mood,
      userMessage,
      assistantReply,
    })

    await saveMemory(profileId, companionId, memoryText)
  } catch (error) {
    console.error('⚠️ Falha ao salvar memória vetorial:', error.message)
  }
}

async function generateAndPersistAutoReply({
  profileId,
  conversation,
  userMessage,
}) {
  const [companion, recentMessages] = await Promise.all([
    getCompanionById(conversation.companion_id),
    getRecentMessages(conversation.id, 12),
  ])

  const recalledMemories = await recallSafeMemories(
    profileId,
    conversation.companion_id,
    userMessage,
  )

  const reply = await maybeGenerateAutoReply({
    companion,
    conversationPersona: {
      relationshipType: conversation.relationship_type,
      currentMood: conversation.current_mood,
    },
    recentMessages,
    recalledMemories,
  })

  if (!reply) {
    return null
  }

  const savedAssistantMessage = await insertAssistantMessage(conversation.id, reply)

  await updateConversationPreview(conversation.id, reply)

  await createReplyNotification({
    profileId,
    companionId: conversation.companion_id,
    companionName: companion.name,
    reply,
  })

  await saveSafeMemory({
    profileId,
    companionId: conversation.companion_id,
    companionName: companion.name,
    conversation,
    userMessage,
    assistantReply: reply,
  })

  return mapMessage(savedAssistantMessage)
}

export async function listConversations(profileId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select(`
      id,
      created_at,
      updated_at,
      last_message_preview,
      relationship_type,
      current_mood,
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
    messages: (row.messages || [])
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 1),
  }))

  return normalized.map(mapConversation)
}

export async function startConversation({
  profileId,
  companionId,
  relationshipType,
  currentMood,
}) {
  await getCompanionById(companionId)

  const safeRelationshipType = sanitizePersonaValue(
    relationshipType,
    DEFAULT_RELATIONSHIP_TYPE,
  )
  const safeCurrentMood = sanitizePersonaValue(
    currentMood,
    DEFAULT_CURRENT_MOOD,
  )

  const existing = await getConversationByPair(profileId, companionId)

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('conversations')
      .update({
        relationship_type: safeRelationshipType,
        current_mood: safeCurrentMood,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) {
      throw new ApiError(500, 'Erro ao atualizar persona da conversa existente.', updateError)
    }

    const refreshed = await getConversationById(profileId, existing.id)
    return mapConversation(refreshed)
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      relationship_type: safeRelationshipType,
      current_mood: safeCurrentMood,
      last_message_preview: 'Conversa iniciada',
    })
    .select('id')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao iniciar conversa.', error)
  }

  const created = await getConversationById(profileId, data.id)
  return mapConversation(created)
}

export async function updateConversationPersona({
  profileId,
  conversationId,
  relationshipType,
  currentMood,
}) {
  const conversation = await getOwnedConversation(profileId, conversationId)

  const payload = {
    updated_at: new Date().toISOString(),
  }

  if (relationshipType !== undefined) {
    payload.relationship_type = sanitizePersonaValue(
      relationshipType,
      DEFAULT_RELATIONSHIP_TYPE,
    )
  }

  if (currentMood !== undefined) {
    payload.current_mood = sanitizePersonaValue(
      currentMood,
      DEFAULT_CURRENT_MOOD,
    )
  }

  const { error } = await supabaseAdmin
    .from('conversations')
    .update(payload)
    .eq('id', conversation.id)

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar persona da conversa.', error)
  }

  const refreshed = await getConversationById(profileId, conversation.id)

  return {
    id: refreshed.id,
    relationshipType: refreshed.relationship_type,
    currentMood: refreshed.current_mood,
    updatedAt: refreshed.updated_at,
  }
}

export async function listMessages(profileId, conversationId) {
  await getOwnedConversation(profileId, conversationId)

  const { data, error } = await supabaseAdmin
    .from('messages')
    .select('id, conversation_id, content, sender_type, created_at, audio_url, audio_allowed, audio_status, audio_provider, audio_voice_profile_id')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao buscar mensagens.', error)
  }

  return (data || []).map(mapMessage)
}

export async function sendMessage({ profileId, conversationId, conteudo }) {
  const conversation = await getOwnedConversation(profileId, conversationId)

  const { data, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'cliente',
      content: conteudo,
    })
    .select('id, conversation_id, content, sender_type, created_at, audio_url, audio_allowed, audio_status, audio_provider, audio_voice_profile_id')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar mensagem.', error)
  }

  await updateConversationPreview(conversationId, conteudo)

  generateAndPersistAutoReply({
    profileId,
    conversation,
    userMessage: conteudo,
  }).catch((error) => {
    console.error('⚠️ Falha ao gerar pipeline automático da IA:', error.message)
  })

  return mapMessage(data)
}


export async function generateMessageAudio({ profileId, conversationId, messageId }) {
  return generateTtsMessageAudio({ profileId, conversationId, messageId })
}


export async function resetConversationMessages({ profileId, conversationId }) {
  const conversation = await getOwnedConversation(profileId, conversationId)

  const { error } = await supabaseAdmin
    .from('messages')
    .delete()
    .eq('conversation_id', conversation.id)

  if (error) {
    throw new ApiError(500, 'Erro ao resetar mensagens da conversa.', error)
  }

  await updateConversationPreview(conversation.id, 'Conversa reiniciada')

  return {
    id: conversation.id,
    reset: true,
  }
}

export async function streamMessageReply({ profileId, conversationId, conteudo, onToken }) {
  const conversation = await getOwnedConversation(profileId, conversationId)

  const { data: userMessage, error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'cliente',
      content: conteudo,
    })
    .select('id, conversation_id, content, sender_type, created_at, audio_url, audio_allowed, audio_status, audio_provider, audio_voice_profile_id')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar mensagem.', error)
  }

  await updateConversationPreview(conversationId, conteudo)

  const [companion, recentMessages] = await Promise.all([
    getCompanionById(conversation.companion_id),
    getRecentMessages(conversationId, 12),
  ])

  const recalledMemories = await recallSafeMemories(
    profileId,
    conversation.companion_id,
    conteudo,
  )

  const reply = await streamAutoReply({
    companion,
    conversationPersona: {
      relationshipType: conversation.relationship_type,
      currentMood: conversation.current_mood,
    },
    recentMessages,
    recalledMemories,
    onToken,
  })

  if (!reply) {
    throw new ApiError(502, 'A IA não retornou resposta.')
  }

  const savedAssistantMessage = await insertAssistantMessage(conversationId, reply)

  await updateConversationPreview(conversationId, reply)

  await createReplyNotification({
    profileId,
    companionId: conversation.companion_id,
    companionName: companion.name,
    reply,
  })

  await saveSafeMemory({
    profileId,
    companionId: conversation.companion_id,
    companionName: companion.name,
    conversation,
    userMessage: conteudo,
    assistantReply: reply,
  })

  return {
    userMessage: mapMessage(userMessage),
    assistantMessage: mapMessage(savedAssistantMessage),
  }
}
