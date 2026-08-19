import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import {
  getPublishedCatalogCompanion,
  listPublishedCatalogCompanions,
} from './client-catalog-read-model.service.js'
import {
  filterExplicitLiveActionProducts,
  filterExplicitLiveAudioProducts,
} from './media-product-type.service.js'


export async function listActresses(_profileId) {
  const companions = await listPublishedCatalogCompanions({ limit: 100 })

  return companions.map((companion) => ({
    id: companion.id,
    slug: companion.slug,
    nome: companion.nome,
    avatar: companion.avatar,
    banner: companion.banner,
    videoUrl: companion.videoUrl || companion.banner || companion.avatar,
    thumbnailUrl: companion.thumbnailUrl,
    descricao: companion.descricao,
    idade: companion.idade,
    altura: companion.altura,
    fotos: companion.fotos,
    produtosAtivos: companion.activeProductsCount,
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

function isProtectedClientMediaUrl(value) {
  const url = String(value || '').trim()
  return url.startsWith('/media/deliveries/') && url.includes('/protected-view')
}

export async function getActressPublicProfile(profileId, identifier) {
  const { companion, products } = await getPublishedCatalogCompanion(identifier)

  const [
    mySubscriptionResult,
    followersResult,
    conversationsResult,
    historyResult,
  ] = await Promise.all([
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
      .from('media_generations')
      .select('id, media_kind, result_url, created_at')
      .eq('profile_id', profileId)
      .eq('companion_id', companion.id)
      .eq('status', 'concluido')
      .order('created_at', { ascending: false })
      .limit(24),
  ])

  if (
    mySubscriptionResult.error ||
    followersResult.error ||
    conversationsResult.error ||
    historyResult.error
  ) {
    throw new ApiError(500, 'Erro ao montar o perfil público.', {
      mySubscriptionError: mySubscriptionResult.error,
      followersError: followersResult.error,
      conversationsError: conversationsResult.error,
      historyError: historyResult.error,
    })
  }

  const publishedContract = (product) => {
    const status = product.preview?.mediaStatus || 'unavailable'
    const renderer = product.preview?.type === 'video'
      ? 'video'
      : product.preview?.type === 'audio'
        ? 'audio'
        : 'image'

    if (status === 'processing') {
      return {
        mediaType: product.mediaType,
        clientSupported: true,
        clientOpenable: false,
        clientPurchasable: false,
        protectedRenderer: renderer,
        reasonCode: 'RENDITION_PROCESSING',
        severity: 'REVIEW',
        userMessage: product.preview?.userMessage || 'Mídia em preparação.',
      }
    }

    if (status !== 'ready') {
      return {
        mediaType: product.mediaType,
        clientSupported: true,
        clientOpenable: false,
        clientPurchasable: false,
        protectedRenderer: renderer,
        reasonCode: 'MEDIA_UNAVAILABLE',
        severity: 'BLOCKED',
        userMessage: product.preview?.userMessage || 'Mídia indisponível.',
      }
    }

    return {
      mediaType: product.mediaType,
      clientSupported: true,
      clientOpenable: false,
      clientPurchasable: false,
      protectedRenderer: renderer,
      reasonCode: 'READ_ONLY_PUBLIC_CATALOG',
      severity: 'REVIEW',
      userMessage: 'Preview disponível. A entrega protegida depende do acesso comercial ao produto.',
    }
  }

  const liveActions = filterExplicitLiveActionProducts(products)
    .map((product) => ({
      id: product.id,
      mediaType: product.mediaType,
      nome: product.title,
      titulo: product.title,
      descricao: product.description || 'Cena publicada pelo Admin.',
      priceCredits: product.priceCredits,
      nivelRequerido: 1,
      bloqueado: true,
      purchased: false,
      previewUrl: product.preview?.url || null,
      mediaStatus: product.preview?.mediaStatus || 'unavailable',
      streamKind: product.preview?.streamKind || null,
      destination: product.destination,
      assetId: product.asset?.id || null,
      protectedViewUrl: null,
      mediaContract: publishedContract(product),
    }))

  const liveAudios = filterExplicitLiveAudioProducts(products)
    .map((product) => ({
      id: product.id,
      mediaType: product.mediaType,
      titulo: product.title,
      descricao: product.description || 'Áudio publicado pelo Admin.',
      duracao: 'Premium',
      priceCredits: product.priceCredits,
      bloqueado: true,
      purchased: false,
      previewUrl: product.preview?.url || null,
      mediaStatus: product.preview?.mediaStatus || 'unavailable',
      streamKind: product.preview?.streamKind || null,
      destination: product.destination,
      assetId: product.asset?.id || null,
      protectedViewUrl: null,
      companionId: companion.id,
      combinationId: product.id,
      mediaContract: publishedContract(product),
    }))

  const publicPhotos = companion.fotos.length > 0
    ? companion.fotos
    : [companion.banner, companion.avatar].filter(Boolean)

  return {
    id: companion.id,
    slug: companion.slug,
    nome: companion.nome,
    avatar: companion.avatar,
    banner: companion.banner,
    videoUrl: companion.videoUrl || companion.banner || companion.avatar,
    descricao: companion.descricao,
    idade: companion.idade,
    altura: companion.altura,
    fotos: publicPhotos,
    assinaturaAtiva: Boolean(mySubscriptionResult.data),
    online: companion.online,
    totalConteudos: products.length,
    totalChats: conversationsResult.count || 0,
    seguidores: followersResult.count || 0,
    nivelAtual: 1,
    xpAtual: 0,
    xpProximoNivel: 100,
    liveActions,
    liveAudios,
    historico: (historyResult.data || [])
      .filter((item) => isProtectedClientMediaUrl(item.result_url))
      .map((item) => ({
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
