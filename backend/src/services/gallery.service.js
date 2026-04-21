import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

export async function listGallery(profileId, query = '') {
  const { data: companions, error } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, avatar_url, banner_url')
    .ilike('name', `%${query}%`)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar galeria.', error)
  }

  const companionIds = (companions || []).map((item) => item.id)

  let subscriptionsByCompanion = new Map()
  let totalsByCompanion = new Map()
  let previewByCompanion = new Map()

  if (companionIds.length > 0) {
    const [{ data: subscriptions, error: subscriptionsError }, { data: media, error: mediaError }] = await Promise.all([
      supabaseAdmin
        .from('companion_subscriptions')
        .select('companion_id, status')
        .eq('profile_id', profileId)
        .in('companion_id', companionIds),
      supabaseAdmin
        .from('gallery_items')
        .select('companion_id, media_url, created_at')
        .in('companion_id', companionIds)
        .order('created_at', { ascending: false }),
    ])

    if (subscriptionsError) {
      throw new ApiError(500, 'Erro ao carregar assinaturas da galeria.', subscriptionsError)
    }

    if (mediaError) {
      throw new ApiError(500, 'Erro ao carregar mídias da galeria.', mediaError)
    }

    subscriptionsByCompanion = new Map(
      (subscriptions || []).map((item) => [item.companion_id, item.status === 'active'])
    )

    for (const item of media || []) {
      totalsByCompanion.set(item.companion_id, (totalsByCompanion.get(item.companion_id) || 0) + 1)
      if (!previewByCompanion.has(item.companion_id)) {
        previewByCompanion.set(item.companion_id, item.media_url)
      }
    }
  }

  return (companions || []).map((companion) => ({
    id: companion.id,
    slug: companion.slug,
    nome: companion.name,
    avatar: companion.avatar_url,
    banner: companion.banner_url,
    assinaturaAtiva: subscriptionsByCompanion.get(companion.id) || false,
    totalMidias: totalsByCompanion.get(companion.id) || 0,
    previewUrl: previewByCompanion.get(companion.id) || companion.banner_url || companion.avatar_url,
  }))
}
