import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

function mapCompanionCard(companion) {
  return {
    id: companion.id,
    slug: companion.slug,
    nome: companion.name,
    avatar: companion.avatar_url,
    banner: companion.banner_url,
  }
}

function mapPost(row, interaction) {
  return {
    id: row.id,
    atriz: mapCompanionCard(row.companions),
    tipo: row.media_type === 'video' ? 'video' : 'foto',
    url: row.media_url,
    curtidas: row.likes_count || 0,
    comentarios: row.comments_count || 0,
    curtido: interaction?.liked || false,
    salvo: interaction?.saved || false,
  }
}

export async function listFeedPosts(profileId) {
  const { data: posts, error } = await supabaseAdmin
    .from('feed_posts')
    .select(`
      id,
      companion_id,
      media_type,
      media_url,
      likes_count,
      comments_count,
      created_at,
      companions:companion_id (
        id,
        slug,
        name,
        avatar_url,
        banner_url
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar feed.', error)
  }

  const postIds = (posts || []).map((post) => post.id)
  let interactionMap = new Map()

  if (postIds.length > 0) {
    const { data: interactions, error: interactionsError } = await supabaseAdmin
      .from('feed_post_interactions')
      .select('post_id, liked, saved')
      .eq('profile_id', profileId)
      .in('post_id', postIds)

    if (interactionsError) {
      throw new ApiError(500, 'Erro ao carregar interações do feed.', interactionsError)
    }

    interactionMap = new Map((interactions || []).map((item) => [item.post_id, item]))
  }

  return (posts || []).map((post) => mapPost(post, interactionMap.get(post.id)))
}

export async function listFeedSuggestions() {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, avatar_url, banner_url')
    .order('sort_order', { ascending: true })
    .limit(10)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar sugestões.', error)
  }

  return (data || []).map(mapCompanionCard)
}

export async function listFeedTop10() {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, avatar_url, banner_url')
    .order('sort_order', { ascending: true })
    .limit(10)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar top 10.', error)
  }

  return (data || []).map((companion, index) => ({
    posicao: index + 1,
    atriz: mapCompanionCard(companion),
  }))
}

async function recalculateLikeCount(postId) {
  const { data: interactions, error } = await supabaseAdmin
    .from('feed_post_interactions')
    .select('liked')
    .eq('post_id', postId)

  if (error) {
    throw new ApiError(500, 'Erro ao recalcular curtidas.', error)
  }

  const likesCount = (interactions || []).filter((item) => item.liked).length

  const { error: updateError } = await supabaseAdmin
    .from('feed_posts')
    .update({ likes_count: likesCount })
    .eq('id', postId)

  if (updateError) {
    throw new ApiError(500, 'Erro ao atualizar contador de curtidas.', updateError)
  }

  return likesCount
}

export async function togglePostLike(profileId, postId) {
  const { data: post, error: postError } = await supabaseAdmin
    .from('feed_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()

  if (postError) {
    throw new ApiError(500, 'Erro ao validar post.', postError)
  }

  if (!post) {
    throw new ApiError(404, 'Post não encontrado.')
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('feed_post_interactions')
    .select('post_id, profile_id, liked, saved')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (currentError) {
    throw new ApiError(500, 'Erro ao ler interação atual.', currentError)
  }

  const nextLiked = !(current?.liked || false)

  const payload = {
    post_id: postId,
    profile_id: profileId,
    liked: nextLiked,
    saved: current?.saved || false,
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabaseAdmin
    .from('feed_post_interactions')
    .upsert(payload, { onConflict: 'post_id,profile_id' })

  if (upsertError) {
    throw new ApiError(500, 'Erro ao atualizar curtida.', upsertError)
  }

  const curtidas = await recalculateLikeCount(postId)

  return { curtido: nextLiked, curtidas }
}

export async function togglePostSave(profileId, postId) {
  const { data: post, error: postError } = await supabaseAdmin
    .from('feed_posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle()

  if (postError) {
    throw new ApiError(500, 'Erro ao validar post.', postError)
  }

  if (!post) {
    throw new ApiError(404, 'Post não encontrado.')
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from('feed_post_interactions')
    .select('post_id, profile_id, liked, saved')
    .eq('post_id', postId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (currentError) {
    throw new ApiError(500, 'Erro ao ler interação atual.', currentError)
  }

  const nextSaved = !(current?.saved || false)

  const payload = {
    post_id: postId,
    profile_id: profileId,
    liked: current?.liked || false,
    saved: nextSaved,
    updated_at: new Date().toISOString(),
  }

  const { error: upsertError } = await supabaseAdmin
    .from('feed_post_interactions')
    .upsert(payload, { onConflict: 'post_id,profile_id' })

  if (upsertError) {
    throw new ApiError(500, 'Erro ao salvar post.', upsertError)
  }

  return { salvo: nextSaved }
}
