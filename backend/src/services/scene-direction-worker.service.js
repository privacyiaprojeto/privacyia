import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { generateDirectedSceneVideoWithRunPod } from './providers/runpod.provider.js'
import { createSignedReadUrl, uploadPrivateBufferToR2 } from './storage.service.js'
import { registerMasterForLegacyVariant } from './media-asset-master.service.js'
import { requestDefaultRenditionsForMaster } from './media-rendition.service.js'
import { markClientGenerationFailed, markClientGenerationQaPending } from './media-generation-tracking.service.js'
import { assertIdentityAdaptersForCastSlots } from './actor-identity-lora.service.js'

const DIRECTIONS_TABLE = 'scene_directions'
const SCENES_TABLE = 'base_scenes'
const COMPANIONS_TABLE = 'companions'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const MAPPING_REQUIREMENTS_TABLE = 'mapping_requirements'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'

function nowIso() {
  return new Date().toISOString()
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function missingColumn(error) {
  const message = String(error?.message || '')
  return message.match(/Could not find the '([^']+)' column/i)?.[1]
    || message.match(/column "([^"]+)" .* does not exist/i)?.[1]
    || null
}

async function insertAdaptive(table, payload, label, { requiredColumns = [] } = {}) {
  const current = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
  const removed = []

  while (Object.keys(current).length > 0) {
    const { data, error } = await supabaseAdmin.from(table).insert(current).select('*').single()
    if (!error) {
      if (removed.length) console.warn(`[scene-direction] ${label}: colunas ausentes ignoradas: ${removed.join(', ')}`)
      return data
    }

    const column = missingColumn(error)
    if (column && Object.prototype.hasOwnProperty.call(current, column)) {
      if (requiredColumns.includes(column)) {
        throw new ApiError(500, `Schema incompatível: coluna obrigatória ${column} ausente ao registrar ${label}.`, { table, code: error.code || null })
      }
      delete current[column]
      removed.push(column)
      continue
    }

    throw new ApiError(500, `Erro ao registrar ${label}.`, { table, error: error.message, code: error.code || null })
  }

  throw new ApiError(500, `Payload vazio ao registrar ${label}.`)
}

async function getDirectionOrThrow(directionId) {
  const { data, error } = await supabaseAdmin.from(DIRECTIONS_TABLE).select('*').eq('id', directionId).maybeSingle()
  if (error) throw new ApiError(500, 'Erro ao carregar Direção de Cena.', error)
  if (!data) throw new ApiError(404, 'Direção de Cena não encontrada.')
  return data
}

async function updateDirection(directionId, payload) {
  const { data, error } = await supabaseAdmin
    .from(DIRECTIONS_TABLE)
    .update({ ...payload, updated_at: nowIso() })
    .eq('id', directionId)
    .select('*')
    .single()
  if (error) throw new ApiError(500, 'Erro ao atualizar Direção de Cena.', error)
  return data
}

function outputKey(directionId, extension = 'mp4') {
  const date = new Date()
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `media/scene-directions/${y}/${m}/${d}/${directionId}/output.${extension || 'mp4'}`
}

async function loadCompanions(castSlots = []) {
  const ids = [...new Set(castSlots.map((slot) => slot.companionId).filter(Boolean))]
  if (!ids.length) return new Map()

  const { data, error } = await supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('id, name, slug, avatar_url, thumbnail_url, banner_url')
    .in('id', ids)

  if (error) throw new ApiError(500, 'Erro ao carregar referências do elenco.', error)
  return new Map((data || []).map((row) => [row.id, row]))
}


const VISUAL_REFERENCE_PRIORITY = [
  'face_front',
  'face_profile_left',
  'face_profile_right',
  'face_profile',
  'nsfw_closeup_front',
  'nsfw_closeup_back',
  'body_front',
  'body_back',
  'video_expression',
  'video_walk',
  'nsfw_front',
  'nsfw_back',
]

function sortMappingReferences(items = []) {
  const priority = new Map(VISUAL_REFERENCE_PRIORITY.map((tag, index) => [tag, index]))
  return items.slice().sort((left, right) => {
    const leftPriority = priority.has(left.systemTag) ? priority.get(left.systemTag) : 999
    const rightPriority = priority.has(right.systemTag) ? priority.get(right.systemTag) : 999
    if (leftPriority !== rightPriority) return leftPriority - rightPriority
    return String(right.createdAt || '').localeCompare(String(left.createdAt || ''))
  })
}

async function loadApprovedMappingReferences(castSlots = []) {
  const actorIds = [...new Set(
    castSlots
      .filter((slot) => slot.participantType === 'actor')
      .map((slot) => slot.actorProfileId)
      .filter(Boolean),
  )]

  if (!actorIds.length) return new Map()

  const [requirementsResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from(MAPPING_REQUIREMENTS_TABLE)
      .select('id, system_tag, media_type, is_active')
      .eq('is_active', true)
      .not('system_tag', 'is', null),
    supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('id, actor_profile_id, mapping_requirement_id, r2_bucket, r2_key, content_type, status, created_at')
      .in('actor_profile_id', actorIds)
      .eq('status', 'approved')
      .not('r2_bucket', 'is', null)
      .not('r2_key', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  if (requirementsResult.error) {
    throw new ApiError(500, 'Erro ao carregar as referências nominais do mapeamento.', requirementsResult.error)
  }
  if (assetsResult.error) {
    throw new ApiError(500, 'Erro ao carregar os materiais aprovados do elenco.', assetsResult.error)
  }

  const requirementById = new Map(
    (requirementsResult.data || [])
      .filter((row) => ['image', 'video'].includes(String(row.media_type || '').toLowerCase()))
      .map((row) => [row.id, {
        systemTag: String(row.system_tag || '').toLowerCase(),
        mediaType: String(row.media_type || '').toLowerCase(),
      }]),
  )

  const latestByActorAndTag = new Map()
  for (const asset of assetsResult.data || []) {
    const requirement = requirementById.get(asset.mapping_requirement_id)
    if (!requirement?.systemTag) continue
    const dedupeKey = `${asset.actor_profile_id}:${requirement.systemTag}`
    if (latestByActorAndTag.has(dedupeKey)) continue
    latestByActorAndTag.set(dedupeKey, {
      assetId: asset.id,
      actorProfileId: asset.actor_profile_id,
      bucket: asset.r2_bucket,
      key: asset.r2_key,
      contentType: asset.content_type || (requirement.mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
      systemTag: requirement.systemTag,
      mediaType: requirement.mediaType,
      createdAt: asset.created_at || null,
    })
  }

  const byActor = new Map(actorIds.map((actorId) => [actorId, []]))
  for (const item of latestByActorAndTag.values()) {
    byActor.get(item.actorProfileId)?.push(item)
  }

  await Promise.all([...byActor.entries()].map(async ([actorId, items]) => {
    const sorted = sortMappingReferences(items)
    const signed = await Promise.all(sorted.map(async (item) => ({
      assetId: item.assetId,
      systemTag: item.systemTag,
      mediaType: item.mediaType,
      contentType: item.contentType,
      url: await createSignedReadUrl(item.bucket, item.key, 60 * 30),
    })))
    byActor.set(actorId, signed)
  }))

  return byActor
}

async function createCatalogProduct({ direction, castSlots, storage, generated }) {
  const primaryActor = castSlots.find((slot) => slot.participantType === 'actor' && slot.companionId)
  if (!primaryActor) return { combination: null, asset: null }

  const now = nowIso()
  const title = `Direção de Cena • ${primaryActor.displayName || 'Elenco'} • ${String(direction.id).slice(0, 8)}`
  const combination = await insertAdaptive(COMBINATIONS_TABLE, {
    companion_id: primaryActor.companionId,
    actor_profile_id: primaryActor.actorProfileId || null,
    avatar_production_authorization_id: primaryActor.authorizationId || null,
    combination_key: `scene-direction:${direction.id}`,
    title,
    name: title,
    label: title,
    slug: `scene-direction-${direction.id}`,
    media_type: 'video',
    content_type: 'video',
    status: 'active',
    is_active: true,
    active: true,
    visible_to_client: false,
    admin_only: true,
    price_credits: 0,
    prompt: direction.direction_prompt,
    prompt_final: direction.direction_prompt,
    guided_selections: [],
    media_origin: 'scene_direction_studio',
    metadata: {
      source: 'scene_direction_studio',
      directionId: direction.id,
      baseSceneId: direction.base_scene_id || null,
      castSlots,
      privateStorage: true,
    },
    created_at: now,
    updated_at: now,
  }, 'combinação da Direção de Cena', { requiredColumns: ['companion_id', 'actor_profile_id'] })

  const asset = await insertAdaptive(ASSETS_TABLE, {
    combination_id: combination.id,
    companion_id: primaryActor.companionId,
    actor_profile_id: primaryActor.actorProfileId || null,
    avatar_production_authorization_id: primaryActor.authorizationId || null,
    media_type: 'video',
    variant_number: 1,
    r2_bucket: storage.bucket,
    r2_key: storage.key,
    engine: 'runpod',
    status: 'qa_pending',
    max_assignments: 1,
    current_assignments: 0,
    media_origin: 'scene_direction_studio',
    qa_payload: {
      status: 'qa_pending',
      source: 'scene_direction_studio',
      requires_qa: true,
      direction_id: direction.id,
      r2_bucket: storage.bucket,
      r2_key: storage.key,
      mime_type: generated.mimeType || storage.contentType,
      private_storage: true,
    },
    metadata: {
      source: 'scene_direction_studio',
      provider: 'runpod',
      directionId: direction.id,
      baseSceneId: direction.base_scene_id || null,
      castSlots,
      storage: {
        bucket: storage.bucket,
        key: storage.key,
        contentType: storage.contentType,
        byteSize: storage.byteSize,
        private: true,
      },
    },
    created_at: now,
    updated_at: now,
  }, 'produto gerado pela Direção de Cena', { requiredColumns: ['combination_id', 'companion_id', 'actor_profile_id', 'r2_bucket', 'r2_key', 'status'] })

  const masterRegistration = await registerMasterForLegacyVariant({
    variant: asset,
    storage: {
      bucket: storage.bucket,
      key: storage.key,
      contentType: generated.mimeType || storage.contentType || 'video/mp4',
      byteSize: storage.byteSize || generated.buffer?.length || null,
    },
    mediaType: 'video',
    contentType: generated.mimeType || storage.contentType || 'video/mp4',
    metadata: {
      source: 'scene_direction_studio',
      actorProfileId: primaryActor.actorProfileId || null,
      combinationId: combination.id,
      directionId: direction.id,
      baseSceneId: direction.base_scene_id || null,
      providerJobId: generated.providerJobId || generated.jobId || null,
    },
  })

  return { combination, asset: masterRegistration.variant, master: masterRegistration.master }
}

export async function processSceneDirectionJob(job) {
  const directionId = job?.data?.directionId
  if (!directionId) throw new ApiError(400, 'directionId ausente no job de Direção de Cena.')
  if (!env.SCENE_DIRECTION_QUEUE_ENABLED) throw new ApiError(409, 'Fila de Direção de Cena desabilitada.')

  const direction = await getDirectionOrThrow(directionId)
  if (!['queued', 'planned', 'failed'].includes(direction.status)) {
    return { directionId, skipped: true, reason: `status_${direction.status}` }
  }

  await updateDirection(directionId, { status: 'processing', error_message: null, queue_job_id: String(job.id || direction.queue_job_id || '') || null })

  try {
    const castSlots = Array.isArray(direction.cast_slots) ? direction.cast_slots : []
    const identityAdaptersBySlot = await assertIdentityAdaptersForCastSlots(
      castSlots,
      direction.production_mode === 'v2v' ? 'live_action' : 'short_video',
    )
    const [companionById, mappingReferencesByActor] = await Promise.all([
      loadCompanions(castSlots),
      loadApprovedMappingReferences(castSlots),
    ])
    let baseVideoUrl = ''

    if (direction.production_mode === 'v2v') {
      const { data: scene, error: sceneError } = await supabaseAdmin
        .from(SCENES_TABLE)
        .select('*')
        .eq('id', direction.base_scene_id)
        .eq('upload_status', 'ready')
        .eq('is_active', true)
        .maybeSingle()
      if (sceneError) throw new ApiError(500, 'Erro ao carregar vídeo base.', sceneError)
      if (!scene) throw new ApiError(409, 'Vídeo base não está pronto ou foi inativado.')
      baseVideoUrl = await createSignedReadUrl(scene.r2_bucket, scene.video_url, 60 * 30)
    }

    const providerCast = castSlots.map((slot) => {
      if (slot.participantType !== 'actor') return slot

      const mappingReferences = mappingReferencesByActor.get(slot.actorProfileId) || []
      if (!mappingReferences.length) {
        throw new ApiError(409, `${slot.displayName || 'Um integrante do elenco'} ainda não possui material visual aprovado com Tag de Sistema para a produção.`)
      }

      const companion = companionById.get(slot.companionId)
      const primaryReference = mappingReferences.find((item) => item.mediaType === 'image') || mappingReferences[0]

      return {
        ...slot,
        identityAdapter: identityAdaptersBySlot.get(slot.slotIndex) || null,
        referenceImageUrl: primaryReference?.url || null,
        referenceMedia: mappingReferences,
        referenceSource: 'approved_mapping_vault',
        companionLabel: companion?.name || companion?.slug || slot.displayName || null,
      }
    })

    const generated = await generateDirectedSceneVideoWithRunPod({
      directionId,
      productionMode: direction.production_mode,
      baseVideoUrl,
      castSlots: providerCast,
      prompt: direction.direction_prompt,
      camera: safeObject(direction.provider_payload).camera || {},
      action: safeObject(direction.provider_payload).action || {},
      generation: safeObject(direction.provider_payload).generation || {},
      workflow: safeObject(direction.provider_payload).workflow || {},
    })

    const key = outputKey(directionId, generated.extension || 'mp4')
    const storage = await uploadPrivateBufferToR2({
      buffer: generated.buffer,
      key,
      contentType: generated.mimeType || 'video/mp4',
      metadata: { source: 'scene_direction_studio', direction_id: directionId },
    })

    const product = await createCatalogProduct({ direction, castSlots, storage, generated })
    const renditionRequests = product.master?.id
      ? await requestDefaultRenditionsForMaster({
          masterAssetId: product.master.id,
          mediaType: 'video',
          requestedByProfileId: safeObject(direction.metadata).requestContext?.profileId || null,
        })
      : null

    const requestContext = safeObject(direction.metadata).requestContext || safeObject(direction.provider_payload).requestContext || {}
    await markClientGenerationQaPending({
      mediaJobId: requestContext.mediaJobId || null,
      generationId: requestContext.generationId || null,
      assetId: product.asset?.id || null,
      masterAssetId: product.master?.id || null,
      providerJobId: generated.providerJobId || generated.jobId || null,
    })

    const completed = await updateDirection(directionId, {
      status: 'qa_pending',
      output_r2_bucket: storage.bucket,
      output_r2_key: storage.key,
      output_asset_id: product.asset?.id || null,
      provider_payload: {
        ...safeObject(direction.provider_payload),
        result: {
          providerJobId: generated.providerJobId || generated.jobId || null,
          telemetry: generated.telemetry || null,
          privateStorage: true,
        },
      },
      metadata: {
        ...safeObject(direction.metadata),
        processedAt: nowIso(),
        outputAssetId: product.asset?.id || null,
        masterAssetId: product.master?.id || null,
        combinationId: product.combination?.id || null,
        publicUrl: false,
        autoPublication: false,
        renditionRequests: renditionRequests ? {
          previewRenditionId: renditionRequests.preview?.rendition?.id || null,
          hlsRenditionId: renditionRequests.hls?.rendition?.id || null,
          deferred: Boolean(renditionRequests.preview?.deferred || renditionRequests.hls?.deferred),
        } : null,
      },
    })

    return { directionId, status: completed.status, outputAssetId: completed.output_asset_id || null, masterAssetId: product.master?.id || null }
  } catch (error) {
    const requestContext = safeObject(direction?.metadata).requestContext || safeObject(direction?.provider_payload).requestContext || {}
    await Promise.allSettled([
      updateDirection(directionId, {
        status: 'failed',
        error_message: String(error?.message || 'Falha ao processar Direção de Cena.').slice(0, 1200),
      }),
      markClientGenerationFailed({
        mediaJobId: requestContext.mediaJobId || null,
        generationId: requestContext.generationId || null,
        message: error?.message,
      }),
    ])
    throw error
  }
}
