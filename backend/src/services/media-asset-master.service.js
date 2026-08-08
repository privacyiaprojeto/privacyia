import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const MASTERS_TABLE = 'media_assets'
const RENDITIONS_TABLE = 'media_asset_renditions'
const LEGACY_VARIANTS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'

function nowIso() {
  return new Date().toISOString()
}

function requiredText(value, field) {
  const text = String(value || '').trim()
  if (!text) throw new ApiError(500, `${field} é obrigatório para registrar mídia privada.`)
  return text
}

function normalizeMasterStatus(value) {
  const status = String(value || 'qa_pending').trim().toLowerCase()
  const allowed = new Set(['uploading', 'processing', 'qa_pending', 'available', 'published', 'rejected', 'failed', 'archived'])
  return allowed.has(status) ? status : 'qa_pending'
}

function normalizeRenditionStatus(value) {
  const status = String(value || 'queued').trim().toLowerCase()
  const allowed = new Set(['queued', 'processing', 'available', 'failed', 'revoked', 'archived'])
  return allowed.has(status) ? status : 'queued'
}

function normalizeRenditionType(value) {
  const type = String(value || '').trim().toLowerCase()
  if (!['preview', 'forensic_watermark', 'hls_stream'].includes(type)) {
    throw new ApiError(422, 'renditionType inválido. Use preview, forensic_watermark ou hls_stream.')
  }
  return type
}

async function findMasterByPrivatePointer(bucket, key) {
  const { data, error } = await supabaseAdmin
    .from(MASTERS_TABLE)
    .select('*')
    .eq('master_r2_bucket', bucket)
    .eq('master_r2_key', key)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Falha ao consultar Master Limpo existente.', error)
  return data || null
}

export async function registerMasterAsset({
  actorProfileId = null,
  combinationId = null,
  legacyVariantId = null,
  mediaType = null,
  contentType = null,
  byteSize = null,
  checksumSha256 = null,
  bucket,
  key,
  status = 'qa_pending',
  metadata = {},
} = {}) {
  const masterR2Bucket = requiredText(bucket, 'bucket')
  const masterR2Key = requiredText(key, 'key')
  const existing = await findMasterByPrivatePointer(masterR2Bucket, masterR2Key)

  if (existing) {
    if (legacyVariantId && !existing.legacy_variant_id) {
      const { data: updated, error: updateError } = await supabaseAdmin
        .from(MASTERS_TABLE)
        .update({
          legacy_variant_id: legacyVariantId,
          actor_profile_id: existing.actor_profile_id || actorProfileId || null,
          combination_id: existing.combination_id || combinationId || null,
          updated_at: nowIso(),
        })
        .eq('id', existing.id)
        .select('*')
        .single()

      if (updateError) throw new ApiError(500, 'Falha ao completar o vínculo do Master Limpo.', updateError)
      return updated
    }

    return existing
  }

  const payload = {
    actor_profile_id: actorProfileId || null,
    combination_id: combinationId || null,
    legacy_variant_id: legacyVariantId || null,
    media_type: mediaType || null,
    content_type: contentType || null,
    byte_size: Number.isFinite(Number(byteSize)) ? Number(byteSize) : null,
    checksum_sha256: checksumSha256 || null,
    master_r2_bucket: masterR2Bucket,
    master_r2_key: masterR2Key,
    status: normalizeMasterStatus(status),
    metadata: {
      ...metadata,
      privateStorage: true,
      publicUrl: false,
      masterClean: true,
      registeredAt: nowIso(),
    },
  }

  const { data, error } = await supabaseAdmin
    .from(MASTERS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (!error) return data

  if (String(error.code || '') === '23505') {
    const duplicate = await findMasterByPrivatePointer(masterR2Bucket, masterR2Key)
    if (duplicate) return duplicate
  }

  throw new ApiError(500, 'Falha ao registrar o Master Limpo da mídia.', {
    code: error.code || null,
    message: error.message,
    bucket: masterR2Bucket,
    key: masterR2Key,
  })
}

export async function linkLegacyVariantToMaster({ variantId, masterAssetId } = {}) {
  if (!variantId || !masterAssetId) {
    throw new ApiError(500, 'variantId e masterAssetId são obrigatórios para vincular o Master Limpo.')
  }

  const { data, error } = await supabaseAdmin
    .from(LEGACY_VARIANTS_TABLE)
    .update({ master_asset_id: masterAssetId, updated_at: nowIso() })
    .eq('id', variantId)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Falha ao vincular media_asset_variant ao Master Limpo.', error)
  return data
}

export async function registerMasterForLegacyVariant({ variant, storage, mediaType, contentType, metadata = {} } = {}) {
  if (!variant?.id) throw new ApiError(500, 'Asset legado ausente ao registrar Master Limpo.')

  const master = await registerMasterAsset({
    actorProfileId: variant.actor_profile_id || metadata.actorProfileId || null,
    combinationId: variant.combination_id || metadata.combinationId || null,
    legacyVariantId: variant.id,
    mediaType: mediaType || variant.media_type || null,
    contentType: contentType || storage?.contentType || null,
    byteSize: storage?.byteSize || null,
    checksumSha256: storage?.checksumSha256 || null,
    bucket: storage?.bucket || variant.r2_bucket,
    key: storage?.key || variant.r2_key,
    status: variant.status || 'qa_pending',
    metadata: {
      ...metadata,
      source: metadata.source || 'master_registry_from_legacy_variant',
      legacyVariantId: variant.id,
    },
  })

  const linkedVariant = variant.master_asset_id === master.id
    ? variant
    : await linkLegacyVariantToMaster({ variantId: variant.id, masterAssetId: master.id })

  return { master, variant: linkedVariant }
}

export async function registerMediaRendition({
  masterAssetId,
  renditionType,
  deliveryId = null,
  bucket,
  key,
  status = 'queued',
  metadata = {},
} = {}) {
  if (!masterAssetId) throw new ApiError(422, 'masterAssetId é obrigatório para registrar rendition.')

  const type = normalizeRenditionType(renditionType)
  const r2Bucket = requiredText(bucket, 'bucket')
  const r2Key = requiredText(key, 'key')

  const payload = {
    master_asset_id: masterAssetId,
    rendition_type: type,
    delivery_id: deliveryId || null,
    r2_bucket: r2Bucket,
    r2_key: r2Key,
    status: normalizeRenditionStatus(status),
    metadata: {
      ...metadata,
      privateStorage: true,
      publicUrl: false,
      registeredAt: nowIso(),
    },
  }

  const { data, error } = await supabaseAdmin
    .from(RENDITIONS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (!error) return data

  if (String(error.code || '') === '23505') {
    const { data: existing, error: existingError } = await supabaseAdmin
      .from(RENDITIONS_TABLE)
      .select('*')
      .eq('r2_bucket', r2Bucket)
      .eq('r2_key', r2Key)
      .maybeSingle()

    if (!existingError && existing) return existing
  }

  throw new ApiError(500, 'Falha ao registrar rendition privada.', error)
}

export async function linkDeliveryToRendition({ deliveryId, masterAssetId, renditionId } = {}) {
  if (!deliveryId || !masterAssetId || !renditionId) {
    throw new ApiError(422, 'deliveryId, masterAssetId e renditionId são obrigatórios.')
  }

  const { data, error } = await supabaseAdmin
    .from(DELIVERIES_TABLE)
    .update({
      master_asset_id: masterAssetId,
      rendition_id: renditionId,
      updated_at: nowIso(),
    })
    .eq('id', deliveryId)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Falha ao vincular entrega à rendition protegida.', error)
  return data
}
