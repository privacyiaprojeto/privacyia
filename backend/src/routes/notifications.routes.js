import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getNotificationPreferencesController,
  getNotificationsController,
  markAllNotificationsAsReadController,
  markNotificationAsReadController,
  updateNotificationPreferencesController,
} from '../controllers/notifications.controller.js'

const router = Router()

router.get('/', asyncHandler(getNotificationsController))
router.get('/preferencias', asyncHandler(getNotificationPreferencesController))
router.patch('/preferencias', asyncHandler(updateNotificationPreferencesController))
router.patch('/:id/lida', asyncHandler(markNotificationAsReadController))
router.post('/ler-tudo', asyncHandler(markAllNotificationsAsReadController))

export { router as notificationsRoutes }
