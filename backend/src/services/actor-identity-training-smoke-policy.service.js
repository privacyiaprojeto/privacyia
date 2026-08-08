import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

function text(value) {
  return String(value || '').trim()
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value))
}

function parseExpiry(value) {
  const raw = text(value)
  if (!raw) return null
  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

export function inspectControlledIdentityTrainingSmokePolicy({ actorProfileId = null, trainingRunId = null, now = new Date() } = {}) {
  const configuredActorId = text(env.IDENTITY_LORA_REAL_SMOKE_ACTOR_PROFILE_ID)
  const configuredRunId = text(env.IDENTITY_LORA_REAL_SMOKE_TRAINING_RUN_ID)
  const expiresAt = parseExpiry(env.IDENTITY_LORA_REAL_SMOKE_EXPIRES_AT)
  const blockers = []

  if (env.IDENTITY_LORA_REAL_SMOKE_ENABLED !== true) blockers.push('real_smoke_not_armed')
  if (!isUuid(configuredActorId)) blockers.push('real_smoke_actor_not_configured')
  if (!isUuid(configuredRunId)) blockers.push('real_smoke_run_not_configured')
  if (!expiresAt) blockers.push('real_smoke_expiry_not_configured')
  if (expiresAt && expiresAt.getTime() <= now.getTime()) blockers.push('real_smoke_window_expired')
  if (Number(env.IDENTITY_LORA_REAL_SMOKE_MAX_JOBS) !== 1) blockers.push('real_smoke_must_allow_exactly_one_job')
  if (text(env.IDENTITY_LORA_TRAINER_CONTRACT_VERSION) !== 'privacy-identity-lora-training-v2') blockers.push('trainer_contract_v2_required')
  if (env.IDENTITY_LORA_TRAINING_ENABLED !== true) blockers.push('real_training_disabled_by_policy')
  if (env.IDENTITY_LORA_TRAINER_DRY_RUN_ONLY === true) blockers.push('dry_run_only_mode_active')
  if (env.IDENTITY_LORA_INFERENCE_INJECTION_READY === true) blockers.push('inference_injection_must_remain_disabled')

  const actorMatched = actorProfileId ? text(actorProfileId) === configuredActorId : null
  const runMatched = trainingRunId ? text(trainingRunId) === configuredRunId : null
  if (actorProfileId && !actorMatched) blockers.push('actor_not_authorized_for_real_smoke')
  if (trainingRunId && !runMatched) blockers.push('run_not_authorized_for_real_smoke')

  return {
    enabled: env.IDENTITY_LORA_REAL_SMOKE_ENABLED === true,
    ready: blockers.length === 0,
    actorProfileId: configuredActorId || null,
    trainingRunId: configuredRunId || null,
    expiresAt: expiresAt?.toISOString() || null,
    maxJobs: Number(env.IDENTITY_LORA_REAL_SMOKE_MAX_JOBS),
    actorMatched,
    runMatched,
    contractVersion: text(env.IDENTITY_LORA_TRAINER_CONTRACT_VERSION),
    blockers,
  }
}

export function assertControlledIdentityTrainingSmokePolicy(actorProfileId, trainingRunId) {
  const policy = inspectControlledIdentityTrainingSmokePolicy({ actorProfileId, trainingRunId })
  if (!policy.ready) {
    throw new ApiError(409, 'A primeira criação real da identidade ainda não está autorizada para este ator e este run.', {
      blockers: policy.blockers,
      actorMatched: policy.actorMatched,
      runMatched: policy.runMatched,
      expiresAt: policy.expiresAt,
    })
  }
  return policy
}
