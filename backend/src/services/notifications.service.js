import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

export async function ensureNotificationPreferences(profileId) {
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('notification_preferences')
    .select('profile_id, marketing, sistema')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (existingError) {
    throw new ApiError(500, 'Erro ao buscar preferências de notificação.', existingError)
  }

  if (existing) {
    return existing
  }

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .insert({
      profile_id: profileId,
      marketing: true,
      sistema: true,
    })
    .select('profile_id, marketing, sistema')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao criar preferências de notificação.', error)
  }

  return data
}

export async function listNotifications(profileId) {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('id, type, category, title, description, is_read, payload, created_at')
    .eq('profile_id', profileId)
    .gte('created_at', oneWeekAgo)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar notificações.', error)
  }

  return (data || []).map((item) => ({
    id: item.id,
    tipo: item.type,
    categoria: item.category,
    titulo: item.title,
    descricao: item.description,
    lida: item.is_read,
    criadaEm: item.created_at,
    payload: item.payload || undefined,
  }))
}

export async function getNotificationPreferences(profileId) {
  const data = await ensureNotificationPreferences(profileId)

  return {
    marketing: data.marketing,
    sistema: data.sistema,
  }
}

export async function markNotificationAsRead(profileId, notificationId) {
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
    .eq('profile_id', profileId)
    .select('id, type, category, title, description, is_read, payload, created_at')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao marcar notificação como lida.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Notificação não encontrada.')
  }

  return {
    id: data.id,
    tipo: data.type,
    categoria: data.category,
    titulo: data.title,
    descricao: data.description,
    lida: data.is_read,
    criadaEm: data.created_at,
    payload: data.payload || undefined,
  }
}

export async function markAllNotificationsAsRead(profileId) {
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true })
    .eq('profile_id', profileId)
    .eq('is_read', false)

  if (error) {
    throw new ApiError(500, 'Erro ao marcar todas as notificações como lidas.', error)
  }
}

export async function updateNotificationPreferences(profileId, input) {
  await ensureNotificationPreferences(profileId)

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .update(input)
    .eq('profile_id', profileId)
    .select('profile_id, marketing, sistema')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar preferências.', error)
  }

  return {
    marketing: data.marketing,
    sistema: data.sistema,
  }
}
