import { createHash, randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { auditActorIdentityDatasetReadiness } from './actor-identity-dataset-readiness.service.js'

const TRAINING_RUNS_TABLE = 'actor_identity_training_runs'
const CONFIRMATION_PHRASE = 'REGISTRAR CONJUNTO APROVADO'
const ACTIVE_DATASET_STATUSES = new Set([
  'dataset_pending',
  'dataset_ready',
  'dry_run_ready',
  'training_pending',
  'training_in_progress',
  'training_completed',
  'qa_pending',
])

function normalizeText(value) {
  return String(value || '').trim()
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

function isMissingRelationError(error) {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return code === '42P01'
    || code === 'PGRST205'
    || message.includes('could not find the table')
    || message.includes('relation') && message.includes('does not exist')
}

function publicRun(row) {
  if (!row) return null
  const manifest = row.dataset_manifest && typeof row.dataset_manifest === 'object' ? row.dataset_manifest : {}
  const summary = manifest.summary && typeof manifest.summary === 'object' ? manifest.summary : {}
  return {
    id: row.id,
    mode: row.mode,
    status: row.status,
    statusLabel: row.status === 'dataset_ready' ? 'Conjunto registrado' : row.status,
    datasetManifestSha256Prefix: normalizeText(row.dataset_manifest_sha256).slice(0, 12) || null,
    imageCount: Number(summary.imageCount || 0),
    videoCount: Number(summary.videoCount || 0),
    audioCount: Number(summary.audioCount || 0),
    baseModel: row.base_model || null,
    trainingEngine: row.training_engine || null,
    trainingEngineCommit: row.training_engine_commit || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function registerActorIdentityDataset(actorProfileId, input = {}, { requestedByProfileId = null } = {}) {
  if (normalizeText(input.confirmation) !== CONFIRMATION_PHRASE) {
    throw new ApiError(422, 'A confirmação do registro do conjunto não foi reconhecida.')
  }
  if (!requestedByProfileId) {
    throw new ApiError(401, 'Não foi possível identificar o Admin responsável pelo registro do conjunto.')
  }

  const datasetAudit = await auditActorIdentityDatasetReadiness(actorProfileId, {
    includePrivateManifest: true,
    requireIdentityAuthorization: true,
    requireTrainingConfiguration: false,
  })

  if (!datasetAudit.datasetRegistration?.ready || !datasetAudit.privateManifest) {
    throw new ApiError(409, 'O conjunto aprovado ainda não pode ser registrado.', {
      blockers: datasetAudit.datasetRegistration?.blockers || datasetAudit.readiness.blockers,
      summary: datasetAudit.summary,
      coverage: datasetAudit.coverage,
      diagnostics: datasetAudit.diagnostics?.summary,
    })
  }

  const assets = datasetAudit.privateManifest.assets || []
  const imageCount = assets.filter((item) => item.mediaType === 'image').length
  const videoCount = assets.filter((item) => item.mediaType === 'video').length
  const audioCount = assets.filter((item) => item.mediaType === 'audio').length
  const manifest = {
    schemaVersion: 'privacy-identity-dataset-manifest-v2',
    scope: 'actor_visual_identity_dataset',
    actorProfileId,
    kycCaseId: datasetAudit.mappingCase.id,
    consentSource: 'actor_identity_preparation_authorization',
    consentSnapshotSha256: datasetAudit.privateManifest.consentSnapshotSha256,
    identityPreparationAuthorization: datasetAudit.privateManifest.identityPreparationAuthorization || null,
    authorizationId: datasetAudit.privateManifest.authorizationId || null,
    inventoryFingerprintSha256: datasetAudit.privateManifest.fingerprintSha256,
    assets,
    summary: {
      imageCount,
      videoCount,
      audioCount,
      totalAssets: assets.length,
    },
    safety: {
      immutableDatasetSnapshot: true,
      modelConfigurationExcluded: true,
      signedUrlsPersisted: false,
      publicUrlsAllowed: false,
      filesCopied: false,
      noTrainingStarted: true,
    },
  }
  const manifestSha256 = sha256(stableStringify(manifest))

  const { data: activeRows, error: activeError } = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .in('status', [...ACTIVE_DATASET_STATUSES])
    .order('created_at', { ascending: false })
    .limit(5)

  if (activeError) {
    if (isMissingRelationError(activeError)) throw new ApiError(409, 'O registro controlado do conjunto ainda não está disponível no banco.')
    throw new ApiError(500, 'Erro ao verificar conjuntos de identidade já registrados.', activeError)
  }

  const existing = (activeRows || [])[0] || null
  if (existing) {
    if (existing.dataset_manifest_sha256 === manifestSha256) {
      return {
        status: 'ACTOR_IDENTITY_DATASET_ALREADY_REGISTERED',
        run: publicRun(existing),
        message: 'Este mesmo conjunto aprovado já está registrado. Nenhum registro duplicado foi criado.',
        safety: {
          databaseMutationExecuted: false,
          datasetManifestRegistered: true,
          modelConfigurationChanged: false,
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
    throw new ApiError(409, 'Já existe um conjunto ativo diferente para este ator. A divergência foi bloqueada para revisão administrativa.', {
      activeRunId: existing.id,
      activeStatus: existing.status,
      activeManifestSha256Prefix: normalizeText(existing.dataset_manifest_sha256).slice(0, 12) || null,
      currentManifestSha256Prefix: manifestSha256.slice(0, 12),
    })
  }

  const now = new Date().toISOString()
  const runId = randomUUID()
  const triggerToken = `prv_actor_${actorProfileId.replaceAll('-', '').slice(0, 8)}_v1`
  const { data, error } = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .insert({
      id: runId,
      actor_profile_id: actorProfileId,
      kyc_case_id: datasetAudit.mappingCase.id,
      mode: 'readiness_dry_run',
      status: 'dataset_ready',
      dataset_manifest: manifest,
      dataset_manifest_sha256: manifestSha256,
      dataset_r2_bucket: null,
      dataset_r2_prefix: null,
      base_model: normalizeText(env.IDENTITY_LORA_BASE_MODEL) || 'Wan-AI/Wan2.1-VACE-14B',
      base_model_fingerprint: null,
      training_engine: 'DiffSynth-Studio',
      training_engine_commit: normalizeText(env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT) || 'dataset-registration-only',
      trigger_token: triggerToken,
      requested_by_profile_id: requestedByProfileId,
      metadata: {
        source: 'stage_2_2d3_2_dataset_registration',
        datasetOnly: true,
        modelConfigurationPending: true,
        noRunPod: true,
        noR2Copy: true,
        noTrainingStarted: true,
        inventoryFingerprintSha256: datasetAudit.privateManifest.fingerprintSha256,
        consentSnapshotSha256: datasetAudit.privateManifest.consentSnapshotSha256,
      },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()

  if (error) {
    if (isMissingRelationError(error)) throw new ApiError(409, 'O registro controlado do conjunto ainda não está disponível no banco.')
    throw new ApiError(500, 'Erro ao registrar o conjunto aprovado da identidade.', error)
  }

  return {
    status: 'ACTOR_IDENTITY_DATASET_REGISTERED',
    run: publicRun(data),
    message: 'Conjunto aprovado registrado e congelado. A configuração do treinamento continua pendente e nenhum treinamento foi iniciado.',
    safety: {
      databaseMutationExecuted: true,
      datasetManifestRegistered: true,
      modelConfigurationChanged: false,
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
