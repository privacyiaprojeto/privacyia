import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getConversationsController,
  getMessagesController,
  generateMessageAudioController,
  resetConversationMessagesController,
  sendMessageController,
  startConversationController,
  streamMessageController,
  updateConversationPersonaController,
} from '../controllers/chat.controller.js'

const router = Router()

router.get('/conversas', asyncHandler(getConversationsController))
router.post('/conversas/start', asyncHandler(startConversationController))
router.patch('/conversas/:id/persona', asyncHandler(updateConversationPersonaController))
router.get('/conversas/:id/mensagens', asyncHandler(getMessagesController))
router.post('/conversas/:conversationId/mensagens/:messageId/audio', asyncHandler(generateMessageAudioController))
router.delete('/conversas/:id/mensagens', asyncHandler(resetConversationMessagesController))
router.post('/conversas/:id/mensagens/stream', asyncHandler(streamMessageController))
router.post('/conversas/:id/mensagens', asyncHandler(sendMessageController))

export { router as chatRoutes }
