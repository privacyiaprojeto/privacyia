import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const TABLE = 'mapping_requirements'
const MEDIA_TYPES = new Set(['image', 'audio', 'video'])
const SYSTEM_TAGS = new Set([
  'face_front',
  'face_profile',
  'face_profile_left',
  'face_profile_right',
  'body_front',
  'body_back',
  'nsfw_front',
  'nsfw_back',
  'nsfw_closeup_front',
  'nsfw_closeup_back',
  'voice_natural',
  'voice_whisper',
  'voice_affectionate',
  'nsfw_voice_moan',
  'video_expression',
  'video_walk',
])

const ACCEPTED_MIME_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  audio: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg'],
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
}

const DEFAULT_GUIDANCE_BY_SYSTEM_TAG = Object.freeze({
  face_front: 'Envie uma selfie frontal, com todo o rosto visível, câmera na altura dos olhos e expressão natural. Fique de frente para uma fonte de luz suave e nunca deixe a luz principal atrás de você. Não use filtros que alterem seus traços.',
  face_profile: 'Envie uma foto lateral nítida, com todo o contorno do rosto visível e sem filtros que alterem sua identidade.',
  face_profile_left: 'Vire o lado esquerdo do rosto para a câmera. Mantenha cabelo, acessórios e sombras sem esconder olhos, nariz, boca ou contorno facial.',
  face_profile_right: 'Vire o lado direito do rosto para a câmera. Mantenha cabelo, acessórios e sombras sem esconder olhos, nariz, boca ou contorno facial.',
  body_front: 'Envie uma foto de corpo inteiro de frente, com a câmera estável, boa iluminação e o corpo totalmente dentro do enquadramento.',
  body_back: 'Envie uma foto de corpo inteiro de costas, com a câmera estável, boa iluminação e o corpo totalmente dentro do enquadramento.',
  nsfw_front: 'Envie somente o material 18+ solicitado e autorizado, sem outras pessoas, sem documentos ou dados pessoais visíveis e com enquadramento claro. O arquivo ficará em armazenamento privado.',
  nsfw_back: 'Envie somente o material 18+ solicitado e autorizado, sem outras pessoas, sem documentos ou dados pessoais visíveis e com enquadramento claro. O arquivo ficará em armazenamento privado.',
  nsfw_closeup_front: 'Siga exatamente a orientação aprovada pelo Admin para este material 18+. Não inclua terceiros nem informações pessoais no enquadramento.',
  nsfw_closeup_back: 'Siga exatamente a orientação aprovada pelo Admin para este material 18+. Não inclua terceiros nem informações pessoais no enquadramento.',
  voice_natural: 'Grave em ambiente silencioso, falando com sua voz natural, sem música, eco ou efeitos. Mantenha o microfone a uma distância constante.',
  voice_whisper: 'Grave em ambiente silencioso, com voz baixa e clara, sem música, eco ou efeitos. Evite encostar ou soprar diretamente no microfone.',
  voice_affectionate: 'Leia o texto solicitado com entonação acolhedora e natural, em ambiente silencioso e sem aplicar efeitos na voz.',
  nsfw_voice_moan: 'Grave somente o áudio 18+ solicitado e autorizado, sem vozes de terceiros, música ou efeitos. Use um ambiente silencioso e preserve sua voz natural.',
  video_expression: 'Grave um vídeo curto com o rosto inteiro visível, câmera estável e boa iluminação. Faça expressões naturais e movimentos leves de cabeça, sem filtros.',
  video_walk: 'Grave um vídeo de corpo inteiro caminhando em ritmo natural. Mantenha a câmera estável, o corpo dentro do quadro e evite contraluz.',
})

const DEFAULT_GUIDANCE_BY_MEDIA_TYPE = Object.freeze({
  image: 'Envie uma imagem nítida, bem iluminada, sem filtros que alterem sua identidade e sem outras pessoas no enquadramento.',
  audio: 'Grave em ambiente silencioso, sem música ou efeitos, mantendo o volume e a distância do microfone constantes.',
  video: 'Grave com câmera estável, boa iluminação, sem filtros e mantendo a área solicitada completamente visível.',
})

function buildRequirementGuidance({ description, systemTag, mediaType }) {
  const customDescription = String(description || '').trim()
  if (customDescription) return customDescription
  return DEFAULT_GUIDANCE_BY_SYSTEM_TAG[systemTag]
    || DEFAULT_GUIDANCE_BY_MEDIA_TYPE[mediaType]
    || 'Siga a orientação informada pelo Admin e envie somente material próprio e autorizado.'
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeMediaType(value) {
  const mediaType = String(value || '').trim().toLowerCase()
  if (!MEDIA_TYPES.has(mediaType)) {
    throw new ApiError(422, 'Tipo de mídia inválido. Use image, audio ou video.')
  }
  return mediaType
}

function normalizeSystemTag(value) {
  if (value === undefined) return undefined
  if (value === null || String(value).trim() === '') return null

  const systemTag = String(value).trim().toLowerCase()
  if (!SYSTEM_TAGS.has(systemTag)) {
    throw new ApiError(422, 'Tag de sistema inválida. Escolha uma opção disponível no painel.')
  }

  return systemTag
}

function deriveMappingCategory(systemTag) {
  return String(systemTag || '').trim().toLowerCase().includes('nsfw')
    ? 'premium'
    : 'standard'
}

function mapRequirement(row = {}, { includeSystemTag = false } = {}) {
  const mediaType = normalizeMediaType(row.media_type)

  return {
    id: row.id,
    title: row.title || 'Requisito de mapeamento',
    description: row.description || '',
    guidance: buildRequirementGuidance({
      description: row.description,
      systemTag: row.system_tag,
      mediaType,
    }),
    mediaType,
    mapping_category: deriveMappingCategory(row.system_tag),
    isRequired: row.is_required !== false,
    isActive: row.is_active !== false,
    acceptedMimeTypes: [...ACCEPTED_MIME_TYPES[mediaType]],
    accept: ACCEPTED_MIME_TYPES[mediaType].join(','),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    ...(includeSystemTag ? { systemTag: row.system_tag || null } : {}),
  }
}

function wrapTableError(message, error) {
  const code = String(error?.code || '')
  if (code === '42P01') {
    return new ApiError(500, 'Motor de Mapeamento ainda não instalado. Execute a migração 20260711_dynamic_mapping_requirements.sql.', error)
  }
  if (code === '42703' && String(error?.message || '').includes('system_tag')) {
    return new ApiError(500, 'Tag de sistema ainda não instalada. Execute a migração 20260712_admin_kyc_approval_system_tag.sql.', error)
  }
  return new ApiError(500, message, error)
}

export function getAcceptedMimeTypesForMediaType(mediaType) {
  const normalized = normalizeMediaType(mediaType)
  return [...ACCEPTED_MIME_TYPES[normalized]]
}

export function isMimeTypeAllowedForRequirement(requirement, contentType) {
  const normalized = String(contentType || '').trim().toLowerCase().split(';')[0]
  return getAcceptedMimeTypesForMediaType(requirement.mediaType).includes(normalized)
}

export async function listActiveMappingRequirements() {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select('id, title, description, media_type, system_tag, is_required, is_active, created_at, updated_at')
    .eq('is_active', true)
    .order('is_required', { ascending: false })
    .order('created_at', { ascending: true })

  if (error) throw wrapTableError('Erro ao carregar requisitos ativos de mapeamento.', error)
  return (data || []).map((row) => mapRequirement(row))
}

export async function listAdminMappingRequirements({ includeInactive = true } = {}) {
  let query = supabaseAdmin
    .from(TABLE)
    .select('id, title, description, media_type, system_tag, is_required, is_active, created_at, updated_at')
    .order('is_active', { ascending: false })
    .order('is_required', { ascending: false })
    .order('created_at', { ascending: true })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw wrapTableError('Erro ao listar requisitos de mapeamento.', error)

  return { items: (data || []).map((row) => mapRequirement(row, { includeSystemTag: true })) }
}

export async function getMappingRequirementOrThrow(requirementId, { activeOnly = false } = {}) {
  if (!String(requirementId || '').trim()) {
    throw new ApiError(400, 'Requisito de mapeamento obrigatório.')
  }

  let query = supabaseAdmin
    .from(TABLE)
    .select('id, title, description, media_type, system_tag, is_required, is_active, created_at, updated_at')
    .eq('id', requirementId)

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query.maybeSingle()
  if (error) throw wrapTableError('Erro ao validar requisito de mapeamento.', error)
  if (!data) throw new ApiError(404, activeOnly ? 'Requisito ativo de mapeamento não encontrado.' : 'Requisito de mapeamento não encontrado.')

  return mapRequirement(data, { includeSystemTag: true })
}

export async function createMappingRequirement(input = {}) {
  const now = nowIso()
  const payload = {
    title: String(input.title || '').trim(),
    description: String(input.description || '').trim(),
    media_type: normalizeMediaType(input.mediaType),
    system_tag: normalizeSystemTag(input.systemTag) ?? null,
    is_required: input.isRequired !== false,
    is_active: true,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert(payload)
    .select('id, title, description, media_type, system_tag, is_required, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapTableError('Erro ao criar requisito de mapeamento.', error)

  return {
    item: mapRequirement(data, { includeSystemTag: true }),
    message: 'Requisito de mapeamento criado.',
  }
}

export async function updateMappingRequirement(requirementId, input = {}) {
  await getMappingRequirementOrThrow(requirementId)

  const payload = { updated_at: nowIso() }
  if (input.title !== undefined) payload.title = String(input.title || '').trim()
  if (input.description !== undefined) payload.description = String(input.description || '').trim()
  if (input.mediaType !== undefined) payload.media_type = normalizeMediaType(input.mediaType)
  if (input.systemTag !== undefined) payload.system_tag = normalizeSystemTag(input.systemTag)
  if (input.isRequired !== undefined) payload.is_required = Boolean(input.isRequired)
  if (input.isActive !== undefined) payload.is_active = Boolean(input.isActive)

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(payload)
    .eq('id', requirementId)
    .select('id, title, description, media_type, system_tag, is_required, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapTableError('Erro ao atualizar requisito de mapeamento.', error)

  return {
    item: mapRequirement(data, { includeSystemTag: true }),
    message: data.is_active ? 'Requisito de mapeamento atualizado.' : 'Requisito de mapeamento inativado.',
  }
}

export async function inactivateMappingRequirement(requirementId) {
  return updateMappingRequirement(requirementId, { isActive: false })
}

function assetField(asset, camelKey, snakeKey) {
  return asset?.[camelKey] ?? asset?.[snakeKey] ?? null
}

function isDryRunAsset(asset = {}) {
  const status = String(assetField(asset, 'status', 'status') || '').toLowerCase()
  const metadata = assetField(asset, 'metadata', 'metadata') || {}
  return status === 'registered_dry_run' || metadata?.dryRunOnly === true || metadata?.vault?.dryRun === true
}

function isValidAsset(asset = {}) {
  const status = String(assetField(asset, 'status', 'status') || '').toLowerCase()
  const bucket = assetField(asset, 'bucket', 'r2_bucket')
  const key = assetField(asset, 'key', 'r2_key')

  return Boolean(
    bucket
    && key
    && !isDryRunAsset(asset)
    && !['rejected', 'deleted', 'quarantined', 'archived'].includes(status),
  )
}

export function buildDynamicMappingChecklist(requirements = [], assets = [], kycCase = {}) {
  const safeRequirements = Array.isArray(requirements) ? requirements.filter((item) => item?.isActive !== false) : []
  const safeAssets = Array.isArray(assets) ? assets : []

  const groups = safeRequirements.map((requirement) => {
    const matchingAssets = safeAssets.filter((asset) => (
      String(assetField(asset, 'mappingRequirementId', 'mapping_requirement_id') || '') === requirement.id
    ))
    const validAssets = matchingAssets.filter(isValidAsset)
    const latestAsset = matchingAssets
      .slice()
      .sort((left, right) => String(assetField(right, 'createdAt', 'created_at') || '').localeCompare(String(assetField(left, 'createdAt', 'created_at') || '')))[0] || null

    return {
      key: requirement.id,
      requirementId: requirement.id,
      label: requirement.title,
      description: requirement.guidance || requirement.description,
      mediaType: requirement.mediaType,
      required: Boolean(requirement.isRequired),
      present: validAssets.length > 0,
      totalAssets: matchingAssets.length,
      validAssets: validAssets.length,
      dryRunAssets: matchingAssets.filter(isDryRunAsset).length,
      status: latestAsset ? String(assetField(latestAsset, 'status', 'status') || 'pending_review') : 'pending',
      rejectionReason: latestAsset ? assetField(latestAsset, 'rejectionReason', 'rejection_reason') : null,
      assets: validAssets.map((asset) => ({
        id: assetField(asset, 'id', 'id'),
        mappingRequirementId: requirement.id,
        assetType: assetField(asset, 'assetType', 'asset_type'),
        originalFilename: assetField(asset, 'originalFilename', 'original_filename'),
        status: assetField(asset, 'status', 'status'),
        rejectionReason: assetField(asset, 'rejectionReason', 'rejection_reason'),
        createdAt: assetField(asset, 'createdAt', 'created_at'),
      })),
    }
  })

  const requiredGroups = groups.filter((group) => group.required)
  const missingGroups = requiredGroups.filter((group) => !group.present)
  const completedGroups = requiredGroups.filter((group) => group.present)
  const isComplete = missingGroups.length === 0
  const caseStatus = kycCase?.status || 'pending_review'
  const readinessStatus = isComplete
    ? (caseStatus === 'approved' ? 'approved' : 'ready_for_review')
    : 'incomplete'

  return {
    status: readinessStatus,
    isComplete,
    totalRequired: requiredGroups.length,
    completedRequired: completedGroups.length,
    missingRequired: missingGroups.length,
    missingGroups: missingGroups.map((group) => ({
      key: group.key,
      requirementId: group.requirementId,
      label: group.label,
      description: group.description,
      mediaType: group.mediaType,
    })),
    groups,
    summary: safeRequirements.length === 0
      ? 'Nenhum requisito ativo foi configurado pelo Admin.'
      : isComplete
        ? 'Mapeamento completo para análise e autorização.'
        : `Mapeamento incompleto. Faltam ${missingGroups.length} requisito(s) obrigatório(s).`,
  }
}
