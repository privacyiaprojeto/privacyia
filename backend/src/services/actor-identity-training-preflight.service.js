import { createHash } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

const ACTORS_TABLE = 'actor_profiles'
const TRAINING_RUNS_TABLE = 'actor_identity_training_runs'
const CONFIRMATION = 'PREPARAR PREFLIGHT CONTROLADO DA IDENTIDADE D3.5'

function safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeText(value) {
  return String(value || '').trim()
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/.test(normalizeText(value).toLowerCase())
}

function isPrivateName(value) {
  const clean = normalizeText(value)
  return Boolean(clean && !/^https?:\/\//i.test(clean) && !clean.startsWith('/'))
}

function publicPlanSnapshot(metadata) {
  const stage = safeObject(safeObject(metadata).stage_2_2d3_5)
  const plan = safeObject(stage.plan)
  return {
    prepared: stage.executionPlanPrepared === true,
    sha256Prefix: normalizeText(stage.executionPlanSha256).slice(0, 12) || null,
    preparedAt: stage.preparedAt || null,
    provider: normalizeText(safeObject(plan.provider).name) || null,
    mode: normalizeText(plan.mode) || null,
    outputPrivate: safeObject(plan.output).public === false,
    runtimeExecutionEnabled: false,
    trainingStarted: false,
    qaStarted: false,
    adapterIntegrated: false,
  }
}

export function inspectActorIdentityTrainingExecutionEnvironment() {
  const provider = normalizeText(env.IDENTITY_LORA_TRAINING_PROVIDER || 'runpod_serverless')
  const endpointConfigured = Boolean(normalizeText(env.IDENTITY_LORA_TRAINER_ENDPOINT_ID))
  const privateBucketConfigured = isPrivateName(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME)
  const outputPrefixConfigured = isPrivateName(env.IDENTITY_LORA_TRAINING_OUTPUT_PREFIX)
  const safeToPreparePlan = Boolean(
    env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true
    && env.IDENTITY_LORA_TRAINING_ENABLED === false
    && env.IDENTITY_LORA_INFERENCE_INJECTION_READY === false
    && privateBucketConfigured
    && outputPrefixConfigured
    && normalizeText(env.IDENTITY_LORA_BASE_MODEL)
    && isSha256(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)
    && normalizeText(env.IDENTITY_LORA_TRAINING_ENGINE_COMMIT)
  )

  const blockersForRealExecution = []
  if (!endpointConfigured) blockersForRealExecution.push('trainer_endpoint_not_configured')
  if (!normalizeText(env.RUNPOD_API_KEY)) blockersForRealExecution.push('runpod_api_key_not_configured')
  if (env.IDENTITY_LORA_TRAINING_ENABLED !== true) blockersForRealExecution.push('real_training_disabled_by_policy')
  if (env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true) blockersForRealExecution.push('dry_run_only_mode_active')

  return {
    provider,
    endpointConfigured,
    privateBucketConfigured,
    outputPrefixConfigured,
    dryRunOnly: env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true,
    realTrainingEnabled: env.IDENTITY_LORA_TRAINING_ENABLED === true,
    inferenceInjectionReady: env.IDENTITY_LORA_INFERENCE_INJECTION_READY === true,
    safeToPreparePlan,
    blockersForRealExecution,
  }
}

export async function prepareActorIdentityTrainingExecutionPlan(actorProfileId, {
  requestedByProfileId = null,
  confirmation = '',
} = {}) {
  if (confirmation !== CONFIRMATION) {
    throw new ApiError(400, 'A confirmação do preflight controlado é inválida.')
  }
  if (!requestedByProfileId) {
    throw new ApiError(401, 'Não foi possível identificar o Admin responsável pelo preflight.')
  }

  const environment = inspectActorIdentityTrainingExecutionEnvironment()
  if (!environment.safeToPreparePlan) {
    throw new ApiError(409, 'O ambiente seguro ainda não está pronto para preparar o plano de execução.', {
      blockers: environment.blockersForRealExecution,
      trainingStarted: false,
    })
  }

  const actorResult = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('id, display_name, legal_name, status, kyc_status')
    .eq('id', actorProfileId)
    .maybeSingle()
  if (actorResult.error) throw new ApiError(500, 'Erro ao carregar o ator para o preflight.', actorResult.error)
  if (!actorResult.data) throw new ApiError(404, 'Ator não encontrado.')
  if (normalizeText(actorResult.data.status).toLowerCase() !== 'approved' || normalizeText(actorResult.data.kyc_status).toLowerCase() !== 'approved') {
    throw new ApiError(409, 'O ator e o mapeamento precisam permanecer aprovados antes do preflight.')
  }

  const runResult = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .select('*')
    .eq('actor_profile_id', actorProfileId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (runResult.error) throw new ApiError(500, 'Erro ao carregar a preparação de treinamento.', runResult.error)
  const run = runResult.data
  if (!run) throw new ApiError(409, 'Nenhuma configuração validada foi encontrada para este ator.')
  if (run.status !== 'dry_run_ready') {
    throw new ApiError(409, 'O preflight só pode ser preparado depois da validação segura da configuração.', { currentStatus: run.status })
  }
  if (!isSha256(run.dataset_manifest_sha256) || !isSha256(run.base_model_fingerprint)) {
    throw new ApiError(409, 'O conjunto ou o modelo-base não possui assinatura válida para o preflight.')
  }
  if (!isPrivateName(run.dataset_r2_bucket) || !isPrivateName(run.dataset_r2_prefix)) {
    throw new ApiError(409, 'O destino privado da preparação não está configurado corretamente.')
  }
  if (!normalizeText(run.training_engine) || !normalizeText(run.training_engine_commit)) {
    throw new ApiError(409, 'A versão controlada do ambiente de treinamento não foi registrada.')
  }

  const outputPrefix = `${normalizeText(env.IDENTITY_LORA_TRAINING_OUTPUT_PREFIX)}/${actorProfileId}/${run.id}`
  const plan = {
    schemaVersion: 'privacy-identity-training-execution-plan-v1',
    actorProfileId,
    trainingRunId: run.id,
    mode: 'preflight_only',
    dataset: {
      manifestSha256: normalizeText(run.dataset_manifest_sha256).toLowerCase(),
      bucket: run.dataset_r2_bucket,
      prefix: run.dataset_r2_prefix,
      public: false,
    },
    model: {
      repository: run.base_model,
      fingerprintSha256: normalizeText(run.base_model_fingerprint).toLowerCase(),
    },
    engine: {
      name: run.training_engine,
      commit: run.training_engine_commit,
    },
    provider: {
      name: environment.provider,
      endpointConfigured: environment.endpointConfigured,
    },
    output: {
      bucket: run.dataset_r2_bucket,
      prefix: outputPrefix,
      public: false,
    },
    phases: [
      { id: 'preflight', status: 'prepared' },
      { id: 'controlled_training', status: 'locked' },
      { id: 'identity_qa', status: 'locked' },
      { id: 'adapter_integration', status: 'locked' },
    ],
    safety: {
      noRunPodCall: true,
      noGpu: true,
      noTraining: true,
      noR2Read: true,
      noR2Write: true,
      noQueueJob: true,
      noProductMutation: true,
      noInferenceRelease: true,
    },
  }
  const executionPlanSha256 = sha256(plan)
  const currentMetadata = safeObject(run.metadata)
  const existing = safeObject(currentMetadata.stage_2_2d3_5)
  if (existing.executionPlanPrepared === true && normalizeText(existing.executionPlanSha256) === executionPlanSha256) {
    return {
      status: 'IDENTITY_TRAINING_EXECUTION_PLAN_ALREADY_PREPARED',
      actor: { id: actorResult.data.id, displayName: actorResult.data.display_name || actorResult.data.legal_name || 'Ator/Atriz' },
      runId: run.id,
      executionPlan: publicPlanSnapshot(currentMetadata),
      nextAction: 'A execução real continua bloqueada. O próximo estágio deverá habilitar um executor controlado com confirmação própria.',
      message: 'O preflight seguro já estava preparado. Nenhum treinamento foi iniciado.',
      safety: { databaseMutationExecuted: false, runPodCalled: false, gpuStarted: false, trainingStarted: false, r2ReadExecuted: false, r2WriteExecuted: false, queueJobCreated: false, productCreated: false },
    }
  }

  const now = new Date().toISOString()
  const metadata = {
    ...currentMetadata,
    stage_2_2d3_5: {
      executionPlanPrepared: true,
      executionPlanSha256,
      preparedAt: now,
      preparedByProfileId: requestedByProfileId,
      plan,
      realTrainingAllowed: false,
      productReleaseAllowed: false,
      adapterIntegrationAllowed: false,
    },
  }

  const updateResult = await supabaseAdmin
    .from(TRAINING_RUNS_TABLE)
    .update({ metadata, updated_at: now })
    .eq('id', run.id)
    .eq('actor_profile_id', actorProfileId)
    .eq('status', 'dry_run_ready')
    .select('*')
    .single()
  if (updateResult.error) throw new ApiError(500, 'Erro ao registrar o preflight controlado.', updateResult.error)

  return {
    status: 'IDENTITY_TRAINING_EXECUTION_PLAN_PREPARED',
    actor: { id: actorResult.data.id, displayName: actorResult.data.display_name || actorResult.data.legal_name || 'Ator/Atriz' },
    runId: updateResult.data.id,
    executionPlan: publicPlanSnapshot(updateResult.data.metadata),
    nextAction: 'A execução real continua bloqueada. O próximo estágio deverá habilitar um executor controlado com confirmação própria.',
    message: 'Preflight seguro preparado. Nenhum RunPod, GPU, treinamento, fila ou produto foi iniciado.',
    safety: { databaseMutationExecuted: true, runPodCalled: false, gpuStarted: false, trainingStarted: false, r2ReadExecuted: false, r2WriteExecuted: false, queueJobCreated: false, productCreated: false },
  }
}
