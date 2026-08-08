import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { addActorPipelineLiveAudioJob } from '../queues/audio.queue.js'
import { addActorPipelineImageStageJob, addImageRealJob } from '../queues/image.queue.js'
import { assertAvatarCompliantForProduction } from './actor-compliance.service.js'
import { getActorPayoutFinanceReport } from './actor-finance.service.js'
import { listFactoryAdminAssets, updateFactoryPublishableProductPublication } from './factory-admin.service.js'
import { createSceneDirection, getProductSplits, replaceProductSplits } from './scene-direction.service.js'
import { approveAssetVariant, rejectAssetVariant } from './factory-qa.service.js'
import {
  assertApprovedActorIdentityForProduction,
  getActorIdentityLoraSummary,
} from './actor-identity-lora.service.js'

const ACTORS_TABLE = 'actor_profiles'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const COMPANIONS_TABLE = 'companions'
const DICTIONARIES_TABLE = 'prompt_dictionaries'
const STORYLINES_TABLE = 'audio_storylines'
const BASE_SCENES_TABLE = 'base_scenes'
const COMBINATIONS_TABLE = 'media_combinations'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'
const IMAGE_PROMPT_CATEGORIES = ['scenario', 'clothing', 'action', 'pose', 'mood', 'lighting']

const TRUTHY = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])
const queueEnabled = () => env.WORKERS_ENABLED && (env.ACTOR_PIPELINE_QUEUE_ENABLED || TRUTHY.has(String(process.env.ALLOW_M4_1_FACTORY_ENQUEUE || '').trim().toLowerCase()))
const nowIso = () => new Date().toISOString()

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase()
  return String(error?.code || '') === '42703' || message.includes('does not exist') || message.includes('column')
}

async function insertAdaptive(table, input, label) {
  let payload = { ...input }
  const removed = []

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select('*').maybeSingle()
    if (!error) return { row: data, removedColumns: removed }

    if (!isMissingColumnError(error)) {
      throw new ApiError(500, `Erro ao criar ${label}.`, error)
    }

    const match = String(error.message || '').match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i)
      || String(error.message || '').match(/["']([a-zA-Z0-9_]+)["']\s+does not exist/i)
    const column = match?.[1]
    if (!column || !(column in payload)) {
      throw new ApiError(500, `Schema incompatível ao criar ${label}.`, error)
    }

    delete payload[column]
    removed.push(column)
  }

  throw new ApiError(500, `Não foi possível adaptar o payload de ${label}.`)
}

async function resolveActorContext(actorId, { requireAuthorization = false, contentType = null } = {}) {
  const { data: actor, error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('*')
    .eq('id', actorId)
    .maybeSingle()

  if (actorError) throw new ApiError(500, 'Erro ao carregar o ator da linha de montagem.', actorError)
  if (!actor) throw new ApiError(404, 'Ator não encontrado.')
  if (String(actor.status || '').toLowerCase() === 'blocked') throw new ApiError(409, 'O ator está bloqueado para operação.')

  const { data: authorizations, error: authorizationError } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (authorizationError) throw new ApiError(500, 'Erro ao carregar autorização de produção do ator.', authorizationError)
  const now = Date.now()
  const authorization = (authorizations || []).find((row) => {
    if (String(row.status || '').toLowerCase() !== 'active') return false
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() < now) return false
    return true
  }) || null

  if (requireAuthorization && !authorization) {
    throw new ApiError(409, 'O ator ainda não possui autorização ativa vinculada a um avatar.')
  }

  const companionId = authorization?.companion_id || safeObject(actor.metadata).companionId || safeObject(actor.metadata).companion_id || null
  let companion = null
  if (companionId) {
    const result = await supabaseAdmin.from(COMPANIONS_TABLE).select('*').eq('id', companionId).maybeSingle()
    if (result.error) throw new ApiError(500, 'Erro ao carregar avatar vinculado ao ator.', result.error)
    companion = result.data || null
  }

  if (requireAuthorization && (!companion || !authorization?.companion_id)) {
    throw new ApiError(409, 'A autorização ativa não possui avatar válido vinculado.')
  }

  if (requireAuthorization && contentType) {
    await assertAvatarCompliantForProduction({ companionId: authorization.companion_id, contentType })
  }

  return { actor, authorization, companion, companionId: companion?.id || companionId }
}

function mapActor(context) {
  const { actor, authorization, companion } = context
  return {
    id: actor.id,
    displayName: actor.display_name || actor.legal_name || 'Ator/Atriz',
    legalName: actor.legal_name || null,
    email: actor.email || null,
    status: actor.status || null,
    kycStatus: actor.kyc_status || null,
    productionStatus: actor.production_status || null,
    companion: companion ? { id: companion.id, name: companion.name || companion.slug || null, slug: companion.slug || null } : null,
    authorization: authorization ? {
      id: authorization.id,
      status: authorization.status,
      authorizedForContentTypes: authorization.authorized_for_content_types || [],
    } : null,
  }
}

async function loadDictionarySelections(ids = []) {
  if (!ids.length) return []
  const { data, error } = await supabaseAdmin
    .from(DICTIONARIES_TABLE)
    .select('id, category, label, is_active')
    .in('id', ids)

  if (error) throw new ApiError(500, 'Erro ao validar os dicionários de prompt.', error)
  const byId = new Map((data || []).map((row) => [row.id, row]))
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean)
  if (ordered.length !== ids.length || ordered.some((row) => row.is_active === false)) {
    throw new ApiError(422, 'Um ou mais itens do Dicionário de Prompt estão ausentes ou inativos.')
  }
  return ordered
}

function buildDictionaryPrompt(companion, selections, productType, notes = '') {
  const base = productType === 'short_video'
    ? `cinematic short video featuring ${companion?.name || companion?.slug || 'the authorized adult model'}`
    : `photorealistic editorial portrait of ${companion?.name || companion?.slug || 'the authorized adult model'}`
  const parts = selections.map((item) => `${item.category}: ${item.label}`)
  return [base, ...parts, notes, 'professional lighting', 'high detail', 'adult subject', 'no watermark'].filter(Boolean).join(', ')
}

function buildDictionarySelections(selections) {
  return selections.map((item) => ({
    titleId: `dictionary:${item.category}`,
    titleName: item.category,
    itemId: item.id,
    itemName: item.label,
    technicalSnippet: item.label,
    negativePrompt: '',
  }))
}

function uniqueIds(items = []) {
  return Array.from(new Set((items || []).filter(Boolean)))
}

function groupSelectionsByCategory(selections) {
  const grouped = new Map()
  for (const category of IMAGE_PROMPT_CATEGORIES) grouped.set(category, [])
  const seen = new Set()
  for (const item of selections) {
    if (!item || !item.id || !item.category || seen.has(item.id)) continue
    seen.add(item.id)
    if (!grouped.has(item.category)) continue
    grouped.get(item.category).push(item)
  }
  return grouped
}

function expandImageSelectionCombinations(groupedSelections) {
  let combinations = [[]]
  for (const category of IMAGE_PROMPT_CATEGORIES) {
    const items = groupedSelections.get(category) || []
    if (!items.length) return []
    const next = []
    for (const partial of combinations) {
      for (const item of items) next.push([...partial, item])
    }
    combinations = next
  }
  return combinations
}

function buildImageCombinationKey(actorId, selections) {
  const byCategory = new Map(selections.map((item) => [item.category, item]))
  const parts = IMAGE_PROMPT_CATEGORIES.map((category) => `${category}:${byCategory.get(category)?.id || 'missing'}`)
  return `actor-pipeline:image:${actorId}:${parts.join('|')}`
}

function buildImageCombinationTitle(context, selections) {
  const stageName = context.companion?.name || context.actor.display_name || 'Ator'
  return `Imagem • ${stageName} • ${selections.map((item) => item.label).join(' • ')}`
}

function buildPreparedImageCombinations(context, selections, notes = '') {
  const groupedSelections = groupSelectionsByCategory(selections)
  const missingCategories = IMAGE_PROMPT_CATEGORIES.filter((category) => (groupedSelections.get(category) || []).length === 0)
  if (missingCategories.length) {
    throw new ApiError(422, `Escolha ao menos uma opção para: ${missingCategories.join(', ')}.`)
  }

  const selectionCombinations = expandImageSelectionCombinations(groupedSelections)
  if (!selectionCombinations.length) {
    throw new ApiError(422, 'Não foi possível montar combinações válidas para a produção de imagem.')
  }

  return selectionCombinations.map((combinationSelections) => {
    const prompt = buildDictionaryPrompt(context.companion, combinationSelections, 'image', notes)
    const guidedSelections = buildDictionarySelections(combinationSelections)
    const combinationKey = buildImageCombinationKey(context.actor.id, combinationSelections)
    const title = buildImageCombinationTitle(context, combinationSelections)
    return { combinationSelections, prompt, guidedSelections, combinationKey, title }
  })
}

async function loadExistingImageCombinationKeys(actorId, combinationKeys = []) {
  const existingKeys = new Set()
  const queryChunkSize = 200
  for (let index = 0; index < combinationKeys.length; index += queryChunkSize) {
    const chunk = combinationKeys.slice(index, index + queryChunkSize)
    const { data, error } = await supabaseAdmin
      .from(COMBINATIONS_TABLE)
      .select('combination_key')
      .eq('actor_profile_id', actorId)
      .in('combination_key', chunk)
    if (error) throw new ApiError(500, 'Erro ao conferir combinações já existentes na Linha de Montagem.', error)
    for (const row of data || []) {
      if (row.combination_key) existingKeys.add(row.combination_key)
    }
  }
  return existingKeys
}

function imageStageCapacity(variations) {
  const byProducts = Math.max(1, Number(env.ACTOR_PIPELINE_IMAGE_STAGE_MAX_PRODUCTS || 48))
  const byOutputs = Math.max(1, Math.floor(Number(env.ACTOR_PIPELINE_IMAGE_STAGE_MAX_OUTPUTS || 240) / Math.max(1, variations)))
  return Math.max(1, Math.min(byProducts, byOutputs))
}

function assertImageRequestGuard(productCount, outputCount) {
  const maxProducts = Number(env.ACTOR_PIPELINE_IMAGE_REQUEST_MAX_PRODUCTS || 5000)
  const maxOutputs = Number(env.ACTOR_PIPELINE_IMAGE_REQUEST_MAX_OUTPUTS || 25000)
  if (productCount > maxProducts) {
    throw new ApiError(422, `A solicitação ultrapassa a proteção geral de ${maxProducts} produtos base. Revise as seleções antes de continuar.`)
  }
  if (outputCount > maxOutputs) {
    throw new ApiError(422, `A solicitação ultrapassa a proteção geral de ${maxOutputs} mídias. Revise as seleções ou a quantidade de variações.`)
  }
}

async function createImageProductBatch({
  context,
  prepared,
  variations,
  adminProfileId,
  requestId,
  stageNumber,
  stageCount,
  stageProductCount,
  requestProductCount,
  requestOutputCount,
}) {
  const now = nowIso()
  const combinationId = randomUUID()
  const batchId = randomUUID()
  const sharedMetadata = {
    source: 'actor_pipeline',
    actorProfileId: context.actor.id,
    companionId: context.companion.id,
    productType: 'image',
    combinatorialBatch: true,
    combinatorialRequestId: requestId,
    internalStageNumber: stageNumber,
    internalStageCount: stageCount,
    internalStageProductCount: stageProductCount,
    requestProductCount,
    requestOutputCount,
  }

  await insertAdaptive(COMBINATIONS_TABLE, {
    id: combinationId,
    companion_id: context.companion.id,
    actor_profile_id: context.actor.id,
    avatar_production_authorization_id: context.authorization.id,
    media_origin: 'actor_pipeline',
    media_type: 'image',
    content_type: 'image',
    combination_key: prepared.combinationKey,
    title: prepared.title,
    name: prepared.title,
    label: prepared.title,
    status: 'active',
    is_active: true,
    active: true,
    visible_to_client: false,
    admin_only: true,
    price_credits: 0,
    prompt: prepared.prompt,
    prompt_template: prepared.prompt,
    prompt_final: prepared.prompt,
    negative_prompt: 'low quality, blurry, distorted face, bad anatomy, watermark, text, logo',
    guided_selections: prepared.guidedSelections,
    metadata: {
      ...sharedMetadata,
      guidedSelections: prepared.guidedSelections,
      prompt: prepared.prompt,
      createdBy: adminProfileId,
      createdAt: now,
    },
    created_at: now,
    updated_at: now,
  }, 'combinação de imagem da Linha de Montagem')

  await insertAdaptive(BATCHES_TABLE, {
    id: batchId,
    companion_id: context.companion.id,
    profile_id: adminProfileId,
    actor_profile_id: context.actor.id,
    avatar_production_authorization_id: context.authorization.id,
    media_origin: 'actor_pipeline',
    name: prepared.title,
    title: prepared.title,
    label: prepared.title,
    status: 'queued',
    source: 'actor_pipeline',
    job_origin: 'admin_actor_pipeline',
    media_type: 'image',
    content_type: 'image',
    total_items: variations,
    total_count: variations,
    queued_items: variations,
    processing_items: 0,
    qa_pending_items: 0,
    completed_items: 0,
    failed_items: 0,
    generated_count: 0,
    approved_count: 0,
    rejected_count: 0,
    requested_variants: variations,
    metadata: { ...sharedMetadata, combinationId, prompt: prepared.prompt, createdBy: adminProfileId },
    created_at: now,
    updated_at: now,
  }, 'lote de imagem da Linha de Montagem')

  const itemIds = []
  const queueJobIds = []
  for (let index = 0; index < variations; index += 1) {
    const itemId = randomUUID()
    const variantNumber = index + 1
    await insertAdaptive(BATCH_ITEMS_TABLE, {
      id: itemId,
      batch_id: batchId,
      companion_id: context.companion.id,
      profile_id: adminProfileId,
      actor_profile_id: context.actor.id,
      avatar_production_authorization_id: context.authorization.id,
      media_origin: 'actor_pipeline',
      combination_id: combinationId,
      media_combination_id: combinationId,
      status: 'queued',
      source: 'actor_pipeline',
      job_origin: 'admin_actor_pipeline',
      media_type: 'image',
      content_type: 'image',
      requested_variants: 1,
      variant_number: variantNumber,
      item_index: index,
      idempotency_key: `actor-pipeline:${batchId}:${variantNumber}`,
      prompt: prepared.prompt,
      prompt_text: prepared.prompt,
      prompt_final: prepared.prompt,
      negative_prompt: 'low quality, blurry, distorted face, bad anatomy, watermark, text, logo',
      generation_payload: { source: 'actor_pipeline', factoryMode: 'real_image', prompt: prepared.prompt, variantNumber },
      generation_params: { width: 1024, height: 1024, steps: 28, guidance_scale: 6.5 },
      metadata: { ...sharedMetadata, variantNumber },
      created_at: now,
      updated_at: now,
    }, 'item de imagem da Linha de Montagem')

    const job = await addImageRealJob({
      batchItemId: itemId,
      batchId,
      combinationId,
      requestedVariants: 1,
      nextStatus: 'qa_pending',
      delayMs: 0,
      metadata: { ...sharedMetadata, variantNumber },
      jobPayload: {
        companionId: context.companion.id,
        mediaType: 'image',
        contentType: 'image',
        variantNumber,
        factoryMode: 'real_image',
        generateRealImage: true,
        productionAuthorizationId: context.authorization.id,
        actorProfileId: context.actor.id,
        width: 1024,
        height: 1024,
        steps: 28,
        guidance_scale: 6.5,
      },
    })
    itemIds.push(itemId)
    queueJobIds.push(String(job.id))
  }

  return { batchId, combinationId, itemIds, queueJobIds }
}

async function createImageBatch(context, input, adminProfileId) {
  if (!queueEnabled()) {
    throw new ApiError(503, 'A fila da Linha de Montagem está desabilitada. Ative WORKERS_ENABLED e ACTOR_PIPELINE_QUEUE_ENABLED antes de produzir.')
  }

  const dictionarySelectionIds = uniqueIds(input.dictionarySelections.map((item) => item.id))
  const selections = await loadDictionarySelections(dictionarySelectionIds)
  if (!selections.length) throw new ApiError(422, 'Selecione ao menos um item do Dicionário de Prompt.')

  const preparedCombinations = buildPreparedImageCombinations(context, selections, input.notes)
  const existingKeys = await loadExistingImageCombinationKeys(context.actor.id, preparedCombinations.map((item) => item.combinationKey))
  const freshCombinations = preparedCombinations.filter((item) => !existingKeys.has(item.combinationKey))
  const skippedExistingCount = preparedCombinations.length - freshCombinations.length

  if (!freshCombinations.length) {
    throw new ApiError(409, 'Todas as combinações selecionadas já existem para este ator. Nenhum produto novo foi criado.')
  }

  const totalOutputs = freshCombinations.length * input.variations
  assertImageRequestGuard(freshCombinations.length, totalOutputs)

  const stageCapacity = imageStageCapacity(input.variations)
  const expectedStageCount = Math.ceil(freshCombinations.length / stageCapacity)
  const requestId = randomUUID()
  const plannerJob = await addActorPipelineImageStageJob({
    requestId,
    actorId: context.actor.id,
    adminProfileId,
    dictionarySelectionIds,
    variations: input.variations,
    notes: input.notes || null,
    stageNumber: 1,
    expectedStageCount,
    requestedFreshProductCount: freshCombinations.length,
    requestedOutputCount: totalOutputs,
  })

  return {
    mode: 'image_combinatorial_orchestrator',
    queued: true,
    requestId,
    plannerJobId: String(plannerJob.id),
    requestedCombinationCount: preparedCombinations.length,
    createdProductCount: freshCombinations.length,
    skippedExistingCount,
    totalQueuedItems: totalOutputs,
    variationsPerProduct: input.variations,
    internalStageCapacity: stageCapacity,
    internalStageCount: expectedStageCount,
    message: `Produção organizada com ${freshCombinations.length} produto(s) e ${totalOutputs} mídia(s), distribuída em ${expectedStageCount} etapa(s) interna(s).${skippedExistingCount ? ` ${skippedExistingCount} combinação(ões) já existente(s) para este ator foram ignoradas.` : ''}`,
  }
}

export async function processActorPipelineImageStageJob(input = {}) {
  const requestId = String(input.requestId || '').trim()
  const actorId = String(input.actorId || '').trim()
  const dictionarySelectionIds = uniqueIds(input.dictionarySelectionIds || [])
  const variations = Math.max(1, Math.min(Number(input.variations || 1), 20))
  const stageNumber = Math.max(1, Number(input.stageNumber || 1))
  if (!requestId || !actorId || !dictionarySelectionIds.length) {
    throw new ApiError(400, 'Payload incompleto para processar etapa interna de imagens.')
  }

  const context = await resolveActorContext(actorId, { requireAuthorization: true, contentType: 'image' })
  const selections = await loadDictionarySelections(dictionarySelectionIds)
  const preparedCombinations = buildPreparedImageCombinations(context, selections, input.notes || '')
  const existingKeys = await loadExistingImageCombinationKeys(actorId, preparedCombinations.map((item) => item.combinationKey))
  const freshCombinations = preparedCombinations.filter((item) => !existingKeys.has(item.combinationKey))

  if (!freshCombinations.length) {
    return {
      requestId,
      stageNumber,
      completed: true,
      createdProductCount: 0,
      createdOutputCount: 0,
      remainingProductCount: 0,
      message: 'Todas as etapas internas desta solicitação já foram concluídas.',
    }
  }

  const stageCapacity = imageStageCapacity(variations)
  const currentStage = freshCombinations.slice(0, stageCapacity)
  const remainingProductCount = Math.max(freshCombinations.length - currentStage.length, 0)
  const expectedStageCount = Math.max(stageNumber, Number(input.expectedStageCount || Math.ceil(freshCombinations.length / stageCapacity)))
  const stageResults = []

  for (const prepared of currentStage) {
    stageResults.push(await createImageProductBatch({
      context,
      prepared,
      variations,
      adminProfileId: input.adminProfileId || null,
      requestId,
      stageNumber,
      stageCount: expectedStageCount,
      stageProductCount: currentStage.length,
      requestProductCount: Number(input.requestedFreshProductCount || currentStage.length + remainingProductCount),
      requestOutputCount: Number(input.requestedOutputCount || (currentStage.length + remainingProductCount) * variations),
    }))
  }

  let nextStageJobId = null
  if (remainingProductCount > 0) {
    const nextJob = await addActorPipelineImageStageJob({
      requestId,
      actorId,
      adminProfileId: input.adminProfileId || null,
      dictionarySelectionIds,
      variations,
      notes: input.notes || null,
      stageNumber: stageNumber + 1,
      expectedStageCount,
      requestedFreshProductCount: Number(input.requestedFreshProductCount || currentStage.length + remainingProductCount),
      requestedOutputCount: Number(input.requestedOutputCount || (currentStage.length + remainingProductCount) * variations),
    })
    nextStageJobId = String(nextJob.id)
  }

  return {
    requestId,
    stageNumber,
    expectedStageCount,
    completed: remainingProductCount === 0,
    createdProductCount: currentStage.length,
    createdOutputCount: currentStage.length * variations,
    remainingProductCount,
    nextStageJobId,
    batchIds: stageResults.map((item) => item.batchId),
    combinationIds: stageResults.map((item) => item.combinationId),
    message: remainingProductCount > 0
      ? `Etapa interna ${stageNumber} concluída. A próxima etapa ficou na fila de espera.`
      : `Etapa interna ${stageNumber} concluída. Toda a solicitação foi organizada.`,
  }
}

async function createLiveAudioBatch(context, input, adminProfileId) {
  if (!queueEnabled()) {
    throw new ApiError(503, 'A fila da Linha de Montagem está desabilitada. Ative WORKERS_ENABLED e ACTOR_PIPELINE_QUEUE_ENABLED antes de produzir.')
  }
  if (!input.storylineId) throw new ApiError(422, 'Selecione um enredo de áudio.')

  const { data: storyline, error } = await supabaseAdmin
    .from(STORYLINES_TABLE)
    .select('*')
    .eq('id', input.storylineId)
    .eq('is_active', true)
    .maybeSingle()
  if (error) throw new ApiError(500, 'Erro ao validar o enredo de áudio.', error)
  if (!storyline) throw new ApiError(404, 'Enredo ativo não encontrado.')

  const now = nowIso()
  const combinationId = randomUUID()
  const batchId = randomUUID()
  const title = `Live Audio • ${storyline.title}`
  const script = String(storyline.script || '').trim()
  if (!script) throw new ApiError(422, 'O enredo selecionado não possui texto para TTS.')

  await insertAdaptive(COMBINATIONS_TABLE, {
    id: combinationId,
    companion_id: context.companion.id,
    actor_profile_id: context.actor.id,
    avatar_production_authorization_id: context.authorization.id,
    media_origin: 'actor_pipeline',
    media_type: 'live_audio',
    content_type: 'live_audio',
    combination_key: `actor-pipeline:live-audio:${context.actor.id}:${Date.now()}`,
    title,
    name: title,
    label: title,
    status: 'active',
    is_active: true,
    active: true,
    visible_to_client: false,
    admin_only: true,
    price_credits: 0,
    prompt: script,
    prompt_template: script,
    prompt_final: script,
    guided_selections: [{ titleId: 'audio_storyline', titleName: 'Enredo', itemId: storyline.id, itemName: storyline.title, technicalSnippet: script }],
    metadata: { source: 'actor_pipeline', productType: 'live_audio', storylineId: storyline.id, voiceTone: storyline.voice_tone, script, createdBy: adminProfileId },
    created_at: now,
    updated_at: now,
  }, 'combinação de Live Audio')

  await insertAdaptive(BATCHES_TABLE, {
    id: batchId,
    companion_id: context.companion.id,
    profile_id: adminProfileId,
    actor_profile_id: context.actor.id,
    avatar_production_authorization_id: context.authorization.id,
    media_origin: 'actor_pipeline',
    name: title,
    title,
    label: title,
    status: 'queued',
    source: 'actor_pipeline',
    job_origin: 'admin_actor_pipeline',
    media_type: 'live_audio',
    content_type: 'live_audio',
    total_items: input.variations,
    total_count: input.variations,
    queued_items: input.variations,
    requested_variants: input.variations,
    metadata: { source: 'actor_pipeline', productType: 'live_audio', storylineId: storyline.id, voiceTone: storyline.voice_tone, script, createdBy: adminProfileId },
    created_at: now,
    updated_at: now,
  }, 'lote de Live Audio')

  const itemIds = []
  const queueJobIds = []
  for (let index = 0; index < input.variations; index += 1) {
    const itemId = randomUUID()
    const variantNumber = index + 1
    await insertAdaptive(BATCH_ITEMS_TABLE, {
      id: itemId,
      batch_id: batchId,
      companion_id: context.companion.id,
      profile_id: adminProfileId,
      actor_profile_id: context.actor.id,
      avatar_production_authorization_id: context.authorization.id,
      media_origin: 'actor_pipeline',
      combination_id: combinationId,
      media_combination_id: combinationId,
      status: 'queued',
      source: 'actor_pipeline',
      job_origin: 'admin_actor_pipeline',
      media_type: 'live_audio',
      content_type: 'live_audio',
      requested_variants: 1,
      variant_number: variantNumber,
      item_index: index,
      idempotency_key: `actor-pipeline-live-audio:${batchId}:${variantNumber}`,
      prompt: script,
      prompt_text: script,
      prompt_final: script,
      generation_payload: { source: 'actor_pipeline', factoryMode: 'live_audio', storylineId: storyline.id, voiceTone: storyline.voice_tone, script, variantNumber },
      metadata: { source: 'actor_pipeline', productType: 'live_audio', storylineId: storyline.id, voiceTone: storyline.voice_tone, script, variantNumber },
      created_at: now,
      updated_at: now,
    }, 'item de Live Audio')
    const job = await addActorPipelineLiveAudioJob({ batchItemId: itemId, batchId, combinationId, actorProfileId: context.actor.id, companionId: context.companion.id })
    itemIds.push(itemId)
    queueJobIds.push(String(job.id))
  }

  return { mode: 'live_audio_worker', queued: true, batchId, combinationId, itemIds, queueJobIds, variations: input.variations }
}

async function createVideoProduction(context, input) {
  const selections = await loadDictionarySelections(input.dictionarySelections.map((item) => item.id))
  if (!selections.length) throw new ApiError(422, 'Selecione ao menos um item do Dicionário de Prompt para o vídeo curto.')
  const prompt = buildDictionaryPrompt(context.companion, selections, 'short_video', input.notes)
  const directions = []
  for (let index = 0; index < input.variations; index += 1) {
    directions.push(await createSceneDirection({
      productionMode: 'i2v',
      slots: [{ slotIndex: 1, participantType: 'actor', actorProfileId: context.actor.id, companionId: context.companion.id }],
      prompt: `${prompt}, variation ${index + 1} of ${input.variations}`,
      execute: true,
    }))
  }
  return {
    mode: 'scene_direction_i2v',
    queued: directions.every((item) => item.processing?.queued === true),
    variations: input.variations,
    directions,
    processing: {
      requested: true,
      queued: directions.every((item) => item.processing?.queued === true),
      message: directions[0]?.processing?.message || 'Vídeos curtos registrados na Direção de Cena.',
    },
  }
}

async function createLiveActionProduction(context, input) {
  if (!input.baseSceneId) throw new ApiError(422, 'Selecione um Vídeo Base para o Live Action V2V.')
  const { data: scene, error } = await supabaseAdmin.from(BASE_SCENES_TABLE).select('*').eq('id', input.baseSceneId).eq('is_active', true).maybeSingle()
  if (error) throw new ApiError(500, 'Erro ao validar o Vídeo Base.', error)
  if (!scene || String(scene.upload_status || '').toLowerCase() !== 'ready') throw new ApiError(422, 'O Vídeo Base precisa estar ativo e pronto.')

  const slots = [{ slotIndex: 1, participantType: 'actor', actorProfileId: context.actor.id, companionId: context.companion.id }]
  const needed = Math.max(Number(scene.slots_count || 1) - 1, 0)
  for (let index = 0; index < needed; index += 1) {
    const candidate = input.additionalCast[index]
    if (candidate?.participantType === 'actor' && candidate.actorProfileId) {
      slots.push({ slotIndex: index + 2, participantType: 'actor', actorProfileId: candidate.actorProfileId })
    } else {
      slots.push({
        slotIndex: index + 2,
        participantType: 'virtual_extra',
        extraType: candidate?.extraType || 'custom',
        customDescription: candidate?.customDescription || 'participante adulto genérico autorizado para composição',
      })
    }
  }

  const result = await createSceneDirection({
    baseSceneId: scene.id,
    productionMode: 'v2v',
    slots,
    prompt: input.notes || `Live Action V2V de ${context.companion.name || context.actor.display_name}, preservar identidade e movimento natural.`,
    execute: true,
  })
  return { mode: 'scene_direction_v2v', ...result }
}

export async function createActorPipelineProduction(actorId, input, { adminProfileId = null } = {}) {
  const contentType = input.productType === 'short_video' ? 'short_video' : input.productType === 'live_action_v2v' ? 'live_action' : input.productType
  const context = await resolveActorContext(actorId, { requireAuthorization: true, contentType })

  await assertApprovedActorIdentityForProduction({
    actorProfileId: context.actor.id,
    companionId: context.companionId,
    authorizationId: context.authorization?.id || null,
    contentType,
  })

  let production
  if (input.productType === 'image') production = await createImageBatch(context, input, adminProfileId)
  else if (input.productType === 'short_video') production = await createVideoProduction(context, input)
  else if (input.productType === 'live_action_v2v') production = await createLiveActionProduction(context, input)
  else production = await createLiveAudioBatch(context, input, adminProfileId)

  return {
    actor: mapActor(context),
    productType: input.productType,
    production,
    message: production.queued === false
      ? 'Produção registrada, mas a fila está desabilitada pelos guards de ambiente.'
      : production.message || 'Produção enviada para a fila em background. A saída chegará à Revisão Exclusiva.',
  }
}

export async function getActorPipelineSummary(actorId) {
  const context = await resolveActorContext(actorId)
  const [assetsResult, financeReport, identityLora] = await Promise.all([
    context.companionId ? listFactoryAdminAssets({ actorProfileId: actorId, companionId: context.companionId, limit: 100 }) : Promise.resolve({ items: [] }),
    getActorPayoutFinanceReport({ period: 'all', limit: 2000, offset: 0 }),
    getActorIdentityLoraSummary(actorId),
  ])
  const finance = (financeReport.items || []).find((item) => item.actor?.id === actorId) || null
  const assets = assetsResult.items || []
  return {
    actor: mapActor(context),
    identityLora,
    indicators: {
      totalProducts: assets.length,
      pendingReview: assets.filter((item) => item.status === 'qa_pending').length,
      approvedWaitingPublication: assets.filter((item) => item.status === 'available' && !item.combination?.visibleToClient).length,
      published: assets.filter((item) => Boolean(item.combination?.visibleToClient)).length,
    },
    finance: finance ? {
      grossCredits: finance.sales?.grossCredits || 0,
      estimatedPayoutCredits: finance.payout?.estimatedPayoutCredits || 0,
      platformEstimatedCredits: finance.payout?.platformEstimatedCredits || 0,
      payoutStatus: finance.payout?.status || 'no_sales',
      payoutPercent: finance.payout?.rule?.percent || 0,
      deliveries: finance.sales?.deliveries || 0,
    } : {
      grossCredits: 0,
      estimatedPayoutCredits: 0,
      platformEstimatedCredits: 0,
      payoutStatus: 'no_sales',
      payoutPercent: 0,
      deliveries: 0,
    },
  }
}

export async function listActorPipelineReviewProducts(actorId) {
  const context = await resolveActorContext(actorId)
  if (!context.companionId) return { actor: mapActor(context), items: [] }
  const result = await listFactoryAdminAssets({ status: 'qa_pending', actorProfileId: actorId, companionId: context.companionId, limit: 100 })
  return { actor: mapActor(context), items: result.items || [] }
}


export async function approveActorPipelineProduct(actorId, assetId, input = {}, { adminProfileId = null } = {}) {
  const context = await resolveActorContext(actorId)
  if (!context.companionId) throw new ApiError(409, 'O ator não possui avatar vinculado.')
  const result = await listFactoryAdminAssets({
    status: 'qa_pending',
    actorProfileId: actorId,
    companionId: context.companionId,
    limit: 100,
  })
  if (!(result.items || []).some((item) => item.id === assetId)) {
    throw new ApiError(404, 'Produto pendente não encontrado para este ator.')
  }
  const review = await approveAssetVariant(assetId, {
    notes: input.notes || `Aprovado na Revisão Exclusiva de ${context.actor.display_name || context.actor.legal_name || 'ator'}.`,
    actorProfileId: adminProfileId,
    source: 'admin_actor_pipeline',
  })
  return { actor: mapActor(context), review, message: 'Produto aprovado e encaminhado para Publicação & Vitrine.' }
}

export async function rejectActorPipelineProduct(actorId, assetId, input = {}, { adminProfileId = null } = {}) {
  const context = await resolveActorContext(actorId)
  if (!context.companionId) throw new ApiError(409, 'O ator não possui avatar vinculado.')
  const result = await listFactoryAdminAssets({
    status: 'qa_pending',
    actorProfileId: actorId,
    companionId: context.companionId,
    limit: 100,
  })
  if (!(result.items || []).some((item) => item.id === assetId)) {
    throw new ApiError(404, 'Produto pendente não encontrado para este ator.')
  }
  const review = await rejectAssetVariant(assetId, {
    reason: input.reason,
    actorProfileId: adminProfileId,
    source: 'admin_actor_pipeline',
  })
  return { actor: mapActor(context), review, message: 'Produto rejeitado e removido da esteira de publicação.' }
}

export async function listActorPipelinePublicationProducts(actorId) {
  const context = await resolveActorContext(actorId)
  if (!context.companionId) return { actor: mapActor(context), items: [] }
  const result = await listFactoryAdminAssets({ status: 'available', actorProfileId: actorId, companionId: context.companionId, limit: 100 })
  const hidden = (result.items || []).filter((item) => !item.combination?.visibleToClient)
  const items = await Promise.all(hidden.map(async (item) => {
    let splits = null
    try { splits = await getProductSplits(item.id) } catch { splits = null }
    return { ...item, splits }
  }))
  return { actor: mapActor(context), items }
}

export async function publishActorPipelineProduct(actorId, assetId, input, { adminProfileId = null } = {}) {
  const context = await resolveActorContext(actorId, { requireAuthorization: true })
  const result = await listFactoryAdminAssets({ status: 'available', actorProfileId: actorId, companionId: context.companionId, limit: 100 })
  const product = (result.items || []).find((item) => item.id === assetId)
  if (!product) throw new ApiError(404, 'Produto aprovado não encontrado para este ator.')
  if (!input.splits.some((item) => item.beneficiaryType === 'actor' && item.beneficiaryId === actorId)) {
    throw new ApiError(422, 'O Ator 1 deste modal precisa constar no split do produto.')
  }

  const splits = await replaceProductSplits(assetId, input.splits, { adminProfileId })
  const publication = await updateFactoryPublishableProductPublication(assetId, {
    publish: true,
    priceCredits: input.priceCredits,
    destination: input.destination,
    description: input.description,
    actorProfileId: actorId,
    storefrontActorIds: input.splits.filter((item) => item.beneficiaryType === 'actor' && item.displayOnStorefront).map((item) => item.beneficiaryId),
    splitSummary: splits.summary,
  }, { actorProfileId: adminProfileId })

  return { actor: mapActor(context), product: publication, splits, message: 'Produto publicado e disponibilizado aos clientes conforme destino, preço e vitrine seletiva.' }
}
