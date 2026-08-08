import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { createImageMediaGeneration, createVideoMediaGeneration } from './media.service.js'

const GUIDED_AVATAR_OPTIONS_TABLE = 'companion_creation_options'
const GUIDED_TITLES_TABLE = 'prompt_dimensions'
const GUIDED_ITEMS_TABLE = 'prompt_options'

const CONTENT_TYPE_BY_MEDIA_KIND = {
  imagem: 'image',
  video: 'video',
}


function normalizeCompanionText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function isInternalTestCompanion(companion = {}) {
  const text = [companion.name, companion.slug]
    .map(normalizeCompanionText)
    .filter(Boolean)
    .join(' ')

  if (!text) return false
  return (
    text.includes('avatar teste') ||
    text.includes('avatar-teste') ||
    text.includes('teste 6.0') ||
    text.includes('teste-6-0') ||
    text.includes('teste_6_0') ||
    text.includes('sprint 6.0') ||
    text.includes('sprint-6-0')
  )
}

function mapPublicActress(row) {
  return {
    id: row.id,
    nome: row.name || row.slug || 'Avatar',
    avatar: row.avatar_url || row.thumbnail_url || row.banner_url || '',
    avatarUrl: row.avatar_url || row.thumbnail_url || row.banner_url || '',
  }
}

function mapSubscribedActress(row) {
  const companion = row.companions || {}
  return {
    id: companion.id,
    nome: companion.name || companion.slug || 'Avatar',
    avatar: companion.avatar_url || companion.thumbnail_url || companion.banner_url || '',
    avatarUrl: companion.avatar_url || companion.thumbnail_url || companion.banner_url || '',
  }
}

function mapOption(row) {
  return {
    id: row.id,
    label: row.label,
    categoria: row.category,
    categoriaLabel: row.category_label || undefined,
    titleId: row.title_id || undefined,
    titleName: row.title_name || row.category_label || undefined,
    source: row.source || 'legacy',
    imageUrl: row.image_url || undefined,
    videoUrl: row.video_url || undefined,
  }
}

function normalizeContentTypes(values = []) {
  return [...new Set((values || []).filter(Boolean))]
}

function isMissingGuidedFactoryTable(error) {
  const message = String(error?.message || '')
  return error?.code === '42P01' || /does not exist|schema cache|Could not find/i.test(message)
}

function isActive(row) {
  return row?.is_active !== false
}

function isVisibleToClient(row) {
  return row?.visible_to_client !== false && row?.admin_only !== true
}

function supportsContentType(row, contentType) {
  const contentTypes = normalizeContentTypes(row?.content_types || row?.metadata?.contentTypes || [])
  return contentTypes.length === 0 || contentTypes.includes(contentType)
}

function mapGuidedOption({ item, title }) {
  const titleName = title?.display_name || title?.name || title?.label || 'Opção'
  const itemName = item?.display_name || item?.name || item?.label || 'Item'

  return {
    id: item.id,
    label: itemName,
    categoria: title.id,
    categoriaLabel: titleName,
    titleId: title.id,
    titleName,
    source: 'guided_factory',
    imageUrl: item.image_url || undefined,
    videoUrl: item.video_url || undefined,
  }
}

function mapGeneratedItem(row) {
  return {
    id: row.id,
    atrizId: row.companion_id,
    atrizNome: row.companions?.name || 'Atriz',
    tipo: row.media_kind,
    url: row.result_url || undefined,
    status: row.status,
    progresso: row.progress || 0,
    eta: row.eta_seconds ?? undefined,
    criadaEm: row.created_at,
    denunciado: row.is_reported || false,
  }
}

async function requireActiveSubscription(profileId, companionId) {
  const { data, error } = await supabaseAdmin
    .from('companion_subscriptions')
    .select('id')
    .eq('profile_id', profileId)
    .eq('companion_id', companionId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar assinatura da atriz.', error)
  }

  if (!data) {
    throw new ApiError(403, 'Você precisa ter assinatura ativa dessa atriz.')
  }
}

async function listGenerated(profileId, mediaKind) {
  const { data, error } = await supabaseAdmin
    .from('media_generations')
    .select(`
      id,
      companion_id,
      media_kind,
      result_url,
      status,
      progress,
      eta_seconds,
      created_at,
      is_reported,
      companions:companion_id (
        name
      )
    `)
    .eq('profile_id', profileId)
    .eq('media_kind', mediaKind)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new ApiError(500, 'Erro ao carregar gerações.', error)
  }

  return (data || []).map(mapGeneratedItem)
}

async function reportGeneration(profileId, generationId, motivo, mediaKind) {
  const { data, error } = await supabaseAdmin
    .from('media_generations')
    .update({
      is_reported: true,
      report_reason: motivo,
      updated_at: new Date().toISOString(),
    })
    .eq('id', generationId)
    .eq('profile_id', profileId)
    .eq('media_kind', mediaKind)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao denunciar geração.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Geração não encontrada.')
  }

  return {
    success: true,
  }
}

export async function listSubscribedActresses(profileId) {
  const { data: subscriptions, error } = await supabaseAdmin
    .from('companion_subscriptions')
    .select(`
      companion_id,
      companions:companion_id (
        id,
        slug,
        name,
        avatar_url,
        banner_url,
        thumbnail_url
      )
    `)
    .eq('profile_id', profileId)
    .eq('status', 'active')

  if (error) {
    throw new ApiError(500, 'Erro ao carregar atrizes assinadas.', error)
  }

  const subscribed = (subscriptions || [])
    .filter((row) => row.companions && !isInternalTestCompanion(row.companions))
    .map(mapSubscribedActress)

  const { data: publicCompanions, error: publicError } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, avatar_url, banner_url, thumbnail_url, sort_order')
    .order('sort_order', { ascending: true })
    .limit(30)

  if (publicError) {
    throw new ApiError(500, 'Erro ao carregar avatares disponíveis.', publicError)
  }

  const publicItems = (publicCompanions || [])
    .filter((companion) => !isInternalTestCompanion(companion))
    .map(mapPublicActress)

  const merged = new Map()
  for (const item of [...subscribed, ...publicItems]) {
    if (!item.id || merged.has(item.id)) continue
    merged.set(item.id, item)
  }

  return Array.from(merged.values())
}


async function listGuidedClientOptions({ profileId, companionId, mediaKind }) {
  if (!companionId) return []

  const contentType = CONTENT_TYPE_BY_MEDIA_KIND[mediaKind]
  if (!contentType) return []

  await requireActiveSubscription(profileId, companionId)

  const { data: avatarRows, error: avatarError } = await supabaseAdmin
    .from(GUIDED_AVATAR_OPTIONS_TABLE)
    .select('option_id, is_enabled, visible_to_client')
    .eq('companion_id', companionId)
    .eq('is_enabled', true)
    .eq('visible_to_client', true)

  if (avatarError) {
    if (isMissingGuidedFactoryTable(avatarError)) return []
    throw new ApiError(500, 'Erro ao carregar opções liberadas para o avatar.', avatarError)
  }

  const optionIds = [...new Set((avatarRows || []).map((row) => row.option_id).filter(Boolean))]
  if (optionIds.length === 0) return []

  const { data: items, error: itemsError } = await supabaseAdmin
    .from(GUIDED_ITEMS_TABLE)
    .select('*')
    .in('id', optionIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (itemsError) {
    if (isMissingGuidedFactoryTable(itemsError)) return []
    throw new ApiError(500, 'Erro ao carregar itens liberados para o cliente.', itemsError)
  }

  const filteredItems = (items || [])
    .filter(isActive)
    .filter(isVisibleToClient)
    .filter((item) => supportsContentType(item, contentType))

  if (filteredItems.length === 0) return []

  const titleIds = [...new Set(filteredItems.map((item) => item.dimension_id).filter(Boolean))]
  if (titleIds.length === 0) return []

  const { data: titles, error: titlesError } = await supabaseAdmin
    .from(GUIDED_TITLES_TABLE)
    .select('*')
    .in('id', titleIds)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (titlesError) {
    if (isMissingGuidedFactoryTable(titlesError)) return []
    throw new ApiError(500, 'Erro ao carregar títulos liberados para o cliente.', titlesError)
  }

  const titleById = new Map(
    (titles || [])
      .filter(isActive)
      .filter(isVisibleToClient)
      .filter((title) => supportsContentType(title, contentType))
      .map((title) => [title.id, title]),
  )

  return filteredItems
    .map((item) => ({ item, title: titleById.get(item.dimension_id) }))
    .filter(({ title }) => Boolean(title))
    .sort((a, b) => {
      const titleSort = Number(a.title.sort_order || 0) - Number(b.title.sort_order || 0)
      if (titleSort !== 0) return titleSort
      return Number(a.item.sort_order || 0) - Number(b.item.sort_order || 0)
    })
    .map(mapGuidedOption)
}

export async function listImageOptions({ profileId = null, companionId = null } = {}) {
  if (profileId && companionId) {
    const guidedOptions = await listGuidedClientOptions({ profileId, companionId, mediaKind: 'imagem' })
    if (guidedOptions.length > 0) return guidedOptions
  }

  const { data, error } = await supabaseAdmin
    .from('nsfw_options')
    .select('id, media_kind, category, label, image_url, video_url, sort_order')
    .eq('media_kind', 'imagem')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar opções de imagem.', error)
  }

  return (data || []).map(mapOption)
}

export async function listVideoOptions({ profileId = null, companionId = null } = {}) {
  if (profileId && companionId) {
    const guidedOptions = await listGuidedClientOptions({ profileId, companionId, mediaKind: 'video' })
    if (guidedOptions.length > 0) return guidedOptions
  }

  const { data, error } = await supabaseAdmin
    .from('nsfw_options')
    .select('id, media_kind, category, label, image_url, video_url, sort_order')
    .eq('media_kind', 'video')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar opções de vídeo.', error)
  }

  return (data || []).map(mapOption)
}

export async function createImageGeneration(profileId, input) {
  return createImageMediaGeneration(profileId, input)
}

export async function createVideoGeneration(profileId, input) {
  return createVideoMediaGeneration(profileId, input)
}

export async function listGeneratedImages(profileId) {
  return listGenerated(profileId, 'imagem')
}

export async function listGeneratedVideos(profileId) {
  return listGenerated(profileId, 'video')
}

export async function reportImageGeneration(profileId, generationId, motivo) {
  return reportGeneration(profileId, generationId, motivo, 'imagem')
}

export async function reportVideoGeneration(profileId, generationId, motivo) {
  return reportGeneration(profileId, generationId, motivo, 'video')
}
