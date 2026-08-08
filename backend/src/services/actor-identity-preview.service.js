import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { getPrivateObjectStream } from './storage.service.js'
import {
  assertControlledIdentityPreviewPolicy,
  inspectControlledIdentityPreviewPolicy,
  IDENTITY_PREVIEW_CONTRACT_VERSION,
} from './actor-identity-preview-policy.service.js'

const RUNS_TABLE = 'actor_identity_training_runs'
const ADAPTERS_TABLE = 'actor_identity_adapters'
const CONFIRMATION = 'PREPARAR PREVIA PRIVADA DA IDENTIDADE'
const ACTIVE = new Set(['submitting', 'queued', 'running'])
const TERMINAL = new Set(['ready', 'failed', 'cancelled'])
const LEGACY_PAID_QA_KIT_DISABLED = false

function text(value) { return String(value || '').trim() }
function safeObject(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {} }
function isSha256(value) { return /^[0-9a-f]{64}$/i.test(text(value)) }
function isUuid(value) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text(value)) }
function isPrivateReference(bucket, key) {
  return Boolean(text(bucket) && text(key) && !/^https?:\/\//i.test(text(bucket)) && !/^https?:\/\//i.test(text(key)) && !text(key).startsWith('/'))
}
function redactError(error) { return text(error?.message || error).replace(/https?:\/\/\S+/gi, '[private]').slice(0, 500) }

function resolveBackendRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
}

async function loadBaseModelLock() {
  const lockPath = path.resolve(resolveBackendRoot(), text(env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH))
  let payload
  try { payload = JSON.parse(await readFile(lockPath, 'utf8')) } catch (error) {
    throw new ApiError(409, 'O vínculo auditável do modelo-base não pôde ser carregado.', { reason: redactError(error) })
  }
  if (payload?.schemaVersion !== 'privacy-identity-base-model-lock-v1') throw new ApiError(409, 'O vínculo do modelo-base usa um contrato incompatível.')
  if (text(payload.repository) !== text(env.IDENTITY_LORA_BASE_MODEL) || text(payload.revision) !== text(env.IDENTITY_LORA_BASE_MODEL_REVISION) || text(payload.fingerprintSha256) !== text(env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)) {
    throw new ApiError(409, 'O vínculo do modelo-base não corresponde à configuração aprovada.')
  }
  if (!Array.isArray(payload.artifacts) || payload.artifacts.length !== 9 || payload.artifacts.some((item) => !text(item.path) || !isSha256(item.sha256) || Number(item.size || 0) <= 0)) {
    throw new ApiError(409, 'O vínculo do modelo-base não contém os nove arquivos válidos esperados.')
  }
  return payload
}

async function loadLatestIdentity(actorProfileId) {
  const runResult = await supabaseAdmin.from(RUNS_TABLE).select('*').eq('actor_profile_id', actorProfileId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (runResult.error) throw new ApiError(500, 'Erro ao carregar a identidade criada.', runResult.error)
  if (!runResult.data) throw new ApiError(409, 'Nenhuma identidade criada foi encontrada para este ator.')
  const adapterResult = await supabaseAdmin.from(ADAPTERS_TABLE).select('*').eq('actor_profile_id', actorProfileId).eq('training_run_id', runResult.data.id).order('adapter_version', { ascending: false }).limit(1).maybeSingle()
  if (adapterResult.error) throw new ApiError(500, 'Erro ao carregar o resultado da identidade.', adapterResult.error)
  if (!adapterResult.data) throw new ApiError(409, 'O arquivo final da identidade ainda não foi registrado.')
  return { run: runResult.data, adapter: adapterResult.data }
}

// D3.6H12 — explicit KYC + dynamic trigger token + raw RGB V2V denoise 0.85
function selectPreviewInputs(run) {
  const manifest = safeObject(run.dataset_manifest)
  const assets = Array.isArray(manifest.assets) ? manifest.assets : []
  const requiredAssetId = text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_ASSET_ID)
  const requiredSha256 = text(process.env.IDENTITY_LORA_PREVIEW_REFERENCE_SHA256).toLowerCase()
  if (!isUuid(requiredAssetId) || !isSha256(requiredSha256)) {
    throw new ApiError(409, 'A KYC frontal explícita ainda não foi armada por asset_id e SHA-256.')
  }
  const matches = assets.filter((item) => {
    const systemTag = text(item.systemTag || item.system_tag).toLowerCase()
    const assetId = text(item.assetId || item.asset_id)
    const checksum = text(item.checksumSha256 || item.checksum_sha256).toLowerCase()
    return systemTag === 'face_front' &&
      text(item.mediaType || item.media_type) === 'image' &&
      assetId === requiredAssetId && checksum === requiredSha256 &&
      isPrivateReference(item.source?.bucket, item.source?.key) && isSha256(checksum)
  })
  if (matches.length !== 1) {
    throw new ApiError(409, 'A KYC frontal explícita não foi encontrada de forma única no manifesto deste run.')
  }
  const image = matches[0]
  const bucket = text(image.source?.bucket)
  const key = text(image.source?.key)
  const actorScope = `/actor-${text(run.actor_profile_id)}/`
  if (bucket !== 'privacy-media' || !key.startsWith('vault/actor-mapping/') || !`/${key}`.includes(actorScope)) {
    throw new ApiError(409, 'A KYC frontal explícita não pertence ao cofre privado deste ator.')
  }
  return { image, requiredAssetId, requiredSha256 }
}

function visualEvidence(adapter) {
  const qaReport = safeObject(adapter.qa_report)
  return safeObject(qaReport.visualEvidence || qaReport.visual_evidence)
}

async function updateEvidence(adapter, evidence) {
  const qaReport = safeObject(adapter.qa_report)
  const now = new Date().toISOString()
  const next = { ...qaReport, visualEvidence: evidence }
  const result = await supabaseAdmin.from(ADAPTERS_TABLE).update({ qa_report: next, updated_at: now }).eq('id', adapter.id).eq('actor_profile_id', adapter.actor_profile_id).eq('training_run_id', adapter.training_run_id).select('*').single()
  if (result.error) throw new ApiError(500, 'Erro ao atualizar o andamento da prévia privada.', result.error)
  return result.data
}

function previewSnapshot(adapter) {
  const evidence = visualEvidence(adapter)
  const status = text(evidence.status) || 'not_started'
  const qaKit = safeObject(evidence.qaKit)
  const assets = Array.isArray(qaKit.assets) ? qaKit.assets.map((item) => ({
    assetKey: text(item.assetKey), label: text(item.label), kind: text(item.kind), contentType: text(item.contentType),
    mediaAvailable: isPrivateReference(item.r2Bucket, item.r2Key), width: Number(item.width || 0) || null,
    height: Number(item.height || 0) || null, numFrames: Number(item.numFrames || 0) || null,
    fps: Number(item.fps || 0) || null, durationSeconds: Number(item.durationSeconds || 0) || null,
  })) : []
  const replacement = safeObject(evidence.replacement)
  const forensicAudit = safeObject(evidence.forensicAudit)
  return {
    status, ready: evidence.ready === true && status === 'ready', reviewable: evidence.reviewable === true,
    providerJobIdConfigured: Boolean(text(evidence.providerJobId)), providerJobIdPrefix: text(evidence.providerJobId).slice(0, 12) || null,
    requestedAt: evidence.requestedAt || null, startedAt: evidence.startedAt || null, completedAt: evidence.completedAt || null,
    lastCheckedAt: evidence.lastCheckedAt || null, failedAt: evidence.failedAt || null, message: text(evidence.operatorMessage) || null,
    mediaAvailable: assets.length === 2 && assets.every((item) => item.mediaAvailable), assetCount: assets.length, assets,
    width: Number(evidence.width || 0) || null, height: Number(evidence.height || 0) || null,
    numFrames: Number(evidence.numFrames || 0) || null, fps: Number(evidence.fps || 0) || null,
    durationSeconds: Number(evidence.durationSeconds || 0) || null, failureCode: text(evidence.failureCode) || null,
    recoveryPrepared: safeObject(evidence.recovery).prepared === true,
    recoveryAttemptUsed: Number(safeObject(evidence.recovery).additionalAttemptsUsed || 0),
    recoverySourceProviderJobIdPrefix: text(safeObject(evidence.recovery).sourceProviderJobId).slice(0, 12) || null,
    replacementPrepared: replacement.prepared === true,
    replacementAttemptUsed: Number(replacement.additionalAttemptsUsed || 0),
    replacementReason: text(replacement.reason) || null,
    replacementSourceProviderJobIdPrefix: text(replacement.sourceProviderJobId).slice(0, 12) || null,
    invalidatedAt: evidence.invalidatedAt || null,
    invalidationReason: text(evidence.invalidationReason) || null,
    forensicAudit: {
      status: text(forensicAudit.status) || 'not_run',
      verdict: text(forensicAudit.verdict) || 'not_evaluated',
      executedAt: forensicAudit.executedAt || null,
      blockers: Array.isArray(forensicAudit.blockers) ? forensicAudit.blockers.map((item) => ({ code: text(item.code), message: text(item.message), severity: text(item.severity) || 'critical' })) : [],
    },
  }
}

async function compileContract(run, adapter, policy) {
  if (!isPrivateReference(adapter.r2_bucket, adapter.r2_key) || !isSha256(adapter.sha256) || Number(adapter.byte_size || 0) <= 0) throw new ApiError(409, 'O arquivo final da identidade não passou pela verificação de integridade.')
  const neutralBucket = text(env.IDENTITY_LORA_NEUTRAL_QA_BUCKET)
  const neutralKey = text(env.IDENTITY_LORA_NEUTRAL_QA_KEY)
  const neutralSha256 = text(env.IDENTITY_LORA_NEUTRAL_QA_SHA256).toLowerCase()
  if (neutralBucket !== 'privacy-media' || neutralKey !== 'qa-assets/neutral-motion-01.mp4' || !isSha256(neutralSha256)) throw new ApiError(409, 'O vídeo neutro privado ainda não foi vinculado por checksum.')

  const { image: referenceImage, requiredAssetId, requiredSha256 } = selectPreviewInputs(run)
  const referenceBucket = text(referenceImage.source?.bucket)
  const referenceKey = text(referenceImage.source?.key)
  const referenceSha256 = text(referenceImage.checksumSha256 || referenceImage.checksum_sha256).toLowerCase()
  if (!isPrivateReference(referenceBucket, referenceKey) || referenceBucket !== 'privacy-media' || referenceSha256 !== requiredSha256) throw new ApiError(409, 'A KYC frontal explícita não passou pela verificação de integridade.')

  const triggerToken = text(run.trigger_token)
  if (!/^prv_actor_[a-z0-9_]+$/.test(triggerToken)) throw new ApiError(409, 'O run não possui trigger token identitário válido.')
  const positiveA = 'adult man walking naturally in a neutral studio, full body visible, stable camera, realistic skin texture, consistent anatomy, clean background'
  const positiveB = `${triggerToken}, adult man walking naturally in a neutral studio, full body visible, stable camera, realistic skin texture, consistent anatomy, clean background, preserve the mapped male identity and facial proportions`

  return {
    contract_version: IDENTITY_PREVIEW_CONTRACT_VERSION,
    execution_mode: 'controlled_identity_neutral_ab',
    request_id: `identity-neutral-ab-${randomUUID()}`,
    actor_profile_id: run.actor_profile_id, training_run_id: run.id, adapter_id: adapter.id,
    base_video: { bucket: neutralBucket, key: neutralKey, sha256: neutralSha256 },
    reference_image: { bucket: referenceBucket, key: referenceKey, sha256: referenceSha256, system_tag: 'face_front', asset_id: requiredAssetId },
    identity: { trigger_token: triggerToken, reference_asset_id: requiredAssetId, reference_sha256: referenceSha256 },
    adapter: { bucket: adapter.r2_bucket, key: adapter.r2_key, sha256: text(adapter.sha256).toLowerCase(), byte_size: Number(adapter.byte_size) },
    sampling: { seed: 99, width: 832, height: 480, fps: 16, frames: 17, steps: 30, denoise: 0.85, branch_b_denoise: 0.85, lora_strength: 0.65 },
    prompt: { positive: positiveA, positive_b: positiveB, negative: 'identity mismatch, wrong person, feminine appearance, deformed face, deformed eyes, deformed hands, extra fingers, blur, low resolution, artifacts, text, watermark, cropped head' },
    metadata: { workflow_revision: 'D3.6H12-trigger-token-raw-rgb-v2v-denoise-085-v1', methodology_hotfix: 'D3.6H12-HF2-paired-denoise-085-v1', branch_b_control_mode: 'raw_rgb_v2v_denoise_085', branch_a_denoise: 0.85, branch_b_denoise: 0.85, ab_denoise_paired: true, trigger_token_used: triggerToken, reference_asset_id: requiredAssetId, reference_sha256: referenceSha256 },
    output: { bucket: text(env.IDENTITY_LORA_PRIVATE_BUCKET || env.R2_BUCKET_NAME), prefix: `${text(env.IDENTITY_LORA_PREVIEW_OUTPUT_PREFIX)}/${run.actor_profile_id}/${run.id}/${adapter.id}`, public: false },
    smoke: { enabled: true, one_shot: true, actor_profile_id: run.actor_profile_id, training_run_id: run.id, adapter_id: adapter.id, expires_at: policy.expiresAt, max_jobs: 1 },
    safety: { private_storage_only: true, public_urls_forbidden: true, automatic_retry_allowed: false, one_shot_smoke: true, kyc_reference_required: true, kyc_reference_private_only: true, kyc_reference_branch_b_only: true, kyc_reference_persistence_forbidden: true, product_release_allowed: false },
  }
}

async function runPodRequest(pathname, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), Number(env.IDENTITY_LORA_PREVIEW_TIMEOUT_MS))
  try {
    const response = await fetch(`${String(env.RUNPOD_BASE_URL).replace(/\/$/, '')}/${text(env.IDENTITY_LORA_QA_VIDEO_ENDPOINT_ID)}${pathname}`, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${text(env.RUNPOD_API_KEY)}`, ...(options.headers || {}) },
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new ApiError(502, 'O servidor de prévia recusou a solicitação.', { providerStatus: response.status })
    return payload
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(502, 'Não foi possível acessar o servidor da prévia privada.', { reason: redactError(error) })
  } finally { clearTimeout(timeout) }
}

export async function startActorIdentityPreview(actorProfileId, { requestedByProfileId = null, confirmation } = {}) {
  if (text(confirmation) !== CONFIRMATION) throw new ApiError(400, 'Confirmação inválida para preparar a prévia privada.')
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  if (!['training_completed', 'qa_pending', 'approved'].includes(text(run.status))) throw new ApiError(409, 'A identidade ainda não terminou de ser criada.')
  if (['rejected', 'revoked'].includes(text(adapter.status)) || ['rejected'].includes(text(adapter.qa_status))) throw new ApiError(409, 'Esta identidade exige correção antes de preparar uma prévia.')
  const current = visualEvidence(adapter)
  if (current.ready === true || ACTIVE.has(text(current.status))) {
    return { status: 'IDENTITY_PREVIEW_ALREADY_EXISTS', adapterId: adapter.id, preview: previewSnapshot(adapter), message: current.ready === true ? 'A prévia privada já está pronta.' : 'A prévia privada já está sendo preparada.' }
  }
  if (text(current.providerJobId)) throw new ApiError(409, 'Esta identidade já possui uma solicitação de prévia registrada. Atualize o andamento antes de tentar novamente.')
  const recovery = safeObject(current.recovery)
  const replacement = safeObject(current.replacement)
  if (recovery.prepared === true && replacement.prepared === true) throw new ApiError(409, 'Recuperação e substituição não podem ser executadas juntas.')
  if (recovery.prepared === true && Number(recovery.additionalAttemptsUsed || 0) >= 1) throw new ApiError(409, 'A única recuperação controlada desta prévia já foi consumida.')
  if (replacement.prepared === true && Number(replacement.additionalAttemptsUsed || 0) >= 1) throw new ApiError(409, 'A única substituição controlada do kit QA já foi consumida.')
  const policy = assertControlledIdentityPreviewPolicy(actorProfileId, run.id, adapter.id)
  if (!text(env.IDENTITY_LORA_QA_VIDEO_ENDPOINT_ID) || !text(env.RUNPOD_API_KEY)) throw new ApiError(409, 'O servidor de prévia privada não está configurado.')
  const contract = await compileContract(run, adapter, policy)
  const now = new Date().toISOString()
  const recoveryState = recovery.prepared === true ? { ...recovery, additionalAttemptsUsed: 1, submittedAt: now, automaticRetry: false } : recovery
  const replacementState = replacement.prepared === true ? { ...replacement, additionalAttemptsUsed: 1, submittedAt: now, automaticRetry: false } : replacement
  await updateEvidence(adapter, {
    ...current,
    status: 'submitting', ready: false, requestedAt: now, requestedByProfileId, contractVersion: IDENTITY_PREVIEW_CONTRACT_VERSION,
    actorProfileId, trainingRunId: run.id, adapterId: adapter.id, providerJobId: null, automaticRetry: false, privateOnly: true,
    recovery: recoveryState, replacement: replacementState,
  })
  let providerJobId = null
  try {
    const provider = await runPodRequest('/run', { method: 'POST', body: JSON.stringify({ input: contract }) })
    providerJobId = text(provider.id)
    if (!providerJobId) throw new ApiError(502, 'O servidor não retornou o identificador da prévia.')
    const updated = await updateEvidence(adapter, {
      ...current,
      status: 'queued', ready: false, requestedAt: now, requestedByProfileId, contractVersion: IDENTITY_PREVIEW_CONTRACT_VERSION,
      actorProfileId, trainingRunId: run.id, adapterId: adapter.id, providerJobId, submittedAt: new Date().toISOString(),
      automaticRetry: false, privateOnly: true, recovery: recoveryState, replacement: replacementState,
    })
    return { status: 'IDENTITY_PREVIEW_JOB_SUBMITTED', adapterId: adapter.id, preview: previewSnapshot(updated), message: 'A prévia privada começou a ser preparada.', safety: { runPodCalled: true, gpuMayStart: true, productReleased: false, adapterApproved: false } }
  } catch (error) {
    const failedAt = new Date().toISOString()
    await updateEvidence(adapter, {
      status: providerJobId ? 'queued' : 'failed', ready: false, requestedAt: now, requestedByProfileId,
      actorProfileId, trainingRunId: run.id, adapterId: adapter.id, providerJobId: providerJobId || null,
      failedAt: providerJobId ? null : failedAt,
      operatorMessage: providerJobId ? 'O servidor aceitou a solicitação; a repetição foi bloqueada para evitar custo duplicado.' : 'Não foi possível iniciar a prévia privada.',
      lastError: redactError(error), automaticRetry: false, privateOnly: true,
    })
    if (providerJobId) throw new ApiError(500, 'O servidor aceitou a prévia, mas houve falha ao salvar o estado. Uma segunda tentativa foi bloqueada.', { providerJobIdPrefix: providerJobId.slice(0, 12) })
    throw error
  }
}

export async function refreshActorIdentityPreviewStatus(actorProfileId) {
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  const current = visualEvidence(adapter)
  const providerJobId = text(current.providerJobId)
  if (!providerJobId) return { status: 'IDENTITY_PREVIEW_NOT_SUBMITTED', adapterId: adapter.id, preview: previewSnapshot(adapter), terminal: false }
  if (TERMINAL.has(text(current.status))) return { status: 'IDENTITY_PREVIEW_LOCAL_TERMINAL', adapterId: adapter.id, preview: previewSnapshot(adapter), terminal: true }
  if (!text(env.IDENTITY_LORA_QA_VIDEO_ENDPOINT_ID) || !text(env.RUNPOD_API_KEY)) throw new ApiError(409, 'O servidor de prévia não está configurado para consultar o andamento.')

  const provider = await runPodRequest(`/status/${encodeURIComponent(providerJobId)}`, { method: 'GET' })
  const providerStatus = text(provider.status).toUpperCase()
  const now = new Date().toISOString()
  let next = { ...current, lastCheckedAt: now, providerStatus }
  if (providerStatus === 'IN_QUEUE') next = { ...next, status: 'queued' }
  else if (providerStatus === 'IN_PROGRESS') next = { ...next, status: 'running', startedAt: current.startedAt || now }
  else if (providerStatus === 'COMPLETED') {
    const output = safeObject(provider.output)
    const kit = safeObject(output.qa_kit)
    if (text(output.contract_version) !== IDENTITY_PREVIEW_CONTRACT_VERSION) throw new ApiError(502, 'O worker retornou um contrato de kit incompatível.')
    if (text(kit.actor_profile_id) !== actorProfileId || text(kit.training_run_id) !== run.id || text(kit.adapter_id) !== adapter.id) throw new ApiError(502, 'O kit retornado não pertence à identidade solicitada.')
    const providerAssets = Array.isArray(kit.assets) ? kit.assets : []
    const expectedKeys = ['baseline_without_lora', 'candidate_with_lora']
    if (providerAssets.length !== 2 || expectedKeys.some((key) => !providerAssets.some((item) => text(item.asset_key) === key))) throw new ApiError(502, 'O worker não retornou as duas evidências A/B obrigatórias.')
    const assets = providerAssets.map((item) => {
      if (!isPrivateReference(item.r2_bucket, item.r2_key) || !isSha256(item.sha256) || Number(item.byte_size || 0) <= 0) throw new ApiError(502, 'O worker retornou uma evidência privada inválida.')
      return { assetKey: text(item.asset_key), label: text(item.label), kind: text(item.kind), contentType: text(item.content_type), r2Bucket: item.r2_bucket, r2Key: item.r2_key, sha256: text(item.sha256).toLowerCase(), byteSize: Number(item.byte_size), width: Number(item.width || 0), height: Number(item.height || 0), numFrames: Number(item.num_frames || 0), fps: Number(item.fps || 0) || null, durationSeconds: Number(item.duration_seconds || 0) || null }
    })
    const video = assets.find((item) => item.assetKey === 'candidate_with_lora')
    const reviewable = Boolean(kit.reviewable === true && video && video.width >= 832 && video.height >= 480 && video.numFrames >= 17 && Number(video.durationSeconds || 0) >= 1)
    if (!reviewable) throw new ApiError(502, 'O kit foi produzido, mas não atende à duração e definição mínimas para conferência.')
    next = {
      ...next, status: 'ready', ready: true, reviewable: true, completedAt: now,
      previewAssetId: text(kit.qa_kit_id) || randomUUID(), qaKit: { schemaVersion: text(kit.schema_version), assetCount: assets.length, assets, provenance: safeObject(kit.provenance) },
      r2Bucket: video.r2Bucket, r2Key: video.r2Key, sha256: video.sha256, byteSize: video.byteSize,
      contentType: video.contentType, width: video.width, height: video.height, numFrames: video.numFrames, fps: video.fps, durationSeconds: video.durationSeconds,
      privateOnly: true, publicUrl: null, operatorMessage: 'Comparação A/B neutra pronta para conferência.',
    }
  } else if (['FAILED', 'TIMED_OUT'].includes(providerStatus)) {
    const providerError = text(provider.error || safeObject(provider.output).error).slice(0, 500) || providerStatus
    const failureCode = providerError.includes('PREVIEW_INFERENCE_FAILED') ? 'PREVIEW_INFERENCE_FAILED' : providerStatus
    next = { ...next, status: 'failed', ready: false, failedAt: now, failureCode, operatorMessage: 'Não foi possível preparar a prévia. Nenhuma aprovação foi realizada.', lastError: providerError }
  } else if (providerStatus === 'CANCELLED') next = { ...next, status: 'cancelled', ready: false, failedAt: now, operatorMessage: 'A preparação da prévia foi cancelada.' }
  const updated = await updateEvidence(adapter, next)
  return { status: 'IDENTITY_PREVIEW_STATUS_REFRESHED', adapterId: adapter.id, providerStatus, preview: previewSnapshot(updated), terminal: ['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].includes(providerStatus), message: next.operatorMessage || 'Andamento atualizado.' }
}

export async function getActorIdentityPreviewMedia(actorProfileId, assetKey = 'baseline_without_lora', range = null, abortSignal = null) {
  const { adapter } = await loadLatestIdentity(actorProfileId)
  const current = visualEvidence(adapter)
  const assets = Array.isArray(safeObject(current.qaKit).assets) ? safeObject(current.qaKit).assets : []
  const selected = assets.find((item) => text(item.assetKey) === text(assetKey))
  if (!['ready', 'invalid'].includes(text(current.status)) || !selected || !isPrivateReference(selected.r2Bucket, selected.r2Key)) throw new ApiError(404, 'A evidência privada solicitada ainda não está disponível.')
  return getPrivateObjectStream({ bucket: selected.r2Bucket, key: selected.r2Key, range, abortSignal })
}

export async function inspectActorIdentityPreview(actorProfileId) {
  const { run, adapter } = await loadLatestIdentity(actorProfileId)
  return { actorProfileId, trainingRunId: run.id, adapterId: adapter.id, policy: inspectControlledIdentityPreviewPolicy({ actorProfileId, trainingRunId: run.id, adapterId: adapter.id }), preview: previewSnapshot(adapter) }
}

export { CONFIRMATION as IDENTITY_PREVIEW_CONFIRMATION }
