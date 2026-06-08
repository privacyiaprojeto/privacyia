import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { debitCreditsAtomically, refundCredits } from './wallet.service.js'
import { getExtensionFromContentType, uploadImageBuffer, uploadVideoBuffer } from './storage.service.js'
import { generateImageWithRunPod, generateVideoWithRunPod } from './providers/runpod.provider.js'

const IMAGE_MEDIA_KIND = 'imagem'
const VIDEO_MEDIA_KIND = 'video'
const PROCESSING_JOB_STATUS = 'processing'
const DEFAULT_VIDEO_CREDITS_COST = 80

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

async function getSelectedOptions(input) {
  const optionPairs = mapOptionInput(input)

  if (optionPairs.length === 0) {
    return {}
  }

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
  const result = {}

  for (const pair of optionPairs) {
    const option = byId.get(pair.id)
    if (!option) continue

    result[pair.field] = {
      id: option.id,
      mediaKind: option.media_kind,
      category: option.category,
      label: option.label,
    }
  }

  return result
}


async function getSelectedVideoOptions(input) {
  const optionPairs = mapVideoOptionInput(input)

  if (optionPairs.length === 0) {
    return {}
  }

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
  const result = {}

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
    }
  }

  return result
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
      external_provider: 'runpod',
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

  const prompt = joinPromptSegments([
    'photorealistic editorial portrait',
    buildCompanionBaseDescriptor(companion),
    'solo adult female subject',
    'subject centered, elegant composition, realistic facial features',
    pose ? `pose/composition: ${pose}` : 'pose/composition: elegant natural portrait pose',
    environment ? `scene/background: ${environment}` : 'scene/background: premium indoor editorial setting',
    outfit ? `wardrobe: ${outfit}` : 'wardrobe: tasteful modern outfit',
    accessory ? `accessory: ${accessory}` : null,
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


function getFirstVideoUrlFromOptions(options = {}) {
  return Object.values(options)
    .map((option) => normalizePromptText(option?.videoUrl || option?.video_url))
    .find(Boolean) || ''
}

function buildVideoPromptPayload({ companion, input = {}, options = {}, creditsCost }) {
  const baseVideoUrl = normalizePromptText(
    input.baseVideoUrl ||
      input.videoBaseUrl ||
      input.targetVideoUrl ||
      getFirstVideoUrlFromOptions(options) ||
      env.FACESWAP_BASE_VIDEO_URL ||
      '',
  )

  const sourceImageUrl = normalizePromptText(
    input.sourceImageUrl ||
      input.referenceImageUrl ||
      companion?.avatar_url ||
      companion?.thumbnail_url ||
      companion?.banner_url ||
      '',
  )

  return {
    mediaKind: VIDEO_MEDIA_KIND,
    companionId: companion?.id,
    selectedOptions: options,
    pricing: {
      mediaKind: VIDEO_MEDIA_KIND,
      creditsCost,
    },
    baseVideoUrl,
    targetVideoUrl: baseVideoUrl,
    sourceImageUrl,
    referenceImageUrl: sourceImageUrl,
    provider: 'runpod',
    engine: 'faceswap_zero_shot',
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
      external_provider: 'runpod',
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

async function insertGalleryItem({ profileId, companionId, mediaUrl, mediaType = IMAGE_MEDIA_KIND }) {
  const { error } = await supabaseAdmin
    .from('gallery_items')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      media_type: mediaType,
      media_url: mediaUrl,
      saved_from_feed: false,
    })

  if (error) {
    throw new ApiError(500, 'Erro ao inserir mídia na galeria.', error)
  }
}

async function markCompletedRecords({ mediaJobId, generationId, resultUrl, runpodJobId }) {
  const now = new Date().toISOString()

  const [{ error: jobError }, { error: generationError }] = await Promise.all([
    supabaseAdmin
      .from('media_jobs')
      .update({
        status: 'completed',
        output_media_url: resultUrl,
        runpod_job_id: runpodJobId || null,
        updated_at: now,
      })
      .eq('id', mediaJobId),
    supabaseAdmin
      .from('media_generations')
      .update({
        status: 'concluido',
        progress: 100,
        eta_seconds: 0,
        result_url: resultUrl,
        external_provider: 'runpod',
        external_job_id: runpodJobId || mediaJobId,
        updated_at: now,
      })
      .eq('id', generationId),
  ])

  if (jobError || generationError) {
    throw new ApiError(500, 'Erro ao marcar mídia como concluída.', { jobError, generationError })
  }
}

export async function createImageMediaGeneration(profileId, input) {
  if (!env.RUNPOD_IMAGE_ENDPOINT_ID) {
    throw new ApiError(503, 'RunPod de imagem ainda não configurado. Defina RUNPOD_IMAGE_ENDPOINT_ID para ativar a Fábrica Visual.')
  }

  const companionId = input.atrizId

  if (!companionId) {
    throw new ApiError(400, 'atrizId obrigatório para geração de imagem.')
  }

  let mediaJob = null
  let generation = null
  let debited = false
  let creditsCost = 0

  await assertNoProcessingMediaJob(profileId)
  await requireActiveSubscription(profileId, companionId)

  const companion = await getCompanion(companionId)
  const options = await getSelectedOptions(input)
  const pricing = await getMediaPricingRule(IMAGE_MEDIA_KIND)
  creditsCost = pricing.creditsCost

  const promptPayload = buildImagePromptPayload({
    companion,
    options,
    creditsCost,
  })

  mediaJob = await createMediaJob({
    profileId,
    companionId,
    kind: getImageJobKind(),
    promptPayload,
    creditsCost,
  })

  try {
    await debitCreditsAtomically(profileId, creditsCost, 'Geração de imagem', {
      referenceType: 'media_job',
      referenceId: mediaJob.id,
    })
    debited = true

    generation = await createMediaGeneration({
      profileId,
      companionId,
      mediaJob,
      promptPayload,
      creditsCost,
    })

    const generatedImage = await generateImageWithRunPod({
      companion,
      options,
      promptPayload: {
        ...promptPayload,
        mediaJobId: mediaJob.id,
        generationId: generation.id,
      },
    })

    const extension = generatedImage.extension || getExtensionFromContentType(generatedImage.mimeType || 'image/png')
    const imageKey = `images/generated/${profileId}/${generation.id}.${extension}`
    const resultUrl = await uploadImageBuffer({
      buffer: generatedImage.buffer,
      key: imageKey,
      contentType: generatedImage.mimeType || 'image/png',
    })

    await insertGalleryItem({
      profileId,
      companionId,
      mediaUrl: resultUrl,
    })

    await markCompletedRecords({
      mediaJobId: mediaJob.id,
      generationId: generation.id,
      resultUrl,
      runpodJobId: generatedImage.runpodJobId,
    })

    console.log(`[Media Pipeline] imagem concluída | mediaJob=${mediaJob.id} | generation=${generation.id} | credits=${creditsCost}`)

    return {
      id: generation.id,
      mediaJobId: mediaJob.id,
      status: 'concluido',
      progresso: 100,
      url: resultUrl,
    }
  } catch (error) {
    await markMediaFailed({
      mediaJobId: mediaJob?.id,
      generationId: generation?.id,
      errorMessage: error?.message,
    })

    if (debited) {
      await refundCredits(profileId, creditsCost, 'Estorno por falha na geração de imagem', {
        referenceType: 'media_job',
        referenceId: mediaJob?.id,
      }).catch((refundError) => {
        console.error('[Media Pipeline] falha ao estornar créditos após erro de imagem:', refundError)
      })
    }

    throw error
  }
}


async function processVideoGenerationInBackground({
  profileId,
  companion,
  mediaJob,
  generation,
  promptPayload,
  creditsCost,
}) {
  try {
    console.log(`[Media Pipeline] processamento assíncrono de vídeo iniciado | mediaJob=${mediaJob.id} | generation=${generation.id}`)

    const generatedVideo = await generateVideoWithRunPod({
      companion,
      baseVideoUrl: promptPayload.baseVideoUrl,
      promptPayload: {
        ...promptPayload,
        mediaJobId: mediaJob.id,
        generationId: generation.id,
      },
    })

    const extension =
      generatedVideo.extension ||
      getExtensionFromContentType(generatedVideo.mimeType || 'video/mp4') ||
      'mp4'

    const videoKey = `videos/generated/${profileId}/${generation.id}.${extension}`

    const resultUrl = await uploadVideoBuffer({
      buffer: generatedVideo.buffer,
      key: videoKey,
      contentType: generatedVideo.mimeType || 'video/mp4',
    })

    await insertGalleryItem({
      profileId,
      companionId: companion.id,
      mediaUrl: resultUrl,
      mediaType: VIDEO_MEDIA_KIND,
    })

    await markCompletedRecords({
      mediaJobId: mediaJob.id,
      generationId: generation.id,
      resultUrl,
      runpodJobId: generatedVideo.runpodJobId,
    })

    console.log(`[Media Pipeline] vídeo concluído | mediaJob=${mediaJob.id} | generation=${generation.id} | credits=${creditsCost}`)
  } catch (error) {
    console.error(
      `[Media Pipeline] falha no processamento assíncrono de vídeo | mediaJob=${mediaJob?.id} | generation=${generation?.id}:`,
      error,
    )

    await markMediaFailed({
      mediaJobId: mediaJob?.id,
      generationId: generation?.id,
      errorMessage: error?.message,
    })

    await refundCredits(profileId, creditsCost, 'Estorno por falha na geração de vídeo', {
      referenceType: 'media_job',
      referenceId: mediaJob?.id,
    }).catch((refundError) => {
      console.error('[Media Pipeline] falha ao estornar créditos após erro de vídeo:', refundError)
    })
  }
}

export async function createVideoMediaGeneration(profileId, input) {
  if (!env.RUNPOD_VIDEO_ENDPOINT_ID) {
    throw new ApiError(503, 'RunPod de vídeo ainda não configurado. Defina RUNPOD_VIDEO_ENDPOINT_ID para ativar o pipeline de vídeo.')
  }

  const companionId = input.atrizId

  if (!companionId) {
    throw new ApiError(400, 'atrizId obrigatório para geração de vídeo.')
  }

  let mediaJob = null
  let generation = null
  let debited = false
  let creditsCost = 0

  await assertNoProcessingMediaJob(profileId)
  await requireActiveSubscription(profileId, companionId)

  const companion = await getCompanion(companionId)
  const options = await getSelectedVideoOptions(input)
  const pricing = await getVideoPricingRule()
  creditsCost = pricing.creditsCost

  const promptPayload = buildVideoPromptPayload({
    companion,
    input,
    options,
    creditsCost,
  })

  if (!promptPayload.sourceImageUrl) {
    throw new ApiError(400, 'Imagem de referência da atriz não encontrada para FaceSwap.')
  }

  if (!promptPayload.baseVideoUrl) {
    throw new ApiError(400, 'Vídeo base obrigatório para geração de vídeo. Configure FACESWAP_BASE_VIDEO_URL ou envie baseVideoUrl.')
  }

  mediaJob = await createMediaJob({
    profileId,
    companionId,
    kind: getVideoJobKind(),
    promptPayload,
    creditsCost,
  })

  try {
    await debitCreditsAtomically(profileId, creditsCost, 'Geração de vídeo', {
      referenceType: 'media_job',
      referenceId: mediaJob.id,
    })
    debited = true

    generation = await createVideoMediaGenerationRecord({
      profileId,
      companionId,
      mediaJob,
      promptPayload,
      creditsCost,
    })

    console.log(`[Media Pipeline] vídeo enfileirado | mediaJob=${mediaJob.id} | generation=${generation.id} | credits=${creditsCost}`)

    setImmediate(() => {
      processVideoGenerationInBackground({
        profileId,
        companion,
        mediaJob,
        generation,
        promptPayload,
        creditsCost,
      }).catch((error) => {
        console.error('[Media Pipeline] erro não tratado no background de vídeo:', error)
      })
    })

    return {
      id: generation.id,
      mediaJobId: mediaJob.id,
      status: 'em_andamento',
      progresso: 5,
      accepted: true,
      mediaKind: VIDEO_MEDIA_KIND,
      message: 'Vídeo em processamento. A galeria será atualizada automaticamente.',
    }
  } catch (error) {
    await markMediaFailed({
      mediaJobId: mediaJob?.id,
      generationId: generation?.id,
      errorMessage: error?.message,
    })

    if (debited) {
      await refundCredits(profileId, creditsCost, 'Estorno por falha na geração de vídeo', {
        referenceType: 'media_job',
        referenceId: mediaJob?.id,
      }).catch((refundError) => {
        console.error('[Media Pipeline] falha ao estornar créditos após erro de vídeo:', refundError)
      })
    }

    throw error
  }
}

