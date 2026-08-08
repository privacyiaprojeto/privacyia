import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { auditActorIdentityDatasetReadiness } from './actor-identity-dataset-readiness.service.js'

const ACTORS_TABLE = 'actor_profiles'
const CONFIRMATION_PHRASE = 'AUTORIZAR USO PARA PREPARAR IDENTIDADE'

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim()
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase()
}

function identityPreparationAuthorization(metadata = {}) {
  const root = safeObject(metadata)
  const preparation = safeObject(root.identityPreparation)
  const authorization = safeObject(preparation.authorization)
  if (normalizeLower(authorization.status) !== 'active') return null
  return authorization
}

function publicAuthorization(row = {}) {
  return {
    source: 'actor_profile_metadata',
    actorProfileId: row.actorProfileId || null,
    kycCaseId: row.kycCaseId || null,
    status: row.status || null,
    scope: row.scope || null,
    authorizedAt: row.authorizedAt || null,
    authorizedByProfileId: row.authorizedByProfileId || null,
  }
}

async function loadActor(actorProfileId) {
  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, display_name, legal_name, status, kyc_status, production_status, metadata')
    .eq('id', actorProfileId)
    .maybeSingle()

  if (error) throw new ApiError(500, 'Erro ao carregar o ator para preparação da identidade.', error)
  if (!data) throw new ApiError(404, 'Ator não encontrado.')
  return data
}

function assertActorReadyForIdentityPreparation(actor, datasetAudit) {
  if (normalizeLower(actor.status) !== 'approved') {
    throw new ApiError(409, 'O ator precisa estar aprovado antes da preparação da identidade.')
  }
  if (normalizeLower(actor.kyc_status) !== 'approved') {
    throw new ApiError(409, 'O mapeamento precisa estar aprovado antes da preparação da identidade.')
  }
  if (!datasetAudit.mappingCase || normalizeLower(datasetAudit.mappingCase.status) !== 'approved') {
    throw new ApiError(409, 'Nenhum mapeamento aprovado foi encontrado para este ator.')
  }

  const summary = datasetAudit.summary || {}
  const thresholds = datasetAudit.thresholds || {}
  const coverage = datasetAudit.coverage || {}
  const diagnostics = datasetAudit.diagnostics?.summary || {}
  const materialBlockers = []

  if (Number(summary.pendingReviewAssets || 0) > 0) materialBlockers.push('Existem materiais aguardando decisão do Admin.')
  if (Number(diagnostics.actionRequired || 0) > 0) materialBlockers.push('Existem materiais com ação obrigatória pendente.')
  if (Number(summary.validUniqueImages || 0) < Number(thresholds.minimumImages || 15)) materialBlockers.push('A quantidade mínima de fotos válidas ainda não foi atingida.')
  if (Number(summary.validUniqueVideos || 0) < Number(thresholds.minimumVideos || 6)) materialBlockers.push('A quantidade mínima de vídeos válidos ainda não foi atingida.')
  if ((coverage.missingImageTags || []).length > 0) materialBlockers.push('Ainda faltam categorias obrigatórias de fotos.')
  if ((coverage.missingVideoTags || []).length > 0) materialBlockers.push('Ainda faltam categorias obrigatórias de vídeos.')

  if (materialBlockers.length > 0) {
    throw new ApiError(409, 'O conjunto visual ainda não está pronto para receber autorização de preparação.', {
      blockers: materialBlockers,
      summary,
      coverage,
      diagnostics,
    })
  }
}

export async function authorizeActorIdentityPreparation(actorProfileId, input = {}, { adminProfileId = null } = {}) {
  if (normalizeText(input.confirmation) !== CONFIRMATION_PHRASE) {
    throw new ApiError(422, 'A confirmação da autorização não foi reconhecida.')
  }
  if (!adminProfileId) {
    throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela autorização.')
  }

  const [actor, datasetAudit] = await Promise.all([
    loadActor(actorProfileId),
    auditActorIdentityDatasetReadiness(actorProfileId, { requireIdentityAuthorization: false }),
  ])

  assertActorReadyForIdentityPreparation(actor, datasetAudit)

  const mappingCaseId = datasetAudit.mappingCase.id
  const existingAuthorization = identityPreparationAuthorization(actor.metadata)
  if (existingAuthorization) {
    if (existingAuthorization.actorProfileId !== actorProfileId || existingAuthorization.kycCaseId !== mappingCaseId) {
      throw new ApiError(409, 'Existe uma autorização ativa vinculada a outro ator ou a outro mapeamento. A divergência foi bloqueada.')
    }
    return {
      status: 'ACTOR_IDENTITY_PREPARATION_AUTHORIZATION_ALREADY_ACTIVE',
      actor: {
        id: actor.id,
        displayName: actor.display_name || actor.legal_name || 'Ator/Atriz',
        productionStatus: actor.production_status || null,
      },
      mappingCase: datasetAudit.mappingCase,
      authorization: publicAuthorization(existingAuthorization),
      dataset: {
        validUniqueImages: datasetAudit.summary.validUniqueImages,
        validUniqueVideos: datasetAudit.summary.validUniqueVideos,
        includedVisualAssets: datasetAudit.summary.includedVisualAssets,
        actionRequired: datasetAudit.diagnostics.summary.actionRequired,
      },
      message: 'A preparação da identidade deste ator já está autorizada. Nenhuma autorização duplicada foi criada.',
      safety: {
        databaseMutationExecuted: false,
        runPodCalled: false,
        gpuStarted: false,
        trainingStarted: false,
        r2ReadExecuted: false,
        r2WriteExecuted: false,
        queueJobCreated: false,
        productCreated: false,
        publicUrlCreated: false,
      },
    }
  }

  const recordedAt = new Date().toISOString()
  const currentMetadata = safeObject(actor.metadata)
  const currentPreparation = safeObject(currentMetadata.identityPreparation)
  const termsSnapshot = {
    schemaVersion: 'privacy-actor-identity-preparation-consent-v2',
    scope: 'prepare_actor_identity_only',
    actorProfileId,
    kycCaseId: mappingCaseId,
    authorizedByProfileId: adminProfileId,
    approvedMappingConfirmed: true,
    approvedDatasetConfirmed: true,
    identityTrainingPreparationAllowed: true,
    automaticTrainingAllowed: false,
    productReleaseAllowed: false,
    publicPublicationAllowed: false,
    companionBindingRequiredBeforeProductRelease: true,
    recordedAt,
  }
  const authorization = {
    schemaVersion: 'privacy-actor-identity-preparation-authorization-v2',
    source: 'actor_profile_metadata',
    status: 'active',
    scope: 'prepare_actor_identity_only',
    actorProfileId,
    kycCaseId: mappingCaseId,
    authorizedByProfileId: adminProfileId,
    authorizedAt: recordedAt,
    note: normalizeText(input.note) || null,
    termsSnapshot,
    datasetInventoryFingerprintSha256Prefix: datasetAudit.inventory?.fingerprintSha256Prefix || null,
    validUniqueImages: datasetAudit.summary.validUniqueImages,
    validUniqueVideos: datasetAudit.summary.validUniqueVideos,
    noAutomaticTraining: true,
    noProductRelease: true,
  }
  const nextMetadata = {
    ...currentMetadata,
    identityPreparation: {
      ...currentPreparation,
      schemaVersion: 'privacy-actor-identity-preparation-v2',
      actorProfileId,
      kycCaseId: mappingCaseId,
      authorization,
      updatedAt: recordedAt,
    },
  }

  const { data: updatedActor, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({ metadata: nextMetadata })
    .eq('id', actorProfileId)
    .select('id, display_name, legal_name, production_status, metadata')
    .single()

  if (error) throw new ApiError(500, 'Erro ao registrar a autorização de preparação da identidade.', error)

  return {
    status: 'ACTOR_IDENTITY_PREPARATION_AUTHORIZED',
    actor: {
      id: updatedActor.id,
      displayName: updatedActor.display_name || updatedActor.legal_name || 'Ator/Atriz',
      productionStatus: updatedActor.production_status || null,
    },
    mappingCase: datasetAudit.mappingCase,
    authorization: publicAuthorization(authorization),
    dataset: {
      validUniqueImages: datasetAudit.summary.validUniqueImages,
      validUniqueVideos: datasetAudit.summary.validUniqueVideos,
      includedVisualAssets: datasetAudit.summary.includedVisualAssets,
      actionRequired: datasetAudit.diagnostics.summary.actionRequired,
    },
    message: 'Uso dos materiais autorizado para preparar a identidade de forma controlada. Nenhum treinamento ou produto foi iniciado.',
    safety: {
      databaseMutationExecuted: true,
      actorScopedAuthorizationRecorded: true,
      productionStatusChanged: false,
      runPodCalled: false,
      gpuStarted: false,
      trainingStarted: false,
      r2ReadExecuted: false,
      r2WriteExecuted: false,
      queueJobCreated: false,
      productCreated: false,
      publicUrlCreated: false,
    },
  }
}
