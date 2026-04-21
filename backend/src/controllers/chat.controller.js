import { parseOrThrow } from '../utils/validators.js'
import { conversationIdParamsSchema, sendMessageSchema } from '../validators/chat.schemas.js'
import { listConversations, listMessages, sendMessage } from '../services/chat.service.js'

export async function getConversationsController(req, res) {
  const data = await listConversations(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getMessagesController(req, res) {
  const params = parseOrThrow(conversationIdParamsSchema, req.params)
  const data = await listMessages(req.auth.profile.id, params.id)
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
