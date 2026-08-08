import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { debitCreditsAtomically, refundCredits } from './wallet.service.js'
import { addImageRealJob } from '../queues/image.queue.js'
import { assertAvatarCompliantForProduction } from './actor-compliance.service.js'
import { createSceneDirection } from './scene-direction.service.js'
import { markClientGenerationFailed, markClientGenerationQueued } from './media-generation-tracking.service.js'
import { assertApprovedActorIdentityForProduction } from './actor-identity-lora.service.js'

const IMAGE_MEDIA_KIND = 'imagem'
const VIDEO_MEDIA_KIND = 'video'
const PROCESSING_JOB_STATUS = 'processing'
const DEFAULT_VIDEO_CREDITS_COST = 80
const GUIDED_TITLES_TABLE = 'prompt_dimensions'
const GUIDED_ITEMS_TABLE = 'prompt_options'


function getImageJobKind() {
  return env.MEDIA_IMAGE_JOB_KIND || 'image'
}

function getVideoJobKind() {
  return env.MEDIA_VIDEO_JOB_KIND || 'video'
}

function mapOptionInput(input = {}) {
  return [
    ['posicaoId', input.posicaoId],
    ['ambienteId', input.ambienteId],
    ['acessorioId', input.acessorioId],
    ['roupaId', input.roupaId],
  ]
    .filter(([, value]) => value)
    .map(([field, id]) => ({ field, id }))
}

function mapVideoOptionInput(input = {}) {
  return [
    ['acaoId', input.acaoId || input.posicaoId],
    ['localizacaoId', input.localizacaoId || input.ambienteId],
    ['acessorioId', input.acessorioId],
    ['roupaId', input.roupaId],
  ]
    .filter(([, value]) => value)
    .map(([field, id]) => ({ field, id }))
}

function normalizeMediaJobError(error) {
  const message = String(error?.message || '')

  if (error?.code === '23505' || /duplicate key/i.test(message)) {
    return new ApiError(429, 'Você já possui uma geração em andamento. Aguarde finalizar antes de iniciar outra.', error)
  }

  if (/invalid input value for enum/i.test(message) && /media_job_kind/i.test(message)) {
    return new ApiError(
      500,
      `Valor inválido para media_jobs.kind. Ajuste MEDIA_IMAGE_JOB_KIND no .env para o valor real do enum media_job_kind. Valor atual: ${getImageJobKind()}`,
      error,
    )
  }

  return new ApiError(500, 'Erro ao registrar job de mídia.', error)
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

async function getCompanion(companionId) {
  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, slug, name, age, bio, avatar_url, banner_url, thumbnail_url, is_active')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar companion para geração de mídia.', error)
  }

  if (!data || data.is_active === false) {
    throw new ApiError(404, 'Companion não encontrado ou inativo.')
  }

  return data
}


function normalizeGuidedSelections(input = {}) {
  const selections = input.guidedSelections || input.selecoesGuiadas || input.dynamicSelections || []

  if (Array.isArray(selections)) {
    return selections
      .map((item) => ({
        titleId: item?.titleId || null,
        category: item?.category || item?.categoria || item?.titleId || null,
        itemId: item?.itemId || item?.id || null,
      }))
      .filter((item) => item.itemId)
  }

  if (selections && typeof selections === 'object') {
    return Object.entries(selections)
      .filter(([, itemId]) => Boolean(itemId))
      .map(([category, itemId]) => ({
        titleId: category,
        category,
        itemId,
      }))
  }

  return []
}

function supportsGuidedContentType(row, contentType) {
  const contentTypes = row?.content_types || row?.metadata?.contentTypes || []
  return !Array.isArray(contentTypes) || contentTypes.length === 0 || contentTypes.includes(contentType)
}

function guidedContentTypeForMediaKind(mediaKind) {
  return mediaKind === VIDEO_MEDIA_KIND ? 'video' : 'image'
}

async function getSelectedGuidedOptions(input = {}, mediaKind = IMAGE_MEDIA_KIND) {
  const selections = normalizeGuidedSelections(input)

  if (selections.length === 0) {
    return {}
  }

  const itemIds = [...new Set(selections.map((item) => item.itemId).filter(Boolean))]

  if (itemIds.length === 0) {
    return {}
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from(GUIDED_ITEMS_TABLE)
    .select('*')
    .in('id', itemIds)
    .eq('is_active', true)

  if (itemsError) {
    throw new ApiError(500, 'Erro ao carregar opções guiadas da geração.', itemsError)
  }

  const contentType = guidedContentTypeForMediaKind(mediaKind)
  const filteredItems = (items || [])
    .filter((item) => item.visible_to_client !== false && item.admin_only !== true)
    .filter((item) => supportsGuidedContentType(item, contentType))

  if (filteredItems.length === 0) return {}

  const titleIds = [...new Set(filteredItems.map((item) => item.dimension_id).filter(Boolean))]

  const { data: titles, error: titlesError } = await supabaseAdmin
    .from(GUIDED_TITLES_TABLE)
    .select('*')
    .in('id', titleIds)
    .eq('is_active', true)

  if (titlesError) {
    throw new ApiError(500, 'Erro ao carregar títulos guiados da geração.', titlesError)
  }

  const titleById = new Map(
    (titles || [])
      .filter((title) => title.visible_to_client !== false && title.admin_only !== true)
      .filter((title) => supportsGuidedContentType(title, contentType))
      .map((title) => [title.id, title]),
  )

  const itemById = new Map(filteredItems.map((item) => [item.id, item]))
  const result = {}

  for (const selection of selections) {
    const item = itemById.get(selection.itemId)
    if (!item) continue

    const title = titleById.get(item.dimension_id)
    if (!title) continue

    const titleName = title.display_name || title.name || title.label || 'Opção'
    const itemName = item.display_name || item.name || item.label || 'Item'
    const key = `guided:${title.id}`

    result[key] = {
      id: item.id,
      mediaKind,
      category: titleName,
      titleId: title.id,
      titleName,
      label: itemName,
      technicalSnippet: item.technical_snippet || itemName,
      negativePrompt: item.negative_prompt || '',
      isGuided: true,
    }
  }

  return result
}

async function getSelectedOptions(input) {
  const optionPairs = mapOptionInput(input)
  const result = {}

  if (optionPairs.length > 0) {
    const optionIds = optionPairs.map((item) => item.id)

    const { data, error } = await supabaseAdmin
      .from('nsfw_options')
      .select('id, media_kind, category, label')
      .in('id', optionIds)
      .eq('is_active', true)

    if (error) {
      throw new ApiError(500, 'Erro ao carregar opções da geração.', error)
    }

    const byId = new Map((data || []).map((item) => [item.id, item]))

    for (const pair of optionPairs) {
      const option = byId.get(pair.id)
      if (!option) continue

      result[pair.field] = {
        id: option.id,
        mediaKind: option.media_kind,
        category: option.category,
        label: option.label,
        isGuided: false,
      }
    }
  }

  return {
    ...result,
    ...(await getSelectedGuidedOptions(input, IMAGE_MEDIA_KIND)),
  }
}


async function getSelectedVideoOptions(input) {
  const optionPairs = mapVideoOptionInput(input)
  const result = {}

  if (optionPairs.length > 0) {
    const optionIds = optionPairs.map((item) => item.id)

    const { data, error } = await supabaseAdmin
      .from('nsfw_options')
      .select('id, media_kind, category, label, image_url, video_url')
      .in('id', optionIds)
      .eq('is_active', true)

    if (error) {
      throw new ApiError(500, 'Erro ao carregar opções de vídeo.', error)
    }

    const byId = new Map((data || []).map((item) => [item.id, item]))

    for (const pair of optionPairs) {
      const option = byId.get(pair.id)
      if (!option) continue

      result[pair.field] = {
        id: option.id,
        mediaKind: option.media_kind,
        category: option.category,
        label: option.label,
        imageUrl: option.image_url || null,
        videoUrl: option.video_url || null,
        isGuided: false,
      }
    }
  }

  return {
    ...result,
    ...(await getSelectedGuidedOptions(input, VIDEO_MEDIA_KIND)),
  }
}

async function assertNoProcessingMediaJob(profileId) {
  const { data, error } = await supabaseAdmin
    .from('media_jobs')
    .select('id, kind, status, created_at')
    .eq('profile_id', profileId)
    .eq('status', PROCESSING_JOB_STATUS)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao verificar geração em andamento.', error)
  }

  if (data) {
    throw new ApiError(429, 'Você já possui uma geração em andamento. Aguarde finalizar antes de iniciar outra.', {
      mediaJobId: data.id,
      kind: data.kind,
      createdAt: data.created_at,
    })
  }
}

async function getMediaPricingRule(mediaKind) {
  const { data, error } = await supabaseAdmin
    .from('media_pricing_rules')
    .select('media_kind, base_cost_credits, is_active')
    .eq('media_kind', mediaKind)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao consultar tabela de preços de mídia.', error)
  }

  if (!data) {
    throw new ApiError(500, `Preço não configurado para media_kind=${mediaKind}. Configure public.media_pricing_rules antes de gerar mídia.`)
  }

  const creditsCost = Number(data.base_cost_credits || 0)

  if (!Number.isInteger(creditsCost) || creditsCost <= 0) {
    throw new ApiError(500, `Preço inválido para media_kind=${mediaKind}.`)
  }

  return {
    mediaKind: data.media_kind,
    creditsCost,
  }
}

async function createMediaJob({ profileId, companionId, kind, promptPayload, creditsCost }) {
  const { data, error } = await supabaseAdmin
    .from('media_jobs')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      kind,
      status: PROCESSING_JOB_STATUS,
      prompt_payload: promptPayload,
      credits_cost: creditsCost,
    })
    .select('id, status, created_at')
    .single()

  if (error) {
    throw normalizeMediaJobError(error)
  }

  return data
}

async function createMediaGeneration({ profileId, companionId, mediaJob, promptPayload, creditsCost }) {
  const { data, error } = await supabaseAdmin
    .from('media_generations')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      media_kind: IMAGE_MEDIA_KIND,
      status: 'em_andamento',
      progress: 15,
      eta_seconds: 30,
      cost_credits: creditsCost,
      option_payload: {
        ...promptPayload,
        mediaJobId: mediaJob.id,
      },
      external_provider: 'bullmq',
      external_job_id: mediaJob.id,
    })
    .select('id, status, progress')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao registrar geração de mídia.', error)
  }

  return data
}

const IMAGE_QUALITY_BOOSTERS = [
  'ultra realistic',
  '8k',
  'raw photo',
  'intricate details',
  'cinematic lighting',
  'masterpiece',
  'highres',
  'photorealistic',
  'sharp focus',
  'natural skin texture',
  'realistic eyes',
  'realistic hands',
  'professional photography',
  'detailed face',
  'clean composition',
].join(', ')

const DEFAULT_IMAGE_NEGATIVE_PROMPT = [
  'worst quality',
  'low quality',
  'lowres',
  'blurry',
  'out of focus',
  'jpeg artifacts',
  'watermark',
  'signature',
  'logo',
  'text',
  'cropped',
  'duplicate',
  'multiple persons',
  'extra person',
  'deformed',
  'disfigured',
  'bad anatomy',
  'bad proportions',
  'extra limbs',
  'extra arms',
  'extra legs',
  'missing arms',
  'missing legs',
  'extra fingers',
  'missing fingers',
  'fused fingers',
  'mutated hands',
  'bad hands',
  'cross-eye',
  'lazy eye',
  'cloned face',
  'plastic skin',
  'cgi',
  '3d render',
  'cartoon',
  'anime',
].join(', ')

function normalizePromptText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
}

function joinPromptSegments(parts, separator = ', ') {
  return parts.map(normalizePromptText).filter(Boolean).join(separator)
}

function getOptionLabel(options = {}, key) {
  return normalizePromptText(options?.[key]?.label)
}

function getGuidedOptionSegments(options = {}) {
  return Object.values(options)
    .filter((option) => option?.isGuided)
    .map((option) => {
      const title = normalizePromptText(option?.titleName || option?.category)
      const snippet = normalizePromptText(option?.technicalSnippet || option?.label)
      return title && snippet ? `${title}: ${snippet}` : snippet
    })
    .filter(Boolean)
}

function buildCompanionBaseDescriptor(companion = {}) {
  return joinPromptSegments([
    companion?.name || 'adult female subject',
    companion?.age ? `${companion.age} years old` : null,
    companion?.ethnicity || null,
    companion?.body_type ? `${companion.body_type} body type` : null,
    companion?.bio || null,
  ])
}

function buildImagePromptPayload({ companion, options = {}, creditsCost }) {
  const pose = getOptionLabel(options, 'posicaoId')
  const environment = getOptionLabel(options, 'ambienteId')
  const accessory = getOptionLabel(options, 'acessorioId')
  const outfit = getOptionLabel(options, 'roupaId')
  const guidedSegments = getGuidedOptionSegments(options)

  const prompt = joinPromptSegments([
    'photorealistic editorial portrait',
    buildCompanionBaseDescriptor(companion),
    'solo adult female subject',
    'subject centered, elegant composition, realistic facial features',
    pose ? `pose/composition: ${pose}` : 'pose/composition: elegant natural portrait pose',
    environment ? `scene/background: ${environment}` : 'scene/background: premium indoor editorial setting',
    outfit ? `wardrobe: ${outfit}` : 'wardrobe: tasteful modern outfit',
    accessory ? `accessory: ${accessory}` : null,
    ...guidedSegments,
    IMAGE_QUALITY_BOOSTERS,
  ])

  return {
    mediaKind: IMAGE_MEDIA_KIND,
    companionId: companion?.id,
    selectedOptions: options,
    pricing: {
      mediaKind: IMAGE_MEDIA_KIND,
      creditsCost,
    },
    prompt,
    prompt_text: prompt,
    negativePrompt: DEFAULT_IMAGE_NEGATIVE_PROMPT,
    negative_prompt: DEFAULT_IMAGE_NEGATIVE_PROMPT,
    width: 1024,
    height: 1024,
    steps: 32,
    num_inference_steps: 32,
    guidance_scale: 6.5,
    generationConfig: {
      width: 1024,
      height: 1024,
      num_inference_steps: 32,
      guidance_scale: 6.5,
    },
    requestedAt: new Date().toISOString(),
  }
}


function buildVideoPromptPayload({ companion, input = {}, options = {}, creditsCost }) {
  const guidedSegments = getGuidedOptionSegments(options)
  const prompt = joinPromptSegments([
    `cinematic video featuring ${companion?.name || companion?.slug || 'the authorized adult model'}`,
    ...guidedSegments,
    normalizePromptText(input.notes || input.prompt || ''),
    'preserve authorized identity',
    'private master output',
    'quality review required',
  ])

  return {
    mediaKind: VIDEO_MEDIA_KIND,
    companionId: companion?.id,
    selectedOptions: options,
    guidedSelections: Object.values(options).filter((item) => item?.isGuided),
    prompt,
    prompt_text: prompt,
    negative_prompt: 'low quality, blurry, distorted identity, duplicate subject, watermark, text, logo',
    pricing: { mediaKind: VIDEO_MEDIA_KIND, creditsCost },
    productionMode: String(input.productionMode || input.production_mode || (input.baseSceneId ? 'v2v' : 'i2v')).toLowerCase() === 'v2v' ? 'v2v' : 'i2v',
    baseSceneId: input.baseSceneId || input.base_scene_id || null,
    provider: 'runpod',
    engine: input.baseSceneId ? 'wan-2.1-v2v' : 'wan-2.1-i2v',
    requestedAt: new Date().toISOString(),
  }
}

async function createVideoMediaGenerationRecord({ profileId, companionId, mediaJob, promptPayload, creditsCost }) {
  const { data, error } = await supabaseAdmin
    .from('media_generations')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      media_kind: VIDEO_MEDIA_KIND,
      status: 'em_andamento',
      progress: 5,
      eta_seconds: 180,
      cost_credits: creditsCost,
      option_payload: {
        ...promptPayload,
        mediaJobId: mediaJob.id,
      },
      external_provider: 'bullmq',
      external_job_id: mediaJob.id,
    })
    .select('id, status, progress')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao registrar geração de vídeo.', error)
  }

  return data
}

async function getVideoPricingRule() {
  try {
    return await getMediaPricingRule(VIDEO_MEDIA_KIND)
  } catch (error) {
    console.warn('[Media Pipeline] preço de vídeo não configurado em media_pricing_rules. Usando fallback de créditos.', error?.message || error)

    return {
      mediaKind: VIDEO_MEDIA_KIND,
      creditsCost: DEFAULT_VIDEO_CREDITS_COST,
    }
  }
}

async function updateMediaGenerationFailed(generationId, safeError, now) {
  if (!generationId) return

  const { error } = await supabaseAdmin
    .from('media_generations')
    .update({
      status: 'erro',
      progress: 0,
      eta_seconds: 0,
      report_reason: safeError,
      updated_at: now,
    })
    .eq('id', generationId)

  if (error) {
    console.error('[Media Pipeline] falha ao marcar media_generation como erro:', error)
  }
}

async function markMediaFailed({ mediaJobId, generationId, errorMessage }) {
  const safeError = String(errorMessage || 'Falha desconhecida na geração de mídia.').slice(0, 500)
  const now = new Date().toISOString()

  const jobPromise = mediaJobId
    ? supabaseAdmin
        .from('media_jobs')
        .update({
          status: 'failed',
          error_message: safeError,
          updated_at: now,
        })
        .eq('id', mediaJobId)
    : Promise.resolve()

  await Promise.allSettled([
    jobPromise,
    updateMediaGenerationFailed(generationId, safeError, now),
  ])
}

function queueEnabledForImage() {
  return Boolean(env.WORKERS_ENABLED && env.ACTOR_PIPELINE_QUEUE_ENABLED)
}

function queueEnabledForVideo() {
  return Boolean(env.WORKERS_ENABLED && env.SCENE_DIRECTION_QUEUE_ENABLED)
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase()
  return String(error?.code || '') === '42703' || message.includes('does not exist') || message.includes('column')
}

async function insertAdaptive(table, input, label, { requiredColumns = [] } = {}) {
  let payload = { ...input }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select('*').maybeSingle()
    if (!error) return data
    if (!isMissingColumnError(error)) throw new ApiError(500, `Erro ao criar ${label}.`, error)
    const match = String(error.message || '').match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i)
      || String(error.message || '').match(/["']([a-zA-Z0-9_]+)["']\s+does not exist/i)
    const column = match?.[1]
    if (!column || !(column in payload)) throw new ApiError(500, `Schema incompatível ao criar ${label}.`, error)
    if (requiredColumns.includes(column)) {
      throw new ApiError(500, `Schema incompatível: coluna obrigatória ${column} ausente ao criar ${label}.`, error)
    }
    delete payload[column]
  }
  throw new ApiError(500, `Falha ao adaptar ${label}.`)
}

async function resolveCanonicalActorContext(companionId, contentType) {
  const { data: authorizations, error } = await supabaseAdmin
    .from('avatar_production_authorizations')
    .select('*')
    .eq('companion_id', companionId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) throw new ApiError(500, 'Erro ao carregar autorização canônica da atriz.', error)
  const now = Date.now()
  const authorization = (authorizations || []).find((row) => {
    if (!row.actor_profile_id) return false
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false
    const types = Array.isArray(row.authorized_for_content_types) ? row.authorized_for_content_types : []
    return types.length === 0 || types.includes(contentType) || (contentType === 'video' && types.some((type) => ['short_video', 'live_action'].includes(String(type))))
  })

  if (!authorization) throw new ApiError(409, 'A atriz não possui autorização ativa para esta produção.')
  await assertAvatarCompliantForProduction({ companionId, contentType })
  return { actorProfileId: authorization.actor_profile_id, authorizationId: authorization.id }
}

async function createCanonicalImageBatch({ profileId, companion, context, promptPayload, mediaJob, generation }) {
  const now = new Date().toISOString()
  const combinationId = randomUUID()
  const batchId = randomUUID()
  const itemId = randomUUID()
  const title = `Pedido de imagem • ${companion.name || companion.slug || companion.id} • ${String(generation.id).slice(0, 8)}`

  await insertAdaptive('media_combinations', {
    id: combinationId,
    companion_id: companion.id,
    actor_profile_id: context.actorProfileId,
    avatar_production_authorization_id: context.authorizationId,
    media_origin: 'client_canonical_queue',
    media_type: 'image',
    content_type: 'image',
    combination_key: `client:image:${generation.id}`,
    title, name: title, label: title,
    status: 'active', is_active: true, active: true,
    visible_to_client: false, admin_only: true, price_credits: 0,
    prompt: promptPayload.prompt,
    prompt_final: promptPayload.prompt,
    negative_prompt: promptPayload.negative_prompt,
    guided_selections: promptPayload.guidedSelections || [],
    metadata: { source: 'client_canonical_queue', profileId, mediaJobId: mediaJob.id, generationId: generation.id, qaRequired: true, publicUrl: false },
    created_at: now, updated_at: now,
  }, 'combinação canônica do Cliente', { requiredColumns: ['id', 'companion_id', 'actor_profile_id'] })

  await insertAdaptive('media_generation_batches', {
    id: batchId,
    companion_id: companion.id,
    profile_id: profileId,
    actor_profile_id: context.actorProfileId,
    avatar_production_authorization_id: context.authorizationId,
    media_origin: 'client_canonical_queue',
    name: title, title, label: title,
    status: 'queued', source: 'client_canonical_queue', job_origin: 'client_nsfw_adapter',
    media_type: 'image', content_type: 'image',
    total_items: 1, total_count: 1, queued_items: 1, requested_variants: 1,
    metadata: { source: 'client_canonical_queue', combinationId, profileId, mediaJobId: mediaJob.id, generationId: generation.id },
    created_at: now, updated_at: now,
  }, 'lote canônico do Cliente', { requiredColumns: ['id', 'companion_id', 'actor_profile_id'] })

  await insertAdaptive('media_generation_batch_items', {
    id: itemId,
    batch_id: batchId,
    companion_id: companion.id,
    profile_id: profileId,
    actor_profile_id: context.actorProfileId,
    avatar_production_authorization_id: context.authorizationId,
    media_origin: 'client_canonical_queue',
    combination_id: combinationId,
    media_combination_id: combinationId,
    status: 'queued', source: 'client_canonical_queue', job_origin: 'client_nsfw_adapter',
    media_type: 'image', content_type: 'image', requested_variants: 1, variant_number: 1, item_index: 0,
    idempotency_key: `client-canonical:${generation.id}`,
    prompt: promptPayload.prompt, prompt_text: promptPayload.prompt, prompt_final: promptPayload.prompt,
    negative_prompt: promptPayload.negative_prompt,
    generation_payload: { ...promptPayload, source: 'client_canonical_queue', factoryMode: 'real_image', profileId, mediaJobId: mediaJob.id, generationId: generation.id },
    generation_params: promptPayload.generationConfig,
    metadata: { source: 'client_canonical_queue', profileId, mediaJobId: mediaJob.id, generationId: generation.id, qaRequired: true },
    created_at: now, updated_at: now,
  }, 'item canônico do Cliente', { requiredColumns: ['id', 'batch_id', 'companion_id', 'actor_profile_id', 'combination_id'] })

  const job = await addImageRealJob({
    batchItemId: itemId,
    batchId,
    combinationId,
    requestedVariants: 1,
    nextStatus: 'qa_pending',
    metadata: { source: 'client_canonical_queue', profileId, mediaJobId: mediaJob.id, generationId: generation.id },
    jobPayload: {
      companionId: companion.id,
      actorProfileId: context.actorProfileId,
      productionAuthorizationId: context.authorizationId,
      profileId,
      mediaJobId: mediaJob.id,
      generationId: generation.id,
      factoryMode: 'real_image',
      generateRealImage: true,
      createDelivery: false,
      createGalleryItem: false,
    },
  })

  return { queueJobId: String(job.id), batchId, itemId, combinationId }
}

export async function createImageMediaGeneration(profileId, input) {
  if (!queueEnabledForImage()) throw new ApiError(503, 'Produção canônica indisponível: mantenha a solicitação bloqueada até os workers de imagem serem habilitados.')
  if (!env.RUNPOD_IMAGE_ENDPOINT_ID) throw new ApiError(503, 'RunPod de imagem ainda não configurado.')

  const companionId = input.atrizId
  await assertNoProcessingMediaJob(profileId)
  await requireActiveSubscription(profileId, companionId)
  const companion = await getCompanion(companionId)
  const context = await resolveCanonicalActorContext(companionId, 'image')
  await assertApprovedActorIdentityForProduction({
    actorProfileId: context.actorProfileId,
    companionId,
    authorizationId: context.authorizationId,
    contentType: 'image',
  })
  const options = await getSelectedOptions(input)
  const pricing = await getMediaPricingRule(IMAGE_MEDIA_KIND)
  const promptPayload = buildImagePromptPayload({ companion, options, creditsCost: pricing.creditsCost })
  promptPayload.guidedSelections = Object.values(options).filter((item) => item?.isGuided)
  promptPayload.actorProfileId = context.actorProfileId
  promptPayload.authorizationId = context.authorizationId

  let mediaJob
  let generation
  let debited = false
  try {
    mediaJob = await createMediaJob({ profileId, companionId, kind: getImageJobKind(), promptPayload, creditsCost: pricing.creditsCost })
    await debitCreditsAtomically(profileId, pricing.creditsCost, 'Geração de imagem', { referenceType: 'media_job', referenceId: mediaJob.id })
    debited = true
    generation = await createMediaGeneration({ profileId, companionId, mediaJob, promptPayload, creditsCost: pricing.creditsCost })
    const canonical = await createCanonicalImageBatch({ profileId, companion, context, promptPayload, mediaJob, generation })
    await markClientGenerationQueued({ mediaJobId: mediaJob.id, generationId: generation.id, queueJobId: canonical.queueJobId, canonical: { ...promptPayload, ...canonical, privateStorage: true, qaRequired: true } })
    return { id: generation.id, mediaJobId: mediaJob.id, status: 'em_andamento', progresso: 10, accepted: true, canonicalQueue: 'media:image', ...canonical, message: 'Pedido aceito pela fila canônica. A mídia ficará em QA antes de qualquer entrega.' }
  } catch (error) {
    await markClientGenerationFailed({ mediaJobId: mediaJob?.id, generationId: generation?.id, message: error?.message })
    if (debited) await refundCredits(profileId, pricing.creditsCost, 'Estorno por falha ao enfileirar imagem', { referenceType: 'media_job', referenceId: mediaJob?.id }).catch(() => {})
    throw error
  }
}

export async function createVideoMediaGeneration(profileId, input) {
  if (!queueEnabledForVideo()) throw new ApiError(503, 'Produção canônica indisponível: mantenha a solicitação bloqueada até os workers de vídeo serem habilitados.')
  if (!env.RUNPOD_VIDEO_ENDPOINT_ID) throw new ApiError(503, 'RunPod de vídeo ainda não configurado.')

  const companionId = input.atrizId
  await assertNoProcessingMediaJob(profileId)
  await requireActiveSubscription(profileId, companionId)
  const companion = await getCompanion(companionId)
  const context = await resolveCanonicalActorContext(companionId, 'video')
  await assertApprovedActorIdentityForProduction({
    actorProfileId: context.actorProfileId,
    companionId,
    authorizationId: context.authorizationId,
    contentType: input.productionMode === 'v2v' ? 'live_action' : 'short_video',
  })
  const options = await getSelectedVideoOptions(input)
  const pricing = await getVideoPricingRule()
  const promptPayload = buildVideoPromptPayload({ companion, input, options, creditsCost: pricing.creditsCost })

  let mediaJob
  let generation
  let debited = false
  try {
    mediaJob = await createMediaJob({ profileId, companionId, kind: getVideoJobKind(), promptPayload, creditsCost: pricing.creditsCost })
    await debitCreditsAtomically(profileId, pricing.creditsCost, 'Geração de vídeo', { referenceType: 'media_job', referenceId: mediaJob.id })
    debited = true
    generation = await createVideoMediaGenerationRecord({ profileId, companionId, mediaJob, promptPayload, creditsCost: pricing.creditsCost })

    const directionResult = await createSceneDirection({
      productionMode: promptPayload.productionMode,
      baseSceneId: promptPayload.productionMode === 'v2v' ? promptPayload.baseSceneId : null,
      slots: [{ slotIndex: 1, participantType: 'actor', actorProfileId: context.actorProfileId, companionId }],
      prompt: promptPayload.prompt,
      execute: true,
      requestContext: { source: 'client_canonical_queue', profileId, mediaJobId: mediaJob.id, generationId: generation.id, creditsCost: pricing.creditsCost },
    })

    const direction = directionResult.direction
    const queueJobId = String(directionResult.processing?.jobId || direction?.queueJobId || direction?.queue_job_id || direction?.id)
    await markClientGenerationQueued({ mediaJobId: mediaJob.id, generationId: generation.id, queueJobId, canonical: { ...promptPayload, directionId: direction?.id || null, privateStorage: true, qaRequired: true } })
    return { id: generation.id, mediaJobId: mediaJob.id, status: 'em_andamento', progresso: 10, accepted: true, canonicalQueue: promptPayload.productionMode === 'v2v' ? 'media:video-v2v' : 'media:video-short', directionId: direction?.id || null, queueJobId, message: 'Pedido aceito pela fila canônica. O Master privado seguirá para QA e renditions.' }
  } catch (error) {
    await markClientGenerationFailed({ mediaJobId: mediaJob?.id, generationId: generation?.id, message: error?.message })
    if (debited) await refundCredits(profileId, pricing.creditsCost, 'Estorno por falha ao enfileirar vídeo', { referenceType: 'media_job', referenceId: mediaJob?.id }).catch(() => {})
    throw error
  }
}
