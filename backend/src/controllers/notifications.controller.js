import { parseOrThrow } from '../utils/validators.js'
import {
  notificationIdParamsSchema,
  notificationPreferencesSchema,
} from '../validators/notifications.schemas.js'
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreferences,
} from '../services/notifications.service.js'

export async function getNotificationsController(req, res) {
  const data = await listNotifications(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getNotificationPreferencesController(req, res) {
  const data = await getNotificationPreferences(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function markNotificationAsReadController(req, res) {
  const params = parseOrThrow(notificationIdParamsSchema, req.params)
  const data = await markNotificationAsRead(req.auth.profile.id, params.id)
  return res.status(200).json(data)
}

export async function markAllNotificationsAsReadController(req, res) {
  await markAllNotificationsAsRead(req.auth.profile.id)
  return res.status(204).send()
}

export async function updateNotificationPreferencesController(req, res) {
  const input = parseOrThrow(notificationPreferencesSchema, req.body)
  const data = await updateNotificationPreferences(req.auth.profile.id, input)
  return res.status(200).json(data)
}
