import { createHash } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { getActorProfileByAuthenticatedProfile } from './actor-auth.service.js'
import { isArchivedDemoOrTestRow } from './demo-test-hygiene.service.js'
import { deleteObject, uploadKycAssetToVault } from './storage.service.js'
import {
  buildDynamicMappingChecklist,
  getMappingRequirementOrThrow,
  isMimeTypeAllowedForRequirement,
  listActiveMappingRequirements,
} from './mapping-requirements.service.js'

const ACTOR_ROLE = 'atriz'
const KYC_CASES_TABLE = 'actor_kyc_cases'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'
const DELIVERIES_TABLE = 'user_media_deliveries'
const PAYOUT_METHODS_TABLE = 'actor_payout_method_requests'
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024


function nowIso() {
  return new Date().toISOString()
}

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function safeNumber(value) {
  const parsed = Number(value || 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function assertActorRole(profile = {}) {
  if (profile?.role !== ACTOR_ROLE) {
    throw new ApiError(403, 'Acesso permitido apenas ao Painel da Atriz.')
  }
}

function normalizeMediaType(value) {
  const raw = String(value || '').trim().toLowerCase()

  if (['image', 'imagem', 'photo', 'picture', 'img'].includes(raw)) return 'image'
  if (['audio', 'audio_live', 'live_audio', 'voice', 'tts'].includes(raw)) return 'audio'
  if (['video', 'short_video'].includes(raw)) return 'video'
  if (['live_action', 'live-action'].includes(raw)) return 'liveAction'

  return raw || 'image'
}


function normalizeContentType(value) {
  return String(value || '').trim().toLowerCase().split(';')[0]
}

function inferContentTypeFromFilename(filename, fallback = 'application/octet-stream', expectedMediaType = null) {
  const clean = String(filename || '').toLowerCase()
  if (clean.endsWith('.jpg') || clean.endsWith('.jpeg')) return 'image/jpeg'
  if (clean.endsWith('.png')) return 'image/png'
  if (clean.endsWith('.webp')) return 'image/webp'
  if (clean.endsWith('.pdf')) return 'application/pdf'
  if (clean.endsWith('.mp3')) return 'audio/mpeg'
  if (clean.endsWith('.wav')) return 'audio/wav'
  if (clean.endsWith('.webm')) return expectedMediaType === 'video' ? 'video/webm' : 'audio/webm'
  if (clean.endsWith('.m4a')) return 'audio/mp4'
  if (clean.endsWith('.mp4')) return expectedMediaType === 'video' ? 'video/mp4' : 'audio/mp4'
  if (clean.endsWith('.mov')) return 'video/quicktime'
  if (clean.endsWith('.ogg')) return 'audio/ogg'
  return fallback
}

function normalizeBase64(value) {
  const raw = String(value || '').trim()
  const commaIndex = raw.indexOf(',')
  const payload = raw.startsWith('data:') && commaIndex >= 0 ? raw.slice(commaIndex + 1) : raw
  return payload.replace(/\s/g, '')
}

function estimateBase64Bytes(base64) {
  const normalized = normalizeBase64(base64)
  if (!normalized) return 0
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0
  return Math.floor((normalized.length * 3) / 4) - padding
}

function detectContentType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg'
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf'
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE') return 'audio/wav'
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg'
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3') return 'audio/mpeg'
  if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) return 'audio/mpeg'
  if (buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'application/webm'
  if (buffer.length >= 12 && buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'application/mp4'

  return null
}

function contentTypesCompatible(declaredContentType, detectedContentType) {
  if (declaredContentType === detectedContentType) return true
  if (declaredContentType === 'audio/x-wav' && detectedContentType === 'audio/wav') return true
  if (detectedContentType === 'application/mp4' && ['audio/mp4', 'video/mp4'].includes(declaredContentType)) return true
  if (detectedContentType === 'application/webm' && ['audio/webm', 'video/webm'].includes(declaredContentType)) return true
  return false
}

function sanitizeFilename(value, fallback = 'material') {
  const safe = String(value || fallback)
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-zA-Z0-9._ -]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  return (safe || fallback).slice(0, 160)
}

function mapActor(actor = {}) {
  return {
    id: actor.id,
    profileId: actor.profile_id || null,
    displayName: actor.display_name || 'Atriz',
    status: actor.status || 'draft',
    kycStatus: actor.kyc_status || 'not_started',
    productionStatus: actor.production_status || 'not_authorized',
    updatedAt: actor.updated_at || null,
  }
}

function mapKycCase(row = {}) {
  return {
    id: row.id,
    status: row.status || 'pending_review',
    caseType: row.case_type || 'avatar_mapping',
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    rejectionReason: row.rejection_reason || null,
    updatedAt: row.updated_at || null,
  }
}

function mapKycAsset(row = {}) {
  return {
    id: row.id,
    caseId: row.kyc_case_id || null,
    mappingRequirementId: row.mapping_requirement_id || null,
    assetType: row.asset_type || null,
    status: row.status || 'uploaded',
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    originalFilename: row.original_filename || null,
    contentType: row.content_type || null,
    byteSize: safeNumber(row.byte_size),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function isPublishedProduct(row = {}) {
  const metadata = safeObject(row.metadata)
  const publication = safeObject(metadata.productPublication || metadata.publication || metadata.clientPublication)
  const status = String(publication.status || '').toLowerCase()

  if (status === 'hidden') return false
  if (status === 'published' || publication.published === true) return true

  return row.visible_to_client === true && row.admin_only !== true && row.is_active !== false
}

function readMediaPayoutRule(actorMetadata = {}, mediaType = 'image') {
  const finance = safeObject(actorMetadata.finance)
  const mediaRules = safeObject(finance.mediaTypePayouts || finance.mediaTypeSplits)
  const normalizedType = normalizeMediaType(mediaType)
  const rule = safeObject(mediaRules[normalizedType])
  const rawBps = rule.payoutRateBps ?? rule.actorShareBps ?? rule.bps
  const rawPercent = rule.payoutPercent ?? rule.actorPercent ?? rule.percent

  let bps = safeNumber(rawBps)
  if (!bps && rawPercent !== undefined && rawPercent !== null) {
    bps = safeNumber(rawPercent) * 100
  }

  if (!bps) {
    bps = safeNumber(finance.payoutRateBps || finance.actorShareBps)
  }

  if (!bps && finance.payoutPercent !== undefined && finance.payoutPercent !== null) {
    bps = safeNumber(finance.payoutPercent) * 100
  }

  const normalizedBps = Math.min(Math.max(Math.round(bps), 0), 10000)

  return {
    mediaType: normalizedType,
    payoutRateBps: normalizedBps,
    payoutPercent: Math.round((normalizedBps / 100) * 100) / 100,
    configured: normalizedBps > 0,
  }
}

async function getActorContext(profile) {
  assertActorRole(profile)
  const actor = await getActorProfileByAuthenticatedProfile(profile.id)

  const { data: authorizations, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('id, companion_id, status, starts_at, ends_at, authorized_for_content_types')
    .eq('actor_profile_id', actor.id)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao carregar vínculos autorizados da atriz.', error)
  }

  const activeAuthorizations = (authorizations || []).filter((item) => item.status === 'active')
  const companionIds = [...new Set(activeAuthorizations.map((item) => item.companion_id).filter(Boolean))]

  return {
    actor,
    activeAuthorizations,
    companionIds,
  }
}

async function loadKycSnapshot(actorId) {
  const [{ data: cases, error: caseError }, { data: assets, error: assetError }] = await Promise.all([
    supabaseAdmin
      .from(KYC_CASES_TABLE)
      .select('id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
      .eq('actor_profile_id', actorId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('id, kyc_case_id, mapping_requirement_id, asset_type, status, rejection_reason, reviewed_at, original_filename, content_type, byte_size, created_at, updated_at')
      .eq('actor_profile_id', actorId)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  if (caseError) throw new ApiError(500, 'Erro ao carregar casos de mapeamento da atriz.', caseError)
  if (assetError) throw new ApiError(500, 'Erro ao carregar materiais do cofre privado.', assetError)

  const mappedCases = (cases || []).map(mapKycCase)
  const mappedAssets = (assets || []).map(mapKycAsset)
  const counts = mappedAssets.reduce((acc, item) => {
    acc[item.assetType] = (acc[item.assetType] || 0) + 1
    return acc
  }, {})

  return {
    latestCase: mappedCases[0] || null,
    cases: mappedCases,
    assets: mappedAssets,
    counts,
  }
}

async function loadPublishedProducts({ actorId }) {
  const columns = 'id, actor_profile_id, companion_id, combination_key, title, media_type, price_credits, visible_to_client, admin_only, is_active, metadata, created_at, updated_at'
  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select(columns)
    .eq('actor_profile_id', actorId)
    .order('updated_at', { ascending: false })

  if (error) throw new ApiError(500, 'Erro ao carregar produtos vinculados à atriz.', error)

  // Contenção obrigatória: nenhum fallback por companion. O vínculo canônico é actor_profile_id.
  const products = (data || []).filter((row) => (
    row.actor_profile_id === actorId &&
    !isArchivedDemoOrTestRow(row) &&
    isPublishedProduct(row)
  ))
  const combinationIds = products.map((item) => item.id)
  const variantCounts = new Map()
  const deliveryCounts = new Map()

  if (combinationIds.length > 0) {
    const [{ data: variants, error: variantsError }, { data: deliveries, error: deliveriesError }] = await Promise.all([
      supabaseAdmin
        .from(ASSETS_TABLE)
        .select('id, combination_id, status, media_type')
        .in('combination_id', combinationIds),
      supabaseAdmin
        .from(DELIVERIES_TABLE)
        .select('id, combination_id')
        .in('combination_id', combinationIds),
    ])

    if (variantsError) throw new ApiError(500, 'Erro ao carregar variações dos produtos da atriz.', variantsError)
    if (deliveriesError) throw new ApiError(500, 'Erro ao carregar vendas dos produtos da atriz.', deliveriesError)

    for (const variant of variants || []) {
      const current = variantCounts.get(variant.combination_id) || { total: 0, approved: 0 }
      current.total += 1
      if (['available', 'sold', 'approved'].includes(String(variant.status || '').toLowerCase())) current.approved += 1
      variantCounts.set(variant.combination_id, current)
    }

    for (const delivery of deliveries || []) {
      deliveryCounts.set(delivery.combination_id, (deliveryCounts.get(delivery.combination_id) || 0) + 1)
    }
  }

  return products.map((row) => {
    const variants = variantCounts.get(row.id) || { total: 0, approved: 0 }
    return {
      id: row.id,
      title: row.title || row.combination_key || 'Produto de IA',
      mediaType: normalizeMediaType(row.media_type),
      status: 'published',
      priceCredits: safeNumber(row.price_credits),
      approvedVariants: variants.approved,
      totalVariants: variants.total,
      totalDeliveries: deliveryCounts.get(row.id) || 0,
      clientVisible: true,
      updatedAt: row.updated_at || row.created_at || null,
    }
  })
}

async function loadPayoutMethod(actorId) {
  const { data, error } = await supabaseAdmin
    .from(PAYOUT_METHODS_TABLE)
    .select('id, status, payout_type, pix_key_masked, bank_name, account_last4, reviewed_at, updated_at')
    .eq('actor_profile_id', actorId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao carregar método de repasse da atriz.', error)

  if (!data) {
    return {
      configured: false,
      status: 'not_configured',
      type: null,
      pixKeyMasked: null,
      bankName: null,
      accountLast4: null,
      reviewedAt: null,
    }
  }

  return {
    configured: true,
    status: data.status || 'draft',
    type: data.payout_type || null,
    pixKeyMasked: data.pix_key_masked || null,
    bankName: data.bank_name || null,
    accountLast4: data.account_last4 || null,
    reviewedAt: data.reviewed_at || null,
  }
}

async function loadActorFinance({ actor }) {
  const { data: actorCombinations, error: combinationsError } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select('id, title, combination_key, media_type, companion_id')
    .eq('actor_profile_id', actor.id)

  if (combinationsError) throw new ApiError(500, 'Erro ao carregar produtos financeiros da atriz.', combinationsError)

  const safeCombinations = (actorCombinations || []).filter((item) => !isArchivedDemoOrTestRow(item))
  const combinationIds = safeCombinations.map((item) => item.id)
  const combinationsById = new Map(safeCombinations.map((item) => [item.id, item]))

  if (combinationIds.length === 0) {
    return {
      summary: {
        totalSales: 0,
        grossCredits: 0,
        netPayoutCredits: 0,
        platformCredits: 0,
        averageTicketCredits: 0,
        payoutLedgerAvailable: false,
        estimated: true,
      },
      splitRules: ['image', 'audio', 'video', 'liveAction'].map((mediaType) => readMediaPayoutRule(safeObject(actor.metadata), mediaType)),
      recentSales: [],
      payoutMethod: await loadPayoutMethod(actor.id),
    }
  }

  const { data: deliveries, error } = await supabaseAdmin
    .from(DELIVERIES_TABLE)
    .select('id, combination_id, total_price_credits, companion_credits_used, universal_credits_used, created_at')
    .in('combination_id', combinationIds)
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) throw new ApiError(500, 'Erro ao carregar vendas da atriz.', error)

  const safeDeliveries = (deliveries || []).filter((item) => !isArchivedDemoOrTestRow(item))
  const actorMetadata = safeObject(actor.metadata)
  const recentSales = safeDeliveries.map((delivery) => {
    const combination = combinationsById.get(delivery.combination_id) || null
    const mediaType = normalizeMediaType(delivery.media_type || combination?.media_type)
    const grossCredits = safeNumber(
      delivery.total_price_credits ||
      delivery.totalPriceCredits ||
      delivery.universal_credits_used ||
      delivery.companion_credits_used,
    )
    const split = readMediaPayoutRule(actorMetadata, mediaType)
    const netPayoutCredits = Math.round((grossCredits * split.payoutRateBps) / 10000)

    return {
      id: delivery.id,
      createdAt: delivery.created_at || null,
      productTitle: combination?.title || combination?.combination_key || 'Produto de IA',
      mediaType,
      grossCredits,
      payoutPercent: split.payoutPercent,
      netPayoutCredits,
      splitConfigured: split.configured,
    }
  })

  const grossCredits = recentSales.reduce((total, item) => total + item.grossCredits, 0)
  const netPayoutCredits = recentSales.reduce((total, item) => total + item.netPayoutCredits, 0)
  const mediaTypes = ['image', 'audio', 'video', 'liveAction']
  const splitRules = mediaTypes.map((mediaType) => readMediaPayoutRule(actorMetadata, mediaType))

  return {
    summary: {
      totalSales: recentSales.length,
      grossCredits,
      netPayoutCredits,
      platformCredits: Math.max(grossCredits - netPayoutCredits, 0),
      averageTicketCredits: recentSales.length ? Math.round((grossCredits / recentSales.length) * 100) / 100 : 0,
      payoutLedgerAvailable: false,
      estimated: true,
    },
    splitRules,
    recentSales: recentSales.slice(0, 100),
    payoutMethod: await loadPayoutMethod(actor.id),
  }
}

function buildCreatorRequirementItems(requirements = [], assets = []) {
  return requirements.map((requirement) => {
    const requirementAssets = assets
      .filter((asset) => asset.mappingRequirementId === requirement.id && asset.status !== 'archived')
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
    const latestAsset = requirementAssets[0] || null

    return {
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      mediaType: requirement.mediaType,
      mapping_category: requirement.mapping_category === 'premium' ? 'premium' : 'standard',
      isRequired: requirement.isRequired,
      isActive: requirement.isActive,
      acceptedMimeTypes: requirement.acceptedMimeTypes,
      accept: requirement.accept,
      createdAt: requirement.createdAt,
      updatedAt: requirement.updatedAt,
      status: latestAsset
        ? latestAsset.status === 'rejected'
          ? 'rejected'
          : latestAsset.status === 'approved'
            ? 'approved'
            : 'pending_review'
        : 'pending',
      rejectionReason: latestAsset?.rejectionReason || null,
      uploadedCount: requirementAssets.length,
      latestAsset,
    }
  })
}

export async function getCreatorMappingRequirements({ profile }) {
  const { actor } = await getActorContext(profile)
  const [kyc, requirements] = await Promise.all([
    loadKycSnapshot(actor.id),
    listActiveMappingRequirements(),
  ])

  return {
    actor: mapActor(actor),
    requirements: buildCreatorRequirementItems(requirements, kyc.assets),
    message: 'Requisitos ativos de mapeamento carregados conforme configuração do Admin.',
    safety: {
      actorScoped: true,
      inactiveRequirementsExposed: false,
      storagePointersExposed: false,
      publicUrlExposed: false,
    },
  }
}

export async function getCreatorMapping({ profile }) {
  const { actor } = await getActorContext(profile)
  const [kyc, requirements] = await Promise.all([
    loadKycSnapshot(actor.id),
    listActiveMappingRequirements(),
  ])
  const pendingMapping = actor.kyc_status !== 'approved'
  const checklist = buildDynamicMappingChecklist(requirements, kyc.assets, kyc.latestCase || {})

  return {
    actor: mapActor(actor),
    mapping: {
      status: actor.kyc_status || 'not_started',
      pendingMapping,
      latestCase: kyc.latestCase,
      cases: kyc.cases,
      assets: kyc.assets,
      requirements: buildCreatorRequirementItems(requirements, kyc.assets),
      checklist,
      uploadEnabled: requirements.length > 0,
      uploadMode: 'private_r2_vault',
      acceptedAssetTypes: requirements.map((item) => item.id),
      maxUploadBytes: MAX_UPLOAD_BYTES,
      nextStep: requirements.length === 0
        ? 'O Admin ainda não configurou requisitos ativos de mapeamento.'
        : pendingMapping
          ? 'Envie os materiais obrigatórios ao cofre privado para análise do Admin.'
          : 'Mapeamento aprovado. Novos materiais enviados retornam o caso para análise.',
    },
    warnings: requirements.length === 0 ? ['no_active_mapping_requirements'] : [],
    message: 'Mapeamento carregado pelo Read Model seguro do Creator Dashboard.',
    safety: {
      actorScoped: true,
      storagePointersExposed: false,
      publicUrlExposed: false,
      runPodActionsAvailable: false,
    },
  }
}

export async function getCreatorOverview({ profile }) {
  const { actor, activeAuthorizations } = await getActorContext(profile)
  const [kyc, products, finance, requirements] = await Promise.all([
    loadKycSnapshot(actor.id),
    loadPublishedProducts({ actorId: actor.id }),
    loadActorFinance({ actor }),
    listActiveMappingRequirements(),
  ])

  const checklist = buildDynamicMappingChecklist(requirements, kyc.assets, kyc.latestCase || {})
  const imageMaterials = kyc.assets.filter((item) => String(item.contentType || '').startsWith('image/')).length
  const audioMaterials = kyc.assets.filter((item) => String(item.contentType || '').startsWith('audio/')).length
  const pendencies = []

  if (actor.kyc_status !== 'approved') {
    pendencies.push({
      code: 'kyc_pending',
      title: 'Mapeamento em análise',
      description: 'O Admin precisa aprovar os materiais do cofre antes de liberar novas produções.',
      severity: 'warning',
      target: '/atriz/mapeamento',
    })
  }

  for (const missing of checklist.missingGroups) {
    pendencies.push({
      code: `mapping_requirement_${missing.requirementId}_missing`,
      title: `${missing.label} pendente`,
      description: missing.description || 'Envie o material solicitado pelo Admin para completar o mapeamento.',
      severity: 'critical',
      target: '/atriz/mapeamento',
    })
  }

  if (!finance.payoutMethod.configured || finance.payoutMethod.status !== 'approved') {
    pendencies.push({
      code: 'payout_method_pending',
      title: 'Método de repasse pendente',
      description: 'O método de recebimento ainda não foi aprovado pelo Admin.',
      severity: 'warning',
      target: '/atriz/financeiro',
    })
  }

  return {
    actor: mapActor(actor),
    overview: {
      receivableCredits: finance.summary.netPayoutCredits,
      grossSalesCredits: finance.summary.grossCredits,
      totalSales: finance.summary.totalSales,
      activeProducts: products.length,
      activeAuthorizations: activeAuthorizations.length,
      pendingSecurityItems: pendencies.length,
    },
    security: {
      kycStatus: actor.kyc_status || 'not_started',
      mappingCase: kyc.latestCase,
      materialCounts: {
        identityDocuments: 0,
        facePhotos: imageMaterials,
        voiceAudios: audioMaterials,
      },
      dynamicChecklist: checklist,
      pendencies,
    },
    recentSales: finance.recentSales.slice(0, 5),
    safety: {
      actorScoped: true,
      runPodActionsAvailable: false,
      productionActionsAvailable: false,
      otherActorDataVisible: false,
      payoutIsEstimate: true,
    },
  }
}

export async function getCreatorProducts({ profile }) {
  const { actor } = await getActorContext(profile)
  const products = await loadPublishedProducts({ actorId: actor.id })

  return {
    actor: mapActor(actor),
    summary: {
      activeProducts: products.length,
      totalDeliveries: products.reduce((total, item) => total + item.totalDeliveries, 0),
      totalApprovedVariants: products.reduce((total, item) => total + item.approvedVariants, 0),
    },
    products,
    safety: {
      readOnly: true,
      canEditPrice: false,
      canPublish: false,
      canGenerateMedia: false,
      storagePointersExposed: false,
    },
  }
}

export async function getCreatorFinance({ profile }) {
  const { actor } = await getActorContext(profile)
  const finance = await loadActorFinance({ actor })

  return {
    actor: mapActor(actor),
    ...finance,
    guidance: {
      currency: 'credits',
      grossDefinition: 'Créditos cobrados nas entregas vinculadas aos produtos cujo actor_profile_id pertence à atriz autenticada.',
      netDefinition: 'Estimativa calculada com a regra vigente de split por tipo de mídia.',
      payoutStatus: 'O fechamento contábil e o pagamento real ainda dependem do ledger de repasses.',
    },
    safety: {
      actorScoped: true,
      payoutMutationAvailable: false,
      walletMutationAvailable: false,
      clientIdentityExposed: false,
    },
  }
}

async function getOrCreateOpenMappingCase({ actor, profileId }) {
  const { data: existingCase, error: existingError } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('*')
    .eq('actor_profile_id', actor.id)
    .in('status', ['draft', 'pending_review'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingError) throw new ApiError(500, 'Erro ao localizar caso de mapeamento.', existingError)
  if (existingCase) return existingCase

  const now = nowIso()
  const { data: createdCase, error: createError } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .insert({
      actor_profile_id: actor.id,
      case_type: 'avatar_mapping',
      status: 'pending_review',
      submitted_at: now,
      notes: 'Mapeamento iniciado pelo Painel da Atriz.',
      metadata: {
        source: 'creator_dashboard_private_vault',
        actorInitiated: true,
        privateUploadEnabled: true,
      },
      created_by_profile_id: profileId,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (createError) throw new ApiError(500, 'Erro ao criar caso de mapeamento.', createError)
  return createdCase
}

export async function uploadCreatorMappingAsset({ profile, input = {} }) {
  const { actor } = await getActorContext(profile)
  const requirement = await getMappingRequirementOrThrow(
    input.mappingRequirementId || input.mapping_requirement_id,
    { activeOnly: true },
  )
  const requestedContentType = normalizeContentType(input.contentType || input.content_type)
  const contentType = requestedContentType && requestedContentType !== 'application/octet-stream'
    ? requestedContentType
    : inferContentTypeFromFilename(input.originalFilename || input.original_filename, 'application/octet-stream', requirement.mediaType)

  if (!isMimeTypeAllowedForRequirement(requirement, contentType)) {
    throw new ApiError(400, `Formato de arquivo não permitido para ${requirement.title}.`)
  }

  const base64 = String(input.base64 || '')
  const estimatedBytes = estimateBase64Bytes(base64)

  if (!base64) throw new ApiError(400, 'Arquivo obrigatório para envio ao cofre privado.')
  if (estimatedBytes <= 0) throw new ApiError(400, 'Arquivo vazio ou inválido.')
  if (estimatedBytes > MAX_UPLOAD_BYTES) throw new ApiError(413, 'O arquivo deve ter no máximo 25 MB.')

  const buffer = Buffer.from(normalizeBase64(base64), 'base64')
  const detectedContentType = detectContentType(buffer)

  if (!detectedContentType || !contentTypesCompatible(contentType, detectedContentType)) {
    throw new ApiError(400, 'O conteúdo real do arquivo não corresponde ao formato declarado.')
  }

  const checksumSha256 = createHash('sha256').update(buffer).digest('hex')

  const { data: duplicate, error: duplicateError } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('id, kyc_case_id, mapping_requirement_id, asset_type, status, rejection_reason, reviewed_at, original_filename, content_type, byte_size, created_at, updated_at')
    .eq('actor_profile_id', actor.id)
    .eq('mapping_requirement_id', requirement.id)
    .eq('checksum_sha256', checksumSha256)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (duplicateError) throw new ApiError(500, 'Erro ao verificar material duplicado.', duplicateError)

  if (duplicate) {
    const { data: duplicateCase, error: duplicateCaseError } = await supabaseAdmin
      .from(KYC_CASES_TABLE)
      .select('id, case_type, status, submitted_at, reviewed_at, rejection_reason, created_at, updated_at')
      .eq('id', duplicate.kyc_case_id)
      .eq('actor_profile_id', actor.id)
      .maybeSingle()

    if (duplicateCaseError) throw new ApiError(500, 'Erro ao carregar o caso do material duplicado.', duplicateCaseError)

    return {
      actor: mapActor(actor),
      mappingCase: mapKycCase(duplicateCase || { id: duplicate.kyc_case_id, status: duplicate.status }),
      asset: mapKycAsset(duplicate),
      duplicate: true,
      message: 'Este arquivo já estava registrado para o requisito selecionado.',
      safety: {
        privateVaultOnly: true,
        publicUrlCreated: false,
        actorScoped: true,
        runPodCalled: false,
      },
    }
  }

  const mappingCase = await getOrCreateOpenMappingCase({ actor, profileId: profile.id })
  const originalFilename = sanitizeFilename(input.originalFilename || input.original_filename, `material-${requirement.mediaType}.bin`)
  const vaultResult = await uploadKycAssetToVault({
    buffer,
    actorProfileId: actor.id,
    kycCaseId: mappingCase.id,
    assetType: `mapping_requirement_${requirement.id}`,
    contentType,
    metadata: {
      original_filename: originalFilename,
      created_by_profile_id: profile.id,
      source: 'creator_dashboard_private_vault',
      mapping_requirement_id: requirement.id,
      mapping_requirement_title: requirement.title,
      mapping_media_type: requirement.mediaType,
    },
    dryRunOnly: false,
  })

  const now = nowIso()
  const { data: createdAsset, error: assetError } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .insert({
      kyc_case_id: mappingCase.id,
      actor_profile_id: actor.id,
      mapping_requirement_id: requirement.id,
      asset_type: null,
      r2_bucket: vaultResult.bucket,
      r2_key: vaultResult.key,
      original_filename: originalFilename,
      content_type: contentType,
      byte_size: vaultResult.byteSize,
      checksum_sha256: checksumSha256,
      status: 'pending_review',
      rejection_reason: null,
      reviewed_at: null,
      reviewer_profile_id: null,
      metadata: {
        source: 'creator_dashboard_private_vault',
        privateVaultOnly: true,
        publicUrlCreated: false,
        mappingRequirement: {
          id: requirement.id,
          title: requirement.title,
          mediaType: requirement.mediaType,
          isRequired: requirement.isRequired,
          systemTag: requirement.systemTag || null,
        },
        vault: {
          etag: vaultResult.etag || null,
          versionId: vaultResult.versionId || null,
        },
      },
      created_by_profile_id: profile.id,
      created_at: now,
      updated_at: now,
    })
    .select('id, kyc_case_id, mapping_requirement_id, asset_type, status, rejection_reason, reviewed_at, original_filename, content_type, byte_size, created_at, updated_at')
    .single()

  if (assetError) {
    try {
      await deleteObject(vaultResult.bucket, vaultResult.key)
    } catch {
      // A falha de compensação será registrada pelo erro principal sem expor a chave privada ao cliente.
    }
    throw new ApiError(500, 'Não foi possível concluir o registro seguro do material.', assetError)
  }

  const [{ error: caseUpdateError }, { error: actorUpdateError }] = await Promise.all([
    supabaseAdmin
      .from(KYC_CASES_TABLE)
      .update({
        status: 'pending_review',
        submitted_at: mappingCase.submitted_at || now,
        reviewed_at: null,
        rejection_reason: null,
        updated_at: now,
      })
      .eq('id', mappingCase.id),
    supabaseAdmin
      .from('actor_profiles')
      .update({
        status: actor.status === 'approved' ? 'approved' : 'kyc_pending',
        kyc_status: 'pending_review',
        updated_by_profile_id: profile.id,
        updated_at: now,
      })
      .eq('id', actor.id),
  ])

  if (caseUpdateError) throw new ApiError(500, 'Material registrado, mas o caso não pôde ser atualizado.', caseUpdateError)
  if (actorUpdateError) throw new ApiError(500, 'Material registrado, mas o status da atriz não pôde ser atualizado.', actorUpdateError)

  return {
    actor: mapActor({ ...actor, kyc_status: 'pending_review' }),
    mappingCase: mapKycCase({ ...mappingCase, status: 'pending_review', updated_at: now }),
    asset: mapKycAsset(createdAsset),
    duplicate: false,
    message: 'Material enviado ao cofre privado e encaminhado para análise do Admin.',
    safety: {
      privateVaultOnly: true,
      publicUrlCreated: false,
      actorScoped: true,
      runPodCalled: false,
    },
  }
}
