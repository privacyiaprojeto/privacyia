import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'


export async function listActresses(profileId) {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, avatar_url, banner_url, video_url, thumbnail_url, runpod_voice_id, bio, age, height_label, gallery_urls')
    .order('sort_order', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao buscar atrizes.', error)
  }

  return (data || []).map((item) => ({
    id: item.id,
    slug: item.slug,
    nome: item.name,
    avatar: item.avatar_url || item.thumbnail_url,
    banner: item.banner_url || item.thumbnail_url || item.avatar_url,
    videoUrl: item.video_url || item.banner_url || item.thumbnail_url || item.avatar_url,
    thumbnailUrl: item.thumbnail_url || null,
    runpodVoiceId: item.runpod_voice_id || null,
    descricao: item.bio || '',
    idade: item.age || 0,
    altura: item.height_label || '',
    fotos: item.gallery_urls || [],
  }))
}

export async function getActressProfile(atrizId) {
  const { data: companion, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, avatar_url, is_online, bio, age, height_label, gallery_urls')
    .eq('id', atrizId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar perfil da atriz.', error)
  }

  if (!companion) {
    throw new ApiError(404, 'Atriz não encontrada.')
  }

  return {
    id: companion.id,
    nome: companion.name,
    avatar: companion.avatar_url,
    online: companion.is_online ?? false,
    descricao: companion.bio || '',
    idade: companion.age || 0,
    altura: companion.height_label || '',
    fotos: companion.gallery_urls || [],
  }
}

export async function getActressTimeline(atrizId) {
  const { data, error } = await supabaseAdmin
    .from('gallery_items')
    .select('id, companion_id, media_type, media_url, created_at')
    .eq('companion_id', atrizId)
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar timeline da atriz.', error)
  }

  return (data || []).map((item) => ({
    id: item.id,
    atrizId: item.companion_id,
    tipo: item.media_type === 'video' ? 'video' : 'foto',
    url: item.media_url,
    criadaEm: item.created_at,
  }))
}

export async function getActressPublicProfile(profileId, slug) {
  const { data: companion, error } = await supabaseAdmin
    .from('companions')
    .select(`
      id,
      slug,
      name,
      avatar_url,
      banner_url,
      video_url,
      is_online,
      bio,
      age,
      height_label,
      gallery_urls,
      level_current,
      xp_current,
      xp_next_level
    `)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar perfil público da atriz.', error)
  }

  if (!companion) {
    throw new ApiError(404, 'Atriz não encontrada.')
  }

  const [
    galleryItemsResult,
    mySubscriptionResult,
    followersResult,
    conversationsResult,
    liveActionsResult,
    liveAudiosResult,
    historyResult,
  ] = await Promise.all([
    supabaseAdmin
      .from('gallery_items')
      .select('id, media_type, media_url, created_at')
      .eq('companion_id', companion.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabaseAdmin
      .from('companion_subscriptions')
      .select('id')
      .eq('profile_id', profileId)
      .eq('companion_id', companion.id)
      .eq('status', 'active')
      .maybeSingle(),
    supabaseAdmin
      .from('companion_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('companion_id', companion.id)
      .eq('status', 'active'),
    supabaseAdmin
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('companion_id', companion.id),
    supabaseAdmin
      .from('companion_live_actions')
      .select('id, nome, nivel_requerido, bloqueado_padrao, sort_order')
      .eq('companion_id', companion.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('companion_live_audios')
      .select('id, titulo, duracao_label, nivel_requerido, bloqueado_padrao, sort_order')
      .eq('companion_id', companion.id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('media_generations')
      .select('id, media_kind, result_url, created_at')
      .eq('profile_id', profileId)
      .eq('companion_id', companion.id)
      .eq('status', 'concluido')
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  const [
    galleryItems,
    mySubscription,
    followersCount,
    conversationsCount,
    liveActions,
    liveAudios,
    history,
  ] = [
    galleryItemsResult.data || [],
    mySubscriptionResult.data,
    followersResult.count || 0,
    conversationsResult.count || 0,
    liveActionsResult.data || [],
    liveAudiosResult.data || [],
    historyResult.data || [],
  ]

  if (
    galleryItemsResult.error ||
    mySubscriptionResult.error ||
    followersResult.error ||
    conversationsResult.error ||
    liveActionsResult.error ||
    liveAudiosResult.error ||
    historyResult.error
  ) {
    throw new ApiError(500, 'Erro ao montar o perfil detalhado da atriz.', {
      galleryItemsError: galleryItemsResult.error,
      mySubscriptionError: mySubscriptionResult.error,
      followersError: followersResult.error,
      conversationsError: conversationsResult.error,
      liveActionsError: liveActionsResult.error,
      liveAudiosError: liveAudiosResult.error,
      historyError: historyResult.error,
    })
  }

  const fotos =
    Array.isArray(companion.gallery_urls) && companion.gallery_urls.length > 0
      ? companion.gallery_urls
      : galleryItems
          .filter((item) => item.media_type === 'image')
          .map((item) => item.media_url)

  const nivelAtual = companion.level_current || 1
  const xpAtual = companion.xp_current || 0
  const xpProximoNivel = companion.xp_next_level || 100

  return {
    id: companion.id,
    slug: companion.slug,
    nome: companion.name,
    avatar: companion.avatar_url,
    banner: companion.banner_url,
    videoUrl: companion.video_url || companion.banner_url || companion.avatar_url,
    descricao: companion.bio || '',
    idade: companion.age || 0,
    altura: companion.height_label || '',
    fotos,
    assinaturaAtiva: Boolean(mySubscription),
    online: companion.is_online ?? false,
    totalConteudos: galleryItems.length,
    totalChats: conversationsCount,
    seguidores: followersCount,
    nivelAtual,
    xpAtual,
    xpProximoNivel,
    liveActions: liveActions.map((item) => ({
      id: item.id,
      nome: item.nome,
      nivelRequerido: item.nivel_requerido || 1,
      bloqueado:
        Boolean(item.bloqueado_padrao) ||
        nivelAtual < (item.nivel_requerido || 1),
    })),
    liveAudios: liveAudios.map((item) => ({
      id: item.id,
      titulo: item.titulo,
      duracao: item.duracao_label || '00:00',
      bloqueado:
        Boolean(item.bloqueado_padrao) ||
        nivelAtual < (item.nivel_requerido || 1),
    })),
    historico: history.map((item) => ({
      id: item.id,
      tipo: item.media_kind,
      url: item.result_url,
      criadaEm: item.created_at,
    })),
  }
}


export async function subscribeToActress(profileId, companionId) {
  const { data: companion, error: companionError } = await supabaseAdmin
    .from('companions')
    .select('id')
    .eq('id', companionId)
    .maybeSingle()

  if (companionError) {
    throw new ApiError(500, 'Erro ao validar criadora.', companionError)
  }

  if (!companion) {
    throw new ApiError(404, 'Criadora não encontrada.')
  }

  const { error } = await supabaseAdmin
    .from('companion_subscriptions')
    .upsert({
      profile_id: profileId,
      companion_id: companionId,
      status: 'active',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id,companion_id' })

  if (error) {
    throw new ApiError(500, 'Erro ao ativar assinatura.', error)
  }

  return {
    success: true,
    status: 'active',
  }
}
