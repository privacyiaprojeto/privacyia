import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { normalizeMediaProductType } from './media-product-type.service.js'
import { inspectProtectedVideoRendererReadiness } from './video-renderer-readiness.service.js'

const VALID_DESTINATIONS = new Set(['feed', 'premium', 'public_storefront'])
const APPROVED_ASSET_STATUSES = new Set(['available', 'sold', 'published'])
const VIDEO_PRODUCTS = new Set(['short_video', 'live_action'])
const AUDIO_PRODUCTS = new Set(['audio', 'audio_chat', 'audio_live'])

const PUBLIC_COMBINATION_FIELDS = [
  'id',
  'companion_id',
  'title',
  'description',
  'media_type',
  'price_credits',
  'visible_to_client',
  'admin_only',
  'is_active',
  'metadata',
  'updated_at',
].join(', ')

const PUBLIC_COMPANION_FIELDS = [
  'id',
  'slug',
  'name',
  'avatar_url',
  'banner_url',
  'video_url',
  'thumbnail_url',
  'bio',
  'age',
  'height_label',
  'gallery_urls',
  'is_online',
  'sort_order',
].join(', ')

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))]
}

function isInternalTestCompanion(companion = {}) {
  const text = [companion.name, companion.slug]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ')

  return Boolean(text) && (
    text.includes('avatar teste') ||
    text.includes('avatar-teste') ||
    text.includes('teste 6.0') ||
    text.includes('teste-6-0') ||
    text.includes('teste_6_0') ||
    text.includes('sprint 6.0') ||
    text.includes('sprint-6-0')
  )
}

function publicCompanionFromRow(row = {}) {
  const avatar = row.avatar_url || row.thumbnail_url || row.banner_url || ''
  const banner = row.banner_url || row.thumbnail_url || avatar
  const galleryUrls = Array.isArray(row.gallery_urls)
    ? row.gallery_urls.filter((value) => typeof value === 'string' && value.trim())
    : []

  return {
    id: row.id,
    slug: row.slug || row.id,
    nome: row.name || row.slug || 'Criadora',
    avatar,
    banner,
    videoUrl: row.video_url || '',
    thumbnailUrl: row.thumbnail_url || null,
    descricao: row.bio || '',
    idade: Number(row.age || 0),
    altura: row.height_label || '',
    fotos: galleryUrls,
    online: row.is_online ?? false,
    sortOrder: Number(row.sort_order || 0),
  }
}

function normalizeMediaType(...sources) {
  const { mediaType } = normalizeMediaProductType(...sources)
  return mediaType === 'unknown' ? 'image' : mediaType
}

function publicationFromRow(row) {
  const metadata = safeObject(row?.metadata)
  return safeObject(metadata.productPublication || metadata.publication)
}

function normalizeDestination(value) {
  const destination = normalizeText(value)
  return VALID_DESTINATIONS.has(destination) ? destination : null
}

function strictPublishedRow(row) {
  if (!row?.id || !row?.companion_id) return null
  if (row.visible_to_client !== true || row.admin_only === true || row.is_active === false) return null

  const publication = publicationFromRow(row)
  const destination = normalizeDestination(publication.destination)
  if (!destination || publication.status !== 'published' || publication.published === false) return null

  const assetId = publication.assetId || publication.asset_id || null
  const storefrontActorIds = unique(
    Array.isArray(publication.storefrontActorIds)
      ? publication.storefrontActorIds
      : Array.isArray(publication.storefront_actor_ids)
        ? publication.storefront_actor_ids
        : [],
  )

  return {
    row,
    publication,
    destination,
    assetId,
    storefrontActorIds,
  }
}

function isSimulatedAsset(asset) {
  const metadata = safeObject(asset?.metadata)
  return [
    metadata.simulatedOutput,
    metadata.simulated_output,
    metadata.placeholder,
    metadata.isPlaceholder,
    metadata.is_placeholder,
  ].some((value) => value === true)
}

function buildPreview({ productId, mediaType, asset, renditions }) {
  const base = {
    type: VIDEO_PRODUCTS.has(mediaType) ? 'video' : AUDIO_PRODUCTS.has(mediaType) ? 'audio' : 'image',
    url: `/media/catalog-products/${productId}/preview`,
    mediaStatus: 'unavailable',
    streamKind: null,
    assetId: asset?.id || null,
    masterAssetId: asset?.master_asset_id || null,
    renditionId: null,
    userMessage: 'Mídia indisponível.',
  }

  if (mediaType === 'conflict') {
    return {
      ...base,
      userMessage: 'Mídia com configuração de tipo incompatível. Revisão necessária.',
    }
  }

  if (
    !asset ||
    !APPROVED_ASSET_STATUSES.has(normalizeText(asset.status)) ||
    isSimulatedAsset(asset) ||
    !asset.r2_bucket ||
    !asset.r2_key
  ) {
    return base
  }

  if (mediaType === 'live_action') {
    return {
      ...base,
      userMessage: 'Live Action interativo ainda não está disponível.',
    }
  }

  if (mediaType === 'audio_live') {
    return {
      ...base,
      userMessage: 'Live Audio audiovisual ainda não está disponível.',
    }
  }

  if (mediaType === 'short_video') {
    const rendererReadiness = inspectProtectedVideoRendererReadiness()
    if (!rendererReadiness.ready) {
      return {
        ...base,
        userMessage: rendererReadiness.userMessage,
      }
    }

    const preview = renditions.find((item) => item.rendition_type === 'preview' && item.status === 'available')
    if (preview) {
      return {
        ...base,
        mediaStatus: 'ready',
        streamKind: 'progressive',
        renditionId: preview.id,
        userMessage: 'Disponível.',
      }
    }

    return {
      ...base,
      mediaStatus: 'processing',
      userMessage: 'Preview em preparação. O Master e o HLS completo não são expostos na vitrine.',
    }
  }

  if (mediaType === 'audio' || mediaType === 'audio_chat') {
    const preview = renditions.find((item) => item.rendition_type === 'preview' && item.status === 'available')
    if (preview) {
      return {
        ...base,
        mediaStatus: 'ready',
        streamKind: 'progressive',
        renditionId: preview.id,
        userMessage: 'Disponível.',
      }
    }

    return {
      ...base,
      mediaStatus: 'processing',
      userMessage: 'Preview de áudio em preparação. O Master não é exposto na vitrine.',
    }
  }

  return {
    ...base,
    mediaStatus: 'ready',
    streamKind: 'image',
    userMessage: 'Disponível.',
  }
}

async function loadRowsByIds(table, ids, fields = '*') {
  const safeIds = unique(ids)
  if (safeIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin.from(table).select(fields).in('id', safeIds)
  if (error) throw new ApiError(500, `Erro ao carregar ${table} para o catálogo.`, error)
  return new Map((data || []).filter((row) => row?.id).map((row) => [row.id, row]))
}

async function loadRenditionsByMasterIds(masterIds) {
  const safeIds = unique(masterIds)
  if (safeIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from('media_asset_renditions')
    .select('id, master_asset_id, rendition_type, delivery_id, status, metadata, created_at')
    .in('master_asset_id', safeIds)
    .is('delivery_id', null)
    .eq('rendition_type', 'preview')
    .order('created_at', { ascending: false })

  if (error) throw new ApiError(500, 'Erro ao carregar renditions do catálogo.', error)

  const grouped = new Map()
  for (const item of data || []) {
    const current = grouped.get(item.master_asset_id) || []
    current.push(item)
    grouped.set(item.master_asset_id, current)
  }
  return grouped
}

async function loadPublicCompanionsByIds(companionIds) {
  const ids = unique(companionIds)
  if (ids.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select(PUBLIC_COMPANION_FIELDS)
    .in('id', ids)

  if (error) throw new ApiError(500, 'Erro ao carregar a vitrine pública.', error)

  return new Map(
    (data || [])
      .filter((row) => row?.id && !isInternalTestCompanion(row))
      .map((row) => [row.id, publicCompanionFromRow(row)]),
  )
}

async function loadActiveActorBindings(actorIds = [], companionId = null) {
  let query = supabaseAdmin
    .from('avatar_production_authorizations')
    .select('actor_profile_id, companion_id, status, starts_at, ends_at, created_at')
    .eq('status', 'active')

  const ids = unique(actorIds)
  if (ids.length > 0) query = query.in('actor_profile_id', ids)
  if (companionId) query = query.eq('companion_id', companionId)

  const { data, error } = await query
  if (error) throw new ApiError(500, 'Erro ao validar vitrines seletivas dos atores.', error)

  const now = Date.now()
  return (data || []).filter((row) => {
    if (!row.actor_profile_id || !row.companion_id) return false
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false
    return true
  })
}

function publicProductFromContext(context, companion, asset, renditions) {
  const mediaType = normalizeMediaType(asset, context.row)
  const preview = buildPreview({
    productId: context.row.id,
    mediaType,
    asset,
    renditions,
  })

  return {
    id: context.row.id,
    title: context.row.title || 'Conteúdo exclusivo',
    description: context.publication.description || context.row.description || '',
    mediaType,
    destination: context.destination,
    priceCredits: Math.max(0, Number(context.row.price_credits || 0)),
    updatedAt: context.row.updated_at || null,
    actorProfileId: context.publication.actorProfileId || context.publication.actor_profile_id || null,
    storefrontActorIds: context.storefrontActorIds,
    asset: asset ? {
      id: asset.id,
      status: asset.status,
      masterAssetId: asset.master_asset_id || null,
    } : null,
    preview,
    companion,
  }
}

export async function listPublishedCatalogProducts({
  destinations = null,
  companionId = null,
  storefrontActorIds = null,
  limit = 200,
} = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)
  const destinationFilter = unique(destinations).map(normalizeDestination).filter(Boolean)
  const actorFilter = new Set(unique(storefrontActorIds))

  const { data, error } = await supabaseAdmin
    .from('media_combinations')
    .select(PUBLIC_COMBINATION_FIELDS)
    .eq('visible_to_client', true)
    .eq('is_active', true)
    .eq('admin_only', false)
    .order('updated_at', { ascending: false })
    .limit(Math.min(safeLimit * 3, 500))

  if (error) throw new ApiError(500, 'Erro ao carregar produtos publicados.', error)

  const contexts = (data || [])
    .map(strictPublishedRow)
    .filter(Boolean)
    .filter((context) => destinationFilter.length === 0 || destinationFilter.includes(context.destination))
    .filter((context) => !companionId || context.row.companion_id === companionId)
    .filter((context) => actorFilter.size === 0 || context.storefrontActorIds.some((id) => actorFilter.has(id)))
    .slice(0, safeLimit)

  const assetsById = await loadRowsByIds(
    'media_asset_variants',
    contexts.map((context) => context.assetId),
    'id, combination_id, companion_id, actor_profile_id, media_type, status, r2_bucket, r2_key, master_asset_id, metadata, updated_at',
  )
  const renditionsByMaster = await loadRenditionsByMasterIds(
    [...assetsById.values()].map((asset) => asset.master_asset_id),
  )
  const companionsById = await loadPublicCompanionsByIds(contexts.map((context) => context.row.companion_id))

  return contexts
    .map((context) => {
      const companion = companionsById.get(context.row.companion_id)
      if (!companion) return null

      const asset = context.assetId ? assetsById.get(context.assetId) || null : null
      if (asset && asset.combination_id !== context.row.id) return null
      const renditions = asset?.master_asset_id ? renditionsByMaster.get(asset.master_asset_id) || [] : []
      return publicProductFromContext(context, companion, asset, renditions)
    })
    .filter(Boolean)
}

export async function listPublishedCatalogCompanions({ limit = 50 } = {}) {
  const products = await listPublishedCatalogProducts({
    destinations: ['premium', 'public_storefront'],
    limit: 500,
  })
  const actorIds = unique(products.flatMap((product) => product.storefrontActorIds))
  const bindings = await loadActiveActorBindings(actorIds)
  const companionIds = unique(bindings.map((binding) => binding.companion_id))
  const companionsById = await loadPublicCompanionsByIds(companionIds)
  const actorToCompanion = new Map(bindings.map((binding) => [binding.actor_profile_id, binding.companion_id]))
  const grouped = new Map()

  for (const product of products) {
    for (const actorId of product.storefrontActorIds) {
      const targetCompanionId = actorToCompanion.get(actorId)
      const companion = companionsById.get(targetCompanionId)
      if (!companion) continue

      const current = grouped.get(companion.id) || {
        ...companion,
        activeProductsCount: 0,
        activeMediaTypes: new Set(),
        latestPublicationAt: null,
      }
      current.activeProductsCount += 1
      current.activeMediaTypes.add(product.mediaType)
      if (!current.latestPublicationAt || String(product.updatedAt || '') > String(current.latestPublicationAt || '')) {
        current.latestPublicationAt = product.updatedAt || null
      }
      grouped.set(companion.id, current)
    }
  }

  return [...grouped.values()]
    .map((companion) => ({ ...companion, activeMediaTypes: [...companion.activeMediaTypes] }))
    .sort((left, right) => (
      right.activeProductsCount !== left.activeProductsCount
        ? right.activeProductsCount - left.activeProductsCount
        : left.sortOrder - right.sortOrder
    ))
    .slice(0, Math.min(Math.max(Number(limit) || 50, 1), 100))
}

export async function getPublishedCatalogCompanion(identifier) {
  const value = String(identifier || '').trim()
  if (!value) throw new ApiError(404, 'Criadora não encontrada.')

  let query = supabaseAdmin.from('companions').select(PUBLIC_COMPANION_FIELDS)
  query = isUuid(value) ? query.eq('id', value) : query.eq('slug', value)
  const { data: companionRow, error } = await query.maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao carregar perfil público.', error)
  if (!companionRow || isInternalTestCompanion(companionRow)) {
    throw new ApiError(404, 'Criadora não encontrada.')
  }

  const bindings = await loadActiveActorBindings([], companionRow.id)
  const actorIds = unique(bindings.map((binding) => binding.actor_profile_id))
  const products = actorIds.length > 0
    ? await listPublishedCatalogProducts({
        destinations: ['premium', 'public_storefront'],
        storefrontActorIds: actorIds,
        limit: 300,
      })
    : []

  if (products.length === 0) {
    throw new ApiError(404, 'Criadora sem produtos publicados nesta vitrine.')
  }

  return {
    companion: publicCompanionFromRow(companionRow),
    actorProfileIds: actorIds,
    products,
  }
}
