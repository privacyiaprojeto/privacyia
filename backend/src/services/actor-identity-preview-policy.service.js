import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

const CONTRACT_VERSION = 'privacy-identity-motion-abc-v1'

function text(value) { return String(value || '').trim() }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)) }
function parseExpiry(value) {
  const raw = text(value)
  if (!raw) return null
  const timestamp = Date.parse(raw)
  return Number.isFinite(timestamp) ? new Date(timestamp) : null
}

export function inspectControlledIdentityPreviewPolicy({ actorProfileId = null, trainingRunId = null, adapterId = null, now = new Date() } = {}) {
  const configuredActorId = text(env.IDENTITY_LORA_PREVIEW_ACTOR_PROFILE_ID)
  const configuredRunId = text(env.IDENTITY_LORA_PREVIEW_TRAINING_RUN_ID)
  const configuredAdapterId = text(env.IDENTITY_LORA_PREVIEW_ADAPTER_ID)
  const expiresAt = parseExpiry(env.IDENTITY_LORA_PREVIEW_EXPIRES_AT)
  const blockers = []

  if (env.IDENTITY_LORA_PREVIEW_ENABLED !== true) blockers.push('preview_not_enabled')
  if (env.IDENTITY_LORA_PREVIEW_DRY_RUN_ONLY === true) blockers.push('preview_dry_run_only')
  if (env.IDENTITY_LORA_PREVIEW_SMOKE_ENABLED !== true) blockers.push('preview_smoke_not_armed')
  if (!isUuid(configuredActorId)) blockers.push('preview_actor_not_configured')
  if (!isUuid(configuredRunId)) blockers.push('preview_run_not_configured')
  if (!isUuid(configuredAdapterId)) blockers.push('preview_adapter_not_configured')
  if (!expiresAt) blockers.push('preview_expiry_not_configured')
  if (expiresAt && expiresAt.getTime() <= now.getTime()) blockers.push('preview_window_expired')
  if (Number(env.IDENTITY_LORA_PREVIEW_MAX_JOBS) !== 1) blockers.push('preview_must_allow_exactly_one_job')
  if (text(env.IDENTITY_LORA_PREVIEW_CONTRACT_VERSION) !== CONTRACT_VERSION) blockers.push('preview_motion_abc_contract_required')
  if (env.IDENTITY_LORA_INFERENCE_INJECTION_READY === true) blockers.push('production_inference_must_remain_disabled')
  if (!text(env.IDENTITY_LORA_QA_VIDEO_ENDPOINT_ID)) blockers.push('qa_video_endpoint_not_configured')
  if (text(env.IDENTITY_LORA_NEUTRAL_QA_BUCKET) !== 'privacy-media' || text(env.IDENTITY_LORA_NEUTRAL_QA_KEY) !== 'qa-assets/neutral-motion-01.mp4') blockers.push('neutral_qa_source_not_approved')
  if (!/^[0-9a-f]{64}$/i.test(text(env.IDENTITY_LORA_NEUTRAL_QA_SHA256))) blockers.push('neutral_qa_sha256_missing')

  const actorMatched = actorProfileId ? text(actorProfileId) === configuredActorId : null
  const runMatched = trainingRunId ? text(trainingRunId) === configuredRunId : null
  const adapterMatched = adapterId ? text(adapterId) === configuredAdapterId : null
  if (actorProfileId && !actorMatched) blockers.push('preview_actor_scope_mismatch')
  if (trainingRunId && !runMatched) blockers.push('preview_run_scope_mismatch')
  if (adapterId && !adapterMatched) blockers.push('preview_adapter_scope_mismatch')

  return {
    enabled: env.IDENTITY_LORA_PREVIEW_ENABLED === true,
    ready: blockers.length === 0,
    actorProfileId: configuredActorId || null,
    trainingRunId: configuredRunId || null,
    adapterId: configuredAdapterId || null,
    expiresAt: expiresAt?.toISOString() || null,
    maxJobs: Number(env.IDENTITY_LORA_PREVIEW_MAX_JOBS),
    actorMatched,
    runMatched,
    adapterMatched,
    contractVersion: text(env.IDENTITY_LORA_PREVIEW_CONTRACT_VERSION),
    blockers,
  }
}

export function assertControlledIdentityPreviewPolicy(actorProfileId, trainingRunId, adapterId) {
  const policy = inspectControlledIdentityPreviewPolicy({ actorProfileId, trainingRunId, adapterId })
  if (!policy.ready) {
    throw new ApiError(409, 'A prévia privada ainda não está autorizada para esta identidade.', {
      blockers: policy.blockers,
      actorMatched: policy.actorMatched,
      runMatched: policy.runMatched,
      adapterMatched: policy.adapterMatched,
      expiresAt: policy.expiresAt,
    })
  }
  return policy
}

export { CONTRACT_VERSION as IDENTITY_PREVIEW_CONTRACT_VERSION }
