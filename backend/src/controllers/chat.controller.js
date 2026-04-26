import { parseOrThrow } from '../utils/validators.js'
import {
  conversationIdParamsSchema,
  messageAudioParamsSchema,
  sendMessageSchema,
  startConversationSchema,
  updateConversationPersonaSchema,
} from '../validators/chat.schemas.js'
import {
  listConversations,
  listMessages,
  generateMessageAudio,
  resetConversationMessages,
  sendMessage,
  startConversation,
  streamMessageReply,
  updateConversationPersona,
} from '../services/chat.service.js'

export async function getConversationsController(req, res) {
  const data = await listConversations(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function startConversationController(req, res) {
  const input = parseOrThrow(startConversationSchema, req.body)

  const data = await startConversation({
    profileId: req.auth.profile.id,
    companionId: input.companionId,
    relationshipType: input.relationshipType,
    currentMood: input.currentMood,
  })

  return res.status(201).json(data)
}

export async function updateConversationPersonaController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)
  const input = parseOrThrow(updateConversationPersonaSchema, req.body)

  const data = await updateConversationPersona({
    profileId: req.auth.profile.id,
    conversationId: params.id,
    relationshipType: input.relationshipType,
    currentMood: input.currentMood,
  })

  return res.status(200).json(data)
}

export async function getMessagesController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)
  const data = await listMessages(req.auth.profile.id, params.id)
  return res.status(200).json(data)
}

export async function generateMessageAudioController(req, res) {
  const params = parseOrThrow(messageAudioParamsSchema, req.params)

  const data = await generateMessageAudio({
    profileId: req.auth.profile.id,
    conversationId: params.conversationId,
    messageId: params.messageId,
  })

  return res.status(200).json(data)
}

export async function sendMessageController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)
  const input = parseOrThrow(sendMessageSchema, req.body)

  const data = await sendMessage({
    profileId: req.auth.profile.id,
    conversationId: params.id,
    conteudo: input.conteudo,
  })

  return res.status(201).json(data)
}


export async function resetConversationMessagesController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)

  const data = await resetConversationMessages({
    profileId: req.auth.profile.id,
    conversationId: params.id,
  })

  return res.status(200).json(data)
}

export async function streamMessageController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)
  const input = parseOrThrow(sendMessageSchema, req.body)

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  function send(event, data) {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    send('status', { status: 'typing' })

    const result = await streamMessageReply({
      profileId: req.auth.profile.id,
      conversationId: params.id,
      conteudo: input.conteudo,
      onToken: (token) => {
        send('token', { token })
      },
    })

    send('done', result)
    res.end()
  } catch (error) {
    send('error', {
      message: error.message || 'Erro ao gerar resposta.',
    })
    res.end()
  }
}
