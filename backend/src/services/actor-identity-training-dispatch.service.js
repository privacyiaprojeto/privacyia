import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { prepareActorIdentityTrainingExecutionPlan } from './actor-identity-training-preflight.service.js'
import { assertControlledIdentityTrainingSmokePolicy, inspectControlledIdentityTrainingSmokePolicy } from './actor-identity-training-smoke-policy.service.js'
import { classifyIdentityTrainingFailure } from './actor-identity-training-failure.service.js'

const TRAINING_RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const CONFIRMATION = 'CRIAR IDENTIDADE REAL CONTROLADA D3.6B'
const CONTRACT_VERSION = 'privacy-identity-lora-training-v2'
const TERMINAL_PROVIDER_STATES = new Set(['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'])

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim()
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(normalizeText(value).toLowerCase())
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalizeText(value))
}

function isPrivateReference(bucket, key) {
  const cleanBucket = normalizeText(bucket)
  const cleanKey = normalizeText(key)
  return Boolean(cleanBucket && cleanKey && !/^https?:\/\//i.test(cleanBucket) && !/^https?:\/\//i.test(cleanKey) && !cleanKey.startsWith('/'))
}

function redactError(error) {
  const message = normalizeText(error?.message || error)
  return message.replace(/https?:\/\/\S+/gi, '[url-redacted]').slice(0, 500)
}

function stageSnapshot(run) {
  const stage = safeObject(safeObject(run?.metadata).stage_2_2d3_6a)
  return {
    dispatchStatus: normalizeText(stage.dispatchStatus) || 'not_started',
    providerJobId: normalizeText(stage.providerJobId) || null,
    submittedAt: stage.submittedAt || null,
    startedAt: stage.startedAt || run?.started_at || null,
    completedAt: stage.completedAt || run?.completed_at || null,
    lastCheckedAt: stage.lastCheckedAt || null,
    progressPercent: Number.isFinite(Number(stage.progressPercent)) ? Number(stage.progressPercent) : null,
    adapterRegistered: stage.adapterRegistered === true,
    lastError: normalizeText(stage.lastError) || null,
    failureCode: normalizeText(stage.failureCode) || null,
    failureCategory: normalizeText(stage.failureCategory) || null,
    retryable: stage.retryable === true,
    operatorMessage: normalizeText(stage.operatorMessage) || null,
    failedAt: stage.failedAt || run?.failed_at || null,
  }
}

function resolveBackendRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url))
  return path.resolve(here, '..', '..')
}

async function loadBaseModelLock() {
  const lockPath = path.resolve(resolveBackendRoot(), normalizeText(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH))
  let payload
  try {
    payload = JSON.parse(await readFile(lockPath, 'utf8'))
  } catch (error) {
    throw new ApiError(409, 'O lock auditável do modelo-base não pôde ser carregado.', { reason: redactError(error) })
  }
  if (payload?.schemaVersion !== 'privacy-identity-base-model-lock-v1') {
    throw new ApiError(409, 'O lock do modelo-base usa um contrato incompatível.')
  }
  if (normalizeText(payload.repository) !== normalizeText(env.IDENTITY_LORA_BASE_MODEL)) {
    throw new ApiError(409, 'O repositório do lock não corresponde ao modelo-base configurado.')
  }
  if (normalizeText(payload.revision) !== normalizeText(env.IDENTITY_LORA_BASE_MODEL_REVISION)) {
    throw new ApiError(409, 'A revisão do lock não corresponde à revisão configurada.')
  }
  if (normalizeText(payload.fingerprintSha256) !== normalizeText(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)) {
    throw new ApiError(409, 'A assinatura do lock não corresponde ao fingerprint configurado.')
  }
  const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : []
  if (artifacts.length !== 9 || artifacts.some((item) => !normalizeText(item.path) || !isSha256(item.sha256) || Number(item.size || 0) <= 0)) {
    throw new ApiError(409, 'O lock do modelo-base não contém os nove artefatos válidos esperados.')
  }
  return payload
}

export function inspectActorIdentityTrainingDispatchEnvironment() {
  const blockers = []
  const endpointId = normalizeText(env.IDENTITY_LORA_TRAINER_ENDPOINT_ID)
  const apiKeyConfigured = Boolean(normalizeText(env.RUNPOD_API_KEY))
  if (!endpointId) blockers.push('trainer_endpoint_not_configured')
  if (!apiKeyConfigured) blockers.push('runpod_api_key_not_configured')
  if (env.IDENTITY_LORA_TRAINING_ENABLED !== true) blockers.push('real_training_disabled_by_policy')
  if (env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true) blockers.push('dry_run_only_mode_active')
  if (env.IDENTITY_LORA_INFERENCE_INJECTION_READY === true) blockers.push('inference_injection_must_remain_disabled_during_training')
  if (!normalizeText(env.IDENTITY_LORA_BASE_MODEL_REVISION)) blockers.push('base_model_revision_missing')
  if (!isSha256(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)) blockers.push('base_model_fingerprint_missing')
  if (!normalizeText(env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT)) blockers.push('training_engine_commit_missing')
  if (!normalizeText(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME)) blockers.push('private_bucket_missing')
  if (normalizeText(env.IDENTITY_LORA_TRAINER_CONTRACT_VERSION) !== CONTRACT_VERSION) blockers.push('trainer_contract_v2_required')
  if (env.IDENTITY_LORA_TRAINING_TARGET_AUDIT_APPROVED !== true) blockers.push('training_target_audit_not_approved')
  if (env.IDENTITY_LORA_PAID_TRAINING_AFTER_TARGET_AUDIT !== true) blockers.push('paid_training_after_target_audit_disabled')
  if (normalizeText(env.IDENTITY_LORA_TRAINING_TARGET_PROFILE) !== 'wan_dit_identity_video_v1') blockers.push('training_target_profile_not_approved')
  const smokePolicy = inspectControlledIdentityTrainingSmokePolicy()
  blockers.push(...smokePolicy.blockers.filter((item) => !blockers.includes(item)))

  return {
    provider: 'runpod_serverless',
    endpointConfigured: Boolean(endpointId),
    apiKeyConfigured,
    realTrainingEnabled: env.IDENTITY_LORA_TRAINING_ENABLED === true,
    dryRunOnly: env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true,
    smokePolicy,
    trainingTargetGate: {
      auditApproved: env.IDENTITY_LORA_TRAINING_TARGET_AUDIT_APPROVED === true,
      paidTrainingAllowed: env.IDENTITY_LORA_PAID_TRAINING_AFTER_TARGET_AUDIT === true,
      configuredProfile: normalizeText(env.IDENTITY_LORA_TRAINING_TARGET_PROFILE),
      approvedProfile: 'wan_dit_identity_video_v1',
    },
    ready: blockers.length === 0,
    blockers,
  }
}

async function loadLatestRun(actorProfileId) {
  const result = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (result.error) throw new ApiError(500, 'Erro ao carregar a preparação da identidade.', result.error)
  if (!result.data) throw new ApiError(409, 'Nenhum conjunto validado foi encontrado para este ator.')
  return result.data
}

function compileSamples(manifest, triggerToken) {
  const assets = Array.isArray(manifest.assets) ? manifest.assets : []
  const images = assets.filter((item) => item.mediaType === 'image' && isPrivateReference(item.source?.bucket, item.source?.key) && isSha256(item.checksumSha256))
  const videos = assets.filter((item) => item.mediaType === 'video' && isPrivateReference(item.source?.bucket, item.source?.key) && isSha256(item.checksumSha256))
  if (images.length < Number(env.IDENTITY_LORA_MIN_APPROVED_IMAGES) || videos.length < Number(env.IDENTITY_LORA_MIN_APPROVED_VIDEOS)) {
    throw new ApiError(409, 'O conjunto congelado não possui a quantidade mínima de fotos e vídeos para criar a identidade.')
  }

  const sortedImages = [...images].sort((a, b) => `${a.systemTag || ''}:${a.assetId}`.localeCompare(`${b.systemTag || ''}:${b.assetId}`))
  const sortedVideos = [...videos].sort((a, b) => `${a.systemTag || ''}:${a.assetId}`.localeCompare(`${b.systemTag || ''}:${b.assetId}`))
  return sortedImages.map((image, index) => {
    const video = sortedVideos[index % sortedVideos.length]
    return {
      sample_id: `sample-${String(index + 1).padStart(2, '0')}`,
      prompt: `${triggerToken} pessoa`,
      video_asset_id: video.assetId,
      video_source: video.source,
      video_sha256: video.checksumSha256,
      reference_image_asset_id: image.assetId,
      reference_image_source: image.source,
      reference_image_sha256: image.checksumSha256,
    }
  })
}

export async function compileActorIdentityTrainingWorkerContractForRun(run) {
  const manifest = safeObject(run.dataset_manifest)
  if (manifest.schemaVersion !== 'privacy-identity-dataset-manifest-v2') {
    throw new ApiError(409, 'O conjunto congelado usa um contrato incompatível com o worker de treinamento.')
  }
  if (!isUuid(run.actor_profile_id) || !isUuid(run.id) || !isSha256(run.dataset_manifest_sha256) || !isSha256(run.base_model_fingerprint)) {
    throw new ApiError(409, 'O run de treinamento não possui os identificadores e assinaturas obrigatórios.')
  }
  const lock = await loadBaseModelLock()
  const executionStage = safeObject(safeObject(run.metadata).stage_2_2d3_5)
  if (executionStage.executionPlanPrepared !== true) {
    throw new ApiError(409, 'O plano seguro da identidade ainda não foi preparado.')
  }
  const outputPrefix = `${normalizeText(env.IDENTITY_LORA_TRAINING_OUTPUT_PREFIX)}/${run.actor_profile_id}/${run.id}`
  return {
    contract_version: CONTRACT_VERSION,
    execution_mode: 'controlled_training_smoke',
    request_id: `identity-${run.id}`,
    actor_profile_id: run.actor_profile_id,
    training_run_id: run.id,
    kyc_case_id: run.kyc_case_id,
    trigger_token: run.trigger_token,
    dataset_manifest_sha256: run.dataset_manifest_sha256,
    dataset: {
      schema_version: manifest.schemaVersion,
      image_count: Number(manifest.summary?.imageCount || 0),
      video_count: Number(manifest.summary?.videoCount || 0),
      samples: compileSamples(manifest, run.trigger_token),
    },
    model: {
      repository: lock.repository,
      revision: lock.revision,
      fingerprint_sha256: lock.fingerprintSha256,
      artifacts: lock.artifacts,
    },
    engine: {
      name: run.training_engine,
      commit: run.training_engine_commit,
      official_script: 'examples/wanvideo/model_training/train.py',
    },
    training: {
      profile: normalizeText(env.IDENTITY_LORA_TRAINING_PROFILE),
      width: 832,
      height: 480,
      num_frames: 17,
      dataset_repeat: 60,
      num_epochs: 1,
      optimizer_steps: 800,
      checkpoint_steps: [400, 600, 800],
      learning_rate: 0.00005,
      lora_rank: 32,
      lora_alpha: 32,
      lora_base_model: 'dit',
      remove_prefix_in_ckpt: 'pipe.dit.',
      vace_frozen: true,
      target_modules: ['cross_attn.q', 'cross_attn.k', 'cross_attn.v', 'cross_attn.o', 'ffn.0', 'ffn.2'],
      gradient_checkpointing_offload: true,
      automatic_retry: false,
    },
    output: {
      bucket: normalizeText(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME),
      prefix: outputPrefix,
      public: false,
      qa_required: true,
    },
    smoke: {
      enabled: true,
      one_shot: true,
      actor_profile_id: run.actor_profile_id,
      training_run_id: run.id,
      expires_at: normalizeText(env.IDENTITY_LORA_REAL_SMOKE_EXPIRES_AT),
      max_jobs: 1,
    },
    safety: {
      actor_scoped: true,
      private_storage_only: true,
      public_urls_forbidden: true,
      product_release_allowed: false,
      inference_injection_allowed: false,
      automatic_retry_allowed: false,
      one_shot_smoke: true,
    },
  }
}

async function runPodRequest(pathname, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(env.IDENTITY_LORA_TRAINER_TIMEOUT_MS))
  try {
    const response = await fetch(`${String(env.RUNPOD_BASE_URL).replace(/\/$/, '')}/${normalizeText(env.IDENTITY_LORA_TRAINER_ENDPOINT_ID)}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${normalizeText(env.RUNPOD_API_KEY)}`,
        ...(options.headers || {}),
      },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(502, 'O servidor de criação da identidade recusou a solicitação.', { providerStatus: response.status, providerPayload: safeObject(payload) })
    return payload
  } finally {
    clearTimeout(timeout)
  }
}

export async function buildActorIdentityTrainingWorkerContract(actorProfileId, { runId = null } = {}) {
  const cleanActorId = normalizeText(actorProfileId)
  const cleanRunId = normalizeText(runId)
  if (!isUuid(cleanActorId)) throw new ApiError(400, 'actorProfileId inválido para exportação do contrato.')
  if (cleanRunId && !isUuid(cleanRunId)) throw new ApiError(400, 'runId inválido para exportação do contrato.')

  let query = supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', cleanActorId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (cleanRunId) query = query.eq('id', cleanRunId)

  const result = await query.maybeSingle()
  if (result.error) throw new ApiError(500, 'Erro ao carregar o run da identidade para exportação do payload.', result.error)
  if (!result.data) throw new ApiError(404, 'Run da identidade não encontrado para exportação do payload.')

  const run = result.data
  const stage = safeObject(safeObject(run.metadata).stage_2_2d3_5)
  if (run.status !== 'dry_run_ready') {
    throw new ApiError(409, 'O payload só pode ser exportado quando o run estiver em dry_run_ready.', { currentStatus: run.status, runId: run.id })
  }
  if (stage.executionPlanPrepared !== true) {
    throw new ApiError(409, 'O payload só pode ser exportado após o preflight seguro D3.5.', { runId: run.id })
  }

  const contract = await compileActorIdentityTrainingWorkerContractForRun(run)
  return { run, contract }
}

export async function startActorIdentityTraining(actorProfileId, { requestedByProfileId = null, confirmation = '' } = {}) {
  if (confirmation !== CONFIRMATION) throw new ApiError(422, 'A confirmação para criar a identidade é inválida.')
  if (!requestedByProfileId) throw new ApiError(401, 'Não foi possível identificar o Admin responsável pela criação da identidade.')

  const environment = inspectActorIdentityTrainingDispatchEnvironment()
  if (!environment.ready) {
    throw new ApiError(409, 'O servidor de criação da identidade ainda não está pronto.', { blockers: environment.blockers })
  }

  let run = await loadLatestRun(actorProfileId)
  let executionStage = safeObject(safeObject(run.metadata).stage_2_2d3_5)
  if (run.status === 'dry_run_ready' && executionStage.executionPlanPrepared !== true) {
    await prepareActorIdentityTrainingExecutionPlan(actorProfileId, {
      requestedByProfileId,
      confirmation: 'PREPARAR PREFLIGHT CONTROLADO DA IDENTIDADE D3.5',
    })
    run = await loadLatestRun(actorProfileId)
    executionStage = safeObject(safeObject(run.metadata).stage_2_2d3_5)
  }
  const smokePolicy = assertControlledIdentityTrainingSmokePolicy(actorProfileId, run.id)
  const currentStage = stageSnapshot(run)
  if (['training_pending', 'training_in_progress', 'qa_pending', 'training_completed'].includes(run.status) || currentStage.providerJobId) {
    return {
      status: 'IDENTITY_TRAINING_ALREADY_REQUESTED',
      runId: run.id,
      training: currentStage,
      message: 'A criação da identidade já foi solicitada. Nenhum job duplicado foi criado.',
      safety: { duplicateJobCreated: false, productCreated: false, productionStatusChanged: false },
    }
  }
  if (run.status !== 'dry_run_ready') {
    throw new ApiError(409, 'A identidade só pode ser criada depois que o conjunto e a configuração estiverem validados.', { currentStatus: run.status })
  }

  const contract = await compileActorIdentityTrainingWorkerContractForRun(run)
  const now = new Date().toISOString()
  const dispatchNonce = randomUUID()
  const metadata = {
    ...safeObject(run.metadata),
    stage_2_2d3_6b: {
      smokeMode: true,
      oneShot: true,
      actorProfileId,
      trainingRunId: run.id,
      expiresAt: smokePolicy.expiresAt,
      authorizedByProfileId: requestedByProfileId,
      authorizedAt: now,
      productReleaseAllowed: false,
      inferenceInjectionAllowed: false,
    },
    stage_2_2d3_6a: {
      dispatchStatus: 'submitting',
      dispatchNonce,
      requestedAt: now,
      requestedByProfileId,
      provider: 'runpod_serverless',
      contractVersion: CONTRACT_VERSION,
      requestId: contract.request_id,
      productReleaseAllowed: false,
      automaticRetryAllowed: false,
    },
  }

  const lockResult = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .update({ mode: 'training_controlled', status: 'training_pending', metadata, updated_at: now })
    .eq('id', run.id)
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'dry_run_ready')
    .select('*')
    .maybeSingle()
  if (lockResult.error) throw new ApiError(500, 'Erro ao reservar a criação da identidade.', lockResult.error)
  if (!lockResult.data) throw new ApiError(409, 'A criação da identidade foi bloqueada porque o estado mudou durante a confirmação.')

  let acceptedProviderJobId = null
  try {
    const provider = await runPodRequest('/run', { method: 'POST', body: JSON.stringify({ input: contract }) })
    const providerJobId = normalizeText(provider.id)
    if (!providerJobId) throw new Error('runpod_job_id_missing')
    acceptedProviderJobId = providerJobId
    const submittedAt = new Date().toISOString()
    const submittedMetadata = {
      ...metadata,
      stage_2_2d3_6a: {
        ...metadata.stage_2_2d3_6a,
        dispatchStatus: 'queued',
        providerJobId,
        submittedAt,
      },
      stage_2_2d3_6b: {
        ...metadata.stage_2_2d3_6b,
        oneShotConsumed: true,
        oneShotConsumedAt: submittedAt,
        providerJobId,
      },
    }
    const update = await supabaseAdmin
      .from(TRAINING_RUNS_TABLE)
      .update({ metadata: submittedMetadata, updated_at: submittedAt })
      .eq('id', run.id)
      .eq('actor_profile_id', actorProfileId)
      .select('*')
      .single()
    if (update.error) throw new ApiError(500, 'O job foi aceito, mas o identificador não pôde ser persistido.', update.error)
    return {
      status: 'IDENTITY_TRAINING_JOB_SUBMITTED',
      runId: run.id,
      training: stageSnapshot(update.data),
      message: 'Criação da identidade iniciada. A tela acompanhará o andamento automaticamente.',
      safety: { runPodCalled: true, gpuMayStart: true, productCreated: false, productionStatusChanged: false, publicUrlCreated: false },
    }
  } catch (error) {
    const failedAt = new Date().toISOString()
    const providerAccepted = Boolean(acceptedProviderJobId)
    const failedMetadata = {
      ...metadata,
      stage_2_2d3_6a: {
        ...metadata.stage_2_2d3_6a,
        dispatchStatus: providerAccepted ? 'provider_accepted_persistence_failed' : 'submission_failed',
        providerJobId: acceptedProviderJobId || null,
        lastError: redactError(error),
        lastCheckedAt: failedAt,
        duplicateRetryBlocked: providerAccepted,
      },
    }
    await supabaseAdmin
      .from(TRAINING_RUNS_TABLE)
      .update({
        mode: providerAccepted ? 'training_controlled' : 'readiness_dry_run',
        status: providerAccepted ? 'training_pending' : 'dry_run_ready',
        metadata: failedMetadata,
        updated_at: failedAt,
      })
      .eq('id', run.id)
      .eq('actor_profile_id', actorProfileId)
    if (providerAccepted) {
      throw new ApiError(500, 'O servidor aceitou a criação, mas houve falha ao registrar o identificador. Uma nova tentativa foi bloqueada para evitar job duplicado.', {
        providerJobIdPrefix: acceptedProviderJobId.slice(0, 12),
        duplicateRetryBlocked: true,
      })
    }
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'Não foi possível enviar a criação da identidade ao servidor de treinamento.', { reason: redactError(error) })
  }
}

async function registerAdapterFromWorker(run, output, now) {
  const adapter = safeObject(output.adapter)
  if (normalizeText(output.contract_version) !== CONTRACT_VERSION) throw new ApiError(502, 'O worker retornou um contrato incompatível.')
  if (!isPrivateReference(adapter.r2_bucket, adapter.r2_key) || !isSha256(adapter.sha256) || Number(adapter.byte_size || 0) <= 0) {
    throw new ApiError(502, 'O worker não retornou um adapter privado válido.')
  }
  if (normalizeText(adapter.actor_profile_id) !== normalizeText(run.actor_profile_id) || normalizeText(adapter.training_run_id) !== normalizeText(run.id)) {
    throw new ApiError(502, 'O adapter retornado não pertence ao ator e ao run solicitados.')
  }
  if (normalizeText(adapter.base_model_fingerprint) !== normalizeText(run.base_model_fingerprint)) {
    throw new ApiError(502, 'O adapter foi criado com um modelo-base incompatível.')
  }

  const existing = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('*')
    .eq('training_run_id', run.id)
    .eq('sha256', normalizeText(adapter.sha256).toLowerCase())
    .maybeSingle()
  if (existing.error) throw new ApiError(500, 'Erro ao verificar o adapter retornado.', existing.error)
  if (existing.data) return existing.data

  const versions = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .select('adapter_version')
    .eq('actor_profile_id', run.actor_profile_id)
    .order('adapter_version', { ascending: false })
    .limit(1)
  if (versions.error) throw new ApiError(500, 'Erro ao calcular a versão do adapter.', versions.error)
  const version = Number(versions.data?.[0]?.adapter_version || 0) + 1
  const insert = await supabaseAdmin
    .from(ADAPTERS_TABLE)
    .insert({
      actor_profile_id: run.actor_profile_id,
      training_run_id: run.id,
      adapter_version: version,
      status: 'qa_pending',
      qa_status: 'pending',
      base_model: run.base_model,
      base_model_fingerprint: run.base_model_fingerprint,
      r2_bucket: adapter.r2_bucket,
      r2_key: adapter.r2_key,
      sha256: normalizeText(adapter.sha256).toLowerCase(),
      byte_size: Number(adapter.byte_size),
      trigger_token: run.trigger_token,
      rank: Number(adapter.rank || 32),
      alpha: Number(adapter.alpha || 32),
      recommended_strength_model: Number(adapter.recommended_strength_model || 0.65),
      consent_version: normalizeText(adapter.consent_version || 'identity-preparation-v1'),
      training_engine: run.training_engine,
      training_engine_commit: run.training_engine_commit,
      manifest: safeObject(adapter.manifest),
      qa_report: {},
      metadata: { source: 'stage_2_2d3_6a_worker_result', privateOnly: true, productReleaseAllowed: false },
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single()
  if (insert.error) throw new ApiError(500, 'Erro ao registrar o adapter privado para QA.', insert.error)
  return insert.data
}

export async function refreshActorIdentityTrainingStatus(actorProfileId) {
  const run = await loadLatestRun(actorProfileId)
  const stage = stageSnapshot(run)
  if (!stage.providerJobId) {
    return { status: 'IDENTITY_TRAINING_NOT_SUBMITTED', runId: run.id, runStatus: run.status, training: stage, terminal: false }
  }
  if (['qa_pending', 'approved', 'failed', 'cancelled'].includes(run.status)) {
    return { status: 'IDENTITY_TRAINING_LOCAL_TERMINAL', runId: run.id, runStatus: run.status, training: stage, terminal: true }
  }
  const environment = inspectActorIdentityTrainingDispatchEnvironment()
  if (!environment.endpointConfigured || !environment.apiKeyConfigured) {
    throw new ApiError(409, 'O servidor de criação não está configurado para consultar o andamento.')
  }

  const provider = await runPodRequest(`/status/${encodeURIComponent(stage.providerJobId)}`, { method: 'GET' })
  const providerStatus = normalizeText(provider.status).toUpperCase()
  const now = new Date().toISOString()
  let nextStatus = run.status
  const nextStage = {
    ...safeObject(safeObject(run.metadata).stage_2_2d3_6a),
    providerJobId: stage.providerJobId,
    providerStatus,
    lastCheckedAt: now,
  }
  const patch = { updated_at: now }

  if (providerStatus === 'IN_QUEUE') {
    nextStatus = 'training_pending'
    nextStage.dispatchStatus = 'queued'
  } else if (providerStatus === 'IN_PROGRESS') {
    nextStatus = 'training_in_progress'
    nextStage.dispatchStatus = 'training'
    nextStage.startedAt = stage.startedAt || now
    patch.started_at = run.started_at || now
  } else if (providerStatus === 'COMPLETED') {
    const adapter = await registerAdapterFromWorker(run, safeObject(provider.output), now)
    nextStatus = 'qa_pending'
    nextStage.dispatchStatus = 'completed'
    nextStage.completedAt = now
    nextStage.adapterRegistered = true
    nextStage.adapterId = adapter.id
    patch.completed_at = now
  } else if (providerStatus === 'FAILED' || providerStatus === 'TIMED_OUT') {
    const failure = classifyIdentityTrainingFailure({ providerStatus, provider })
    nextStatus = 'failed'
    nextStage.dispatchStatus = 'failed'
    nextStage.lastError = failure.message
    nextStage.failureCode = failure.failureCode
    nextStage.failureCategory = failure.failureCategory
    nextStage.retryable = failure.retryable
    nextStage.operatorMessage = failure.operatorMessage
    nextStage.failedAt = now
    patch.failed_at = now
    patch.failure_reason = `${failure.failureCode}: ${failure.message}`.slice(0, 500)
  } else if (providerStatus === 'CANCELLED') {
    nextStatus = 'cancelled'
    nextStage.dispatchStatus = 'cancelled'
  }

  const metadata = { ...safeObject(run.metadata), stage_2_2d3_6a: nextStage }
  const update = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .update({ ...patch, status: nextStatus, metadata })
    .eq('id', run.id)
    .eq('actor_profile_id', actorProfileId)
    .select('*')
    .single()
  if (update.error) throw new ApiError(500, 'Erro ao atualizar o andamento da identidade.', update.error)

  return {
    status: 'IDENTITY_TRAINING_STATUS_REFRESHED',
    runId: run.id,
    runStatus: nextStatus,
    providerStatus,
    training: stageSnapshot(update.data),
    terminal: TERMINAL_PROVIDER_STATES.has(providerStatus),
    message: nextStatus === 'qa_pending'
      ? 'Identidade criada e aguardando revisão do Admin.'
      : nextStatus === 'failed'
        ? 'A criação falhou. Nenhuma identidade ou adapter foi criado.'
        : 'Andamento da criação atualizado.',
  }
}

export { CONFIRMATION as IDENTITY_TRAINING_CONFIRMATION }
