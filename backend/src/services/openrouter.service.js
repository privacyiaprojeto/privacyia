import axios from 'axios'
import { env } from '../config/env.js'
import { supabaseAdmin } from '../config/supabase.js'

const openrouter = axios.create({
  baseURL: env.OPENROUTER_BASE_URL,
  headers: {
    Authorization: env.OPENROUTER_API_KEY ? `Bearer ${env.OPENROUTER_API_KEY}` : undefined,
    'Content-Type': 'application/json',
  },
})

export async function maybeGenerateAutoReply({ profileId, companionId, conversationId, userMessage }) {
  if (!env.OPENROUTER_API_KEY) {
    return null
  }

  const [{ data: companion }, { data: lastMessages }] = await Promise.all([
    supabaseAdmin
      .from('companions')
      .select('name, system_prompt')
      .eq('id', companionId)
      .maybeSingle(),
    supabaseAdmin
      .from('messages')
      .select('sender_type, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const systemPrompt = companion?.system_prompt || `Você é ${companion?.name || 'uma companion virtual'} em um roleplay textual.`

  const messages = [
    { role: 'system', content: systemPrompt },
    ...((lastMessages || []).reverse().map((msg) => ({
      role: msg.sender_type === 'cliente' ? 'user' : 'assistant',
      content: msg.content,
    }))),
    { role: 'user', content: userMessage },
  ]

  const response = await openrouter.post('/chat/completions', {
    model: env.OPENROUTER_TEXT_MODEL,
    messages,
    temperature: 0.9,
  })

  const reply = response.data?.choices?.[0]?.message?.content?.trim()
  if (!reply) {
    return null
  }

  const { error } = await supabaseAdmin
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_type: 'atriz',
      content: reply,
    })

  if (!error) {
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_preview: reply.slice(0, 120),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
  }

  await supabaseAdmin
    .from('notifications')
    .insert({
      profile_id: profileId,
      type: 'marketing',
      category: 'nova_publicacao',
      title: `${companion?.name || 'Sua companion'} respondeu sua mensagem`,
      description: reply.slice(0, 140),
      payload: { atrizId: companionId },
    })

  return reply
}

export async function createEmbedding(inputText) {
  if (!env.OPENROUTER_API_KEY) {
    return null
  }

  const response = await openrouter.post('/embeddings', {
    model: env.OPENROUTER_EMBEDDING_MODEL,
    input: inputText,
  })

  return response.data?.data?.[0]?.embedding || null
}
