import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import {
  createSignedReadUrl,
  createSignedUploadUrl,
  headObject,
  sanitizeStoragePathSegment,
} from './storage.service.js'
import { addVideoShortJob } from '../queues/video-short.queue.js'
import { addVideoV2vJob } from '../queues/video-v2v.queue.js'
import { assertIdentityAdaptersForCastSlots } from './actor-identity-lora.service.js'

const BASE_SCENES_TABLE = 'base_scenes'
const DIRECTIONS_TABLE = 'scene_directions'
const PRODUCT_SPLITS_TABLE = 'product_splits'
const ACTORS_TABLE = 'actor_profiles'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const COMPANIONS_TABLE = 'companions'
const PRODUCTS_TABLE = 'media_asset_variants'
const MAX_BASE_SCENE_BYTES = 750 * 1024 * 1024

const EXTRA_LABELS = {
  generic_black_man: 'Homem Negro Genérico',
  generic_white_muscular_man: 'Homem Branco Musculoso',
  generic_asian_woman: 'Mulher Asiática',
  custom: 'Personagem Personalizado',
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function isCompanyActor(row = {}) {
  const metadata = safeObject(row.metadata)
  const entityType = String(metadata.entityType || metadata.entity_type || metadata.profileType || metadata.profile_type || '').toLowerCase()
  return entityType === 'company' || entityType === 'empresa' || metadata.isCompany === true || metadata.is_company === true
}

function wrapSceneTableError(message, error) {
  if (String(error?.code || '') === '42P01') {
    return new ApiError(500, 'Estúdio de Direção ainda não instalado. Execute a migração 20260712_admin_scene_direction_splits.sql.', error)
  }
  return new ApiError(500, message, error)
}

function mapBaseScene(row = {}) {
  return {
    id: row.id,
    title: row.title || 'Cena sem título',
    description: row.description || '',
    slotsCount: Number(row.slots_count || 1),
    sceneType: row.scene_type || null,
    contentType: row.content_type || 'video/mp4',
    byteSize: row.byte_size == null ? null : Number(row.byte_size),
    uploadStatus: row.upload_status || 'uploading',
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    previewEndpoint: row.id ? `/api/admin/scene-direction/base-scenes/${row.id}/preview` : null,
  }
}

function mapDirection(row = {}) {
  return {
    id: row.id,
    baseSceneId: row.base_scene_id || null,
    productionMode: row.production_mode || 'v2v',
    slotsCount: Number(row.slots_count || 1),
    castSlots: Array.isArray(row.cast_slots) ? row.cast_slots : [],
    prompt: row.direction_prompt || '',
    status: row.status || 'planned',
    queueJobId: row.queue_job_id || null,
    outputAssetId: row.output_asset_id || null,
    errorMessage: row.error_message || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    metadata: safeObject(row.metadata),
  }
}

function mapSplit(row = {}) {
  return {
    id: row.id,
    productId: row.product_id,
    beneficiaryId: row.beneficiary_id,
    beneficiaryType: row.beneficiary_type,
    beneficiaryName: row.beneficiary_name_snapshot || 'Beneficiário',
    splitPercentage: Number(row.split_percentage || 0),
    displayOnStorefront: row.display_on_storefront !== false,
    sortOrder: Number(row.sort_order || 0),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function buildSceneKey({ sceneId, title }) {
  const date = new Date()
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const slug = sanitizeStoragePathSegment(title || 'cena-base', 'cena-base')
  return `media/base-scenes/${year}/${month}/${sceneId}/${slug}.mp4`
}

async function getBaseSceneOrThrow(sceneId, { readyOnly = false } = {}) {
  let query = supabaseAdmin.from(BASE_SCENES_TABLE).select('*').eq('id', sceneId)
  if (readyOnly) query = query.eq('upload_status', 'ready').eq('is_active', true)

  const { data, error } = await query.maybeSingle()
  if (error) throw wrapSceneTableError('Erro ao carregar cena base.', error)
  if (!data) throw new ApiError(404, readyOnly ? 'Cena base ativa e pronta não encontrada.' : 'Cena base não encontrada.')
  return data
}

export async function listBaseScenes({ includeInactive = false } = {}) {
  let query = supabaseAdmin
    .from(BASE_SCENES_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw wrapSceneTableError('Erro ao listar cenas base.', error)

  return { items: (data || []).map(mapBaseScene) }
}

export async function createBaseSceneUploadSession(input = {}, { adminProfileId = null } = {}) {
  const sceneId = randomUUID()
  const bucket = env.R2_BUCKET_NAME
  if (!bucket) throw new ApiError(500, 'Armazenamento privado ainda não configurado para a Biblioteca de Cenas.')

  const key = buildSceneKey({ sceneId, title: input.title })
  const now = nowIso()

  const payload = {
    id: sceneId,
    title: normalizeText(input.title),
    description: normalizeText(input.description),
    video_url: key,
    r2_bucket: bucket,
    slots_count: Number(input.slotsCount || 2),
    scene_type: input.sceneType,
    content_type: 'video/mp4',
    byte_size: Number(input.byteSize || 0),
    upload_status: 'uploading',
    is_active: true,
    metadata: {
      source: 'admin_scene_library',
      originalFilename: normalizeText(input.filename),
      privateStorage: true,
    },
    created_by_profile_id: adminProfileId,
    updated_by_profile_id: adminProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(BASE_SCENES_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw wrapSceneTableError('Erro ao preparar cadastro da cena base.', error)

  try {
    const uploadUrl = await createSignedUploadUrl({
      bucket,
      key,
      contentType: 'video/mp4',
      expiresIn: 15 * 60,
    })

    return {
      scene: mapBaseScene(data),
      upload: {
        url: uploadUrl,
        method: 'PUT',
        contentType: 'video/mp4',
        expiresInSeconds: 900,
      },
    }
  } catch (error_) {
    await supabaseAdmin
      .from(BASE_SCENES_TABLE)
      .update({ upload_status: 'failed', updated_at: nowIso() })
      .eq('id', sceneId)
    throw error_
  }
}

export async function completeBaseSceneUpload(sceneId, { adminProfileId = null } = {}) {
  const scene = await getBaseSceneOrThrow(sceneId)
  const object = await headObject(scene.r2_bucket, scene.video_url)

  if (!String(object.contentType || '').toLowerCase().includes('video/mp4')) {
    throw new ApiError(422, 'O arquivo recebido não foi reconhecido como vídeo MP4.')
  }
  if (Number(object.contentLength || 0) <= 0 || Number(object.contentLength || 0) > MAX_BASE_SCENE_BYTES) {
    throw new ApiError(422, 'O vídeo da cena deve ter entre 1 byte e 750 MB.')
  }

  const { data, error } = await supabaseAdmin
    .from(BASE_SCENES_TABLE)
    .update({
      upload_status: 'ready',
      byte_size: object.contentLength || scene.byte_size || null,
      content_type: object.contentType || 'video/mp4',
      updated_by_profile_id: adminProfileId,
      updated_at: nowIso(),
      metadata: {
        ...safeObject(scene.metadata),
        storageVerifiedAt: nowIso(),
        etag: object.etag || null,
        privateStorage: true,
      },
    })
    .eq('id', sceneId)
    .select('*')
    .single()

  if (error) throw wrapSceneTableError('Erro ao confirmar vídeo da cena base.', error)
  return { scene: mapBaseScene(data), message: 'Cena adicionada à biblioteca.' }
}

export async function updateBaseScene(sceneId, input = {}, { adminProfileId = null } = {}) {
  await getBaseSceneOrThrow(sceneId)
  const payload = { updated_by_profile_id: adminProfileId, updated_at: nowIso() }
  if (input.title !== undefined) payload.title = normalizeText(input.title)
  if (input.description !== undefined) payload.description = normalizeText(input.description)
  if (input.slotsCount !== undefined) payload.slots_count = Number(input.slotsCount)
  if (input.sceneType !== undefined) payload.scene_type = input.sceneType
  if (input.isActive !== undefined) payload.is_active = Boolean(input.isActive)

  const { data, error } = await supabaseAdmin
    .from(BASE_SCENES_TABLE)
    .update(payload)
    .eq('id', sceneId)
    .select('*')
    .single()

  if (error) throw wrapSceneTableError('Erro ao atualizar cena base.', error)
  return { scene: mapBaseScene(data), message: data.is_active ? 'Cena atualizada.' : 'Cena inativada.' }
}

export async function createBaseScenePreview(sceneId) {
  const scene = await getBaseSceneOrThrow(sceneId, { readyOnly: true })
  const expiresIn = 5 * 60
  const url = await createSignedReadUrl(scene.r2_bucket, scene.video_url, expiresIn)
  return {
    scene: mapBaseScene(scene),
    preview: {
      url,
      contentType: scene.content_type || 'video/mp4',
      expiresInSeconds: expiresIn,
      public: false,
    },
  }
}

async function loadActiveAuthorizations() {
  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('id, actor_profile_id, companion_id, status, starts_at, ends_at, authorized_for_content_types')
    .eq('status', 'active')

  if (error) throw new ApiError(500, 'Erro ao carregar autorizações de produção.', error)

  const now = Date.now()
  return (data || []).filter((row) => {
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
    if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false
    const types = Array.isArray(row.authorized_for_content_types) ? row.authorized_for_content_types : []
    return types.some((type) => ['video', 'short_video', 'live_action'].includes(String(type)))
  })
}

export async function listSceneCastingCandidates() {
  const [actorsResult, authorizations] = await Promise.all([
    supabaseAdmin
      .from(ACTORS_TABLE)
      .select('id, display_name, legal_name, email, status, kyc_status, production_status, metadata')
      .neq('status', 'blocked')
      .order('display_name', { ascending: true }),
    loadActiveAuthorizations(),
  ])

  if (actorsResult.error) throw new ApiError(500, 'Erro ao carregar elenco disponível.', actorsResult.error)

  const authorizationByActor = new Map(authorizations.map((row) => [row.actor_profile_id, row]))
  const companionIds = [...new Set(authorizations.map((row) => row.companion_id).filter(Boolean))]
  const companionResult = companionIds.length
    ? await supabaseAdmin.from(COMPANIONS_TABLE).select('id, name, slug, avatar_url, thumbnail_url').in('id', companionIds)
    : { data: [], error: null }

  if (companionResult.error) throw new ApiError(500, 'Erro ao carregar avatares do elenco.', companionResult.error)
  const companionById = new Map((companionResult.data || []).map((row) => [row.id, row]))

  const items = (actorsResult.data || [])
    .map((actor) => {
      const authorization = authorizationByActor.get(actor.id)
      if (!authorization) return null
      const companion = companionById.get(authorization.companion_id) || null
      const beneficiaryType = isCompanyActor(actor) ? 'company' : 'actor'
      return {
        actorProfileId: actor.id,
        companionId: authorization.companion_id,
        authorizationId: authorization.id,
        displayName: actor.display_name || actor.legal_name || 'Ator/Atriz',
        legalName: actor.legal_name || null,
        email: actor.email || null,
        beneficiaryType,
        companion: companion ? {
          id: companion.id,
          name: companion.name || companion.slug || actor.display_name,
          slug: companion.slug || null,
          avatarUrl: companion.avatar_url || companion.thumbnail_url || null,
        } : null,
      }
    })
    .filter(Boolean)

  return { items }
}

export async function listSplitBeneficiaries() {
  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, display_name, legal_name, email, status, metadata')
    .neq('status', 'blocked')
    .order('display_name', { ascending: true })
    .limit(300)

  if (error) throw new ApiError(500, 'Erro ao carregar beneficiários.', error)

  return {
    items: (data || []).map((row) => ({
      id: row.id,
      type: isCompanyActor(row) ? 'company' : 'actor',
      name: row.display_name || row.legal_name || 'Beneficiário',
      legalName: row.legal_name || null,
      email: row.email || null,
      active: row.status !== 'blocked' && row.status !== 'archived',
    })),
  }
}

export async function createSceneDirection(input = {}, { adminProfileId = null } = {}) {
  const baseScene = input.productionMode === 'v2v'
    ? await getBaseSceneOrThrow(input.baseSceneId, { readyOnly: true })
    : null

  const expectedSlots = baseScene ? Number(baseScene.slots_count || 1) : 1
  if (input.slots.length !== expectedSlots) {
    throw new ApiError(422, `Esta produção precisa de ${expectedSlots} participante(s) no elenco.`)
  }

  const candidates = await listSceneCastingCandidates()
  const candidateByActor = new Map(candidates.items.map((item) => [item.actorProfileId, item]))

  const castSlotsWithoutIdentity = input.slots
    .slice()
    .sort((left, right) => left.slotIndex - right.slotIndex)
    .map((slot) => {
      if (slot.participantType === 'actor') {
        const candidate = candidateByActor.get(slot.actorProfileId)
        if (!candidate) {
          throw new ApiError(422, 'Um dos atores escolhidos ainda não possui mapeamento e autorização ativos para vídeo.', {
            actorProfileId: slot.actorProfileId,
          })
        }

        return {
          slotIndex: slot.slotIndex,
          participantType: 'actor',
          actorProfileId: candidate.actorProfileId,
          companionId: candidate.companionId,
          authorizationId: candidate.authorizationId,
          displayName: candidate.displayName,
          companionName: candidate.companion?.name || candidate.displayName,
        }
      }

      return {
        slotIndex: slot.slotIndex,
        participantType: 'virtual_extra',
        extraType: slot.extraType,
        displayName: slot.extraType === 'custom'
          ? normalizeText(slot.customDescription)
          : EXTRA_LABELS[slot.extraType],
        customDescription: slot.extraType === 'custom' ? normalizeText(slot.customDescription) : null,
      }
    })

  const identityAdaptersBySlot = await assertIdentityAdaptersForCastSlots(
    castSlotsWithoutIdentity,
    input.productionMode === 'v2v' ? 'live_action' : 'short_video',
  )
  const castSlots = castSlotsWithoutIdentity.map((slot) => {
    const adapter = slot.participantType === 'actor' ? identityAdaptersBySlot.get(slot.slotIndex) || null : null
    return {
      ...slot,
      identityAdapter: adapter ? {
        adapterId: adapter.adapterId,
        adapterVersion: adapter.adapterVersion,
        baseModel: adapter.baseModel,
        baseModelFingerprint: adapter.baseModelFingerprint,
        sha256: adapter.sha256,
        triggerToken: adapter.triggerToken,
        strengthModel: adapter.strengthModel,
        consentVersion: adapter.consentVersion,
      } : null,
    }
  })

  const now = nowIso()
  const directionId = randomUUID()
  const queueAllowed = Boolean(input.execute && env.SCENE_DIRECTION_QUEUE_ENABLED && env.WORKERS_ENABLED)

  const providerPayload = {
    contractVersion: 'privacy-production-spec-v1',
    productionMode: input.productionMode,
    baseScene: baseScene ? { id: baseScene.id, bucket: baseScene.r2_bucket, key: baseScene.video_url } : null,
    castSlots: castSlots.map((slot) => ({
      slotIndex: slot.slotIndex,
      participantType: slot.participantType,
      actorProfileId: slot.actorProfileId || null,
      companionId: slot.companionId || null,
      authorizationId: slot.authorizationId || null,
      identityAdapter: slot.identityAdapter || null,
      extraType: slot.extraType || null,
      customDescription: slot.customDescription || null,
    })),
    prompt: normalizeText(input.prompt),
    camera: input.camera || {},
    action: input.action || {},
    generation: input.generation || {},
    workflow: input.workflow || {},
    requestContext: input.requestContext || null,
  }

  const { data, error } = await supabaseAdmin
    .from(DIRECTIONS_TABLE)
    .insert({
      id: directionId,
      base_scene_id: baseScene?.id || null,
      production_mode: input.productionMode,
      slots_count: expectedSlots,
      cast_slots: castSlots,
      direction_prompt: normalizeText(input.prompt),
      status: queueAllowed ? 'queued' : 'planned',
      provider_payload: providerPayload,
      metadata: {
        source: input.requestContext?.source || 'admin_scene_direction',
        requestContext: input.requestContext || null,
        requestedExecution: input.execute === true,
        queueAllowed,
        safety: {
          clientBilling: false,
          publicUrl: false,
          autoPublication: false,
        },
      },
      created_by_profile_id: adminProfileId,
      updated_by_profile_id: adminProfileId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) throw wrapSceneTableError('Erro ao registrar direção de cena.', error)

  let job = null
  if (queueAllowed) {
    try {
      job = data.production_mode === 'i2v'
        ? await addVideoShortJob({ directionId })
        : await addVideoV2vJob({ directionId })
      await supabaseAdmin
        .from(DIRECTIONS_TABLE)
        .update({ queue_job_id: String(job.id), updated_at: nowIso() })
        .eq('id', directionId)
    } catch (queueError) {
      await supabaseAdmin
        .from(DIRECTIONS_TABLE)
        .update({ status: 'planned', error_message: `Fila indisponível: ${queueError.message}`, updated_at: nowIso() })
        .eq('id', directionId)
      throw new ApiError(503, 'A direção foi salva, mas a fila de vídeo não respondeu. Ela permanece pronta para novo disparo.', {
        directionId,
      })
    }
  }

  return {
    direction: mapDirection({ ...data, queue_job_id: job?.id ? String(job.id) : null }),
    processing: {
      requested: input.execute === true,
      queued: queueAllowed,
      jobId: job?.id ? String(job.id) : null,
      directionId,
      queueEnabled: env.SCENE_DIRECTION_QUEUE_ENABLED,
      workersEnabled: env.WORKERS_ENABLED,
      message: queueAllowed
        ? 'Produção enviada para a fila protegida de vídeo.'
        : 'Direção salva. Habilite a fila de Direção de Cena para iniciar a geração real.',
    },
  }
}

export async function listSceneDirections({ status = null, limit = 30 } = {}) {
  let query = supabaseAdmin
    .from(DIRECTIONS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Number(limit || 30))

  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw wrapSceneTableError('Erro ao listar direções de cena.', error)
  return { items: (data || []).map(mapDirection) }
}

async function assertProductExists(productId) {
  const { data, error } = await supabaseAdmin
    .from(PRODUCTS_TABLE)
    .select('id')
    .eq('id', productId)
    .maybeSingle()
  if (error) throw new ApiError(500, 'Erro ao validar produto.', error)
  if (!data) throw new ApiError(404, 'Produto não encontrado.')
}

export async function getProductSplits(productId) {
  await assertProductExists(productId)
  const { data, error } = await supabaseAdmin
    .from(PRODUCT_SPLITS_TABLE)
    .select('*')
    .eq('product_id', productId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw wrapSceneTableError('Erro ao carregar repasses do produto.', error)
  const items = (data || []).map(mapSplit)
  const beneficiariesPercent = items.reduce((sum, item) => sum + item.splitPercentage, 0)
  return {
    productId,
    items,
    summary: {
      beneficiariesPercent,
      platformPercent: Math.max(100 - beneficiariesPercent, 0),
      beneficiariesCount: items.length,
    },
  }
}

async function resolveSplitBeneficiaries(splits = []) {
  if (!splits.length) return []

  const ids = [...new Set(splits.map((split) => split.beneficiaryId).filter(Boolean))]
  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, display_name, legal_name, status, metadata')
    .in('id', ids)

  if (error) throw new ApiError(500, 'Erro ao validar beneficiários dos repasses.', error)
  const rowById = new Map((data || []).map((row) => [row.id, row]))

  return splits.map((split, index) => {
    const row = rowById.get(split.beneficiaryId)
    if (!row || ['blocked', 'archived'].includes(String(row.status || '').toLowerCase())) {
      throw new ApiError(422, 'Um dos beneficiários não existe ou está indisponível.', { beneficiaryId: split.beneficiaryId })
    }

    const actualType = isCompanyActor(row) ? 'company' : 'actor'
    if (actualType !== split.beneficiaryType) {
      throw new ApiError(422, 'O tipo do beneficiário não corresponde ao cadastro selecionado.', { beneficiaryId: split.beneficiaryId })
    }

    return {
      beneficiaryId: row.id,
      beneficiaryType: actualType,
      beneficiaryName: row.display_name || row.legal_name || 'Beneficiário',
      splitPercentage: Number(split.splitPercentage || 0),
      displayOnStorefront: split.displayOnStorefront !== false,
      sortOrder: index,
    }
  })
}

export async function replaceProductSplits(productId, splits = [], { adminProfileId = null } = {}) {
  await assertProductExists(productId)

  const resolvedSplits = await resolveSplitBeneficiaries(splits)

  const { data, error } = await supabaseAdmin.rpc('replace_product_splits', {
    p_product_id: productId,
    p_splits: resolvedSplits,
    p_admin_profile_id: adminProfileId,
  })

  if (error) throw wrapSceneTableError('Erro ao salvar vitrine e repasses do produto.', error)

  const items = (data || []).map(mapSplit)
  const beneficiariesPercent = items.reduce((sum, item) => sum + item.splitPercentage, 0)
  return {
    productId,
    items,
    summary: {
      beneficiariesPercent,
      platformPercent: Math.max(100 - beneficiariesPercent, 0),
      beneficiariesCount: items.length,
    },
    message: 'Vitrine e repasses salvos.',
  }
}
