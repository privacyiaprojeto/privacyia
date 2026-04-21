import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getConversationsController,
  getMessagesController,
  sendMessageController,
} from '../controllers/chat.controller.js'

const router = Router()

router.get('/conversas', asyncHandler(getConversationsController))
router.get('/conversas/:id/mensagens', asyncHandler(getMessagesController))
router.post('/conversas/:id/mensagens', asyncHandler(sendMessageController))

export { router as chatRoutes }
