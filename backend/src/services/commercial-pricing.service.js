import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const ASSETS_TABLE = 'media_asset_variants'
const COMBINATIONS_TABLE = 'media_combinations'
const BATCHES_TABLE = 'media_generation_batches'
const PRICING_RULES_TABLE = 'media_pricing_rules'

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizePositiveInteger(value, fallback = 30, max = 200) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed <= 0) return fallback

  return Math.min(parsed, max)
}

function normalizeOffset(value) {
  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) return 0

  return parsed
}

function normalizeMediaType(value) {
  const mediaType = String(value || '').trim()

  return mediaType || null
}

function mediaTypeAliases(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized || normalized === 'all') return []
  if (['image', 'imagem', 'foto', 'photo', 'picture', 'img'].includes(normalized)) return ['image', 'imagem', 'foto', 'photo', 'picture', 'img']
  if (['audio', 'áudio', 'live_audio', 'voice'].includes(normalized)) return ['audio', 'áudio', 'live_audio', 'voice']
  if (['video', 'vídeo', 'short_video', 'live_action'].includes(normalized)) return ['video', 'vídeo', 'short_video', 'live_action']
  return [normalized]
}

function normalizePriceCredits(value, { allowZero = true } = {}) {
  if (value === undefined || value === null || value === '') {
    throw new ApiError(400, 'Informe o preço em créditos.')
  }

  const parsed = Number(value)

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new ApiError(400, 'Preço em créditos deve ser um número inteiro maior ou igual a zero.')
  }

  if (!allowZero && parsed <= 0) {
    throw new ApiError(400, 'Preço em créditos deve ser maior que zero.')
  }

  return parsed
}

function normalizeBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value

  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value || '').trim().toLowerCase())
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))]
}

function hasActivePrice(pricing = {}) {
  if (!pricing || typeof pricing !== 'object') return false
  if (pricing.isActive === false || pricing.active === false || pricing.enabled === false) return false

  const credits = Number(pricing.priceCredits ?? pricing.price_credits ?? pricing.credits ?? 0)
  return Number.isInteger(credits) && credits > 0
}

function getMetadataPrice(metadata, preferredKeys = []) {
  const root = safeObject(metadata)
  const candidates = [
    ...preferredKeys.map((key) => safeObject(root[key])),
    safeObject(root.commercialPricing),
    safeObject(root.productPricing),
    safeObject(root.pricing),
    safeObject(root.productPublication?.pricing),
  ]

  const found = candidates.find(hasActivePrice)
  if (!found) return null

  return {
    credits: Number(found.priceCredits ?? found.price_credits ?? found.credits),
    label: found.label || found.name || null,
    note: found.note || found.observation || null,
    configuredAt: found.updatedAt || found.createdAt || null,
    configuredByProfileId: found.updatedByProfileId || found.createdByProfileId || null,
    raw: found,
  }
}

function buildCommercialPricingPayload({ priceCredits, isActive, note, actorProfileId, scope, source }) {
  const now = new Date().toISOString()

  return {
    scope,
    source,
    priceCredits,
    credits: priceCredits,
    isActive,
    active: isActive,
    note: note || null,
    updatedAt: now,
    updatedByProfileId: actorProfileId || null,
  }
}

async function insertAdminAuditLogSoft(payload = {}) {
  const { error } = await supabaseAdmin
    .from('admin_audit_logs')
    .insert(payload)

  if (error) {
    console.warn('[commercial-pricing] Auditoria administrativa não registrada, sem bloquear operação.', {
      action: payload?.action,
      error: error.message,
    })
  }
}

async function getRowsByIds(table, ids, columns = '*') {
  const cleanIds = uniqueValues(ids)

  if (cleanIds.length === 0) return new Map()

  const { data, error } = await supabaseAdmin
    .from(table)
    .select(columns)
    .in('id', cleanIds)

  if (error) {
    throw new ApiError(500, `Erro ao carregar registros auxiliares de ${table}.`, {
      table,
      error: error.message,
    })
  }

  return new Map((data || []).map((row) => [row.id, row]))
}

async function getAssetById(assetId) {
  if (!assetId) throw new ApiError(400, 'Produto obrigatório para consulta de preço.')

  const { data, error } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, combination_id, batch_id, companion_id, media_type, status, max_assignments, current_assignments, metadata, created_at, updated_at')
    .eq('id', assetId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar produto para consulta de preço.', error)
  }

  if (!data) throw new ApiError(404, 'Produto não encontrado para consulta de preço.')

  return data
}

async function getCombinationById(combinationId) {
  if (!combinationId) return null

  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select('id, companion_id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, guided_selections, metadata, created_at, updated_at')
    .eq('id', combinationId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar assinatura do produto para preço.', error)
  }

  return data || null
}

async function getBatchById(batchId) {
  if (!batchId) return null

  const { data, error } = await supabaseAdmin
    .from(BATCHES_TABLE)
    .select('id, title, status, metadata, created_at, updated_at')
    .eq('id', batchId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar lote do produto para preço.', error)
  }

  return data || null
}

async function getCompanionById(companionId) {
  if (!companionId) return null

  const { data, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, slug, avatar_url, thumbnail_url')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar avatar para preço.', error)
  }

  return data || null
}

async function getGlobalPricingRule(mediaType) {
  const aliases = mediaTypeAliases(mediaType)
  const candidates = aliases.length > 0 ? aliases : [mediaType].filter(Boolean)

  for (const candidate of candidates) {
    const { data, error } = await supabaseAdmin
      .from(PRICING_RULES_TABLE)
      .select('media_kind, base_cost_credits, is_active')
      .eq('media_kind', candidate)
      .eq('is_active', true)
      .maybeSingle()

    if (error) {
      console.warn('[commercial-pricing] Regra global de preço indisponível. Seguindo sem fallback global.', {
        mediaType,
        error: error.message,
      })
      return null
    }

    const credits = Number(data?.base_cost_credits || 0)
    if (Number.isInteger(credits) && credits > 0) {
      return {
        credits,
        mediaKind: data.media_kind,
      }
    }
  }

  return null
}

function buildPriceResolution({ asset, companion, combination, batch, source, configuredPrice }) {
  const credits = Number(configuredPrice?.credits || 0)
  const configured = Number.isInteger(credits) && credits > 0

  return {
    assetId: asset?.id || null,
    companion: companion
      ? {
          id: companion.id,
          name: companion.name || null,
          slug: companion.slug || null,
          avatarUrl: companion.avatar_url || null,
          thumbnailUrl: companion.thumbnail_url || null,
        }
      : asset?.companion_id
        ? { id: asset.companion_id }
        : null,
    product: asset
      ? {
          id: asset.id,
          status: asset.status || null,
          mediaType: asset.media_type || combination?.media_type || null,
          currentAssignments: Number(asset.current_assignments || 0),
          maxAssignments: Number(asset.max_assignments || 1),
        }
      : null,
    combination: combination
      ? {
          id: combination.id,
          key: combination.combination_key || null,
          title: combination.title || null,
          mediaType: combination.media_type || asset?.media_type || null,
          priceCredits: Number(combination.price_credits || 0),
          visibleToClient: combination.visible_to_client ?? false,
          adminOnly: combination.admin_only ?? true,
          isActive: combination.is_active ?? true,
        }
      : asset?.combination_id
        ? { id: asset.combination_id }
        : null,
    batch: batch
      ? {
          id: batch.id,
          title: batch.title || null,
          status: batch.status || null,
        }
      : asset?.batch_id
        ? { id: asset.batch_id }
        : null,
    price: {
      credits,
      isConfigured: configured,
      sellable: configured,
      source,
      sourceLabel: source === 'asset_individual'
        ? 'Preço individual do produto'
        : source === 'combination'
          ? 'Preço da combinação'
          : source === 'batch'
            ? 'Preço do lote'
            : source === 'global_rule'
              ? 'Preço padrão global'
              : 'Preço não configurado',
      note: configuredPrice?.note || null,
      configuredAt: configuredPrice?.configuredAt || null,
      configuredByProfileId: configuredPrice?.configuredByProfileId || null,
    },
    guard: {
      blocksSale: !configured,
      reason: configured ? null : 'Preço não configurado para venda.',
    },
    hierarchy: [
      'asset_individual',
      'combination',
      'batch',
      'global_rule',
    ],
  }
}

export async function resolveCommercialPriceForAsset({ assetId } = {}) {
  const asset = await getAssetById(assetId)
  const combination = await getCombinationById(asset.combination_id)
  const batch = await getBatchById(asset.batch_id)
  const companion = await getCompanionById(asset.companion_id || combination?.companion_id)

  const assetPrice = getMetadataPrice(asset.metadata, ['commercialPricing', 'individualPricing', 'assetPricing'])
  if (assetPrice) {
    return buildPriceResolution({
      asset,
      companion,
      combination,
      batch,
      source: 'asset_individual',
      configuredPrice: assetPrice,
    })
  }

  const combinationMetadataPrice = getMetadataPrice(combination?.metadata, ['commercialPricing', 'combinationPricing'])
  const combinationColumnPrice = Number(combination?.price_credits || 0)
  if (Number.isInteger(combinationColumnPrice) && combinationColumnPrice > 0) {
    return buildPriceResolution({
      asset,
      companion,
      combination,
      batch,
      source: 'combination',
      configuredPrice: {
        credits: combinationColumnPrice,
        note: combinationMetadataPrice?.note || null,
        configuredAt: combinationMetadataPrice?.configuredAt || combination?.updated_at || null,
        configuredByProfileId: combinationMetadataPrice?.configuredByProfileId || null,
      },
    })
  }

  if (combinationMetadataPrice) {
    return buildPriceResolution({
      asset,
      companion,
      combination,
      batch,
      source: 'combination',
      configuredPrice: combinationMetadataPrice,
    })
  }

  const batchPrice = getMetadataPrice(batch?.metadata, ['commercialPricing', 'batchPricing', 'lotPricing'])
  if (batchPrice) {
    return buildPriceResolution({
      asset,
      companion,
      combination,
      batch,
      source: 'batch',
      configuredPrice: batchPrice,
    })
  }

  const globalPrice = await getGlobalPricingRule(asset.media_type || combination?.media_type)
  if (globalPrice) {
    return buildPriceResolution({
      asset,
      companion,
      combination,
      batch,
      source: 'global_rule',
      configuredPrice: {
        credits: globalPrice.credits,
        note: `Regra global media_kind=${globalPrice.mediaKind}`,
      },
    })
  }

  return buildPriceResolution({
    asset,
    companion,
    combination,
    batch,
    source: 'not_configured',
    configuredPrice: null,
  })
}

export async function listCommercialPricingAudit({
  companionId = null,
  mediaType = null,
  status = 'available',
  limit = 80,
  offset = 0,
} = {}) {
  const safeLimit = normalizePositiveInteger(limit, 80, 200)
  const safeOffset = normalizeOffset(offset)
  const safeMediaType = normalizeMediaType(mediaType)
  const mediaAliases = mediaTypeAliases(safeMediaType)

  let query = supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id, combination_id, batch_id, companion_id, media_type, status, max_assignments, current_assignments, metadata, created_at, updated_at')
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1)

  const safeStatus = String(status || 'available').trim().toLowerCase()
  if (safeStatus && safeStatus !== 'all') {
    if (safeStatus === 'available') query = query.in('status', ['available', 'sold'])
    else query = query.eq('status', safeStatus)
  }

  if (companionId) query = query.eq('companion_id', companionId)
  if (mediaAliases.length === 1) query = query.eq('media_type', mediaAliases[0])
  if (mediaAliases.length > 1) query = query.in('media_type', mediaAliases)

  const { data: assets, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao auditar precificação comercial.', error)
  }

  const items = []
  for (const asset of assets || []) {
    const resolution = await resolveCommercialPriceForAsset({ assetId: asset.id })
    items.push(resolution)
  }

  return {
    items,
    summary: {
      total: items.length,
      configured: items.filter((item) => item.price.isConfigured).length,
      missingPrice: items.filter((item) => !item.price.isConfigured).length,
      bySource: items.reduce((acc, item) => {
        acc[item.price.source] = Number(acc[item.price.source] || 0) + 1
        return acc
      }, {}),
    },
    pagination: {
      limit: safeLimit,
      offset: safeOffset,
      returned: items.length,
      hasMore: (assets || []).length === safeLimit,
    },
  }
}

export async function updateAssetCommercialPrice(assetId, input = {}, { actorProfileId = null } = {}) {
  const priceCredits = normalizePriceCredits(input.priceCredits ?? input.price_credits ?? input.credits, { allowZero: true })
  const isActive = normalizeBoolean(input.isActive ?? input.active, priceCredits > 0)
  const now = new Date().toISOString()
  const asset = await getAssetById(assetId)
  const beforeMetadata = safeObject(asset.metadata)
  const commercialPricing = buildCommercialPricingPayload({
    priceCredits,
    isActive,
    note: input.note || input.observation || null,
    actorProfileId,
    scope: 'asset_individual',
    source: 'admin_asset_individual_price',
  })

  const { data, error } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .update({
      metadata: {
        ...beforeMetadata,
        commercialPricing,
      },
      updated_at: now,
    })
    .eq('id', asset.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar preço individual do produto.', error)
  }

  await insertAdminAuditLogSoft({
    actor_profile_id: actorProfileId || null,
    action: 'factory.product.price.asset.update',
    entity_type: ASSETS_TABLE,
    entity_id: asset.id,
    before_payload: { metadata: beforeMetadata },
    after_payload: { commercialPricing, updatedAsset: data },
    reason: 'admin_update_asset_individual_price',
  })

  return resolveCommercialPriceForAsset({ assetId: asset.id })
}

export async function updateCombinationCommercialPrice(combinationId, input = {}, { actorProfileId = null } = {}) {
  if (!combinationId) throw new ApiError(400, 'Combinação obrigatória para atualizar preço.')

  const priceCredits = normalizePriceCredits(input.priceCredits ?? input.price_credits ?? input.credits, { allowZero: true })
  const isActive = normalizeBoolean(input.isActive ?? input.active, priceCredits > 0)
  const now = new Date().toISOString()
  const combination = await getCombinationById(combinationId)

  if (!combination) throw new ApiError(404, 'Combinação não encontrada para atualizar preço.')

  const beforeMetadata = safeObject(combination.metadata)
  const commercialPricing = buildCommercialPricingPayload({
    priceCredits,
    isActive,
    note: input.note || input.observation || null,
    actorProfileId,
    scope: 'combination',
    source: 'admin_combination_price',
  })

  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .update({
      price_credits: priceCredits,
      metadata: {
        ...beforeMetadata,
        commercialPricing,
      },
      updated_at: now,
    })
    .eq('id', combination.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar preço da combinação.', error)
  }

  await insertAdminAuditLogSoft({
    actor_profile_id: actorProfileId || null,
    action: 'factory.product.price.combination.update',
    entity_type: COMBINATIONS_TABLE,
    entity_id: combination.id,
    before_payload: {
      priceCredits: combination.price_credits,
      metadata: beforeMetadata,
    },
    after_payload: { commercialPricing, updatedCombination: data },
    reason: 'admin_update_combination_price',
  })

  const { data: firstAsset, error: assetError } = await supabaseAdmin
    .from(ASSETS_TABLE)
    .select('id')
    .eq('combination_id', combination.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (assetError) {
    throw new ApiError(500, 'Preço atualizado, mas falhou ao montar retorno da combinação.', assetError)
  }

  return firstAsset?.id
    ? resolveCommercialPriceForAsset({ assetId: firstAsset.id })
    : {
        combinationId: combination.id,
        price: {
          credits: priceCredits,
          isConfigured: priceCredits > 0 && isActive,
          sellable: priceCredits > 0 && isActive,
          source: 'combination',
          sourceLabel: 'Preço da combinação',
        },
      }
}

export async function updateBatchCommercialPrice(batchId, input = {}, { actorProfileId = null } = {}) {
  if (!batchId) throw new ApiError(400, 'Lote obrigatório para atualizar preço.')

  const priceCredits = normalizePriceCredits(input.priceCredits ?? input.price_credits ?? input.credits, { allowZero: true })
  const isActive = normalizeBoolean(input.isActive ?? input.active, priceCredits > 0)
  const now = new Date().toISOString()
  const batch = await getBatchById(batchId)

  if (!batch) throw new ApiError(404, 'Lote não encontrado para atualizar preço.')

  const beforeMetadata = safeObject(batch.metadata)
  const commercialPricing = buildCommercialPricingPayload({
    priceCredits,
    isActive,
    note: input.note || input.observation || null,
    actorProfileId,
    scope: 'batch',
    source: 'admin_batch_price',
  })

  const { data, error } = await supabaseAdmin
    .from(BATCHES_TABLE)
    .update({
      metadata: {
        ...beforeMetadata,
        commercialPricing,
      },
      updated_at: now,
    })
    .eq('id', batch.id)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar preço do lote.', error)
  }

  await insertAdminAuditLogSoft({
    actor_profile_id: actorProfileId || null,
    action: 'factory.product.price.batch.update',
    entity_type: BATCHES_TABLE,
    entity_id: batch.id,
    before_payload: { metadata: beforeMetadata },
    after_payload: { commercialPricing, updatedBatch: data },
    reason: 'admin_update_batch_price',
  })

  return {
    batchId: batch.id,
    price: {
      credits: priceCredits,
      isConfigured: priceCredits > 0 && isActive,
      sellable: priceCredits > 0 && isActive,
      source: 'batch',
      sourceLabel: 'Preço do lote',
    },
  }
}
