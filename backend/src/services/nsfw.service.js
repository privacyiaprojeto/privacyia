import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const IMAGE_COST = 30
const VIDEO_COST = 80

function mapSubscribedActress(row) {
  return {
    id: row.companions.id,
    nome: row.companions.name,
    avatar: row.companions.avatar_url,
  }
}

function mapOption(row) {
  return {
    id: row.id,
    label: row.label,
    categoria: row.category,
    imageUrl: row.image_url || undefined,
    videoUrl: row.video_url || undefined,
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

async function debitCredits(profileId, amount, reason) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('credits')
    .eq('id', profileId)
    .single()

  if (profileError) {
    throw new ApiError(500, 'Erro ao validar créditos.', profileError)
  }

  const currentCredits = profile.credits || 0
  if (currentCredits < amount) {
    throw new ApiError(409, 'Créditos insuficientes.')
  }

  const newCredits = currentCredits - amount

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ credits: newCredits })
    .eq('id', profileId)

  if (updateError) {
    throw new ApiError(500, 'Erro ao debitar créditos.', updateError)
  }

  const { error: ledgerError } = await supabaseAdmin
    .from('credit_ledger')
    .insert({
      profile_id: profileId,
      direction: 'saida',
      amount,
      reason,
    })

  if (ledgerError) {
    throw new ApiError(500, 'Erro ao registrar débito de créditos.', ledgerError)
  }

  return newCredits
}

async function getPlaceholderResultUrl(companionId, mediaKind) {
  const mediaFilter = mediaKind === 'video' ? 'video' : 'image'

  const { data: galleryItems, error: galleryError } = await supabaseAdmin
    .from('gallery_items')
    .select('media_url, media_type, created_at')
    .eq('companion_id', companionId)
    .eq('media_type', mediaFilter)
    .order('created_at', { ascending: false })
    .limit(1)

  if (galleryError) {
    throw new ApiError(500, 'Erro ao buscar mídia de placeholder.', galleryError)
  }

  if (galleryItems?.[0]?.media_url) {
    return galleryItems[0].media_url
  }

  const { data: companion, error: companionError } = await supabaseAdmin
    .from('companions')
    .select('banner_url, avatar_url')
    .eq('id', companionId)
    .maybeSingle()

  if (companionError) {
    throw new ApiError(500, 'Erro ao buscar fallback da atriz.', companionError)
  }

  return companion?.banner_url || companion?.avatar_url || null
}

async function settleDemoJobs(profileId, mediaKind) {
  const { data: pendingJobs, error } = await supabaseAdmin
    .from('media_generations')
    .select('id, companion_id, media_kind, created_at, external_job_id')
    .eq('profile_id', profileId)
    .eq('media_kind', mediaKind)
    .eq('status', 'em_andamento')
    .is('external_job_id', null)
    .order('created_at', { ascending: true })
    .limit(20)

  if (error) {
    throw new ApiError(500, 'Erro ao sincronizar gerações pendentes.', error)
  }

  const now = Date.now()
  const minDelayMs = mediaKind === 'imagem' ? 6_000 : 10_000

  for (const job of pendingJobs || []) {
    const ageMs = now - new Date(job.created_at).getTime()
    if (ageMs < minDelayMs) continue

    const placeholderUrl = await getPlaceholderResultUrl(job.companion_id, mediaKind)

    const { error: updateError } = await supabaseAdmin
      .from('media_generations')
      .update({
        status: 'concluido',
        progress: 100,
        eta_seconds: 0,
        result_url: placeholderUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id)

    if (updateError) {
      throw new ApiError(500, 'Erro ao concluir geração placeholder.', updateError)
    }
  }
}

async function listGenerated(profileId, mediaKind) {
  await settleDemoJobs(profileId, mediaKind)

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

async function createGeneration(profileId, mediaKind, input) {
  await requireActiveSubscription(profileId, input.atrizId)

  const cost = mediaKind === 'imagem' ? IMAGE_COST : VIDEO_COST
  await debitCredits(profileId, cost, `Geração de ${mediaKind}`)

  const { data, error } = await supabaseAdmin
    .from('media_generations')
    .insert({
      profile_id: profileId,
      companion_id: input.atrizId,
      media_kind: mediaKind,
      status: 'em_andamento',
      progress: 5,
      eta_seconds: mediaKind === 'imagem' ? 10 : 18,
      cost_credits: cost,
      option_payload: input,
    })
    .select('id, status, progress')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao registrar geração.', error)
  }

  return {
    id: data.id,
    status: data.status,
    progresso: data.progress,
  }
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
  const { data, error } = await supabaseAdmin
    .from('companion_subscriptions')
    .select(`
      companion_id,
      companions:companion_id (
        id,
        name,
        avatar_url
      )
    `)
    .eq('profile_id', profileId)
    .eq('status', 'active')

  if (error) {
    throw new ApiError(500, 'Erro ao carregar atrizes assinadas.', error)
  }

  return (data || []).map(mapSubscribedActress)
}

export async function listImageOptions() {
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

export async function listVideoOptions() {
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
  return createGeneration(profileId, 'imagem', input)
}

export async function createVideoGeneration(profileId, input) {
  return createGeneration(profileId, 'video', input)
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
