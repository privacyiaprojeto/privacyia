import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { getKycVaultObject, headKycVaultObject } from './storage.service.js'
import { inspectConfiguredIdentityBaseModelLock, isGitCommitIdentityBaseModelLock } from './actor-identity-base-model-lock.service.js'

const ACTORS_TABLE = 'actor_profiles'
const KYC_CASES_TABLE = 'actor_kyc_cases'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const REQUIREMENTS_TABLE = 'mapping_requirements'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'

const VISUAL_MEDIA_TYPES = new Set(['image', 'video'])
const REQUIRED_IMAGE_TAGS = ['face_front', 'face_profile_left', 'face_profile_right']
const REQUIRED_VIDEO_TAGS = ['video_expression', 'video_walk']
const DISALLOWED_IDENTITY_TOKENS = ['identity_document', 'identity_card', 'selfie_document', 'documento', 'document']
const TEST_TOKENS = ['dry_run', 'sprint_5_9', 'test-5-9', 'quarantine', 'placeholder', 'mock']

const ALLOWED_MIME_TYPES = {
  image: new Set(['image/jpeg', 'image/png', 'image/webp']),
  video: new Set(['video/mp4', 'video/webm', 'video/quicktime']),
}

const DIAGNOSTIC_DISPOSITION_CONFIRMATION_PHRASE = 'CLASSIFICAR DUPLICADOS CONFIRMADOS COMO HISTORICO D2C.7'
const ACTION_REQUIRED_RECOVERABILITIES = new Set([
  'verify_private_object',
  'admin_decision',
  'storage_repair_required',
  'replacement_required',
  'manual_security_review',
  'manual_review',
])


const IDENTITY_COMPLETION_BLUEPRINTS = Object.freeze([
  {
    systemTag: 'face_front',
    mediaType: 'image',
    targetCount: 4,
    slots: [
      ['natural', 'Rosto frontal — expressão natural', 'Faça uma selfie de frente, com o rosto inteiro visível, câmera na altura dos olhos, boa luz e expressão natural.'],
      ['smile', 'Rosto frontal — sorriso natural', 'Faça uma nova selfie frontal sorrindo naturalmente. Use outro momento ou ambiente, sem filtros e sem repetir a foto anterior.'],
      ['serious', 'Rosto frontal — expressão séria', 'Faça uma nova selfie frontal com expressão séria ou concentrada, rosto relaxado e iluminação uniforme.'],
      ['soft_variation', 'Rosto frontal — variação de luz e aparência', 'Faça uma nova foto frontal em outro ambiente claro, sem contraluz, com cabelo e acessórios sem esconder o rosto.'],
    ],
  },
  {
    systemTag: 'face_profile_left',
    mediaType: 'image',
    targetCount: 3,
    slots: [
      ['full', 'Perfil esquerdo — totalmente de lado', 'Fotografe o lado esquerdo em aproximadamente 90 graus, mostrando olhos, nariz, boca, orelha e contorno do rosto.'],
      ['three_quarter', 'Perfil esquerdo — ângulo de 45 graus', 'Faça outra foto pelo lado esquerdo, agora em aproximadamente 45 graus, com boa luz e sem filtros.'],
      ['variation', 'Perfil esquerdo — nova variação', 'Faça uma terceira foto pelo lado esquerdo em outro momento, mantendo o contorno facial visível e expressão natural.'],
    ],
  },
  {
    systemTag: 'face_profile_right',
    mediaType: 'image',
    targetCount: 3,
    slots: [
      ['full', 'Perfil direito — totalmente de lado', 'Fotografe o lado direito em aproximadamente 90 graus, mostrando olhos, nariz, boca, orelha e contorno do rosto.'],
      ['three_quarter', 'Perfil direito — ângulo de 45 graus', 'Faça outra foto pelo lado direito, agora em aproximadamente 45 graus, com boa luz e sem filtros.'],
      ['variation', 'Perfil direito — nova variação', 'Faça uma terceira foto pelo lado direito em outro momento, mantendo o contorno facial visível e expressão natural.'],
    ],
  },
  {
    systemTag: 'body_front',
    mediaType: 'image',
    targetCount: 3,
    slots: [
      ['neutral', 'Corpo inteiro de frente — postura natural', 'Fotografe o corpo inteiro de frente, em pé, com cabeça, mãos e pés dentro do quadro e câmera sem inclinação.'],
      ['arms_visible', 'Corpo inteiro de frente — braços afastados', 'Faça outra foto de frente com os braços levemente afastados do corpo para mostrar a silhueta completa.'],
      ['pose_variation', 'Corpo inteiro de frente — nova postura', 'Faça uma terceira foto de corpo inteiro de frente com postura diferente, sem esconder partes do corpo e sem repetir a imagem anterior.'],
    ],
  },
  {
    systemTag: 'body_back',
    mediaType: 'image',
    targetCount: 2,
    slots: [
      ['neutral', 'Corpo inteiro de costas — postura natural', 'Fotografe o corpo inteiro de costas, em pé, com cabeça, mãos e pés dentro do quadro e boa iluminação.'],
      ['variation', 'Corpo inteiro de costas — nova postura', 'Faça outra foto de costas com postura diferente e silhueta completa, sem repetir a imagem anterior.'],
    ],
  },
  {
    systemTag: 'video_expression',
    mediaType: 'video',
    targetCount: 3,
    slots: [
      ['natural', 'Vídeo de expressões — movimentos naturais', 'Grave o rosto inteiro por alguns segundos, alternando expressão neutra, sorriso e expressão séria, com movimentos suaves de cabeça.'],
      ['emotion_range', 'Vídeo de expressões — variedade emocional', 'Grave um novo vídeo alternando diferentes expressões naturais. Pisque, fale algumas palavras sem áudio obrigatório e evite cortes.'],
      ['head_angles', 'Vídeo de expressões — ângulos do rosto', 'Grave outro vídeo olhando de frente e virando lentamente o rosto para os dois lados, mantendo boa luz e câmera estável.'],
    ],
  },
  {
    systemTag: 'video_walk',
    mediaType: 'video',
    targetCount: 3,
    slots: [
      ['front_back', 'Vídeo caminhando — frente e retorno', 'Grave o corpo inteiro caminhando em direção à câmera e depois se afastando, em ritmo natural e sem sair do quadro.'],
      ['lateral', 'Vídeo caminhando — movimento lateral', 'Grave um novo vídeo caminhando lateralmente, mantendo o corpo inteiro visível e a câmera estável.'],
      ['turn', 'Vídeo caminhando — caminhada e giro', 'Grave outro vídeo caminhando alguns passos, fazendo um giro natural e retornando à posição inicial.'],
    ],
  },
])

const IDENTITY_COMPLETION_SYSTEM_TAGS = new Set(IDENTITY_COMPLETION_BLUEPRINTS.map((item) => item.systemTag))
const COMPLETION_ACTIVE_ASSET_STATUSES = new Set(['approved', 'pending_review'])

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function metadataIdentityPreparationAuthorization(metadata = {}, actorProfileId = null, mappingCaseId = null) {
  const root = safeObject(metadata)
  const preparation = safeObject(root.identityPreparation)
  const authorization = safeObject(preparation.authorization)
  if (normalizeLower(authorization.status) !== 'active') return null
  if (actorProfileId && authorization.actorProfileId !== actorProfileId) return null
  if (preparation.actorProfileId && authorization.actorProfileId !== preparation.actorProfileId) return null
  if (mappingCaseId && authorization.kycCaseId !== mappingCaseId) return null
  const termsSnapshot = safeObject(authorization.termsSnapshot)
  if (Object.keys(termsSnapshot).length === 0) return null
  return authorization
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase()
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(normalizeLower(value))
}

function normalizeContentType(value) {
  return normalizeLower(value).split(';')[0]
}

function normalizeMediaType(value, contentType = '') {
  const normalized = normalizeLower(value).replace(/[^a-z0-9]+/g, '_')
  if (['image', 'imagem', 'photo', 'foto'].includes(normalized)) return 'image'
  if (['video', 'short_video', 'video_short'].includes(normalized)) return 'video'
  if (['audio', 'voice', 'live_audio'].includes(normalized)) return 'audio'
  const content = normalizeContentType(contentType)
  if (content.startsWith('image/')) return 'image'
  if (content.startsWith('video/')) return 'video'
  if (content.startsWith('audio/')) return 'audio'
  return normalized || 'unknown'
}

function isPrivateObjectReference(bucket, key) {
  const cleanBucket = normalizeText(bucket)
  const cleanKey = normalizeText(key)
  return Boolean(
    cleanBucket
    && cleanKey
    && !/^https?:\/\//i.test(cleanBucket)
    && !/^https?:\/\//i.test(cleanKey)
    && !cleanKey.startsWith('/')
    && cleanKey.startsWith('vault/actor-mapping/')
  )
}

function containsAnyToken(values, tokens) {
  const haystack = values.map((value) => normalizeLower(value)).join(' ')
  return tokens.some((token) => haystack.includes(token))
}

function isDryRunOrTestAsset(asset) {
  const metadata = safeObject(asset.metadata)
  return Boolean(
    normalizeLower(asset.status) === 'registered_dry_run'
    || metadata.safeMock === true
    || metadata.fake === true
    || metadata.dryRunOnly === true
    || safeObject(metadata.vault).dryRun === true
    || containsAnyToken([
      asset.r2_key,
      asset.asset_type,
      asset.original_filename,
      metadata.source,
      metadata.testSource,
      metadata.mappingPurpose,
    ], TEST_TOKENS)
  )
}

function isIdentityDocument(asset, requirement) {
  return containsAnyToken([
    requirement?.system_tag,
    requirement?.title,
    asset.asset_type,
    asset.original_filename,
  ], DISALLOWED_IDENTITY_TOKENS)
}

function isSensitiveMappingMaterial(asset, requirement) {
  const metadata = safeObject(asset.metadata)
  return containsAnyToken([
    requirement?.system_tag,
    requirement?.title,
    asset.asset_type,
    metadata.mappingCategory,
    metadata.mapping_category,
  ], ['nsfw', 'premium'])
}

function mapAssetMediaType(asset, requirement) {
  return normalizeMediaType(requirement?.media_type, asset.content_type)
}


function completionTaskIdFromAsset(asset = {}) {
  const metadata = safeObject(asset.metadata)
  return normalizeText(metadata.identityCompletionTaskId || safeObject(metadata.identityCompletion).taskId)
}

function completionTaskPrefix(systemTag) {
  return `identity:${systemTag}:`
}

function buildIdentityCompletionPlan({ requirements = [], assets = [], classified = null, minimumImages = 15, minimumVideos = 6 } = {}) {
  const activeRequirements = requirements
    .filter((item) => item?.id && item.is_active !== false)
    .sort((left, right) => String(left.created_at || '').localeCompare(String(right.created_at || '')) || String(left.id).localeCompare(String(right.id)))
  const requirementsByTag = new Map()
  for (const requirement of activeRequirements) {
    const tag = normalizeText(requirement.system_tag)
    if (!tag) continue
    const rows = requirementsByTag.get(tag) || []
    rows.push(requirement)
    requirementsByTag.set(tag, rows)
  }

  const rawAssetById = new Map(assets.map((asset) => [asset.id, asset]))
  const includedIds = new Set((classified?.included || []).map((item) => item.assetId))
  const pendingIds = new Set(assets.filter((asset) => normalizeLower(asset.status) === 'pending_review').map((asset) => asset.id))
  const completionEligibleIds = new Set([...includedIds, ...pendingIds])
  const canonicalRequirementIds = new Set()
  const tasks = []

  for (const blueprint of IDENTITY_COMPLETION_BLUEPRINTS) {
    const requirement = (requirementsByTag.get(blueprint.systemTag) || [])[0] || null
    if (!requirement) continue
    canonicalRequirementIds.add(requirement.id)

    const occupiedTaskIds = new Set()
    let unassignedAssetCount = 0
    for (const assetId of completionEligibleIds) {
      const asset = rawAssetById.get(assetId)
      if (!asset || asset.mapping_requirement_id !== requirement.id) continue
      const taskId = completionTaskIdFromAsset(asset)
      if (taskId && taskId.startsWith(completionTaskPrefix(blueprint.systemTag))) occupiedTaskIds.add(taskId)
      else unassignedAssetCount += 1
    }

    const slots = blueprint.slots.map(([suffix, title, guidance], index) => ({
      id: `${completionTaskPrefix(blueprint.systemTag)}${String(index + 1).padStart(2, '0')}:${suffix}`,
      title,
      guidance,
      index: index + 1,
    }))
    for (const slot of slots) {
      if (unassignedAssetCount > 0 && !occupiedTaskIds.has(slot.id)) {
        occupiedTaskIds.add(slot.id)
        unassignedAssetCount -= 1
      }
    }

    for (const slot of slots) {
      if (occupiedTaskIds.has(slot.id)) continue
      tasks.push({
        id: slot.id,
        source: 'system_identity_plan',
        requirementId: requirement.id,
        systemTag: blueprint.systemTag,
        title: slot.title,
        description: normalizeText(requirement.description),
        guidance: slot.guidance,
        mediaType: blueprint.mediaType,
        targetIndex: slot.index,
        targetCount: blueprint.targetCount,
        priority: blueprint.mediaType === 'image' ? 10 + slot.index : 20 + slot.index,
      })
    }
  }

  for (const requirement of activeRequirements) {
    if (canonicalRequirementIds.has(requirement.id)) continue
    const requirementAssets = assets.filter((asset) => asset.mapping_requirement_id === requirement.id)
    const fulfilled = requirementAssets.some((asset) => COMPLETION_ACTIVE_ASSET_STATUSES.has(normalizeLower(asset.status)))
    if (fulfilled) continue
    const latestRejected = requirementAssets
      .filter((asset) => normalizeLower(asset.status) === 'rejected')
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))[0] || null
    const mediaType = normalizeMediaType(requirement.media_type)
    tasks.push({
      id: `admin:${requirement.id}`,
      source: 'admin_requirement',
      requirementId: requirement.id,
      systemTag: normalizeText(requirement.system_tag) || null,
      title: normalizeText(requirement.title) || 'Material solicitado pelo Admin',
      description: normalizeText(requirement.description),
      guidance: normalizeText(requirement.description) || `Siga a orientação do Admin e envie um novo arquivo de ${mediaType === 'image' ? 'imagem' : mediaType === 'video' ? 'vídeo' : mediaType === 'audio' ? 'áudio' : 'material'}.`,
      mediaType,
      targetIndex: 1,
      targetCount: 1,
      priority: 5,
      replacementAssetId: latestRejected?.id || null,
    })
  }

  tasks.sort((left, right) => Number(left.priority || 99) - Number(right.priority || 99) || String(left.title).localeCompare(String(right.title)))
  return {
    schemaVersion: 'privacy-identity-completion-plan-v1',
    ready: tasks.length === 0,
    remainingTotal: tasks.length,
    remainingImages: tasks.filter((task) => task.mediaType === 'image').length,
    remainingVideos: tasks.filter((task) => task.mediaType === 'video').length,
    remainingAudio: tasks.filter((task) => task.mediaType === 'audio').length,
    minimumImages,
    minimumVideos,
    tasks,
  }
}

function blocker(code, message, details = undefined) {
  return { code, message, ...(details === undefined ? {} : { details }) }
}

function warning(code, message, details = undefined) {
  return { code, message, ...(details === undefined ? {} : { details }) }
}


const DATASET_REASON_CATALOG = {
  included: {
    label: 'Incluído no conjunto de identidade',
    message: 'Arquivo aprovado e tecnicamente válido para o treinamento visual.',
    recommendedAction: 'Nenhuma ação necessária para este arquivo.',
    tone: 'success',
    recoverability: 'ready',
  },
  missing_or_invalid_checksum: {
    label: 'Arquivo precisa de conferência',
    message: 'O arquivo foi aprovado, mas o sistema ainda não conseguiu confirmar se ele está completo e correto.',
    recommendedAction: 'Use a conferência automática. Um novo envio só será pedido se o arquivo não puder ser confirmado.',
    tone: 'warning',
    recoverability: 'verify_private_object',
  },
  confirmed_duplicate_history: {
    label: 'Cópia repetida preservada no histórico',
    message: 'O sistema já confirmou que este arquivo é igual a outra versão válida da mesma categoria.',
    recommendedAction: 'Nenhuma ação necessária. A versão válida já está sendo usada.',
    tone: 'neutral',
    recoverability: 'historical_only',
  },
  archived_historical_version: {
    label: 'Versão substituída preservada',
    message: 'Este arquivo foi substituído por uma versão mais recente e permanece somente no histórico.',
    recommendedAction: 'Nenhuma ação necessária. O arquivo não entra no conjunto atual.',
    tone: 'neutral',
    recoverability: 'historical_only',
  },
  asset_not_approved: {
    label: 'Fora do conjunto: decisão pendente',
    message: 'O arquivo ainda não possui aprovação válida para entrar no treinamento.',
    recommendedAction: 'Concluir a análise do arquivo ou solicitar a substituição.',
    tone: 'info',
    recoverability: 'admin_decision',
  },
  superseded_lineage_version: {
    label: 'Versão anterior preservada',
    message: 'Existe uma versão mais recente aprovada na mesma linhagem. Esta versão permanece somente no histórico.',
    recommendedAction: 'Nenhuma ação necessária. O sistema usa apenas a versão aprovada mais recente da linhagem.',
    tone: 'neutral',
    recoverability: 'historical_only',
  },
  audio_not_used_for_visual_identity: {
    label: 'Áudio aprovado fora do treino visual',
    message: 'O áudio permanece válido no mapeamento, mas não é usado para treinar rosto ou corpo em vídeo.',
    recommendedAction: 'Nenhuma ação necessária para a identidade em vídeos.',
    tone: 'neutral',
    recoverability: 'not_applicable',
  },
  unsupported_media_type: {
    label: 'Formato não usado no treino visual',
    message: 'Este tipo de material não é usado para formar a identidade em vídeos.',
    recommendedAction: 'Nenhuma ação necessária, salvo se a categoria estiver incorreta.',
    tone: 'neutral',
    recoverability: 'not_applicable',
  },
  invalid_private_storage_reference: {
    label: 'Arquivo protegido não localizado',
    message: 'O sistema não conseguiu localizar este arquivo no armazenamento protegido.',
    recommendedAction: 'Confira o vínculo do arquivo antes de usá-lo na identidade em vídeos.',
    tone: 'danger',
    recoverability: 'storage_repair_required',
  },
  unsupported_content_type: {
    label: 'Formato de arquivo incompatível',
    message: 'O tipo técnico do arquivo não é aceito pelo treinamento visual.',
    recommendedAction: 'Solicitar substituição em JPEG, PNG, WEBP, MP4, WEBM ou MOV, conforme a categoria.',
    tone: 'danger',
    recoverability: 'replacement_required',
  },
  invalid_byte_size: {
    label: 'Informações do arquivo incompletas',
    message: 'O sistema não conseguiu confirmar todas as informações deste arquivo.',
    recommendedAction: 'Use a conferência automática. Peça um novo envio somente se o arquivo não puder ser recuperado.',
    tone: 'warning',
    recoverability: 'verify_private_object',
  },
  duplicate_checksum: {
    label: 'Arquivo duplicado',
    message: 'Este conteúdo é igual a outro arquivo já aceito.',
    recommendedAction: 'Mantenha apenas uma cópia e peça um material diferente para completar a variedade.',
    tone: 'neutral',
    recoverability: 'deduplicated',
  },
  lineage_scope_mismatch: {
    label: 'Arquivo vinculado ao lugar errado',
    message: 'Este arquivo não corresponde ao mesmo ator, mapeamento e categoria.',
    recommendedAction: 'Não use o arquivo até corrigir o vínculo.',
    tone: 'danger',
    recoverability: 'manual_security_review',
  },
  test_or_dry_run_asset: {
    label: 'Material de teste excluído',
    message: 'Arquivos de teste ou simulação nunca entram no conjunto real de identidade.',
    recommendedAction: 'Nenhuma ação. Use somente material real e autorizado.',
    tone: 'neutral',
    recoverability: 'not_applicable',
  },
  identity_document_excluded: {
    label: 'Documento excluído do treino',
    message: 'Documentos de identidade não são usados para treinar a aparência visual.',
    recommendedAction: 'Nenhuma ação necessária.',
    tone: 'neutral',
    recoverability: 'not_applicable',
  },
  sensitive_mapping_material_excluded: {
    label: 'Material sensível fora do treino automático',
    message: 'Este material permanece protegido no mapeamento e não entra automaticamente no conjunto visual.',
    recommendedAction: 'Não usar no treinamento sem uma regra específica e autorização adicional.',
    tone: 'neutral',
    recoverability: 'not_applicable',
  },
}

function datasetReasonDetails(reason) {
  const details = DATASET_REASON_CATALOG[reason] || {
    label: 'Arquivo fora do conjunto visual',
    message: 'O arquivo não atende a uma regra do conjunto de identidade.',
    recommendedAction: 'Revise a situação antes de solicitar um novo envio.',
    tone: 'warning',
    recoverability: 'manual_review',
  }
  const requiresAction = ACTION_REQUIRED_RECOVERABILITIES.has(details.recoverability)
  return {
    ...details,
    requiresAction,
    noActionRequired: !requiresAction && details.recoverability !== 'ready',
  }
}

function sanitizeDiagnosticAsset(item = {}) {
  const details = datasetReasonDetails(item.reason || 'included')
  return {
    assetId: item.assetId,
    mappingRequirementId: item.mappingRequirementId || null,
    systemTag: item.systemTag || null,
    requirementTitle: item.requirementTitle || null,
    originalFilename: item.originalFilename || null,
    mediaType: item.mediaType || 'unknown',
    contentType: item.contentType || null,
    byteSize: Number(item.byteSize || 0) || null,
    mappingStatus: item.mappingStatus || null,
    datasetStatus: item.reason ? 'excluded' : 'included',
    reasonCode: item.reason || 'included',
    reasonLabel: details.label,
    reasonMessage: details.message,
    recommendedAction: details.recommendedAction,
    tone: details.tone,
    recoverability: details.recoverability,
    requiresAction: details.requiresAction,
    noActionRequired: details.noActionRequired,
    checksumState: item.checksumState || 'unknown',
    parentAssetId: item.parentAssetId || null,
    matchingAssetId: item.matchingAssetId || null,
  }
}

function authorizationAllowsVideo(row) {
  const allowed = Array.isArray(row?.authorized_for_content_types)
    ? row.authorized_for_content_types.map((value) => normalizeLower(value).replace(/[^a-z0-9]+/g, '_'))
    : []
  return allowed.some((value) => ['video', 'short_video', 'live_action'].includes(value))
}

function isAuthorizationActive(row, now = Date.now()) {
  if (!row || normalizeLower(row.status) !== 'active' || row.revoked_at) return false
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false
  if (row.ends_at && new Date(row.ends_at).getTime() < now) return false
  return authorizationAllowsVideo(row)
}

function sanitizedAsset(asset) {
  return {
    assetId: asset.assetId,
    mappingRequirementId: asset.mappingRequirementId,
    systemTag: asset.systemTag,
    mediaType: asset.mediaType,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    checksumSha256Prefix: asset.checksumSha256.slice(0, 12),
  }
}

function compareAssets(left, right) {
  return [left.mediaType, left.systemTag || '', left.checksumSha256, left.assetId]
    .join('|')
    .localeCompare([right.mediaType, right.systemTag || '', right.checksumSha256, right.assetId].join('|'))
}

async function loadActor(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, status, kyc_status, production_status, display_name, legal_name, metadata')
    .eq('id', actorProfileId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao carregar o ator para auditoria do conjunto de identidade.', error)
  if (!data) throw new ApiError(404, 'Ator não encontrado.')
  return data
}

async function loadLatestApprovedCase(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('id, actor_profile_id, status, reviewed_at, metadata, created_at')
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'approved')
    .order('reviewed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao localizar o mapeamento aprovado do ator.', error)
  return data || null
}

async function loadActiveAuthorization(actorProfileId, kycCaseId = null) {
  let query = supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('id, actor_profile_id, companion_id, kyc_case_id, status, authorized_for_content_types, starts_at, ends_at, revoked_at, terms_snapshot, metadata, created_at')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(30)

  if (kycCaseId) query = query.eq('kyc_case_id', kycCaseId)
  const { data, error } = await query
  if (error) throw new ApiError(500, 'Erro ao verificar a autorização de produção do ator.', error)
  return (data || []).find((row) => isAuthorizationActive(row)) || null
}

async function loadRequirementsAndAssets(actorProfileId, kycCaseId) {
  const [requirementsResult, assetsResult] = await Promise.all([
    supabaseAdmin
      .from(REQUIREMENTS_TABLE)
      .select('id, title, description, media_type, system_tag, is_required, is_active, created_at'),
    supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('id, kyc_case_id, actor_profile_id, mapping_requirement_id, asset_type, r2_bucket, r2_key, original_filename, content_type, byte_size, checksum_sha256, status, metadata, created_at')
      .eq('actor_profile_id', actorProfileId)
      .eq('kyc_case_id', kycCaseId)
      .order('created_at', { ascending: true }),
  ])

  if (requirementsResult.error) throw new ApiError(500, 'Erro ao carregar os requisitos do mapeamento.', requirementsResult.error)
  if (assetsResult.error) throw new ApiError(500, 'Erro ao carregar os materiais do mapeamento.', assetsResult.error)

  return {
    requirements: requirementsResult.data || [],
    assets: assetsResult.data || [],
  }
}

function directLineageParentId(asset = {}) {
  const metadata = safeObject(asset.metadata)
  const lineage = safeObject(metadata.lineage)
  return normalizeText(lineage.parentAssetId || metadata.sourceAssetId)
}

function isAdminEditedCopy(asset = {}) {
  const metadata = safeObject(asset.metadata)
  const lineage = safeObject(metadata.lineage)
  return Boolean(metadata.adminSafeImageEditor || lineage.kind === 'admin_non_destructive_edited_copy')
}

function selectApprovedLineageRepresentatives(assets = []) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const resolveRootId = (asset) => {
    let current = asset
    const visited = new Set()
    while (current?.id && !visited.has(current.id)) {
      visited.add(current.id)
      const parentId = directLineageParentId(current)
      if (!parentId || !assetById.has(parentId)) return current.id
      current = assetById.get(parentId)
    }
    return asset.id
  }

  const groups = new Map()
  for (const asset of assets) {
    if (normalizeLower(asset.status) !== 'approved') continue
    const rootId = resolveRootId(asset)
    const group = groups.get(rootId) || []
    group.push(asset)
    groups.set(rootId, group)
  }

  const selected = new Set()
  for (const group of groups.values()) {
    group.sort((left, right) => {
      const editedDifference = Number(isAdminEditedCopy(right)) - Number(isAdminEditedCopy(left))
      if (editedDifference !== 0) return editedDifference
      return String(right.created_at || '').localeCompare(String(left.created_at || ''))
    })
    if (group[0]?.id) selected.add(group[0].id)
  }
  return selected
}

function classifyAssets(assets, requirementById) {
  const included = []
  const excluded = []
  const warnings = []
  const seenChecksums = new Set()
  const lineageRepresentatives = selectApprovedLineageRepresentatives(assets)
  let candidateVisualAssets = 0
  let candidateWithValidChecksum = 0

  for (const asset of assets) {
    const requirement = requirementById.get(asset.mapping_requirement_id) || null
    const mediaType = mapAssetMediaType(asset, requirement)
    const base = {
      assetId: asset.id,
      mappingRequirementId: asset.mapping_requirement_id || null,
      systemTag: normalizeText(requirement?.system_tag) || null,
      requirementTitle: normalizeText(requirement?.title) || null,
      originalFilename: normalizeText(asset.original_filename) || null,
      mediaType,
      contentType: normalizeContentType(asset.content_type) || null,
      byteSize: Number(asset.byte_size || 0) || null,
      mappingStatus: normalizeLower(asset.status) || null,
      checksumState: isSha256(asset.checksum_sha256) ? 'valid' : 'missing_or_invalid',
    }

    const metadata = safeObject(asset.metadata)
    const disposition = safeObject(metadata.identityDatasetDisposition)
    const dispositionScopeMismatch = (disposition.actorProfileId && disposition.actorProfileId !== asset.actor_profile_id)
      || (disposition.kycCaseId && disposition.kycCaseId !== asset.kyc_case_id)
      || (disposition.mappingRequirementId && disposition.mappingRequirementId !== asset.mapping_requirement_id)

    if (normalizeLower(asset.status) === 'archived') {
      excluded.push({ ...base, reason: 'archived_historical_version', parentAssetId: directLineageParentId(asset) || null })
      continue
    }
    if (normalizeLower(disposition.reasonCode) === 'confirmed_duplicate_history') {
      if (dispositionScopeMismatch) {
        excluded.push({ ...base, reason: 'lineage_scope_mismatch' })
      } else {
        excluded.push({ ...base, reason: 'confirmed_duplicate_history', matchingAssetId: normalizeText(disposition.matchingAssetId) || null })
      }
      continue
    }
    if (normalizeLower(asset.status) !== 'approved') {
      excluded.push({ ...base, reason: 'asset_not_approved' })
      continue
    }
    if ((metadata.sourceActorProfileId && metadata.sourceActorProfileId !== asset.actor_profile_id)
      || (metadata.sourceKycCaseId && metadata.sourceKycCaseId !== asset.kyc_case_id)
      || (metadata.sourceMappingRequirementId && metadata.sourceMappingRequirementId !== asset.mapping_requirement_id)) {
      excluded.push({ ...base, reason: 'lineage_scope_mismatch' })
      continue
    }
    if (!lineageRepresentatives.has(asset.id)) {
      excluded.push({ ...base, reason: 'superseded_lineage_version', parentAssetId: directLineageParentId(asset) || null })
      continue
    }
    if (isDryRunOrTestAsset(asset)) {
      excluded.push({ ...base, reason: 'test_or_dry_run_asset' })
      continue
    }
    if (isIdentityDocument(asset, requirement)) {
      excluded.push({ ...base, reason: 'identity_document_excluded' })
      continue
    }
    if (isSensitiveMappingMaterial(asset, requirement)) {
      excluded.push({ ...base, reason: 'sensitive_mapping_material_excluded' })
      continue
    }
    if (!VISUAL_MEDIA_TYPES.has(mediaType)) {
      excluded.push({ ...base, reason: mediaType === 'audio' ? 'audio_not_used_for_visual_identity' : 'unsupported_media_type' })
      continue
    }

    candidateVisualAssets += 1
    const contentType = normalizeContentType(asset.content_type)
    const checksumSha256 = normalizeLower(asset.checksum_sha256)
    const byteSize = Number(asset.byte_size || 0)

    if (!isPrivateObjectReference(asset.r2_bucket, asset.r2_key)) {
      excluded.push({ ...base, reason: 'invalid_private_storage_reference' })
      continue
    }
    if (!ALLOWED_MIME_TYPES[mediaType]?.has(contentType)) {
      excluded.push({ ...base, reason: 'unsupported_content_type', contentType })
      continue
    }
    if (!Number.isFinite(byteSize) || byteSize <= 0) {
      excluded.push({ ...base, reason: 'invalid_byte_size' })
      continue
    }
    if (!isSha256(checksumSha256)) {
      excluded.push({ ...base, reason: 'missing_or_invalid_checksum' })
      continue
    }

    candidateWithValidChecksum += 1
    if (seenChecksums.has(checksumSha256)) {
      excluded.push({ ...base, reason: 'duplicate_checksum' })
      continue
    }
    seenChecksums.add(checksumSha256)

    if (!base.systemTag) {
      warnings.push(warning('asset_without_system_tag', 'Material visual aprovado sem classificação de cobertura.', { assetId: asset.id }))
    }

    included.push({
      ...base,
      contentType,
      byteSize,
      checksumSha256,
      source: {
        bucket: asset.r2_bucket,
        key: asset.r2_key,
      },
    })
  }

  included.sort(compareAssets)
  return {
    included,
    excluded,
    warnings,
    candidateVisualAssets,
    candidateWithValidChecksum,
  }
}

export async function auditActorIdentityDatasetReadiness(actorProfileId, {
  includePrivateManifest = false,
  requireIdentityAuthorization = true,
  requireTrainingConfiguration = true,
} = {}) {
  const actor = await loadActor(actorProfileId)
  const blockers = []
  const trainingConfigurationBlockers = []
  const warnings = []

  if (normalizeLower(actor.status) !== 'approved') {
    blockers.push(blocker('actor_not_approved', 'O ator ainda não está aprovado.'))
  }
  if (normalizeLower(actor.kyc_status) !== 'approved') {
    blockers.push(blocker('mapping_not_approved', 'O mapeamento do ator ainda não está aprovado.'))
  }
  const mappingCase = await loadLatestApprovedCase(actorProfileId)
  if (!mappingCase) {
    blockers.push(blocker('approved_mapping_case_missing', 'Nenhum caso de mapeamento aprovado foi encontrado.'))
  }

  const actorScopedAuthorization = mappingCase
    ? metadataIdentityPreparationAuthorization(actor.metadata, actorProfileId, mappingCase.id)
    : null
  const legacyAvatarAuthorization = mappingCase && !actorScopedAuthorization
    ? await loadActiveAuthorization(actorProfileId, mappingCase.id)
    : null
  const authorization = actorScopedAuthorization || legacyAvatarAuthorization
  const authorizationSource = actorScopedAuthorization ? 'actor_identity_preparation' : legacyAvatarAuthorization ? 'legacy_avatar_production' : null
  if (requireIdentityAuthorization && !authorization) {
    blockers.push(blocker('identity_preparation_authorization_missing', 'O uso dos materiais ainda não foi autorizado para preparar a identidade deste ator.'))
  }

  const termsSnapshot = actorScopedAuthorization
    ? safeObject(actorScopedAuthorization.termsSnapshot)
    : safeObject(legacyAvatarAuthorization?.terms_snapshot)
  const termsSnapshotPresent = Object.keys(termsSnapshot).length > 0
  const consentSnapshotSha256 = termsSnapshotPresent ? sha256(stableStringify(termsSnapshot)) : null
  if (requireIdentityAuthorization && authorization && !termsSnapshotPresent) {
    blockers.push(blocker('consent_snapshot_missing', 'A autorização da identidade não possui uma cópia verificável dos termos de consentimento.'))
  }

  const privateBucket = normalizeText(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME)
  const privateBucketConfigured = Boolean(privateBucket && !/^https?:\/\//i.test(privateBucket))
  if (!privateBucketConfigured) {
    trainingConfigurationBlockers.push(blocker('private_training_bucket_missing', 'O espaço privado que receberá os arquivos preparados ainda não está configurado.'))
  }
  const baseModelFingerprint = normalizeLower(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)
  const baseModelRevision = normalizeLower(env.IDENTITY_LORA_BASE_MODEL_REVISION)
  const baseModelLockAudit = inspectConfiguredIdentityBaseModelLock({
    expectedRepository: normalizeText(env.IDENTITY_LORA_BASE_MODEL),
    expectedRevision: baseModelRevision,
    expectedFingerprint: baseModelFingerprint,
  })
  trainingConfigurationBlockers.push(...baseModelLockAudit.blockers.map((item) => blocker(item.code, item.message, item.details)))
  const trainingEngineCommit = normalizeText(env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT)
  if (!trainingEngineCommit) {
    trainingConfigurationBlockers.push(blocker('training_engine_commit_missing', 'A versão controlada do ambiente de treinamento ainda não foi confirmada.'))
  }
  const dryRunOnly = env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true
  const realTrainingDisabled = env.IDENTITY_LORA_TRAINING_ENABLED !== true
  if (!dryRunOnly) {
    trainingConfigurationBlockers.push(blocker('training_safe_mode_missing', 'O modo seguro de conferência do treinamento ainda não está ativo.'))
  }
  if (!realTrainingDisabled) {
    trainingConfigurationBlockers.push(blocker('real_training_must_remain_disabled', 'O treinamento real precisa permanecer desativado durante esta conferência.'))
  }
  if (requireTrainingConfiguration) blockers.push(...trainingConfigurationBlockers)

  let requirements = []
  let allAssets = []
  let classified = {
    included: [],
    excluded: [],
    warnings: [],
    candidateVisualAssets: 0,
    candidateWithValidChecksum: 0,
  }

  if (mappingCase) {
    const loaded = await loadRequirementsAndAssets(actorProfileId, mappingCase.id)
    requirements = loaded.requirements
    allAssets = loaded.assets
    const requirementById = new Map(requirements.map((row) => [row.id, row]))
    classified = classifyAssets(allAssets, requirementById)
    warnings.push(...classified.warnings)
  }

  const imageAssets = classified.included.filter((asset) => asset.mediaType === 'image')
  const videoAssets = classified.included.filter((asset) => asset.mediaType === 'video')
  const imageTags = new Set(imageAssets.map((asset) => asset.systemTag).filter(Boolean))
  const videoTags = new Set(videoAssets.map((asset) => asset.systemTag).filter(Boolean))
  const missingImageTags = REQUIRED_IMAGE_TAGS.filter((tag) => !imageTags.has(tag))
  const missingVideoTags = REQUIRED_VIDEO_TAGS.filter((tag) => !videoTags.has(tag))
  const minimumImages = Number(env.IDENTITY_LORA_MIN_APPROVED_IMAGES || 15)
  const minimumVideos = Number(env.IDENTITY_LORA_MIN_APPROVED_VIDEOS || 6)

  if (imageAssets.length < minimumImages) {
    blockers.push(blocker('approved_image_count_below_minimum', 'Quantidade de fotos válidas abaixo do mínimo necessário.', {
      current: imageAssets.length,
      minimum: minimumImages,
    }))
  }
  if (videoAssets.length < minimumVideos) {
    blockers.push(blocker('approved_video_count_below_minimum', 'Quantidade de vídeos válidos abaixo do mínimo necessário.', {
      current: videoAssets.length,
      minimum: minimumVideos,
    }))
  }
  if (missingImageTags.length) {
    blockers.push(blocker('required_image_coverage_missing', 'Faltam categorias obrigatórias de fotos para identidade.', { missingTags: missingImageTags }))
  }
  if (missingVideoTags.length) {
    blockers.push(blocker('required_video_coverage_missing', 'Faltam categorias obrigatórias de vídeos para identidade.', { missingTags: missingVideoTags }))
  }

  const excludedByReason = classified.excluded.reduce((accumulator, item) => {
    accumulator[item.reason] = (accumulator[item.reason] || 0) + 1
    return accumulator
  }, {})
  const assetDiagnostics = [
    ...classified.included.map((item) => sanitizeDiagnosticAsset(item)),
    ...classified.excluded.map((item) => sanitizeDiagnosticAsset(item)),
  ].sort((left, right) => String(left.originalFilename || left.assetId).localeCompare(String(right.originalFilename || right.assetId)))
  const excludedDiagnostics = assetDiagnostics.filter((item) => item.datasetStatus === 'excluded')
  const checksumRepairCandidates = excludedDiagnostics.filter((item) => item.reasonCode === 'missing_or_invalid_checksum')
  const actionableDiagnostics = excludedDiagnostics.filter((item) => item.requiresAction)
  const historicalDiagnostics = excludedDiagnostics.filter((item) => item.recoverability === 'historical_only')
  const noActionDiagnostics = excludedDiagnostics.filter((item) => item.noActionRequired)
  if (classified.excluded.length) {
    warnings.push(warning('assets_excluded_from_identity_dataset', 'Alguns materiais foram excluídos do conjunto de identidade por segurança ou integridade.', excludedByReason))
  }

  const manifestAssets = classified.included.map((asset) => ({
    assetId: asset.assetId,
    mappingRequirementId: asset.mappingRequirementId,
    systemTag: asset.systemTag,
    mediaType: asset.mediaType,
    contentType: asset.contentType,
    byteSize: asset.byteSize,
    checksumSha256: asset.checksumSha256,
    source: asset.source,
  }))
  const inventoryCore = {
    schemaVersion: 'privacy-identity-dataset-inventory-v2',
    actorProfileId,
    kycCaseId: mappingCase?.id || null,
    authorizationId: legacyAvatarAuthorization?.id || null,
    identityPreparationAuthorization: actorScopedAuthorization ? {
      source: 'actor_profile_metadata',
      actorProfileId: actorScopedAuthorization.actorProfileId || actorProfileId,
      kycCaseId: actorScopedAuthorization.kycCaseId || mappingCase?.id || null,
      authorizedAt: actorScopedAuthorization.authorizedAt || null,
      scope: actorScopedAuthorization.scope || 'prepare_actor_identity_only',
    } : null,
    consentSnapshotSha256,
    assets: manifestAssets,
  }
  const inventoryFingerprintSha256 = sha256(stableStringify(inventoryCore))
  const approvedAssets = allAssets.filter((asset) => normalizeLower(asset.status) === 'approved')
  const pendingReviewAssets = allAssets.filter((asset) => normalizeLower(asset.status) === 'pending_review')
  const rejectedAssets = allAssets.filter((asset) => normalizeLower(asset.status) === 'rejected')
  const pendingReviewImages = pendingReviewAssets.filter((asset) => normalizeContentType(asset.content_type).startsWith('image/'))
  const pendingReviewVideos = pendingReviewAssets.filter((asset) => normalizeContentType(asset.content_type).startsWith('video/'))
  const approvedAudioAssets = approvedAssets.filter((asset) => normalizeContentType(asset.content_type).startsWith('audio/'))
  const lineageSupersededAssets = classified.excluded.filter((asset) => asset.reason === 'superseded_lineage_version')
  const checksumCoveragePercent = classified.candidateVisualAssets > 0
    ? Number(((classified.candidateWithValidChecksum / classified.candidateVisualAssets) * 100).toFixed(2))
    : 0
  const ready = blockers.length === 0
  const trainingConfigurationCodes = new Set(trainingConfigurationBlockers.map((item) => item.code))
  const datasetRegistrationBlockers = blockers.filter((item) => !trainingConfigurationCodes.has(item.code))
  const datasetRegistrationReady = datasetRegistrationBlockers.length === 0
  const trainingConfigurationReady = trainingConfigurationBlockers.length === 0
  const completionPlan = buildIdentityCompletionPlan({
    requirements,
    assets: allAssets,
    classified,
    minimumImages,
    minimumVideos,
  })

  const response = {
    status: ready ? 'IDENTITY_LORA_DATASET_READINESS_READY' : 'IDENTITY_LORA_DATASET_READINESS_BLOCKED',
    actor: {
      id: actor.id,
      displayName: actor.display_name || actor.legal_name || 'Ator/Atriz',
      status: actor.status || null,
      mappingStatus: actor.kyc_status || null,
      productionStatus: actor.production_status || null,
    },
    mappingCase: mappingCase ? {
      id: mappingCase.id,
      status: mappingCase.status,
      reviewedAt: mappingCase.reviewed_at || null,
    } : null,
    authorization: authorization ? {
      source: authorizationSource,
      id: legacyAvatarAuthorization?.id || null,
      actorProfileId: actorScopedAuthorization?.actorProfileId || legacyAvatarAuthorization?.actor_profile_id || actorProfileId,
      kycCaseId: actorScopedAuthorization?.kycCaseId || legacyAvatarAuthorization?.kyc_case_id || mappingCase?.id || null,
      status: actorScopedAuthorization?.status || legacyAvatarAuthorization?.status || null,
      scope: actorScopedAuthorization?.scope || 'legacy_avatar_production',
      authorizedAt: actorScopedAuthorization?.authorizedAt || legacyAvatarAuthorization?.created_at || null,
      videoAllowed: actorScopedAuthorization ? false : authorizationAllowsVideo(legacyAvatarAuthorization),
      consentSnapshotSha256Prefix: consentSnapshotSha256?.slice(0, 12) || null,
    } : null,
    readiness: {
      ready,
      blockers,
      warnings,
      nextAction: ready
        ? 'A configuração controlada do treinamento pode ser preparada.'
        : 'Corrija os bloqueios antes de preparar o treinamento.',
    },
    datasetRegistration: {
      ready: datasetRegistrationReady,
      blockers: datasetRegistrationBlockers,
      nextAction: datasetRegistrationReady
        ? 'Registrar e congelar o conjunto aprovado.'
        : 'Corrija as pendências do conjunto antes de registrá-lo.',
    },
    trainingConfiguration: {
      ready: trainingConfigurationReady,
      blockers: trainingConfigurationBlockers,
      baseModel: normalizeText(env.IDENTITY_LORA_BASE_MODEL) || null,
      baseModelRevisionConfigured: isGitCommitIdentityBaseModelLock(baseModelRevision),
      baseModelRevisionPrefix: isGitCommitIdentityBaseModelLock(baseModelRevision) ? baseModelRevision.slice(0, 12) : null,
      baseModelFingerprintConfigured: isSha256(baseModelFingerprint),
      baseModelFingerprintPrefix: isSha256(baseModelFingerprint) ? baseModelFingerprint.slice(0, 12) : null,
      baseModelLockConfigured: baseModelLockAudit.lockExists,
      baseModelLockVerified: baseModelLockAudit.ready,
      baseModelLockPath: normalizeText(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH) || null,
      baseModelLockFingerprintPrefix: baseModelLockAudit.fingerprintPrefix || null,
      baseModelArtifactCount: baseModelLockAudit.artifactCount || 0,
      baseModelRequiredArtifactCount: baseModelLockAudit.requiredArtifactCount || 0,
      privateTrainingBucketConfigured: privateBucketConfigured,
      privateTrainingBucketName: privateBucketConfigured ? privateBucket : null,
      trainingEngine: 'DiffSynth-Studio',
      trainingEngineCommit: trainingEngineCommit || null,
      trainingEngineCommitConfigured: Boolean(trainingEngineCommit),
      dryRunOnly,
      realTrainingDisabled,
      nextAction: trainingConfigurationReady
        ? 'A configuração está pronta para uma validação segura, sem iniciar treinamento.'
        : 'Concluir a configuração segura do ambiente e atualizar esta verificação.',
    },
    thresholds: {
      minimumImages,
      minimumVideos,
      recommendedImages: '15-20',
      recommendedShortVideos: '6-10',
      requiredImageTags: REQUIRED_IMAGE_TAGS,
      requiredVideoTags: REQUIRED_VIDEO_TAGS,
    },
    summary: {
      totalMappingAssets: allAssets.length,
      approvedMappingAssets: approvedAssets.length,
      pendingReviewAssets: pendingReviewAssets.length,
      pendingReviewImages: pendingReviewImages.length,
      pendingReviewVideos: pendingReviewVideos.length,
      rejectedAssets: rejectedAssets.length,
      approvedAudioAssets: approvedAudioAssets.length,
      includedVisualAssets: classified.included.length,
      validUniqueImages: imageAssets.length,
      validUniqueVideos: videoAssets.length,
      lineageSupersededAssets: lineageSupersededAssets.length,
      excludedAssets: classified.excluded.length,
      checksumCoveragePercent,
      privateTrainingBucketConfigured: privateBucketConfigured,
      baseModelFingerprintConfigured: isSha256(baseModelFingerprint),
      baseModelRevisionConfigured: isGitCommitIdentityBaseModelLock(baseModelRevision),
      baseModelLockVerified: baseModelLockAudit.ready,
    },
    coverage: {
      imageTags: [...imageTags].sort(),
      videoTags: [...videoTags].sort(),
      missingImageTags,
      missingVideoTags,
    },
    inventory: {
      schemaVersion: inventoryCore.schemaVersion,
      fingerprintSha256: inventoryFingerprintSha256,
      fingerprintSha256Prefix: inventoryFingerprintSha256.slice(0, 12),
      assetCount: manifestAssets.length,
      assets: classified.included.map(sanitizedAsset),
    },
    exclusions: {
      total: classified.excluded.length,
      byReason: excludedByReason,
    },
    completionPlan,
    diagnostics: {
      schemaVersion: 'privacy-identity-dataset-diagnostics-v1',
      assets: assetDiagnostics,
      summary: {
        included: classified.included.length,
        excluded: classified.excluded.length,
        checksumRepairCandidates: checksumRepairCandidates.length,
        actionRequired: actionableDiagnostics.length,
        historicalOnly: historicalDiagnostics.length,
        noActionRequired: noActionDiagnostics.length,
        reasons: Object.entries(excludedByReason)
          .map(([reasonCode, count]) => ({
            reasonCode,
            count,
            ...datasetReasonDetails(reasonCode),
          }))
          .sort((left, right) => right.count - left.count || left.reasonCode.localeCompare(right.reasonCode)),
      },
      checksumRepair: {
        candidateCount: checksumRepairCandidates.length,
        automaticMutationExecuted: false,
        privateObjectVerificationRequired: checksumRepairCandidates.length > 0,
        nextAction: checksumRepairCandidates.length > 0
          ? 'Use a conferência automática antes de pedir qualquer novo envio.'
          : 'Nenhum checksum pendente foi encontrado.',
      },
    },
    safety: {
      readOnly: true,
      databaseMutationExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      r2ReadExecuted: false,
      r2WriteExecuted: false,
      publicUrlCreated: false,
      trainingStarted: false,
      automaticRetryCreated: false,
    },
  }

  if (includePrivateManifest) {
    response.privateManifest = {
      ...inventoryCore,
      fingerprintSha256: inventoryFingerprintSha256,
      destination: privateBucketConfigured ? {
        bucket: privateBucket,
        public: false,
      } : null,
    }
  }

  return response
}

async function hashPrivateObject({ bucket, key }) {
  const object = await getKycVaultObject({ bucket, key })
  const hash = createHash('sha256')
  let byteSize = 0
  for await (const chunk of object.bodyStream) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    hash.update(buffer)
    byteSize += buffer.length
  }
  return {
    checksumSha256: hash.digest('hex'),
    byteSize,
    contentType: normalizeContentType(object.contentType),
  }
}

export async function inspectActorIdentityChecksumRepairReadiness(actorProfileId, { verifyR2 = false } = {}) {
  const actor = await loadActor(actorProfileId)
  const mappingCase = await loadLatestApprovedCase(actorProfileId)
  if (!mappingCase) throw new ApiError(409, 'Nenhum mapeamento aprovado foi encontrado para verificar a recuperação técnica.')

  const { requirements, assets } = await loadRequirementsAndAssets(actorProfileId, mappingCase.id)
  const requirementById = new Map(requirements.map((row) => [row.id, row]))
  const classified = classifyAssets(assets, requirementById)
  const candidates = classified.excluded.filter((item) => item.reason === 'missing_or_invalid_checksum')
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const existingChecksumsByScope = new Map()

  for (const asset of assets) {
    const checksum = normalizeLower(asset.checksum_sha256)
    if (!isSha256(checksum)) continue
    const scopeKey = [asset.actor_profile_id, asset.kyc_case_id, asset.mapping_requirement_id].join('|')
    const values = existingChecksumsByScope.get(scopeKey) || new Set()
    values.add(checksum)
    existingChecksumsByScope.set(scopeKey, values)
  }

  const items = []
  for (const candidate of candidates) {
    const asset = assetById.get(candidate.assetId)
    const item = {
      assetId: candidate.assetId,
      mappingRequirementId: candidate.mappingRequirementId,
      systemTag: candidate.systemTag,
      requirementTitle: candidate.requirementTitle,
      originalFilename: candidate.originalFilename,
      mediaType: candidate.mediaType,
      currentChecksumState: 'missing_or_invalid',
      verifyR2Requested: Boolean(verifyR2),
      objectExists: null,
      contentTypeMatches: null,
      byteSizeMatches: null,
      computedChecksumPrefix: null,
      duplicateWithinSameActorCaseRequirement: null,
      recoverable: null,
      blockers: [],
    }

    if (!asset || asset.actor_profile_id !== actorProfileId || asset.kyc_case_id !== mappingCase.id) {
      item.blockers.push('actor_or_case_scope_mismatch')
      item.recoverable = false
      items.push(item)
      continue
    }
    if (asset.mapping_requirement_id !== candidate.mappingRequirementId) {
      item.blockers.push('mapping_requirement_scope_mismatch')
      item.recoverable = false
      items.push(item)
      continue
    }
    if (!isPrivateObjectReference(asset.r2_bucket, asset.r2_key)) {
      item.blockers.push('invalid_private_storage_reference')
      item.recoverable = false
      items.push(item)
      continue
    }

    if (!verifyR2) {
      item.recoverable = null
      items.push(item)
      continue
    }

    try {
      const head = await headKycVaultObject({ bucket: asset.r2_bucket, key: asset.r2_key })
      item.objectExists = head.exists
      if (!head.exists) {
        item.blockers.push('private_object_missing')
        item.recoverable = false
        items.push(item)
        continue
      }

      const hashed = await hashPrivateObject({ bucket: asset.r2_bucket, key: asset.r2_key })
      const expectedContentType = normalizeContentType(asset.content_type)
      item.contentTypeMatches = !expectedContentType || hashed.contentType === expectedContentType
      item.byteSizeMatches = Number(asset.byte_size || 0) <= 0 || hashed.byteSize === Number(asset.byte_size)
      item.computedChecksumPrefix = hashed.checksumSha256.slice(0, 12)

      const scopeKey = [asset.actor_profile_id, asset.kyc_case_id, asset.mapping_requirement_id].join('|')
      const existing = existingChecksumsByScope.get(scopeKey) || new Set()
      item.duplicateWithinSameActorCaseRequirement = existing.has(hashed.checksumSha256)
      if (!item.contentTypeMatches) item.blockers.push('content_type_mismatch')
      if (!item.byteSizeMatches) item.blockers.push('byte_size_mismatch')
      if (item.duplicateWithinSameActorCaseRequirement) item.blockers.push('duplicate_checksum_in_same_scope')
      item.recoverable = item.blockers.length === 0
      if (item.recoverable) {
        existing.add(hashed.checksumSha256)
        existingChecksumsByScope.set(scopeKey, existing)
      }
    } catch (error) {
      item.blockers.push('private_object_read_failed')
      item.recoverable = false
      item.errorCode = normalizeText(error?.code || error?.name || 'storage_read_error')
    }
    items.push(item)
  }

  const recoverable = items.filter((item) => item.recoverable === true).length
  const blocked = items.filter((item) => item.recoverable === false).length
  const pendingVerification = items.filter((item) => item.recoverable === null).length

  return {
    status: verifyR2
      ? (blocked === 0 ? 'IDENTITY_CHECKSUM_REPAIR_READINESS_READY' : 'IDENTITY_CHECKSUM_REPAIR_READINESS_BLOCKED')
      : 'IDENTITY_CHECKSUM_REPAIR_READINESS_PLAN',
    actor: {
      id: actor.id,
      displayName: actor.display_name || actor.legal_name || 'Ator/Atriz',
    },
    mappingCase: {
      id: mappingCase.id,
      status: mappingCase.status,
    },
    summary: {
      candidates: candidates.length,
      recoverable,
      blocked,
      pendingVerification,
      verifyR2: Boolean(verifyR2),
    },
    items,
    nextAction: !verifyR2 && candidates.length > 0
      ? 'Repita com --verify-r2 para ler os objetos privados e confirmar quais checksums podem ser recuperados sem reenvio.'
      : recoverable > 0
        ? 'Os arquivos recuperáveis podem avançar para um backfill controlado em patch separado, com confirmação humana.'
        : candidates.length === 0
          ? 'Nenhum arquivo precisa de recuperação de checksum.'
          : 'Revise os bloqueios antes de qualquer alteração no banco.',
    safety: {
      readOnly: true,
      databaseMutationExecuted: false,
      r2ReadExecuted: Boolean(verifyR2 && candidates.length > 0),
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      publicUrlCreated: false,
      destructiveDelete: false,
    },
  }
}

const CHECKSUM_REPAIR_CONFIRMATION_PHRASE = 'REPARAR CHECKSUMS RECUPERAVEIS SEM ALTERAR ARQUIVOS D2C.4'

function sanitizedChecksumRepairItem(candidate, overrides = {}) {
  return {
    assetId: candidate.assetId,
    mappingRequirementId: candidate.mappingRequirementId,
    systemTag: candidate.systemTag,
    requirementTitle: candidate.requirementTitle,
    originalFilename: candidate.originalFilename,
    mediaType: candidate.mediaType,
    currentChecksumState: 'missing_or_invalid',
    objectExists: null,
    contentTypeMatches: null,
    byteSizeMatches: null,
    computedChecksumPrefix: null,
    duplicateWithinSameActorCaseRequirement: null,
    recoverable: null,
    blockers: [],
    ...overrides,
  }
}

async function buildControlledChecksumRepairPlan(actorProfileId, { expectedCaseId } = {}) {
  const actor = await loadActor(actorProfileId)
  const mappingCase = await loadLatestApprovedCase(actorProfileId)
  if (!mappingCase) throw new ApiError(409, 'Nenhum mapeamento aprovado foi encontrado para reparar checksums.')
  if (normalizeText(expectedCaseId) && mappingCase.id !== normalizeText(expectedCaseId)) {
    throw new ApiError(409, 'O caso aprovado atual não corresponde ao caso confirmado para o reparo.', {
      expectedCaseId: normalizeText(expectedCaseId),
      currentCaseId: mappingCase.id,
    })
  }

  const { requirements, assets } = await loadRequirementsAndAssets(actorProfileId, mappingCase.id)
  const requirementById = new Map(requirements.map((row) => [row.id, row]))
  const classified = classifyAssets(assets, requirementById)
  const candidates = classified.excluded.filter((item) => item.reason === 'missing_or_invalid_checksum')
  const assetById = new Map(assets.map((asset) => [asset.id, asset]))
  const checksumsByScope = new Map()

  for (const asset of assets) {
    const checksum = normalizeLower(asset.checksum_sha256)
    if (!isSha256(checksum)) continue
    const scopeKey = [asset.actor_profile_id, asset.kyc_case_id, asset.mapping_requirement_id].join('|')
    const values = checksumsByScope.get(scopeKey) || new Map()
    values.set(checksum, asset.id)
    checksumsByScope.set(scopeKey, values)
  }

  const items = []
  const recoverableRows = []
  const duplicateRows = []
  for (const candidate of candidates) {
    const asset = assetById.get(candidate.assetId)
    const item = sanitizedChecksumRepairItem(candidate)

    if (!asset || asset.actor_profile_id !== actorProfileId || asset.kyc_case_id !== mappingCase.id) {
      item.blockers.push('actor_or_case_scope_mismatch')
      item.recoverable = false
      items.push(item)
      continue
    }
    if (asset.mapping_requirement_id !== candidate.mappingRequirementId) {
      item.blockers.push('mapping_requirement_scope_mismatch')
      item.recoverable = false
      items.push(item)
      continue
    }
    if (!isPrivateObjectReference(asset.r2_bucket, asset.r2_key)) {
      item.blockers.push('invalid_private_storage_reference')
      item.recoverable = false
      items.push(item)
      continue
    }

    try {
      const head = await headKycVaultObject({ bucket: asset.r2_bucket, key: asset.r2_key })
      item.objectExists = head.exists
      if (!head.exists) {
        item.blockers.push('private_object_missing')
        item.recoverable = false
        items.push(item)
        continue
      }

      const hashed = await hashPrivateObject({ bucket: asset.r2_bucket, key: asset.r2_key })
      const expectedContentType = normalizeContentType(asset.content_type)
      item.contentTypeMatches = !expectedContentType || hashed.contentType === expectedContentType
      item.byteSizeMatches = Number(asset.byte_size || 0) <= 0 || hashed.byteSize === Number(asset.byte_size)
      item.computedChecksumPrefix = hashed.checksumSha256.slice(0, 12)

      const scopeKey = [asset.actor_profile_id, asset.kyc_case_id, asset.mapping_requirement_id].join('|')
      const existing = checksumsByScope.get(scopeKey) || new Map()
      item.duplicateWithinSameActorCaseRequirement = existing.has(hashed.checksumSha256)
      item.matchingAssetId = existing.get(hashed.checksumSha256) || null
      if (!item.contentTypeMatches) item.blockers.push('content_type_mismatch')
      if (!item.byteSizeMatches) item.blockers.push('byte_size_mismatch')
      if (item.duplicateWithinSameActorCaseRequirement) item.blockers.push('duplicate_checksum_in_same_scope')
      item.recoverable = item.blockers.length === 0

      if (item.recoverable) {
        existing.set(hashed.checksumSha256, asset.id)
        checksumsByScope.set(scopeKey, existing)
        recoverableRows.push({ asset, candidate, checksumSha256: hashed.checksumSha256 })
      } else if (item.duplicateWithinSameActorCaseRequirement && item.blockers.length === 1) {
        duplicateRows.push({
          asset,
          candidate,
          checksumSha256: hashed.checksumSha256,
          matchingAssetId: item.matchingAssetId,
        })
      }
    } catch (error) {
      item.blockers.push('private_object_read_failed')
      item.recoverable = false
      item.errorCode = normalizeText(error?.code || error?.name || 'storage_read_error')
    }
    items.push(item)
  }

  return { actor, mappingCase, candidates, items, recoverableRows, duplicateRows }
}

export async function reconcileActorIdentityDiagnosticDispositionControlled(actorProfileId, {
  apply = false,
  expectedCaseId,
  expectedConfirmedDuplicates,
  confirmationPhrase,
} = {}) {
  const expectedCount = Number(expectedConfirmedDuplicates)
  if (!normalizeText(expectedCaseId)) {
    throw new ApiError(400, 'Informe explicitamente o kyc_case_id esperado para a classificação.')
  }
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new ApiError(400, 'Informe a quantidade esperada de cópias repetidas confirmadas.')
  }

  const plan = await buildControlledChecksumRepairPlan(actorProfileId, { expectedCaseId })
  if (plan.duplicateRows.length !== expectedCount) {
    throw new ApiError(409, 'A quantidade de cópias confirmadas mudou. Nenhum registro foi alterado.', {
      expectedConfirmedDuplicates: expectedCount,
      currentConfirmedDuplicates: plan.duplicateRows.length,
      candidateCount: plan.candidates.length,
    })
  }

  const baseResponse = {
    actor: {
      id: plan.actor.id,
      displayName: plan.actor.display_name || plan.actor.legal_name || 'Ator/Atriz',
    },
    mappingCase: {
      id: plan.mappingCase.id,
      status: plan.mappingCase.status,
    },
    summary: {
      candidates: plan.candidates.length,
      confirmedDuplicates: plan.duplicateRows.length,
      expectedConfirmedDuplicates: expectedCount,
      filesChanged: apply ? plan.duplicateRows.length : 0,
    },
    items: plan.items,
  }

  if (!apply) {
    return {
      status: 'IDENTITY_DIAGNOSTIC_DISPOSITION_CONTROLLED_PLAN',
      ...baseResponse,
      nextAction: 'Repita com --apply e a frase exata para classificar somente as cópias já confirmadas.',
      safety: {
        readOnly: true,
        databaseMutationExecuted: false,
        r2ReadExecuted: true,
        r2WriteExecuted: false,
        runPodCalled: false,
        gpuStarted: false,
        trainingStarted: false,
        publicUrlCreated: false,
        destructiveDelete: false,
        automaticRetryCreated: false,
      },
    }
  }

  if (normalizeText(confirmationPhrase) !== DIAGNOSTIC_DISPOSITION_CONFIRMATION_PHRASE) {
    throw new ApiError(403, 'Frase de confirmação inválida. Nenhum registro foi alterado.')
  }

  const classifiedRows = []
  const appliedRows = []
  try {
    for (const row of plan.duplicateRows) {
      const asset = row.asset
      const originalMetadata = safeObject(asset.metadata)
      const classifiedAt = new Date().toISOString()
      const disposition = {
        schemaVersion: 'privacy-identity-dataset-disposition-v1',
        stage: '2.2D2C.7',
        reasonCode: 'confirmed_duplicate_history',
        noActionRequired: true,
        classifiedAt,
        method: 'private_stream_sha256_match',
        actorProfileId,
        kycCaseId: plan.mappingCase.id,
        mappingRequirementId: asset.mapping_requirement_id,
        sourceAssetId: asset.id,
        matchingAssetId: row.matchingAssetId,
        checksumPrefix: row.checksumSha256.slice(0, 12),
        r2WriteExecuted: false,
      }
      const history = Array.isArray(originalMetadata.identityDatasetDispositionHistory)
        ? originalMetadata.identityDatasetDispositionHistory.slice(-9)
        : []
      const nextMetadata = {
        ...originalMetadata,
        identityDatasetDisposition: disposition,
        identityDatasetDispositionHistory: [...history, disposition],
      }

      const { data, error } = await supabaseAdmin
        .from(KYC_ASSETS_TABLE)
        .update({ metadata: nextMetadata, updated_at: classifiedAt })
        .eq('id', asset.id)
        .eq('actor_profile_id', actorProfileId)
        .eq('kyc_case_id', plan.mappingCase.id)
        .eq('mapping_requirement_id', asset.mapping_requirement_id)
        .eq('status', asset.status)
        .select('id, actor_profile_id, kyc_case_id, mapping_requirement_id, metadata, updated_at')
        .maybeSingle()

      if (error) throw new ApiError(500, 'Falha ao registrar a cópia confirmada no histórico.', error)
      if (!data || safeObject(data.metadata).identityDatasetDisposition?.reasonCode !== 'confirmed_duplicate_history') {
        throw new ApiError(409, 'O arquivo mudou durante a classificação. A operação foi interrompida.')
      }

      appliedRows.push({ asset, originalMetadata, originalUpdatedAt: asset.updated_at, classifiedAt })
      classifiedRows.push({
        assetId: asset.id,
        mappingRequirementId: asset.mapping_requirement_id,
        originalFilename: asset.original_filename,
        matchingAssetId: row.matchingAssetId,
        classifiedAt,
      })
    }
  } catch (error) {
    const rollbackFailures = []
    for (const applied of [...appliedRows].reverse()) {
      const rollback = await supabaseAdmin
        .from(KYC_ASSETS_TABLE)
        .update({
          metadata: applied.originalMetadata,
          updated_at: applied.originalUpdatedAt || new Date().toISOString(),
        })
        .eq('id', applied.asset.id)
        .eq('actor_profile_id', actorProfileId)
        .eq('kyc_case_id', plan.mappingCase.id)
        .eq('mapping_requirement_id', applied.asset.mapping_requirement_id)
        .eq('updated_at', applied.classifiedAt)
        .select('id')
        .maybeSingle()
      if (rollback.error || !rollback.data) rollbackFailures.push(applied.asset.id)
    }
    throw new ApiError(error?.statusCode || 500, error?.message || 'Falha na classificação controlada.', {
      cause: error?.details || null,
      classifiedBeforeFailure: appliedRows.length,
      rollbackAttempted: appliedRows.length > 0,
      rollbackFailures,
      databaseMutationExecuted: appliedRows.length > 0,
    })
  }

  const postReadiness = await auditActorIdentityDatasetReadiness(actorProfileId)
  return {
    status: 'IDENTITY_DIAGNOSTIC_DISPOSITION_CONTROLLED_APPLIED',
    ...baseResponse,
    classified: classifiedRows,
    postReadiness: {
      status: postReadiness.status,
      ready: postReadiness.readiness.ready,
      actionRequired: postReadiness.diagnostics.summary.actionRequired,
      historicalOnly: postReadiness.diagnostics.summary.historicalOnly,
      checksumRepairCandidates: postReadiness.diagnostics.summary.checksumRepairCandidates,
      validUniqueImages: postReadiness.summary.validUniqueImages,
      validUniqueVideos: postReadiness.summary.validUniqueVideos,
    },
    nextAction: 'Atualize a Página do Ator. Cópias confirmadas passam a aparecer apenas como histórico, sem falsa pendência.',
    safety: {
      readOnly: false,
      databaseMutationExecuted: classifiedRows.length > 0,
      databaseRowsUpdated: classifiedRows.length,
      r2ReadExecuted: true,
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      publicUrlCreated: false,
      destructiveDelete: false,
      automaticRetryCreated: false,
    },
  }
}

export async function repairActorIdentityChecksumsControlled(actorProfileId, {
  apply = false,
  expectedCaseId,
  expectedRecoverable,
  confirmationPhrase,
} = {}) {
  const expectedCount = Number(expectedRecoverable)
  if (!normalizeText(expectedCaseId)) {
    throw new ApiError(400, 'Informe explicitamente o kyc_case_id esperado para o reparo.')
  }
  if (!Number.isInteger(expectedCount) || expectedCount < 1) {
    throw new ApiError(400, 'Informe uma quantidade esperada de arquivos recuperáveis maior que zero.')
  }

  const plan = await buildControlledChecksumRepairPlan(actorProfileId, { expectedCaseId })
  if (plan.recoverableRows.length !== expectedCount) {
    throw new ApiError(409, 'A quantidade recuperável mudou desde a inspeção. Nenhum checksum foi alterado.', {
      expectedRecoverable: expectedCount,
      currentRecoverable: plan.recoverableRows.length,
      candidateCount: plan.candidates.length,
    })
  }

  const baseResponse = {
    actor: {
      id: plan.actor.id,
      displayName: plan.actor.display_name || plan.actor.legal_name || 'Ator/Atriz',
    },
    mappingCase: {
      id: plan.mappingCase.id,
      status: plan.mappingCase.status,
    },
    summary: {
      candidates: plan.candidates.length,
      recoverable: plan.recoverableRows.length,
      blocked: plan.items.filter((item) => item.recoverable === false).length,
      expectedRecoverable: expectedCount,
    },
    items: plan.items,
  }

  if (!apply) {
    return {
      status: 'IDENTITY_CHECKSUM_BACKFILL_CONTROLLED_PLAN',
      ...baseResponse,
      nextAction: 'Repita com --apply e a frase de confirmação exata para atualizar somente os arquivos recuperáveis.',
      safety: {
        readOnly: true,
        databaseMutationExecuted: false,
        r2ReadExecuted: true,
        r2WriteExecuted: false,
        runPodCalled: false,
        gpuStarted: false,
        trainingStarted: false,
        publicUrlCreated: false,
        destructiveDelete: false,
        automaticRetryCreated: false,
      },
    }
  }

  if (normalizeText(confirmationPhrase) !== CHECKSUM_REPAIR_CONFIRMATION_PHRASE) {
    throw new ApiError(403, 'Frase de confirmação inválida. Nenhum checksum foi alterado.')
  }

  const repaired = []
  const appliedRows = []
  try {
    for (const row of plan.recoverableRows) {
      const asset = row.asset
      const originalMetadata = safeObject(asset.metadata)
      const repairedAt = new Date().toISOString()
      const repairEntry = {
        schemaVersion: 'privacy-identity-checksum-repair-v1',
        stage: '2.2D2C.4',
        repairedAt,
        method: 'r2_private_stream_sha256',
        actorProfileId,
        kycCaseId: plan.mappingCase.id,
        mappingRequirementId: asset.mapping_requirement_id,
        sourceAssetId: asset.id,
        previousChecksumState: 'missing_or_invalid',
        privateObjectVerified: true,
        contentTypeVerified: true,
        byteSizeVerified: true,
        duplicateInSameScope: false,
        r2WriteExecuted: false,
      }
      const history = Array.isArray(originalMetadata.identityChecksumRepairHistory)
        ? originalMetadata.identityChecksumRepairHistory.slice(-9)
        : []
      const nextMetadata = {
        ...originalMetadata,
        identityChecksumRepair: repairEntry,
        identityChecksumRepairHistory: [...history, repairEntry],
      }

      let updateQuery = supabaseAdmin
        .from(KYC_ASSETS_TABLE)
        .update({
          checksum_sha256: row.checksumSha256,
          metadata: nextMetadata,
          updated_at: repairedAt,
        })
        .eq('id', asset.id)
        .eq('actor_profile_id', actorProfileId)
        .eq('kyc_case_id', plan.mappingCase.id)
        .eq('mapping_requirement_id', asset.mapping_requirement_id)
        .eq('status', asset.status)

      if (asset.checksum_sha256 === null || asset.checksum_sha256 === undefined) {
        updateQuery = updateQuery.is('checksum_sha256', null)
      } else {
        updateQuery = updateQuery.eq('checksum_sha256', asset.checksum_sha256)
      }

      const { data, error } = await updateQuery
        .select('id, actor_profile_id, kyc_case_id, mapping_requirement_id, checksum_sha256, updated_at')
        .maybeSingle()
      if (error) throw new ApiError(500, 'Falha ao registrar o checksum recuperado.', error)
      if (!data || data.checksum_sha256 !== row.checksumSha256) {
        throw new ApiError(409, 'O arquivo mudou durante o reparo. A operação foi interrompida.')
      }

      appliedRows.push({
        asset,
        repairedChecksumSha256: row.checksumSha256,
        originalMetadata,
        originalUpdatedAt: asset.updated_at,
      })
      repaired.push({
        assetId: asset.id,
        mappingRequirementId: asset.mapping_requirement_id,
        systemTag: row.candidate.systemTag,
        originalFilename: asset.original_filename,
        checksumSha256Prefix: row.checksumSha256.slice(0, 12),
        repairedAt,
      })
    }
  } catch (error) {
    const rollbackFailures = []
    for (const applied of [...appliedRows].reverse()) {
      let rollbackQuery = supabaseAdmin
        .from(KYC_ASSETS_TABLE)
        .update({
          checksum_sha256: applied.asset.checksum_sha256 ?? null,
          metadata: applied.originalMetadata,
          updated_at: applied.originalUpdatedAt || new Date().toISOString(),
        })
        .eq('id', applied.asset.id)
        .eq('actor_profile_id', actorProfileId)
        .eq('kyc_case_id', plan.mappingCase.id)
        .eq('mapping_requirement_id', applied.asset.mapping_requirement_id)
        .eq('checksum_sha256', applied.repairedChecksumSha256)
      const rollback = await rollbackQuery.select('id').maybeSingle()
      if (rollback.error || !rollback.data) rollbackFailures.push(applied.asset.id)
    }
    throw new ApiError(error?.statusCode || 500, error?.message || 'Falha no reparo controlado de checksums.', {
      cause: error?.details || null,
      repairedBeforeFailure: appliedRows.length,
      rollbackAttempted: appliedRows.length > 0,
      rollbackFailures,
      databaseMutationExecuted: appliedRows.length > 0,
    })
  }

  const postReadiness = await auditActorIdentityDatasetReadiness(actorProfileId)
  return {
    status: 'IDENTITY_CHECKSUM_BACKFILL_CONTROLLED_APPLIED',
    ...baseResponse,
    repaired,
    postReadiness: {
      status: postReadiness.status,
      ready: postReadiness.readiness.ready,
      validUniqueImages: postReadiness.summary.validUniqueImages,
      validUniqueVideos: postReadiness.summary.validUniqueVideos,
      checksumCoveragePercent: postReadiness.summary.checksumCoveragePercent,
      remainingChecksumRepairCandidates: postReadiness.diagnostics.checksumRepair.candidateCount,
      blockers: postReadiness.readiness.blockers.map((item) => item.code),
    },
    nextAction: 'Repita o readiness do conjunto e complemente apenas as fotos e vídeos que ainda faltarem.',
    safety: {
      readOnly: false,
      databaseMutationExecuted: repaired.length > 0,
      databaseRowsUpdated: repaired.length,
      r2ReadExecuted: true,
      r2WriteExecuted: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      publicUrlCreated: false,
      destructiveDelete: false,
      automaticRetryCreated: false,
    },
  }
}
