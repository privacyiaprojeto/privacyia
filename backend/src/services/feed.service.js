import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import {
  listPublishedCatalogCompanions,
  listPublishedCatalogProducts,
} from './client-catalog-read-model.service.js'

function mapPublicCompanionCard(companion) {
  return {
    id: companion.id,
    slug: companion.slug,
    nome: companion.nome,
    avatar: companion.avatar,
    banner: companion.banner,
    videoUrl: companion.videoUrl || undefined,
    thumbnailUrl: companion.thumbnailUrl || null,
  }
}

function mapCatalogPost(product) {
  return {
    id: product.id,
    atriz: mapPublicCompanionCard(product.companion),
    tipo: product.preview.type === 'video' ? 'video' : 'foto',
    url: product.preview.url,
    mediaStatus: product.preview.mediaStatus,
    streamKind: product.preview.streamKind,
    mediaMessage: product.preview.userMessage,
    curtidas: 0,
    comentarios: 0,
    curtido: false,
    salvo: false,
    readOnly: true,
    produto: {
      id: product.id,
      nome: product.title,
      tipo: product.mediaType,
      precoCreditos: product.priceCredits,
    },
  }
}

export async function listFeedPosts(_profileId) {
  const products = await listPublishedCatalogProducts({
    destinations: ['feed'],
    limit: 200,
  })

  return products.map(mapCatalogPost)
}

export async function listFeedSuggestions() {
  const companions = await listPublishedCatalogCompanions({ limit: 10 })
  return companions.map(mapPublicCompanionCard)
}

export async function listFeedTop10() {
  const companions = await listPublishedCatalogCompanions({ limit: 10 })

  return companions.map((companion, index) => ({
    posicao: index + 1,
    atriz: mapPublicCompanionCard(companion),
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
