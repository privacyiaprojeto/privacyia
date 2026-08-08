import { createHash, randomBytes } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { CONTENT_TYPES } from '../validators/creation-admin.schemas.js'
import { copyObject, getKycVaultObject, headKycVaultObject, uploadKycAssetToVault } from './storage.service.js'
import {
  buildDynamicMappingChecklist,
  getMappingRequirementOrThrow,
  isMimeTypeAllowedForRequirement,
  listActiveMappingRequirements,
} from './mapping-requirements.service.js'
import { auditActorIdentityDatasetReadiness } from './actor-identity-dataset-readiness.service.js'

const ACTORS_TABLE = 'actor_profiles'
const INVITES_TABLE = 'actor_onboarding_invites'
const KYC_CASES_TABLE = 'actor_kyc_cases'
const KYC_ASSETS_TABLE = 'actor_kyc_assets'
const AUTHORIZATIONS_TABLE = 'avatar_production_authorizations'
const COMPANIONS_TABLE = 'companions'
const IDENTITY_TRAINING_RUNS_TABLE = 'actor_identity_training_runs'
const IDENTITY_ADAPTERS_TABLE = 'actor_identity_adapters'

const PRODUCTION_NOT_AUTHORIZED_MESSAGE = 'Este avatar ainda não está autorizado para produção.'
const MAX_MAPPING_ASSET_BYTES = 25 * 1024 * 1024
const TEST_ARTIFACT_SOURCE_PREFIX = 'sprint_5_9'
const MAPPING_TEST_QUARANTINE_SOURCE = 'sprint_5_9H_mapping_vault_test_quarantine'
const MAPPING_TEST_QUARANTINE_CONFIRMATION = 'CONFIRMAR QUARENTENA DE TESTE'
const REVIEW_HISTORY_LIMIT = 30

function asPlainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function appendReviewHistory(current, entry) {
  const history = Array.isArray(current) ? current.filter(Boolean) : []
  return [...history, entry].slice(-REVIEW_HISTORY_LIMIT)
}

function getMappingCaseReviewState(row = {}) {
  const metadata = asPlainObject(row.metadata)
  const actorSubmission = asPlainObject(metadata.actorSubmission)
  const adminReview = asPlainObject(metadata.adminReview)
  const caseStatus = String(row.status || '').toLowerCase()

  if (caseStatus === 'approved' || adminReview.status === 'approved') return 'approved'
  if (caseStatus === 'rejected' || adminReview.status === 'changes_requested' || actorSubmission.status === 'changes_requested' || actorSubmission.status === 'changes_in_progress') {
    return actorSubmission.status === 'changes_in_progress' ? 'changes_in_progress' : 'changes_requested'
  }
  if (actorSubmission.status === 'sent_for_admin_review' || metadata.actorSubmittedForReview === true) return 'sent_for_review'
  return caseStatus === 'draft' ? 'draft' : 'in_progress'
}

function getIdentityDatasetSupplement(row = {}) {
  const metadata = asPlainObject(row.metadata)
  return asPlainObject(metadata.identityDatasetSupplement)
}

function identityDatasetSupplementState(row = {}) {
  return String(getIdentityDatasetSupplement(row).status || '').toLowerCase()
}

function isMissingRelationError(error) {
  const code = String(error?.code || '').toUpperCase()
  const message = `${error?.message || ''} ${error?.details || ''}`.toLowerCase()
  return code === '42P01' || message.includes('does not exist') || message.includes('relation') && message.includes('not found')
}

function latestIso(...values) {
  return values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((value) => !Number.isNaN(value.getTime()))
    .sort((a, b) => b.getTime() - a.getTime())[0]?.toISOString() || null
}

function buildActorIdentityOperationalSnapshot({ run = null, adapter = null, schemaReady = true } = {}) {
  if (!schemaReady) {
    return {
      status: 'schema_pending',
      label: 'Indisponível',
      nextAction: 'Conferir estrutura da identidade',
      progressPercent: null,
      runId: null,
      adapterId: null,
      qaStatus: null,
      lastUpdatedAt: null,
    }
  }

  const runStatus = String(run?.status || '').toLowerCase()
  const adapterStatus = String(adapter?.status || '').toLowerCase()
  const qaStatus = String(adapter?.qa_status || '').toLowerCase()
  const stage = asPlainObject(asPlainObject(run?.metadata).stage_2_2d3_6a)
  const storedProgress = Number(stage.progressPercent)
  const lastUpdatedAt = latestIso(
    adapter?.updated_at,
    adapter?.approved_at,
    adapter?.created_at,
    run?.updated_at,
    run?.completed_at,
    run?.failed_at,
    run?.created_at,
  )

  if (adapter && !adapter.revoked_at && adapterStatus === 'approved' && qaStatus === 'approved') {
    return { status: 'approved', label: 'Aprovada', nextAction: 'Integrar identidade', progressPercent: 100, runId: run?.id || adapter.training_run_id || null, adapterId: adapter.id, qaStatus, lastUpdatedAt }
  }
  if (adapter && (adapterStatus === 'rejected' || qaStatus === 'rejected')) {
    return { status: 'changes_required', label: 'Ajustes necessários', nextAction: 'Revisar reprovação', progressPercent: 100, runId: run?.id || adapter.training_run_id || null, adapterId: adapter.id, qaStatus, lastUpdatedAt }
  }
  if (adapter || ['qa_pending', 'training_completed'].includes(runStatus)) {
    return { status: 'review_required', label: 'Revisão necessária', nextAction: 'Revisar identidade', progressPercent: 100, runId: run?.id || adapter?.training_run_id || null, adapterId: adapter?.id || null, qaStatus: qaStatus || 'pending', lastUpdatedAt }
  }
  if (runStatus === 'training_in_progress') {
    return { status: 'training', label: 'Em treinamento', nextAction: 'Acompanhar treinamento', progressPercent: Number.isFinite(storedProgress) ? storedProgress : null, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  if (runStatus === 'training_pending') {
    return { status: 'queued', label: 'Na fila', nextAction: 'Acompanhar fila', progressPercent: Number.isFinite(storedProgress) ? storedProgress : 0, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  if (runStatus === 'failed') {
    return { status: 'failed', label: 'Falhou', nextAction: 'Ver diagnóstico', progressPercent: null, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  if (runStatus === 'cancelled') {
    return { status: 'cancelled', label: 'Cancelada', nextAction: 'Ver diagnóstico', progressPercent: null, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  if (runStatus === 'dry_run_ready') {
    return { status: 'ready_to_train', label: 'Pronta para criar', nextAction: 'Criar identidade', progressPercent: 0, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  if (runStatus === 'dataset_ready') {
    return { status: 'preparing', label: 'Em preparação', nextAction: 'Validar configuração', progressPercent: 0, runId: run.id, adapterId: null, qaStatus: null, lastUpdatedAt }
  }
  return { status: 'not_started', label: 'Não iniciada', nextAction: 'Preparar identidade', progressPercent: null, runId: run?.id || null, adapterId: null, qaStatus: null, lastUpdatedAt }
}

function getActorListMappingOperationalStatus(actorRow = {}, latestMappingCase = null) {
  if (!latestMappingCase) return actorRow.kyc_status || 'not_started'

  const supplementState = identityDatasetSupplementState(latestMappingCase)
  if (['sent_for_admin_review', 'in_progress'].includes(supplementState)) {
    return 'supplement_review'
  }

  const reviewState = getMappingCaseReviewState(latestMappingCase)
  if (reviewState === 'sent_for_review') return 'pending_review'
  if (reviewState === 'changes_requested') return 'changes_requested'
  if (reviewState === 'changes_in_progress') return 'changes_in_progress'
  if (reviewState === 'approved') return 'approved'
  if (reviewState === 'draft') return 'draft'
  return 'in_progress'
}

function mappingCaseLockedForAdminReview(row = {}) {
  const supplementState = identityDatasetSupplementState(row)
  return getMappingCaseReviewState(row) === 'sent_for_review'
    || ['sent_for_admin_review', 'in_progress'].includes(supplementState)
}

function approvedCaseAcceptsSupplementalReview(row = {}, asset = {}) {
  return String(row.status || '').toLowerCase() === 'approved'
    && String(asset.status || '').toLowerCase() === 'pending_review'
}


function normalizeMappingType(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function getAssetField(asset = {}, camelKey, snakeKey) {
  return asset[camelKey] ?? asset[snakeKey] ?? null
}

function isDryRunMappingAsset(asset = {}) {
  const status = String(getAssetField(asset, 'status', 'status') || '').toLowerCase()
  const metadata = getAssetField(asset, 'metadata', 'metadata') || {}
  const assetType = normalizeMappingType(getAssetField(asset, 'assetType', 'asset_type'))

  return Boolean(
    status === 'registered_dry_run'
    || status.includes('dry_run')
    || assetType.includes('dry_run')
    || metadata?.dryRunOnly === true
    || metadata?.vault?.dryRun === true
    || metadata?.vault?.metadata?.dry_run === true,
  )
}


function getMappingAssetTestSource(asset = {}) {
  const metadata = getAssetField(asset, 'metadata', 'metadata') || {}
  const vaultMetadata = metadata?.vault?.metadata || {}

  return String(
    metadata.source
    || metadata.testSource
    || vaultMetadata.source
    || vaultMetadata.test_source
    || '',
  )
}

function isActorMappingTestArtifact(asset = {}) {
  const key = String(getAssetField(asset, 'key', 'r2_key') || '')
  const assetType = normalizeMappingType(getAssetField(asset, 'assetType', 'asset_type'))
  const originalFilename = normalizeMappingType(getAssetField(asset, 'originalFilename', 'original_filename'))
  const source = getMappingAssetTestSource(asset).toLowerCase()
  const metadata = getAssetField(asset, 'metadata', 'metadata') || {}

  if (!key.startsWith('vault/actor-mapping/')) return false

  return Boolean(
    source.startsWith(TEST_ARTIFACT_SOURCE_PREFIX)
    || source.includes('sprint_5_9')
    || key.includes('/test-5-9')
    || key.includes('real_r2_test')
    || key.includes('dry_run')
    || key.includes('private_view')
    || assetType.includes('dry_run')
    || assetType.includes('real_r2_test')
    || assetType.includes('private_view')
    || assetType.includes('vault_audit')
    || originalFilename.includes('5_9')
    || originalFilename.includes('5_9')
    || originalFilename.includes('mapping_private_view')
    || originalFilename.includes('mapping_upload')
    || metadata?.safeMock === true
    || metadata?.fake === true,
  )
}

function isQuarantinedMappingAsset(asset = {}) {
  const status = String(getAssetField(asset, 'status', 'status') || '').toLowerCase()
  const metadata = getAssetField(asset, 'metadata', 'metadata') || {}

  return Boolean(status === 'quarantined' || metadata?.quarantine?.status === 'quarantined')
}

function buildMappingTestQuarantineKey(sourceKey) {
  const date = new Date()
  const year = String(date.getUTCFullYear())
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  const safeSourceKey = String(sourceKey || 'unknown-object')
    .replace(/^\/+/, '')
    .replace(/[^a-zA-Z0-9._/=-]+/g, '-')

  return [
    '_quarantine',
    'actor-mapping-tests',
    year,
    month,
    day,
    safeSourceKey,
  ].join('/')
}

function mapMappingTestArtifactForAdmin(asset = {}, { r2Head = null, r2Checked = false } = {}) {
  const dryRun = isDryRunMappingAsset(asset)
  const quarantined = isQuarantinedMappingAsset(asset)

  return {
    id: asset.id,
    kycCaseId: asset.kycCaseId || null,
    actorProfileId: asset.actorProfileId || null,
    assetType: asset.assetType || null,
    bucket: asset.bucket || null,
    key: asset.key || null,
    status: asset.status || null,
    originalFilename: asset.originalFilename || null,
    contentType: asset.contentType || null,
    byteSize: asset.byteSize ?? null,
    source: getMappingAssetTestSource(asset) || null,
    dryRun,
    realR2Candidate: Boolean(!dryRun && asset.bucket && asset.key),
    quarantined,
    r2Checked: Boolean(r2Checked),
    r2ObjectExists: r2Checked ? Boolean(r2Head?.exists) : null,
    r2: sanitizeVaultHeadForAdmin(r2Head),
    createdAt: asset.createdAt || null,
    updatedAt: asset.updatedAt || null,
    publicAccess: false,
  }
}

function assertMappingTestArtifact(asset = {}) {
  if (!isActorMappingTestArtifact(asset)) {
    throw new ApiError(409, 'Este material não foi identificado como artefato de teste do mapeamento.')
  }
}

function isValidMappingAsset(asset = {}) {
  const key = getAssetField(asset, 'key', 'r2_key')
  const bucket = getAssetField(asset, 'bucket', 'r2_bucket')
  const status = String(getAssetField(asset, 'status', 'status') || '').toLowerCase()

  return Boolean(
    bucket
    && key
    && !isDryRunMappingAsset(asset)
    && !['rejected', 'deleted', 'quarantined', 'archived'].includes(status),
  )
}

async function buildMappingChecklistFromAssets(assets = [], kycCase = {}) {
  const requirements = await listActiveMappingRequirements()
  return buildDynamicMappingChecklist(requirements, assets, kycCase)
}

async function assertMappingChecklistComplete(kycCase, assets = []) {
  const checklist = await buildMappingChecklistFromAssets(assets, kycCase)

  if (!checklist.isComplete) {
    throw new ApiError(409, 'Mapeamento incompleto. Complete os materiais obrigatórios antes de aprovar ou autorizar produção.', {
      missingGroups: checklist.missingGroups,
      checklist,
    })
  }

  return checklist
}

function nowIso() {
  return new Date().toISOString()
}

function addDaysIso(days = 7) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + Number(days || 7))
  return date.toISOString()
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase()
  return email || null
}

function estimateBase64ByteSize(value) {
  const clean = String(value || '')
    .replace(/^data:.+?;base64,/, '')
    .replace(/^base64,/, '')
    .replace(/\s/g, '')

  if (!clean) return 0

  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(Math.floor((clean.length * 3) / 4) - padding, 0)
}

function decodeBase64Asset(value) {
  const clean = String(value || '')
    .replace(/^data:.+?;base64,/, '')
    .replace(/^base64,/, '')
    .replace(/\s/g, '')

  if (!clean) return Buffer.alloc(0)
  return Buffer.from(clean, 'base64')
}

function hashInviteToken(token) {
  return createHash('sha256').update(String(token || '')).digest('hex')
}

function generateInviteToken() {
  return randomBytes(32).toString('base64url')
}

function assertUuidLike(id, label) {
  if (!String(id || '').trim()) {
    throw new ApiError(400, `${label} obrigatório.`)
  }
}

async function assertTableAvailable(table) {
  const { error } = await supabaseAdmin
    .from(table)
    .select('id')
    .limit(1)

  if (error) {
    throw new ApiError(500, `Tabela ${table} indisponível. Execute a migration do Sprint 5.9A antes de usar Atores/Mapeamento.`, {
      table,
      error: error.message,
    })
  }
}

function mapActor(row = {}, { latestMappingCase = null, mappingOperationalStatus = null, identity = null } = {}) {
  return {
    id: row.id,
    profileId: row.profile_id || null,
    displayName: row.display_name || 'Ator sem nome',
    legalName: row.legal_name || null,
    email: row.email || null,
    phone: row.phone || null,
    countryCode: row.country_code || 'BR',
    status: row.status || 'draft',
    kycStatus: row.kyc_status || 'not_started',
    productionStatus: row.production_status || 'not_authorized',
    latestMappingCaseId: latestMappingCase?.id || null,
    latestMappingCaseStatus: latestMappingCase?.status || null,
    mappingOperationalStatus: mappingOperationalStatus || row.kyc_status || 'not_started',
    identity: identity || buildActorIdentityOperationalSnapshot(),
    notes: row.notes || null,
    blockedAt: row.blocked_at || null,
    blockedByProfileId: row.blocked_by_profile_id || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapInvite(row = {}, { includeToken = null } = {}) {
  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    email: row.email || null,
    status: row.status || 'pending',
    expiresAt: row.expires_at || null,
    acceptedAt: row.accepted_at || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    ...(includeToken ? { inviteToken: includeToken } : {}),
  }
}

function mapKycAsset(row = {}) {
  return {
    id: row.id,
    kycCaseId: row.kyc_case_id || null,
    actorProfileId: row.actor_profile_id || null,
    mappingRequirementId: row.mapping_requirement_id || null,
    assetType: row.asset_type || null,
    bucket: row.r2_bucket || null,
    key: row.r2_key || null,
    originalFilename: row.original_filename || null,
    contentType: row.content_type || null,
    byteSize: row.byte_size ?? null,
    checksumSha256: row.checksum_sha256 || null,
    status: row.status || 'pending_review',
    rejectionReason: row.rejection_reason || null,
    reviewedAt: row.reviewed_at || null,
    reviewerProfileId: row.reviewer_profile_id || null,
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}


function containsForbiddenPublicField(value, path = []) {
  const forbidden = new Set(['bucket', 'r2_bucket', 'key', 'r2_key', 'url', 'publicUrl', 'signedUrl', 'downloadUrl', 'viewUrl'])
  const found = []

  if (!value || typeof value !== 'object') return found

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      found.push(...containsForbiddenPublicField(item, [...path, String(index)]))
    })
    return found
  }

  for (const [field, fieldValue] of Object.entries(value)) {
    const currentPath = [...path, field]
    if (forbidden.has(field)) {
      found.push(currentPath.join('.'))
    }
    found.push(...containsForbiddenPublicField(fieldValue, currentPath))
  }

  return found
}

function sanitizeVaultHeadForAdmin(head = null) {
  if (!head) return null

  return {
    exists: Boolean(head.exists),
    contentType: head.contentType || null,
    contentLength: head.contentLength ?? null,
    etag: head.etag || null,
    lastModified: head.lastModified || null,
    metadata: head.metadata || {},
    publicAccess: false,
  }
}


function buildSafeVaultFilename(asset = {}) {
  const original = String(asset.originalFilename || asset.assetType || asset.id || 'material-mapeamento').trim()
  const fallbackExtension = String(asset.contentType || '').includes('pdf')
    ? 'pdf'
    : String(asset.contentType || '').includes('png')
      ? 'png'
      : String(asset.contentType || '').includes('webp')
        ? 'webp'
        : String(asset.contentType || '').includes('video')
          ? 'mp4'
          : String(asset.contentType || '').includes('audio')
            ? 'mp3'
            : 'bin'

  const withoutPath = original.split(/[\\/]/).pop() || 'material-mapeamento'
  const safe = withoutPath
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 120)

  if (!safe) return `material-mapeamento.${fallbackExtension}`
  if (safe.includes('.')) return safe

  return `${safe}.${fallbackExtension}`
}

function assertAssetIsPrivateMappingVault(asset = {}) {
  const key = String(asset.key || '')
  const metadata = asset.metadata || {}
  const vaultMetadata = metadata?.vault?.metadata || {}

  if (!key.startsWith('vault/actor-mapping/')) {
    throw new ApiError(409, 'Este material não está no cofre privado de mapeamento.')
  }

  if (!(metadata.privateVaultOnly === true || vaultMetadata.privacy === 'private')) {
    throw new ApiError(409, 'Este material não está marcado como cofre privado.')
  }

  if (isDryRunMappingAsset(asset)) {
    throw new ApiError(409, 'Material de simulação não possui arquivo real para visualizar.')
  }
}

function buildActorMappingVaultAudit({ asset, kycCase = null, actor = null, r2Head = null, r2Checked = false, publicPayload = null }) {
  const metadata = asset?.metadata || {}
  const key = asset?.key || null
  const bucket = asset?.bucket || null
  const forbiddenPublicFields = containsForbiddenPublicField(publicPayload || {})
  const expectedPrefix = 'vault/actor-mapping/'
  const status = String(asset?.status || '').toLowerCase()
  const dryRun = isDryRunMappingAsset(asset)
  const vaultMetadata = metadata?.vault?.metadata || {}
  const checks = {
    dbRegistered: Boolean(asset?.id),
    privateVaultPrefix: Boolean(key && String(key).startsWith(expectedPrefix)),
    privateVaultFlag: metadata.privateVaultOnly === true || vaultMetadata.privacy === 'private',
    mappingScope: vaultMetadata.scope === 'actor_mapping_vault' || metadata.mappingPurpose === 'avatar_reference_material',
    publicPayloadSanitized: forbiddenPublicFields.length === 0,
    realUpload: !dryRun && status === 'uploaded',
    r2Checked: Boolean(r2Checked),
    r2ObjectExists: r2Checked ? Boolean(r2Head?.exists) : null,
    publicAccess: false,
  }

  const passed = Boolean(
    checks.dbRegistered
    && checks.privateVaultPrefix
    && checks.privateVaultFlag
    && checks.mappingScope
    && checks.publicPayloadSanitized
    && (!r2Checked || checks.r2ObjectExists === true)
  )

  return {
    status: passed ? 'ok' : 'attention',
    passed,
    asset: {
      id: asset.id,
      kycCaseId: asset.kycCaseId || null,
      actorProfileId: asset.actorProfileId || null,
      assetType: asset.assetType || null,
      bucket,
      key,
      status: asset.status || null,
      contentType: asset.contentType || null,
      byteSize: asset.byteSize ?? null,
      originalFilename: asset.originalFilename || null,
      createdAt: asset.createdAt || null,
    },
    actor: actor ? {
      id: actor.id,
      displayName: actor.display_name || actor.displayName || null,
      status: actor.status || null,
      mappingStatus: actor.kyc_status || actor.kycStatus || null,
    } : null,
    mappingCase: kycCase ? {
      id: kycCase.id,
      status: kycCase.status || null,
      caseType: kycCase.case_type || kycCase.caseType || null,
    } : null,
    checks,
    r2: sanitizeVaultHeadForAdmin(r2Head),
    publicPayloadAudit: {
      sanitized: forbiddenPublicFields.length === 0,
      forbiddenFields: forbiddenPublicFields,
    },
    message: passed
      ? 'Cofre privado validado. Material registrado e sem exposição pública.'
      : 'Auditoria do cofre encontrou pendência. Revise os checks antes de avançar.',
  }
}

function mapPublicKycAsset(row = {}) {
  return {
    id: row.id,
    kycCaseId: row.kyc_case_id || row.kycCaseId || null,
    actorProfileId: row.actor_profile_id || row.actorProfileId || null,
    mappingRequirementId: row.mapping_requirement_id || row.mappingRequirementId || null,
    assetType: row.asset_type || row.assetType || null,
    originalFilename: row.original_filename || row.originalFilename || null,
    contentType: row.content_type || row.contentType || null,
    byteSize: row.byte_size ?? row.byteSize ?? null,
    status: row.status || 'pending_review',
    rejectionReason: row.rejection_reason || row.rejectionReason || null,
    reviewedAt: row.reviewed_at || row.reviewedAt || null,
    createdAt: row.created_at || row.createdAt || null,
    updatedAt: row.updated_at || row.updatedAt || null,
  }
}

function mapKycCase(row = {}, assets = [], { mappingChecklist = null } = {}) {
  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    caseType: row.case_type || 'avatar_mapping',
    status: row.status || 'pending_review',
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    reviewerProfileId: row.reviewer_profile_id || null,
    rejectionReason: row.rejection_reason || null,
    notes: row.notes || null,
    metadata: row.metadata || {},
    assets,
    mappingChecklist,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapPublicMappingChecklist(checklist = {}) {
  return {
    status: checklist.status || 'incomplete',
    isComplete: Boolean(checklist.isComplete),
    totalRequired: checklist.totalRequired || 0,
    completedRequired: checklist.completedRequired || 0,
    missingRequired: checklist.missingRequired || 0,
    missingGroups: (checklist.missingGroups || []).map((group) => ({
      requirementId: group.requirementId || group.key,
      label: group.label,
      description: group.description,
      mediaType: group.mediaType || null,
    })),
    groups: (checklist.groups || []).map((group) => ({
      requirementId: group.requirementId || group.key,
      label: group.label,
      description: group.description,
      mediaType: group.mediaType || null,
      required: Boolean(group.required),
      present: Boolean(group.present),
      status: group.status || 'pending',
      rejectionReason: group.rejectionReason || null,
      totalAssets: group.totalAssets || 0,
      validAssets: group.validAssets || 0,
      dryRunAssets: group.dryRunAssets || 0,
      assets: group.assets || [],
    })),
    summary: checklist.summary || 'Mapeamento aguardando materiais.',
  }
}


function mapPublicIdentityDatasetReadiness(result = null) {
  if (!result) return null

  const summary = asPlainObject(result.summary)
  const thresholds = asPlainObject(result.thresholds)
  const coverage = asPlainObject(result.coverage)
  const validUniqueImages = Math.max(0, Number(summary.validUniqueImages || 0))
  const validUniqueVideos = Math.max(0, Number(summary.validUniqueVideos || 0))
  const minimumImages = Math.max(1, Number(thresholds.minimumImages || 15))
  const minimumVideos = Math.max(1, Number(thresholds.minimumVideos || 6))
  const pendingReviewAssets = Math.max(0, Number(summary.pendingReviewAssets || 0))
  const pendingReviewImages = Math.max(0, Number(summary.pendingReviewImages || 0))
  const pendingReviewVideos = Math.max(0, Number(summary.pendingReviewVideos || 0))
  const missingImageTags = Array.isArray(coverage.missingImageTags) ? coverage.missingImageTags.filter(Boolean) : []
  const missingVideoTags = Array.isArray(coverage.missingVideoTags) ? coverage.missingVideoTags.filter(Boolean) : []
  const materialsReady = validUniqueImages >= minimumImages
    && validUniqueVideos >= minimumVideos
    && pendingReviewAssets === 0
    && missingImageTags.length === 0
    && missingVideoTags.length === 0
  const rawCompletionPlan = asPlainObject(result.completionPlan)
  const completionTasks = Array.isArray(rawCompletionPlan.tasks)
    ? rawCompletionPlan.tasks.map((task) => {
        const item = asPlainObject(task)
        return {
          id: normalizeText(item.id),
          origin: normalizeText(item.source) || 'system_identity_plan',
          requirementId: normalizeText(item.requirementId),
          title: normalizeText(item.title) || 'Material solicitado',
          description: normalizeText(item.description),
          guidance: normalizeText(item.guidance),
          mediaType: normalizeText(item.mediaType) || 'unknown',
          targetIndex: Math.max(1, Number(item.targetIndex || 1)),
          targetCount: Math.max(1, Number(item.targetCount || 1)),
          replacementAssetId: normalizeText(item.replacementAssetId) || null,
        }
      }).filter((task) => task.id && task.requirementId)
    : []

  return {
    materialsReady,
    totalMappingAssets: Math.max(0, Number(summary.totalMappingAssets || 0)),
    approvedMappingAssets: Math.max(0, Number(summary.approvedMappingAssets || 0)),
    pendingReviewAssets,
    pendingReviewImages,
    pendingReviewVideos,
    approvedAudioAssets: Math.max(0, Number(summary.approvedAudioAssets || 0)),
    includedVisualAssets: Math.max(0, Number(summary.includedVisualAssets || 0)),
    validUniqueImages,
    validUniqueVideos,
    excludedAssets: Math.max(0, Number(summary.excludedAssets || 0)),
    minimumImages,
    minimumVideos,
    missingImageTags,
    missingVideoTags,
    completionPlan: {
      schemaVersion: normalizeText(rawCompletionPlan.schemaVersion) || 'privacy-identity-completion-plan-v1',
      ready: completionTasks.length === 0,
      remainingTotal: completionTasks.length,
      remainingImages: completionTasks.filter((task) => task.mediaType === 'image').length,
      remainingVideos: completionTasks.filter((task) => task.mediaType === 'video').length,
      remainingAudio: completionTasks.filter((task) => task.mediaType === 'audio').length,
      tasks: completionTasks,
    },
  }
}

function mapPublicKycCase(row = {}, assets = [], mappingChecklist = null) {
  if (!row?.id) return null

  const metadata = asPlainObject(row.metadata)
  const actorSubmission = asPlainObject(metadata.actorSubmission)
  const adminReview = asPlainObject(metadata.adminReview)
  const reviewStatus = getMappingCaseReviewState(row)
  const supplement = getIdentityDatasetSupplement(row)
  const supplementStatus = String(supplement.status || '').toLowerCase() || null
  const actorSubmittedForReview = reviewStatus === 'sent_for_review'
    || supplementStatus === 'sent_for_admin_review'
  const pendingReviewAssets = (assets || []).filter((asset) => String(asset.status || '').toLowerCase() === 'pending_review').length

  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    caseType: row.case_type || 'avatar_mapping',
    status: row.status || 'draft',
    submittedAt: row.submitted_at || null,
    reviewedAt: row.reviewed_at || null,
    rejectionReason: row.rejection_reason || adminReview.reason || null,
    notes: row.notes || null,
    actorSubmittedForReview,
    sentForReviewAt: actorSubmission.sentForReviewAt || null,
    reviewStatus,
    changesRequestedAt: adminReview.changesRequestedAt || adminReview.requestedAt || null,
    reviewCycle: Math.max(0, Number(actorSubmission.cycle || metadata.reviewCycle || 0)),
    generalMappingApproved: String(row.status || '').toLowerCase() === 'approved',
    supplementalReview: {
      status: supplementStatus,
      cycle: Math.max(0, Number(supplement.cycle || 0)),
      sentForReviewAt: supplement.sentForReviewAt || null,
      completedAt: supplement.completedAt || null,
      pendingReviewAssets,
    },
    canAddSupplementalMaterials: String(row.status || '').toLowerCase() === 'approved'
      && !['sent_for_admin_review', 'in_progress'].includes(supplementStatus),
    assets: (assets || []).map(mapPublicKycAsset),
    mappingChecklist: mapPublicMappingChecklist(mappingChecklist || {}),
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapAuthorization(row = {}) {
  return {
    id: row.id,
    companionId: row.companion_id || null,
    actorProfileId: row.actor_profile_id || null,
    kycCaseId: row.kyc_case_id || null,
    status: row.status || 'active',
    authorizedForContentTypes: row.authorized_for_content_types || [],
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    revokedAt: row.revoked_at || null,
    revokedByProfileId: row.revoked_by_profile_id || null,
    authorizedByProfileId: row.authorized_by_profile_id || null,
    note: row.authorization_note || null,
    financeSnapshot: row.finance_snapshot || {},
    termsSnapshot: row.terms_snapshot || {},
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

async function getActorOrThrow(actorProfileId) {
  assertUuidLike(actorProfileId, 'Ator')
  await assertTableAvailable(ACTORS_TABLE)

  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .select('*')
    .eq('id', actorProfileId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar ator.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Ator não encontrado.')
  }

  return data
}

async function getCompanionOrThrow(companionId) {
  assertUuidLike(companionId, 'Avatar')

  const { data, error } = await supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('id, name, slug, is_active')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar avatar.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Avatar não encontrado.')
  }

  return data
}

async function getKycCaseOrThrow(kycCaseId) {
  assertUuidLike(kycCaseId, 'Mapeamento')
  await assertTableAvailable(KYC_CASES_TABLE)

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('*')
    .eq('id', kycCaseId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar mapeamento.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Mapeamento não encontrado.')
  }

  return data
}

async function listAssetsForCase(kycCaseId) {
  const [{ data: caseRow, error: caseError }, { data, error }] = await Promise.all([
    supabaseAdmin
      .from(KYC_CASES_TABLE)
      .select('id, actor_profile_id')
      .eq('id', kycCaseId)
      .maybeSingle(),
    supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('*')
      .eq('kyc_case_id', kycCaseId)
      .order('created_at', { ascending: true }),
  ])

  if (caseError) throw new ApiError(500, 'Erro ao validar o titular do mapeamento.', caseError)
  if (!caseRow) throw new ApiError(404, 'Mapeamento não encontrado.')
  if (error) throw new ApiError(500, 'Erro ao listar materiais do mapeamento.', error)

  const mismatchedAsset = (data || []).find((row) => row.actor_profile_id !== caseRow.actor_profile_id)
  if (mismatchedAsset) {
    throw new ApiError(409, 'Integridade bloqueada: existe material vinculado a uma pessoa diferente do titular deste mapeamento.')
  }

  return (data || []).map(mapKycAsset)
}

function buildActiveAuthorizationSnapshot(row = null) {
  if (!row) return null

  return {
    id: row.id,
    actorProfileId: row.actor_profile_id || null,
    kycCaseId: row.kyc_case_id || null,
    authorizedForContentTypes: row.authorized_for_content_types || [],
    startsAt: row.starts_at || null,
    endsAt: row.ends_at || null,
    financeSnapshot: row.finance_snapshot || {},
  }
}

export function getProductionNotAuthorizedMessage() {
  return PRODUCTION_NOT_AUTHORIZED_MESSAGE
}

export async function listActorProfiles({ status = null, search = null, includeBlocked = false } = {}) {
  await assertTableAvailable(ACTORS_TABLE)

  let query = supabaseAdmin
    .from(ACTORS_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (!includeBlocked) query = query.neq('status', 'blocked')

  const cleanSearch = normalizeText(search)
  if (cleanSearch) {
    const safe = cleanSearch.replace(/[%_,]/g, '')
    query = query.or(`display_name.ilike.%${safe}%,legal_name.ilike.%${safe}%,email.ilike.%${safe}%`)
  }

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar atores.', error)
  }

  const actorRows = data || []
  const actorIds = actorRows.map((row) => row.id).filter(Boolean)
  const latestMappingCaseByActor = new Map()
  const latestIdentityRunByActor = new Map()
  const latestIdentityAdapterByActor = new Map()
  let identitySchemaReady = true

  if (actorIds.length > 0) {
    const { data: caseRows, error: caseError } = await supabaseAdmin
      .from(KYC_CASES_TABLE)
      .select('id, actor_profile_id, status, metadata, submitted_at, reviewed_at, created_at, updated_at')
      .in('actor_profile_id', actorIds)
      .order('created_at', { ascending: false })

    if (caseError) {
      throw new ApiError(500, 'Erro ao conferir a etapa atual dos mapeamentos.', caseError)
    }

    for (const caseRow of caseRows || []) {
      if (!latestMappingCaseByActor.has(caseRow.actor_profile_id)) {
        latestMappingCaseByActor.set(caseRow.actor_profile_id, caseRow)
      }
    }

    const [runsResult, adaptersResult] = await Promise.all([
      supabaseAdmin
        .from(IDENTITY_TRAINING_RUNS_TABLE)
        .select('id, actor_profile_id, status, mode, metadata, completed_at, failed_at, created_at, updated_at')
        .in('actor_profile_id', actorIds)
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from(IDENTITY_ADAPTERS_TABLE)
        .select('id, actor_profile_id, training_run_id, status, qa_status, approved_at, revoked_at, created_at, updated_at')
        .in('actor_profile_id', actorIds)
        .order('created_at', { ascending: false }),
    ])

    const identityErrors = [runsResult.error, adaptersResult.error].filter(Boolean)
    if (identityErrors.length > 0) {
      if (identityErrors.every(isMissingRelationError)) {
        identitySchemaReady = false
      } else {
        throw new ApiError(500, 'Erro ao conferir o estado das identidades dos atores.', identityErrors[0])
      }
    } else {
      for (const runRow of runsResult.data || []) {
        if (!latestIdentityRunByActor.has(runRow.actor_profile_id)) latestIdentityRunByActor.set(runRow.actor_profile_id, runRow)
      }
      for (const adapterRow of adaptersResult.data || []) {
        if (!latestIdentityAdapterByActor.has(adapterRow.actor_profile_id)) latestIdentityAdapterByActor.set(adapterRow.actor_profile_id, adapterRow)
      }
    }
  }

  return {
    items: actorRows.map((row) => {
      const latestMappingCase = latestMappingCaseByActor.get(row.id) || null
      return mapActor(row, {
        latestMappingCase,
        mappingOperationalStatus: getActorListMappingOperationalStatus(row, latestMappingCase),
        identity: buildActorIdentityOperationalSnapshot({
          run: latestIdentityRunByActor.get(row.id) || null,
          adapter: latestIdentityAdapterByActor.get(row.id) || null,
          schemaReady: identitySchemaReady,
        }),
      })
    }),
  }
}

export async function createActorProfile(input, { actorProfileId = null } = {}) {
  await assertTableAvailable(ACTORS_TABLE)

  const now = nowIso()
  const payload = {
    display_name: input.displayName,
    legal_name: input.legalName || null,
    email: normalizeEmail(input.email),
    phone: input.phone || null,
    country_code: String(input.countryCode || 'BR').toUpperCase(),
    status: 'draft',
    kyc_status: 'not_started',
    production_status: 'not_authorized',
    notes: input.notes || null,
    metadata: {
      ...(input.metadata || {}),
      source: 'admin_actor_foundation',
    },
    created_by_profile_id: actorProfileId,
    updated_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao cadastrar ator.', error)
  }

  return mapActor(data)
}

export async function blockActorProfile(actorId, input = {}, { actorProfileId = null } = {}) {
  await getActorOrThrow(actorId)

  const now = nowIso()
  const blockPayload = {
    status: 'blocked',
    production_status: 'not_authorized',
    blocked_at: now,
    blocked_by_profile_id: actorProfileId,
    updated_by_profile_id: actorProfileId,
    updated_at: now,
  }

  if (input.reason) blockPayload.notes = input.reason

  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update(blockPayload)
    .eq('id', actorId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao bloquear ator.', error)
  }

  await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .update({
      status: 'revoked',
      revoked_at: now,
      revoked_by_profile_id: actorProfileId,
      updated_at: now,
      metadata: {
        revokedByActorBlock: true,
        reason: input.reason || 'Ator bloqueado pelo Admin.',
      },
    })
    .eq('actor_profile_id', actorId)
    .eq('status', 'active')

  return mapActor(data)
}


export async function unblockActorProfile(actorId, input = {}, { actorProfileId = null } = {}) {
  const actor = await getActorOrThrow(actorId)
  const now = nowIso()
  const nextStatus = actor.kyc_status === 'approved' ? 'approved' : 'draft'

  const { data, error } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: nextStatus,
      production_status: 'not_authorized',
      blocked_at: null,
      blocked_by_profile_id: null,
      notes: input.reason || actor.notes || null,
      updated_by_profile_id: actorProfileId,
      updated_at: now,
      metadata: {
        ...(actor.metadata || {}),
        unblockedAt: now,
        unblockedReason: input.reason || null,
      },
    })
    .eq('id', actorId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao reativar ator.', error)
  }

  return mapActor(data)
}

export async function generateActorOnboardingInvite(actorId, input = {}, { actorProfileId = null } = {}) {
  const actor = await getActorOrThrow(actorId)

  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este ator está bloqueado.')
  }

  await assertTableAvailable(INVITES_TABLE)

  const inviteToken = generateInviteToken()
  const now = nowIso()
  const payload = {
    actor_profile_id: actorId,
    email: normalizeEmail(input.email) || actor.email || null,
    invite_token_hash: hashInviteToken(inviteToken),
    status: 'pending',
    expires_at: addDaysIso(input.expiresInDays || 7),
    metadata: {
      ...(input.metadata || {}),
      source: 'admin_actor_invite',
    },
    created_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(INVITES_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao gerar convite do ator.', error)
  }

  await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: actor.status === 'draft' ? 'invited' : actor.status,
      updated_by_profile_id: actorProfileId,
      updated_at: now,
    })
    .eq('id', actorId)

  return {
    invite: mapInvite(data, { includeToken: inviteToken }),
    message: 'Convite criado. Guarde o token agora, pois ele não será exibido novamente.',
  }
}

export async function acceptActorOnboardingInvite(inviteToken, input = {}) {
  await assertTableAvailable(INVITES_TABLE)

  const tokenHash = hashInviteToken(inviteToken)
  const { data: invite, error } = await supabaseAdmin
    .from(INVITES_TABLE)
    .select('*')
    .eq('invite_token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar convite.', error)
  }

  if (!invite || invite.status !== 'pending') {
    throw new ApiError(404, 'Convite inválido ou já utilizado.')
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from(INVITES_TABLE)
      .update({ status: 'expired', updated_at: nowIso() })
      .eq('id', invite.id)

    throw new ApiError(410, 'Convite expirado.')
  }

  const actor = await getActorOrThrow(invite.actor_profile_id)
  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este ator está bloqueado.')
  }

  const now = nowIso()
  const actorPayload = {
    display_name: input.displayName || actor.display_name,
    legal_name: input.legalName || actor.legal_name || null,
    email: normalizeEmail(input.email) || actor.email || invite.email || null,
    phone: input.phone || actor.phone || null,
    status: 'onboarding',
    metadata: {
      ...(actor.metadata || {}),
      ...(input.metadata || {}),
      onboardingAcceptedAt: now,
    },
    updated_at: now,
  }

  const { data: updatedActor, error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update(actorPayload)
    .eq('id', actor.id)
    .select('*')
    .single()

  if (actorError) {
    throw new ApiError(500, 'Erro ao aceitar convite do ator.', actorError)
  }

  const { data: updatedInvite, error: inviteUpdateError } = await supabaseAdmin
    .from(INVITES_TABLE)
    .update({
      status: 'accepted',
      accepted_at: now,
      updated_at: now,
    })
    .eq('id', invite.id)
    .select('*')
    .single()

  if (inviteUpdateError) {
    throw new ApiError(500, 'Erro ao finalizar convite do ator.', inviteUpdateError)
  }

  return {
    actor: mapActor(updatedActor),
    invite: mapInvite(updatedInvite),
    message: 'Convite aceito com sucesso.',
  }
}


async function getActorInviteByToken(inviteToken, { allowPending = true } = {}) {
  await assertTableAvailable(INVITES_TABLE)

  const tokenHash = hashInviteToken(inviteToken)
  const { data: invite, error } = await supabaseAdmin
    .from(INVITES_TABLE)
    .select('*')
    .eq('invite_token_hash', tokenHash)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar convite.', error)
  }

  if (!invite) {
    throw new ApiError(404, 'Convite inválido.')
  }

  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    await supabaseAdmin
      .from(INVITES_TABLE)
      .update({ status: 'expired', updated_at: nowIso() })
      .eq('id', invite.id)

    throw new ApiError(410, 'Convite expirado.')
  }

  const allowedStatuses = allowPending ? ['pending', 'accepted'] : ['accepted']
  if (!allowedStatuses.includes(invite.status)) {
    throw new ApiError(409, 'Convite indisponível para onboarding.')
  }

  const actor = await getActorOrThrow(invite.actor_profile_id)
  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este cadastro está bloqueado. Fale com o suporte.')
  }

  return { invite, actor }
}

async function getLatestMappingCaseForActor(actorId) {
  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('*')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar mapeamento da pessoa participante.', error)
  }

  return data || null
}

function mapOnboardingPortal({ invite, actor, mappingCase = null, assets = [], mappingChecklist = null, requirements = [], identityDataset = null }) {
  return {
    invite: {
      id: invite.id,
      status: invite.status,
      email: invite.email || null,
      expiresAt: invite.expires_at || null,
      acceptedAt: invite.accepted_at || null,
    },
    actor: {
      id: actor.id,
      displayName: actor.display_name || 'Pessoa participante',
      email: actor.email || null,
      phone: actor.phone || null,
      status: actor.status || 'draft',
      mappingStatus: actor.kyc_status || 'not_started',
      productionStatus: actor.production_status || 'not_authorized',
    },
    requirements,
    mappingCase: mappingCase ? mapPublicKycCase(mappingCase, assets, mappingChecklist) : null,
    identityDataset,
    message: invite.status === 'pending'
      ? 'Convite aguardando aceite.'
      : 'Onboarding liberado para envio de materiais do mapeamento.',
  }
}

export async function getActorOnboardingPortal(inviteToken) {
  const { invite, actor } = await getActorInviteByToken(inviteToken, { allowPending: true })
  const mappingCase = await getLatestMappingCaseForActor(actor.id)
  const assets = mappingCase ? await listAssetsForCase(mappingCase.id) : []
  const requirements = await listActiveMappingRequirements()
  const mappingChecklist = buildDynamicMappingChecklist(requirements, assets, mappingCase || {})
  let identityDataset = null

  if (String(mappingCase?.status || '').toLowerCase() === 'approved') {
    try {
      identityDataset = mapPublicIdentityDatasetReadiness(await auditActorIdentityDatasetReadiness(actor.id))
    } catch {
      identityDataset = null
    }
  }

  return mapOnboardingPortal({ invite, actor, mappingCase, assets, mappingChecklist, requirements, identityDataset })
}

async function submitActorOnboardingMappingForReview({ invite, actor, mappingCase, assets = [] }) {
  if (mappingCase.actor_profile_id !== actor.id) {
    throw new ApiError(409, 'Integridade bloqueada: este mapeamento não pertence à pessoa vinculada ao convite.')
  }

  const checklist = await buildMappingChecklistFromAssets(assets, mappingCase)

  if (!checklist.isComplete) {
    throw new ApiError(409, 'Complete todos os materiais obrigatórios antes de enviar o mapeamento para análise do Admin.', {
      missingRequired: checklist.missingGroups || [],
      completedRequired: checklist.completedRequired || 0,
      totalRequired: checklist.totalRequired || 0,
    })
  }

  const now = nowIso()
  const metadata = asPlainObject(mappingCase.metadata)
  const previousSubmission = asPlainObject(metadata.actorSubmission)
  const previousAdminReview = asPlainObject(metadata.adminReview)
  const cycle = Math.max(0, Number(previousSubmission.cycle || metadata.reviewCycle || 0)) + 1
  const actorSubmission = {
    ...previousSubmission,
    status: 'sent_for_admin_review',
    sentForReviewAt: now,
    source: 'public_actor_onboarding_mapping_submit_m4_10',
    inviteId: invite.id,
    actorProfileId: actor.id,
    cycle,
    checklist: {
      completedRequired: checklist.completedRequired || 0,
      totalRequired: checklist.totalRequired || 0,
    },
  }
  const submissionHistory = appendReviewHistory(metadata.submissionHistory, {
    cycle,
    status: 'sent_for_admin_review',
    sentForReviewAt: now,
    inviteId: invite.id,
    actorProfileId: actor.id,
  })

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({
      status: 'pending_review',
      submitted_at: now,
      reviewed_at: null,
      reviewer_profile_id: null,
      rejection_reason: null,
      metadata: {
        ...metadata,
        actorSubmittedForReview: true,
        actorSubmission,
        submissionHistory,
        reviewCycle: cycle,
        adminReview: {
          ...previousAdminReview,
          status: 'awaiting_review',
          latestSubmittedAt: now,
          cycle,
        },
      },
      updated_at: now,
    })
    .eq('id', mappingCase.id)
    .eq('actor_profile_id', actor.id)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Erro ao enviar mapeamento para análise do Admin.', error)

  await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: actor.status === 'approved' ? 'approved' : 'kyc_pending',
      kyc_status: 'pending_review',
      updated_at: now,
    })
    .eq('id', actor.id)

  return {
    item: mapPublicKycCase(data, assets, checklist),
    message: cycle > 1 ? 'Ajustes enviados para uma nova análise do Admin.' : 'Mapeamento enviado para análise do Admin.',
  }
}

async function submitApprovedMappingSupplementForReview({ invite, actor, mappingCase, assets = [] }) {
  if (mappingCase.actor_profile_id !== actor.id) {
    throw new ApiError(409, 'Integridade bloqueada: o mapeamento complementar não pertence à pessoa vinculada ao convite.')
  }

  const pendingAssets = (assets || []).filter((asset) => String(asset.status || '').toLowerCase() === 'pending_review')
  if (pendingAssets.length === 0) {
    throw new ApiError(409, 'Adicione ao menos um novo material antes de enviar a complementação para análise.')
  }

  const metadata = asPlainObject(mappingCase.metadata)
  const previous = getIdentityDatasetSupplement(mappingCase)
  const now = nowIso()
  const cycle = Math.max(0, Number(previous.cycle || 0)) + 1
  const supplement = {
    ...previous,
    status: 'sent_for_admin_review',
    cycle,
    sentForReviewAt: now,
    completedAt: null,
    inviteId: invite.id,
    actorProfileId: actor.id,
    pendingAssetIds: pendingAssets.map((asset) => asset.id),
  }
  const supplementHistory = appendReviewHistory(metadata.identityDatasetSupplementHistory, {
    status: 'sent_for_admin_review',
    cycle,
    sentForReviewAt: now,
    pendingAssetCount: pendingAssets.length,
    actorProfileId: actor.id,
  })

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({
      metadata: {
        ...metadata,
        identityDatasetSupplement: supplement,
        identityDatasetSupplementHistory: supplementHistory,
      },
      updated_at: now,
    })
    .eq('id', mappingCase.id)
    .eq('actor_profile_id', actor.id)
    .eq('status', 'approved')
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Erro ao enviar materiais complementares para análise do Admin.', error)
  const checklist = await buildMappingChecklistFromAssets(assets, data)
  return {
    item: mapPublicKycCase(data, assets, checklist),
    message: 'Materiais complementares enviados para análise. O mapeamento já aprovado e todo o histórico foram preservados.',
  }
}

export async function createActorOnboardingMappingCase(inviteToken, input = {}) {
  const { invite, actor } = await getActorInviteByToken(inviteToken, { allowPending: false })
  let latestCase = await getLatestMappingCaseForActor(actor.id)

  if (input.submitForReview && !latestCase) {
    throw new ApiError(409, 'Abra o mapeamento antes de enviar para análise do Admin.')
  }

  if (latestCase) {
    if (latestCase.actor_profile_id !== actor.id) {
      throw new ApiError(409, 'Integridade bloqueada: o mapeamento encontrado não pertence à pessoa vinculada ao convite.')
    }

    if (latestCase.status === 'rejected') {
      const metadata = asPlainObject(latestCase.metadata)
      const { data, error } = await supabaseAdmin
        .from(KYC_CASES_TABLE)
        .update({
          status: 'pending_review',
          metadata: {
            ...metadata,
            actorSubmittedForReview: false,
            actorSubmission: {
              ...asPlainObject(metadata.actorSubmission),
              status: 'changes_requested',
            },
            adminReview: {
              ...asPlainObject(metadata.adminReview),
              status: 'changes_requested',
              reason: latestCase.rejection_reason || asPlainObject(metadata.adminReview).reason || null,
            },
          },
          updated_at: nowIso(),
        })
        .eq('id', latestCase.id)
        .eq('actor_profile_id', actor.id)
        .select('*')
        .single()
      if (error) throw new ApiError(500, 'Erro ao reabrir o mapeamento para ajustes.', error)
      latestCase = data
    }

    const assets = await listAssetsForCase(latestCase.id)

    if (input.submitForReview && latestCase.status === 'approved') {
      return submitApprovedMappingSupplementForReview({ invite, actor, mappingCase: latestCase, assets })
    }
    if (input.submitForReview) {
      return submitActorOnboardingMappingForReview({ invite, actor, mappingCase: latestCase, assets })
    }

    const checklist = await buildMappingChecklistFromAssets(assets, latestCase)
    const reviewState = getMappingCaseReviewState(latestCase)
    return {
      item: mapPublicKycCase(latestCase, assets, checklist),
      message: latestCase.status === 'approved'
        ? 'Mapeamento aprovado. Você pode complementar os materiais de identidade para vídeos sem apagar o histórico.'
        : reviewState === 'changes_requested' || reviewState === 'changes_in_progress'
          ? 'Ajustes liberados. O histórico e as decisões anteriores foram preservados.'
          : reviewState === 'sent_for_review'
            ? 'Mapeamento em análise. Os materiais permanecem preservados.'
            : 'Mapeamento já aberto. Continue enviando os materiais solicitados.',
    }
  }

  const created = await createActorKycCase(actor.id, {
    caseType: 'avatar_mapping',
    notes: input.notes || 'Mapeamento aberto pelo link público da pessoa participante.',
    metadata: {
      ...(input.metadata || {}),
      source: 'public_actor_onboarding_mapping',
      inviteId: invite.id,
    },
  }, { actorProfileId: null })

  const rawCase = await getKycCaseOrThrow(created.id)
  const checklist = await buildMappingChecklistFromAssets([], rawCase)
  return {
    item: mapPublicKycCase(rawCase, [], checklist),
    message: 'Mapeamento aberto. Envie os materiais solicitados abaixo.',
  }
}

export async function registerActorOnboardingMappingAsset(inviteToken, input = {}) {
  const { invite, actor } = await getActorInviteByToken(inviteToken, { allowPending: false })
  let mappingCase = await getLatestMappingCaseForActor(actor.id)

  if (!mappingCase) {
    const created = await createActorOnboardingMappingCase(inviteToken, {
      notes: 'Mapeamento aberto automaticamente no primeiro envio de material.',
      metadata: { source: 'public_actor_onboarding_auto_mapping' },
    })
    mappingCase = await getKycCaseOrThrow(created.item.id)
  }

  if (mappingCase.actor_profile_id !== actor.id) {
    throw new ApiError(409, 'Integridade bloqueada: este mapeamento não pertence à pessoa vinculada ao convite.')
  }

  const replacementAssetId = normalizeText(input.replacementAssetId)
  let replacementAssetRow = null
  let replacementAsset = null

  if (replacementAssetId) {
    if (input.dryRunOnly) {
      throw new ApiError(409, 'A substituição de material exige um arquivo real.')
    }

    replacementAssetRow = await getKycAssetRowOrThrow(replacementAssetId)
    replacementAsset = mapKycAsset(replacementAssetRow)
    assertKycAssetReviewable(replacementAsset)

    if (String(replacementAsset.status || '').toLowerCase() !== 'rejected') {
      throw new ApiError(409, 'Somente um material devolvido para ajuste pode ser substituído por este fluxo.')
    }
    if (replacementAsset.actorProfileId !== actor.id || replacementAsset.kycCaseId !== mappingCase.id) {
      throw new ApiError(409, 'Integridade bloqueada: o material a substituir não pertence a esta pessoa e a este mapeamento.')
    }
    if (replacementAsset.mappingRequirementId !== input.mappingRequirementId) {
      throw new ApiError(409, 'Integridade bloqueada: a substituição deve permanecer na mesma categoria solicitada pelo Admin.')
    }

    const replacementBuffer = decodeBase64Asset(input.base64)
    const replacementChecksum = createHash('sha256').update(replacementBuffer).digest('hex')
    if (replacementAsset.checksumSha256 && replacementChecksum === replacementAsset.checksumSha256) {
      throw new ApiError(409, 'Selecione um arquivo diferente do material devolvido para ajuste.')
    }
  }

  if (mappingCaseLockedForAdminReview(mappingCase) && !replacementAsset) {
    throw new ApiError(409, 'Este mapeamento está em análise pelo Admin e não pode receber novos materiais neste momento.')
  }

  if (mappingCase.status === 'approved' && !replacementAsset) {
    const metadata = asPlainObject(mappingCase.metadata)
    const previous = getIdentityDatasetSupplement(mappingCase)
    const { data, error } = await supabaseAdmin
      .from(KYC_CASES_TABLE)
      .update({
        metadata: {
          ...metadata,
          identityDatasetSupplement: {
            ...previous,
            status: 'changes_in_progress',
            startedAt: previous.startedAt || nowIso(),
            completedAt: null,
            actorProfileId: actor.id,
          },
        },
        updated_at: nowIso(),
      })
      .eq('id', mappingCase.id)
      .eq('actor_profile_id', actor.id)
      .eq('status', 'approved')
      .select('*')
      .single()
    if (error) throw new ApiError(500, 'Erro ao abrir a complementação do conjunto de identidade.', error)
    mappingCase = data
  }

  if (mappingCaseLockedForAdminReview(mappingCase) && !replacementAsset) {
    throw new ApiError(409, 'Este mapeamento está em análise pelo Admin e não pode receber novos materiais neste momento.')
  }

  const reviewState = getMappingCaseReviewState(mappingCase)
  if (mappingCase.status === 'rejected' || reviewState === 'changes_requested') {
    const metadata = asPlainObject(mappingCase.metadata)
    const { data, error } = await supabaseAdmin
      .from(KYC_CASES_TABLE)
      .update({
        status: 'pending_review',
        metadata: {
          ...metadata,
          actorSubmittedForReview: false,
          actorSubmission: {
            ...asPlainObject(metadata.actorSubmission),
            status: 'changes_in_progress',
            changesStartedAt: nowIso(),
          },
          adminReview: {
            ...asPlainObject(metadata.adminReview),
            status: 'changes_requested',
          },
        },
        updated_at: nowIso(),
      })
      .eq('id', mappingCase.id)
      .eq('actor_profile_id', actor.id)
      .select('*')
      .single()
    if (error) throw new ApiError(500, 'Erro ao liberar o mapeamento para correções.', error)
    mappingCase = data
  }

  const requestedCompletionTaskId = normalizeText(asPlainObject(input.metadata).identityCompletionTaskId)
  if (requestedCompletionTaskId && mappingCase.status === 'approved' && !replacementAsset) {
    const readiness = await auditActorIdentityDatasetReadiness(actor.id)
    const completionTasks = Array.isArray(readiness?.completionPlan?.tasks) ? readiness.completionPlan.tasks : []
    const completionTask = completionTasks.find((task) => normalizeText(task.id) === requestedCompletionTaskId) || null
    if (!completionTask) {
      throw new ApiError(409, 'Esta solicitação de material já foi atendida ou não está mais disponível. Atualize a página antes de enviar.')
    }
    if (normalizeText(completionTask.requirementId) !== normalizeText(input.mappingRequirementId)) {
      throw new ApiError(409, 'Integridade bloqueada: o item selecionado não pertence à categoria de envio informada.')
    }
  }

  const replacementMetadata = replacementAsset
    ? {
        replacement: {
          replacesAssetId: replacementAsset.id,
          actorProfileId: actor.id,
          kycCaseId: mappingCase.id,
          mappingRequirementId: input.mappingRequirementId,
          requestedReason: replacementAsset.rejectionReason || null,
          submittedAt: nowIso(),
          source: 'actor_replacement_upload',
        },
        sourceAssetId: replacementAsset.id,
        sourceActorProfileId: actor.id,
        sourceKycCaseId: mappingCase.id,
        sourceMappingRequirementId: input.mappingRequirementId,
        lineage: {
          kind: 'actor_replacement_upload',
          parentAssetId: replacementAsset.id,
          rootAssetId: asPlainObject(replacementAssetRow?.metadata).lineage?.rootAssetId || replacementAsset.id,
        },
      }
    : {}

  const result = await registerActorKycAsset(mappingCase.id, {
    ...input,
    metadata: {
      ...(input.metadata || {}),
      ...replacementMetadata,
      source: replacementAsset ? 'public_actor_onboarding_replacement_upload' : 'public_actor_onboarding_upload',
      inviteId: invite.id,
      actorVisibleUpload: true,
    },
  }, { actorProfileId: null })

  if (replacementAsset && result.duplicate) {
    throw new ApiError(409, 'Este arquivo já existe nesta categoria. Selecione uma nova versão para concluir a substituição.')
  }

  if (replacementAsset && !result.duplicate) {
    const now = nowIso()
    const oldMetadata = asPlainObject(replacementAssetRow.metadata)
    const { error: archiveError } = await supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .update({
        status: 'archived',
        metadata: {
          ...oldMetadata,
          replacement: {
            ...asPlainObject(oldMetadata.replacement),
            status: 'superseded_by_actor_upload',
            replacedByAssetId: result.item.id,
            replacedAt: now,
            actorProfileId: actor.id,
            kycCaseId: mappingCase.id,
            mappingRequirementId: input.mappingRequirementId,
          },
          archivedReason: 'replaced_after_admin_request',
          archivedAt: now,
        },
        updated_at: now,
      })
      .eq('id', replacementAsset.id)
      .eq('actor_profile_id', actor.id)
      .eq('kyc_case_id', mappingCase.id)
      .eq('mapping_requirement_id', input.mappingRequirementId)
      .eq('status', 'rejected')

    if (archiveError) {
      await supabaseAdmin
        .from(KYC_ASSETS_TABLE)
        .update({
          status: 'archived',
          metadata: {
            ...(result.item.metadata || {}),
            replacementRollback: {
              status: 'archived_after_source_archive_failure',
              sourceAssetId: replacementAsset.id,
              occurredAt: now,
            },
          },
          updated_at: now,
        })
        .eq('id', result.item.id)
        .eq('actor_profile_id', actor.id)
        .eq('kyc_case_id', mappingCase.id)

      throw new ApiError(500, 'O novo arquivo foi recebido, mas a substituição não pôde ser concluída com segurança. Nenhum material foi liberado para o dataset.', archiveError)
    }
  }

  const rawAsset = {
    id: result.item.id,
    kyc_case_id: result.item.kycCaseId,
    actor_profile_id: result.item.actorProfileId,
    mapping_requirement_id: result.item.mappingRequirementId,
    asset_type: result.item.assetType,
    original_filename: result.item.originalFilename,
    content_type: result.item.contentType,
    byte_size: result.item.byteSize,
    status: result.item.status,
    rejection_reason: result.item.rejectionReason,
    reviewed_at: result.item.reviewedAt,
    created_at: result.item.createdAt,
    updated_at: result.item.updatedAt,
  }

  return {
    item: mapPublicKycAsset(rawAsset),
    duplicate: Boolean(result.duplicate),
    message: replacementAsset && !result.duplicate
      ? 'Novo material recebido. O arquivo devolvido saiu do conjunto ativo e foi preservado somente no histórico de auditoria.'
      : result.message || 'Material recebido e guardado no cofre privado. Nenhuma URL pública foi gerada.',
  }
}

export async function createActorKycCase(actorId, input = {}, { actorProfileId = null } = {}) {
  const actor = await getActorOrThrow(actorId)

  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este ator está bloqueado.')
  }

  await assertTableAvailable(KYC_CASES_TABLE)

  const now = nowIso()
  const payload = {
    actor_profile_id: actorId,
    case_type: input.caseType || 'avatar_mapping',
    status: 'draft',
    submitted_at: null,
    notes: input.notes || null,
    metadata: {
      ...(input.metadata || {}),
      source: input.metadata?.source || 'admin_actor_mapping',
    },
    created_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao criar mapeamento.', error)
  }

  await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: actor.status === 'approved' ? actor.status : 'onboarding',
      kyc_status: 'pending_review',
      updated_by_profile_id: actorProfileId,
      updated_at: now,
    })
    .eq('id', actorId)

  return mapKycCase(data, [])
}

export async function listActorKycCases(actorId) {
  await getActorOrThrow(actorId)

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .select('*')
    .eq('actor_profile_id', actorId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(500, 'Erro ao listar mapeamentos do ator.', error)
  }

  return {
    items: (data || []).map((row) => mapKycCase(row)),
  }
}

export async function getActorKycCase(kycCaseId) {
  const kycCase = await getKycCaseOrThrow(kycCaseId)
  const assets = await listAssetsForCase(kycCaseId)

  const mappingChecklist = await buildMappingChecklistFromAssets(assets, kycCase)
  return mapKycCase(kycCase, assets, { mappingChecklist })
}

export async function getActorMappingChecklist(kycCaseId) {
  const kycCase = await getKycCaseOrThrow(kycCaseId)
  const assets = await listAssetsForCase(kycCaseId)

  return await buildMappingChecklistFromAssets(assets, kycCase)
}


async function getKycAssetRowOrThrow(assetId) {
  assertUuidLike(assetId, 'Material de mapeamento')
  await assertTableAvailable(KYC_ASSETS_TABLE)

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('*')
    .eq('id', assetId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar material do mapeamento.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Material de mapeamento não encontrado.')
  }

  return data
}

export async function auditActorMappingVaultAsset(assetId, { checkR2 = false } = {}) {
  const assetRow = await getKycAssetRowOrThrow(assetId)
  const asset = mapKycAsset(assetRow)
  const kycCase = await getKycCaseOrThrow(asset.kycCaseId)
  const actor = await getActorOrThrow(asset.actorProfileId)
  const publicPayload = mapPublicKycAsset(assetRow)

  let r2Head = null
  const shouldCheckR2 = Boolean(checkR2)

  if (shouldCheckR2) {
    if (isDryRunMappingAsset(asset)) {
      throw new ApiError(409, 'Material de simulação não pode ser auditado no R2 real.')
    }

    r2Head = await headKycVaultObject({
      bucket: asset.bucket,
      key: asset.key,
    })
  }

  return buildActorMappingVaultAudit({
    asset,
    kycCase,
    actor,
    r2Head,
    r2Checked: shouldCheckR2,
    publicPayload,
  })
}


export async function getActorMappingVaultAssetStream(assetId, { download = false } = {}) {
  const assetRow = await getKycAssetRowOrThrow(assetId)
  const asset = mapKycAsset(assetRow)
  await getKycCaseOrThrow(asset.kycCaseId)
  await getActorOrThrow(asset.actorProfileId)

  assertAssetIsPrivateMappingVault(asset)

  const object = await getKycVaultObject({
    bucket: asset.bucket,
    key: asset.key,
  })

  return {
    bodyStream: object.bodyStream,
    contentType: object.contentType || asset.contentType || 'application/octet-stream',
    contentLength: object.contentLength ?? asset.byteSize ?? null,
    filename: buildSafeVaultFilename(asset),
    disposition: download ? 'attachment' : 'inline',
    publicAccess: false,
    asset: {
      id: asset.id,
      assetType: asset.assetType || null,
      status: asset.status || null,
      contentType: asset.contentType || object.contentType || null,
      byteSize: asset.byteSize ?? object.contentLength ?? null,
    },
  }
}


function assertKycAssetReviewable(asset = {}) {
  if (isDryRunMappingAsset(asset)) {
    throw new ApiError(409, 'Material de simulação não pode receber decisão nominal de aprovação.')
  }

  const status = String(asset.status || '').toLowerCase()
  if (['archived', 'quarantined', 'deleted'].includes(status)) {
    throw new ApiError(409, 'Este material não está disponível para revisão.')
  }

  assertAssetIsPrivateMappingVault(asset)
}

async function updateActorKycAssetReview(assetId, { decision, reason = null, note = null } = {}, { actorProfileId = null } = {}) {
  const assetRow = await getKycAssetRowOrThrow(assetId)
  const asset = mapKycAsset(assetRow)
  assertKycAssetReviewable(asset)
  const kycCase = await getKycCaseOrThrow(asset.kycCaseId)

  if (asset.actorProfileId !== kycCase.actor_profile_id) {
    throw new ApiError(409, 'Integridade bloqueada: o material pertence a uma pessoa diferente do titular do mapeamento.')
  }
  const supplementalApprovedCaseReview = approvedCaseAcceptsSupplementalReview(kycCase, asset)
  if (!mappingCaseLockedForAdminReview(kycCase) && !supplementalApprovedCaseReview) {
    throw new ApiError(409, 'A análise individual só pode começar depois que este ciclo for enviado formalmente para o Admin.')
  }
  if (String(asset.status || '').toLowerCase() !== 'pending_review') {
    throw new ApiError(409, 'A decisão deste material já foi registrada e não será sobrescrita. Abra um novo ciclo de ajuste quando necessário.')
  }

  const now = nowIso()
  const status = decision === 'approved' ? 'approved' : 'rejected'
  const reviewReason = status === 'rejected' ? normalizeText(reason) : null

  if (status === 'rejected' && !reviewReason) {
    throw new ApiError(422, 'Informe o motivo da rejeição do material.')
  }

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .update({
      status,
      rejection_reason: reviewReason,
      reviewed_at: now,
      reviewer_profile_id: actorProfileId,
      metadata: {
        ...(assetRow.metadata || {}),
        adminReview: {
          decision: status,
          reason: reviewReason,
          note: normalizeText(note) || null,
          reviewedAt: now,
          reviewerProfileId: actorProfileId,
          source: 'admin_mapping_inspection_desk',
        },
      },
      updated_at: now,
    })
    .eq('id', assetId)
    .eq('kyc_case_id', kycCase.id)
    .eq('actor_profile_id', kycCase.actor_profile_id)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, status === 'approved' ? 'Erro ao aprovar material de mapeamento.' : 'Erro ao rejeitar material de mapeamento.', error)
  }

  const caseMetadata = asPlainObject(kycCase.metadata)
  const currentAdminReview = asPlainObject(caseMetadata.adminReview)
  const currentSupplement = getIdentityDatasetSupplement(kycCase)
  const { count: pendingReviewCount, error: pendingCountError } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('id', { count: 'exact', head: true })
    .eq('actor_profile_id', asset.actorProfileId)
    .eq('kyc_case_id', kycCase.id)
    .eq('status', 'pending_review')
  if (pendingCountError) throw new ApiError(500, 'A decisão foi registrada, mas as pendências não puderam ser conferidas.', pendingCountError)

  const supplementalCase = String(kycCase.status || '').toLowerCase() === 'approved'
  const supplementalStatus = Number(pendingReviewCount || 0) === 0 ? 'completed' : 'in_progress'
  const nextMetadata = supplementalCase
    ? {
        ...caseMetadata,
        identityDatasetSupplement: {
          ...currentSupplement,
          status: supplementalStatus,
          startedAt: currentSupplement.startedAt || now,
          lastItemReviewedAt: now,
          reviewerProfileId: actorProfileId,
          pendingReviewAssets: Number(pendingReviewCount || 0),
          completedAt: supplementalStatus === 'completed' ? now : null,
        },
      }
    : {
        ...caseMetadata,
        adminReview: {
          ...currentAdminReview,
          status: 'in_progress',
          startedAt: currentAdminReview.startedAt || now,
          lastItemReviewedAt: now,
          reviewerProfileId: actorProfileId,
        },
      }

  const { error: caseReviewError } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({ metadata: nextMetadata, updated_at: now })
    .eq('id', kycCase.id)
    .eq('actor_profile_id', asset.actorProfileId)

  if (caseReviewError) throw new ApiError(500, 'A decisão foi registrada, mas o progresso da análise não pôde ser atualizado.', caseReviewError)

  return {
    item: mapKycAsset(data),
    message: status === 'approved'
      ? 'Material aprovado na mesa de inspeção.'
      : 'Material rejeitado e devolvido com motivo para correção.',
  }
}


export async function reclassifyActorKycAsset(assetId, input = {}, { actorProfileId = null } = {}) {
  if (!actorProfileId) {
    throw new ApiError(403, 'Somente uma pessoa administradora autenticada pode classificar materiais do mapeamento.')
  }

  const assetRow = await getKycAssetRowOrThrow(assetId)
  const asset = mapKycAsset(assetRow)
  assertKycAssetReviewable(asset)

  if (String(asset.status || '').toLowerCase() !== 'pending_review') {
    throw new ApiError(409, 'Somente materiais aguardando análise podem ter a categoria corrigida.')
  }

  const kycCase = await getKycCaseOrThrow(asset.kycCaseId)
  if (asset.actorProfileId !== kycCase.actor_profile_id) {
    throw new ApiError(409, 'Integridade bloqueada: o material pertence a uma pessoa diferente do titular do mapeamento.')
  }

  const requirement = await getMappingRequirementOrThrow(input.mappingRequirementId, { activeOnly: true })
  const contentType = String(asset.contentType || 'application/octet-stream').trim().toLowerCase().split(';')[0]
  if (!isMimeTypeAllowedForRequirement(requirement, contentType)) {
    throw new ApiError(422, `O arquivo não é compatível com a categoria ${requirement.title}.`)
  }

  if (asset.mappingRequirementId === requirement.id) {
    return {
      item: asset,
      message: 'O material já está classificado nesta categoria.',
    }
  }

  const now = nowIso()
  const metadata = asPlainObject(assetRow.metadata)
  const history = Array.isArray(metadata.reclassificationHistory) ? metadata.reclassificationHistory : []
  const event = {
    previousMappingRequirementId: asset.mappingRequirementId || null,
    mappingRequirementId: requirement.id,
    mappingRequirementTitle: requirement.title,
    actorProfileId: asset.actorProfileId,
    kycCaseId: asset.kycCaseId,
    assetId: asset.id,
    note: normalizeText(input.note) || null,
    changedAt: now,
    changedByProfileId: actorProfileId,
    source: 'admin_mapping_asset_classification',
  }

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .update({
      mapping_requirement_id: requirement.id,
      metadata: {
        ...metadata,
        mappingRequirement: {
          id: requirement.id,
          title: requirement.title,
          mediaType: requirement.mediaType,
          isRequired: requirement.isRequired,
          systemTag: requirement.systemTag || null,
        },
        reclassification: event,
        reclassificationHistory: [...history, event].slice(-50),
      },
      updated_at: now,
    })
    .eq('id', asset.id)
    .eq('actor_profile_id', asset.actorProfileId)
    .eq('kyc_case_id', asset.kycCaseId)
    .eq('status', 'pending_review')
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Erro ao classificar o material do mapeamento.', error)

  return {
    item: mapKycAsset(data),
    message: `Material classificado como ${requirement.title}. Agora ele pode receber uma decisão.`,
  }
}

export async function approveActorKycAsset(assetId, input = {}, context = {}) {
  return updateActorKycAssetReview(assetId, {
    decision: 'approved',
    note: input.note || null,
  }, context)
}

export async function rejectActorKycAsset(assetId, input = {}, context = {}) {
  return updateActorKycAssetReview(assetId, {
    decision: 'rejected',
    reason: input.reason,
  }, context)
}

export async function createActorKycAssetEditedCopy(assetId, input = {}, { actorProfileId = null } = {}) {
  if (!actorProfileId) {
    throw new ApiError(403, 'Somente uma pessoa administradora autenticada pode criar uma cópia ajustada.')
  }

  const sourceRow = await getKycAssetRowOrThrow(assetId)
  const sourceAsset = mapKycAsset(sourceRow)
  assertKycAssetReviewable(sourceAsset)

  if (String(sourceAsset.status || '').toLowerCase() !== 'pending_review') {
    throw new ApiError(409, 'Somente materiais aguardando análise podem gerar uma cópia ajustada.')
  }

  const sourceContentType = String(sourceAsset.contentType || '').toLowerCase()
  if (!sourceContentType.startsWith('image/')) {
    throw new ApiError(422, 'O editor seguro aceita apenas imagens.')
  }

  const kycCase = await getKycCaseOrThrow(sourceAsset.kycCaseId)
  if (sourceAsset.actorProfileId !== kycCase.actor_profile_id) {
    throw new ApiError(409, 'Integridade bloqueada: o material pertence a uma pessoa diferente do titular do mapeamento.')
  }
  if (!sourceAsset.mappingRequirementId) {
    throw new ApiError(409, 'Integridade bloqueada: o material não possui requisito de mapeamento vinculado.')
  }
  const supplementalApprovedCaseReview = approvedCaseAcceptsSupplementalReview(kycCase, sourceAsset)
  if (!mappingCaseLockedForAdminReview(kycCase) && !supplementalApprovedCaseReview) {
    throw new ApiError(409, 'Ajustes administrativos só podem ser feitos depois do envio formal para análise.')
  }

  const requirement = await getMappingRequirementOrThrow(sourceAsset.mappingRequirementId)
  if (requirement.mediaType !== 'image') {
    throw new ApiError(422, 'O requisito vinculado não aceita edição de imagem.')
  }

  const editedBuffer = decodeBase64Asset(input.base64)
  if (!editedBuffer.length) {
    throw new ApiError(400, 'A cópia ajustada está vazia ou inválida.')
  }
  if (editedBuffer.length > 12 * 1024 * 1024) {
    throw new ApiError(413, 'A cópia ajustada deve ter no máximo 12 MB.')
  }
  if (Number(input.byteSize || 0) !== editedBuffer.length) {
    throw new ApiError(422, 'O tamanho informado não corresponde aos bytes recebidos.')
  }

  const contentType = String(input.contentType || 'image/jpeg').toLowerCase()
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
    throw new ApiError(422, 'Formato de imagem ajustada não permitido.')
  }
  if (!isMimeTypeAllowedForRequirement(requirement, contentType)) {
    throw new ApiError(422, `Formato não permitido para ${requirement.title}.`)
  }

  const checksumSha256 = createHash('sha256').update(editedBuffer).digest('hex')
  const { data: duplicateAsset, error: duplicateError } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('*')
    .eq('actor_profile_id', sourceAsset.actorProfileId)
    .eq('kyc_case_id', sourceAsset.kycCaseId)
    .eq('mapping_requirement_id', sourceAsset.mappingRequirementId)
    .eq('checksum_sha256', checksumSha256)
    .neq('status', 'deleted')
    .neq('status', 'quarantined')
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (duplicateError) {
    throw new ApiError(500, 'Erro ao verificar cópia ajustada duplicada.', duplicateError)
  }
  if (duplicateAsset) {
    return {
      item: mapKycAsset(duplicateAsset),
      sourceAssetId: sourceAsset.id,
      duplicate: true,
      originalPreserved: true,
      message: 'Esta mesma cópia ajustada já estava registrada neste mapeamento.',
    }
  }

  const now = nowIso()
  const transform = asPlainObject(input.transform)
  const vaultResult = await uploadKycAssetToVault({
    buffer: editedBuffer,
    actorProfileId: sourceAsset.actorProfileId,
    kycCaseId: sourceAsset.kycCaseId,
    assetType: `mapping_requirement_${requirement.id}_admin_edited_copy`,
    contentType,
    metadata: {
      original_filename: input.originalFilename || 'copia-ajustada.jpg',
      created_by_profile_id: actorProfileId,
      vault_kind: 'actor_avatar_mapping_admin_edited_copy',
      mapping_requirement_id: requirement.id,
      source_asset_id: sourceAsset.id,
      ai_generative_edit: 'false',
    },
    dryRunOnly: false,
  })

  const metadata = {
    sourceAssetId: sourceAsset.id,
    sourceActorProfileId: sourceAsset.actorProfileId,
    sourceKycCaseId: sourceAsset.kycCaseId,
    sourceMappingRequirementId: sourceAsset.mappingRequirementId,
    sourceChecksumSha256: sourceAsset.checksumSha256 || null,
    originalPreserved: true,
    privateVaultOnly: true,
    mappingPurpose: 'avatar_reference_material',
    mappingRequirement: {
      id: requirement.id,
      title: requirement.title,
      mediaType: requirement.mediaType,
      isRequired: requirement.isRequired,
      systemTag: requirement.systemTag || null,
    },
    adminSafeImageEditor: {
      schemaVersion: 'privacy-admin-safe-image-editor-v1',
      createdAt: now,
      createdByProfileId: actorProfileId,
      note: normalizeText(input.note) || null,
      transformations: transform,
      aiGenerativeEdit: false,
      destructiveEdit: false,
    },
    lineage: {
      kind: 'admin_non_destructive_edited_copy',
      parentAssetId: sourceAsset.id,
    },
    vault: {
      dryRun: false,
      metadata: vaultResult.metadata || {},
    },
  }

  const payload = {
    kyc_case_id: sourceAsset.kycCaseId,
    actor_profile_id: sourceAsset.actorProfileId,
    mapping_requirement_id: sourceAsset.mappingRequirementId,
    asset_type: null,
    r2_bucket: vaultResult.bucket,
    r2_key: vaultResult.key,
    original_filename: input.originalFilename || `copia-ajustada-${sourceAsset.id.slice(0, 8)}.jpg`,
    content_type: vaultResult.contentType || contentType,
    byte_size: editedBuffer.length,
    checksum_sha256: checksumSha256,
    status: 'pending_review',
    rejection_reason: null,
    reviewed_at: null,
    reviewer_profile_id: null,
    metadata,
    created_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao registrar a cópia ajustada no cofre privado.', error)
  }

  return {
    item: mapKycAsset(data),
    sourceAssetId: sourceAsset.id,
    duplicate: false,
    originalPreserved: true,
    autoApproved: false,
    message: 'Cópia ajustada criada para nova análise. O arquivo original foi preservado.',
  }
}


export async function listActorMappingVaultTestArtifacts({ checkR2 = false, includeQuarantined = false, limit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit || 100), 1), 500)
  await assertTableAvailable(KYC_ASSETS_TABLE)

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .select('*')
    .ilike('r2_key', 'vault/actor-mapping/%')
    .order('created_at', { ascending: false })
    .limit(safeLimit)

  if (error) {
    throw new ApiError(500, 'Erro ao auditar artefatos de teste do cofre.', error)
  }

  const mapped = (data || [])
    .map(mapKycAsset)
    .filter(isActorMappingTestArtifact)
    .filter((asset) => includeQuarantined || !isQuarantinedMappingAsset(asset))

  const artifacts = []
  for (const asset of mapped) {
    let r2Head = null
    let r2Checked = false

    if (checkR2 && !isDryRunMappingAsset(asset) && asset.bucket && asset.key) {
      r2Checked = true
      r2Head = await headKycVaultObject({ bucket: asset.bucket, key: asset.key })
    }

    artifacts.push(mapMappingTestArtifactForAdmin(asset, { r2Head, r2Checked }))
  }

  const summary = artifacts.reduce((acc, artifact) => {
    acc.total += 1
    if (artifact.dryRun) acc.dryRun += 1
    if (artifact.realR2Candidate) acc.realR2Candidates += 1
    if (artifact.quarantined) acc.quarantined += 1
    if (artifact.r2Checked) acc.r2Checked += 1
    if (artifact.r2ObjectExists === true) acc.r2ObjectExists += 1
    return acc
  }, {
    total: 0,
    dryRun: 0,
    realR2Candidates: 0,
    quarantined: 0,
    r2Checked: 0,
    r2ObjectExists: 0,
    destructiveDelete: false,
    publicAccess: false,
  })

  return {
    status: 'ok',
    checkR2: Boolean(checkR2),
    includeQuarantined: Boolean(includeQuarantined),
    limit: safeLimit,
    summary,
    artifacts,
    message: artifacts.length > 0
      ? 'Artefatos de teste do cofre listados para auditoria. Nenhum delete foi executado.'
      : 'Nenhum artefato de teste do cofre foi encontrado neste limite de busca.',
  }
}

export async function quarantineActorMappingVaultTestArtifacts(input = {}, { actorProfileId = null } = {}) {
  const dryRunOnly = input.dryRunOnly !== false
  const copyR2 = Boolean(input.copyR2)
  const reason = normalizeText(input.reason || 'Quarentena controlada de artefatos de teste do mapeamento.')
  const assetIds = Array.isArray(input.assetIds) ? input.assetIds.filter(Boolean) : []

  if (!dryRunOnly) {
    if (process.env.ALLOW_MAPPING_TEST_QUARANTINE !== 'true') {
      throw new ApiError(409, 'Quarentena real bloqueada. Defina ALLOW_MAPPING_TEST_QUARANTINE=true para executar.')
    }

    if (input.confirmationPhrase !== MAPPING_TEST_QUARANTINE_CONFIRMATION) {
      throw new ApiError(409, `Confirmação inválida. Use exatamente: ${MAPPING_TEST_QUARANTINE_CONFIRMATION}`)
    }
  }

  let rows = []
  if (assetIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('*')
      .in('id', assetIds)

    if (error) {
      throw new ApiError(500, 'Erro ao buscar materiais para quarentena.', error)
    }
    rows = data || []
  } else {
    const audit = await listActorMappingVaultTestArtifacts({
      checkR2: false,
      includeQuarantined: false,
      limit: Math.min(Math.max(Number(input.limit || 50), 1), 100),
    })
    rows = audit.artifacts.map((artifact) => ({
      id: artifact.id,
      kyc_case_id: artifact.kycCaseId,
      actor_profile_id: artifact.actorProfileId,
      asset_type: artifact.assetType,
      r2_bucket: artifact.bucket,
      r2_key: artifact.key,
      original_filename: artifact.originalFilename,
      content_type: artifact.contentType,
      byte_size: artifact.byteSize,
      status: artifact.status,
      metadata: { source: artifact.source },
      created_at: artifact.createdAt,
      updated_at: artifact.updatedAt,
    }))
  }

  const planned = []
  const executed = []
  const skipped = []

  for (const row of rows) {
    const asset = mapKycAsset(row)

    try {
      assertMappingTestArtifact(asset)
    } catch (error) {
      skipped.push({ id: asset.id, reason: error.message })
      continue
    }

    if (isQuarantinedMappingAsset(asset)) {
      skipped.push({ id: asset.id, reason: 'Material já está em quarentena.' })
      continue
    }

    const dryRun = isDryRunMappingAsset(asset)
    const quarantineKey = !dryRun && asset.key ? buildMappingTestQuarantineKey(asset.key) : null
    const plan = {
      id: asset.id,
      bucket: asset.bucket || null,
      key: asset.key || null,
      status: asset.status || null,
      dryRun,
      copyR2Planned: Boolean(copyR2 && !dryRun && asset.bucket && asset.key),
      quarantineKey,
      deletePlanned: false,
      reason,
    }

    planned.push(plan)

    if (dryRunOnly) continue

    let copiedTo = null
    if (plan.copyR2Planned) {
      copiedTo = await copyObject(asset.bucket, asset.key, asset.bucket, quarantineKey, {
        contentType: asset.contentType || undefined,
        metadata: {
          privacy: 'private',
          scope: 'actor_mapping_test_quarantine',
          source: MAPPING_TEST_QUARANTINE_SOURCE,
          original_key: asset.key,
          asset_id: asset.id,
        },
      })
    }

    const metadata = asset.metadata || {}
    const quarantineMetadata = {
      ...(metadata || {}),
      quarantine: {
        status: 'quarantined',
        source: MAPPING_TEST_QUARANTINE_SOURCE,
        at: nowIso(),
        reason,
        requestedByProfileId: actorProfileId || null,
        originalStatus: asset.status || null,
        originalKey: asset.key || null,
        copiedToKey: copiedTo?.destKey || null,
        copiedToBucket: copiedTo?.destBucket || null,
        deleteExecuted: false,
      },
    }

    const { error } = await supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .update({
        status: 'archived',
        metadata: quarantineMetadata,
        updated_at: nowIso(),
      })
      .eq('id', asset.id)

    if (error) {
      throw new ApiError(500, 'Erro ao registrar quarentena lógica do material de teste.', error)
    }

    executed.push({
      id: asset.id,
      status: 'archived',
      quarantineStatus: 'quarantined',
      copiedToKey: copiedTo?.destKey || null,
      deleteExecuted: false,
    })
  }

  return {
    status: dryRunOnly ? 'dry_run' : 'executed',
    dryRunOnly,
    copyR2,
    destructiveDelete: false,
    confirmationRequired: !dryRunOnly,
    confirmationPhrase: MAPPING_TEST_QUARANTINE_CONFIRMATION,
    summary: {
      planned: planned.length,
      executed: executed.length,
      skipped: skipped.length,
      copiedObjects: executed.filter((item) => item.copiedToKey).length,
      deleteExecuted: false,
    },
    planned,
    executed,
    skipped,
    message: dryRunOnly
      ? 'Simulação de quarentena concluída. Nenhum registro foi alterado e nenhum objeto foi apagado.'
      : 'Quarentena lógica concluída. Nenhum delete foi executado.',
  }
}


export async function registerActorKycAsset(kycCaseId, input = {}, { actorProfileId = null } = {}) {
  const requirement = await getMappingRequirementOrThrow(input.mappingRequirementId, { activeOnly: true })
  const contentType = String(input.contentType || 'application/octet-stream').trim().toLowerCase().split(';')[0]
  const assetBuffer = input.dryRunOnly ? Buffer.alloc(0) : decodeBase64Asset(input.base64)
  const estimatedSize = input.dryRunOnly
    ? Number(input.byteSize || 0)
    : assetBuffer.length || estimateBase64ByteSize(input.base64)

  if (!input.dryRunOnly && estimatedSize <= 0) {
    throw new ApiError(400, 'Material de mapeamento vazio ou inválido.')
  }

  if (!input.dryRunOnly && estimatedSize > MAX_MAPPING_ASSET_BYTES) {
    throw new ApiError(413, 'Material de mapeamento deve ter no máximo 25 MB.')
  }

  if (!input.dryRunOnly && !isMimeTypeAllowedForRequirement(requirement, contentType)) {
    throw new ApiError(422, `Formato não permitido para ${requirement.title}.`)
  }

  const kycCase = await getKycCaseOrThrow(kycCaseId)
  const actor = await getActorOrThrow(kycCase.actor_profile_id)

  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este ator está bloqueado.')
  }

  await assertTableAvailable(KYC_ASSETS_TABLE)

  const checksumSha256 = input.dryRunOnly
    ? (input.checksumSha256 || null)
    : createHash('sha256').update(assetBuffer).digest('hex')

  if (!input.dryRunOnly && checksumSha256) {
    const { data: duplicateAsset, error: duplicateError } = await supabaseAdmin
      .from(KYC_ASSETS_TABLE)
      .select('*')
      .eq('actor_profile_id', actor.id)
      .eq('kyc_case_id', kycCase.id)
      .eq('mapping_requirement_id', requirement.id)
      .eq('checksum_sha256', checksumSha256)
      .neq('status', 'rejected')
      .neq('status', 'deleted')
      .neq('status', 'quarantined')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (duplicateError) {
      throw new ApiError(500, 'Erro ao verificar material duplicado do mapeamento.', duplicateError)
    }

    if (duplicateAsset) {
      return {
        item: mapKycAsset(duplicateAsset),
        duplicate: true,
        message: 'Este mesmo arquivo já estava guardado para a categoria selecionada.',
      }
    }
  }

  const vaultResult = await uploadKycAssetToVault({
    buffer: assetBuffer,
    actorProfileId: actor.id,
    kycCaseId: kycCase.id,
    assetType: `mapping_requirement_${requirement.id}`,
    contentType,
    metadata: {
      ...(input.metadata || {}),
      original_filename: input.originalFilename || '',
      created_by_profile_id: actorProfileId || '',
      vault_kind: 'actor_avatar_mapping',
      mapping_requirement_id: requirement.id,
      mapping_requirement_title: requirement.title,
      mapping_media_type: requirement.mediaType,
    },
    dryRunOnly: input.dryRunOnly,
  })

  const now = nowIso()
  const payload = {
    kyc_case_id: kycCase.id,
    actor_profile_id: actor.id,
    mapping_requirement_id: requirement.id,
    asset_type: null,
    r2_bucket: vaultResult.bucket,
    r2_key: vaultResult.key,
    original_filename: input.originalFilename || null,
    content_type: vaultResult.contentType || contentType || null,
    byte_size: input.dryRunOnly ? (input.byteSize ?? vaultResult.byteSize ?? null) : assetBuffer.length,
    checksum_sha256: checksumSha256,
    status: input.dryRunOnly ? 'registered_dry_run' : 'pending_review',
    rejection_reason: null,
    reviewed_at: null,
    reviewer_profile_id: null,
    metadata: {
      ...(input.metadata || {}),
      originalFilename: input.originalFilename || null,
      privateVaultRecordedAt: now,
      mappingRequirement: {
        id: requirement.id,
        title: requirement.title,
        mediaType: requirement.mediaType,
        isRequired: requirement.isRequired,
        systemTag: requirement.systemTag || null,
      },
      vault: {
        dryRun: Boolean(vaultResult.dryRun),
        metadata: vaultResult.metadata || {},
      },
      privateVaultOnly: true,
      mappingPurpose: 'avatar_reference_material',
    },
    created_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(KYC_ASSETS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao registrar material de mapeamento.', error)
  }

  return {
    item: mapKycAsset(data),
    message: 'Material de mapeamento registrado no cofre privado. Nenhuma URL pública foi gerada.',
  }
}

async function assertRequiredMappingAssetsApproved(assets = []) {
  const requirements = await listActiveMappingRequirements()
  const missingApprovals = requirements
    .filter((requirement) => requirement.isRequired)
    .filter((requirement) => !(assets || []).some((asset) => (
      asset.mappingRequirementId === requirement.id
      && String(asset.status || '').toLowerCase() === 'approved'
    )))

  if (missingApprovals.length > 0) {
    throw new ApiError(409, 'A aprovação final permanece bloqueada até que todos os requisitos obrigatórios tenham ao menos um material aprovado.', {
      pendingRequirementIds: missingApprovals.map((item) => item.id),
      pendingRequirementTitles: missingApprovals.map((item) => item.title),
    })
  }
}

function assertNoPendingMappingAssets(assets = []) {
  const pendingAssets = (assets || []).filter((asset) => String(asset.status || '').toLowerCase() === 'pending_review')
  if (pendingAssets.length > 0) {
    throw new ApiError(409, 'A aprovação final permanece bloqueada enquanto houver materiais aguardando decisão.', {
      pendingAssetIds: pendingAssets.map((asset) => asset.id),
      pendingAssetCount: pendingAssets.length,
    })
  }
}

export async function approveActorKycCase(kycCaseId, input = {}, { actorProfileId = null } = {}) {
  const kycCase = await getKycCaseOrThrow(kycCaseId)
  const assets = await listAssetsForCase(kycCaseId)
  await assertMappingChecklistComplete(kycCase, assets)
  await assertRequiredMappingAssetsApproved(assets)
  assertNoPendingMappingAssets(assets)

  if (!mappingCaseLockedForAdminReview(kycCase)) {
    throw new ApiError(409, 'A pessoa participante ainda não enviou este ciclo do mapeamento para análise.')
  }

  const now = nowIso()
  const metadata = asPlainObject(kycCase.metadata)
  const adminReview = asPlainObject(metadata.adminReview)
  const reviewHistory = appendReviewHistory(metadata.reviewHistory, {
    status: 'approved',
    reviewedAt: now,
    reviewerProfileId: actorProfileId,
    cycle: Number(asPlainObject(metadata.actorSubmission).cycle || metadata.reviewCycle || 0),
  })

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({
      status: 'approved',
      reviewed_at: now,
      reviewer_profile_id: actorProfileId,
      rejection_reason: null,
      notes: input.note || kycCase.notes || null,
      metadata: {
        ...metadata,
        actorSubmittedForReview: true,
        adminReview: {
          ...adminReview,
          status: 'approved',
          approvedAt: now,
          reviewerProfileId: actorProfileId,
        },
        reviewHistory,
      },
      updated_at: now,
    })
    .eq('id', kycCaseId)
    .eq('actor_profile_id', kycCase.actor_profile_id)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Erro ao aprovar mapeamento.', error)

  const { error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: 'approved',
      kyc_status: 'approved',
      updated_by_profile_id: actorProfileId,
      updated_at: now,
    })
    .eq('id', data.actor_profile_id)

  if (actorError) throw new ApiError(500, 'Mapeamento aprovado, mas o cadastro da pessoa participante não pôde ser atualizado.', actorError)

  const preservedAssets = await listAssetsForCase(kycCaseId)
  return mapKycCase(data, preservedAssets, { mappingChecklist: buildDynamicMappingChecklist(await listActiveMappingRequirements(), preservedAssets, data) })
}

export async function rejectActorKycCase(kycCaseId, input = {}, { actorProfileId = null } = {}) {
  const kycCase = await getKycCaseOrThrow(kycCaseId)
  const reason = normalizeText(input.reason)
  if (!reason) throw new ApiError(422, 'Informe quais ajustes precisam ser feitos.')
  if (kycCase.status === 'approved') throw new ApiError(409, 'Mapeamento aprovado não pode voltar para ajustes por esta ação.')
  if (!mappingCaseLockedForAdminReview(kycCase)) {
    throw new ApiError(409, 'Os ajustes só podem ser solicitados depois que este ciclo for enviado formalmente para o Admin.')
  }

  const assets = await listAssetsForCase(kycCaseId)
  const now = nowIso()
  const metadata = asPlainObject(kycCase.metadata)
  const actorSubmission = asPlainObject(metadata.actorSubmission)
  const adminReview = asPlainObject(metadata.adminReview)
  const cycle = Math.max(0, Number(actorSubmission.cycle || metadata.reviewCycle || 0))
  const reviewHistory = appendReviewHistory(metadata.reviewHistory, {
    status: 'changes_requested',
    reason,
    changesRequestedAt: now,
    reviewerProfileId: actorProfileId,
    cycle,
  })

  const { data, error } = await supabaseAdmin
    .from(KYC_CASES_TABLE)
    .update({
      status: 'pending_review',
      reviewed_at: now,
      reviewer_profile_id: actorProfileId,
      rejection_reason: reason,
      metadata: {
        ...metadata,
        actorSubmittedForReview: false,
        actorSubmission: {
          ...actorSubmission,
          status: 'changes_requested',
          changesRequestedAt: now,
          lastSentForReviewAt: actorSubmission.sentForReviewAt || null,
          cycle,
        },
        adminReview: {
          ...adminReview,
          status: 'changes_requested',
          reason,
          changesRequestedAt: now,
          reviewerProfileId: actorProfileId,
          cycle,
        },
        reviewHistory,
      },
      updated_at: now,
    })
    .eq('id', kycCaseId)
    .eq('actor_profile_id', kycCase.actor_profile_id)
    .select('*')
    .single()

  if (error) throw new ApiError(500, 'Erro ao solicitar ajustes no mapeamento.', error)

  const { error: actorError } = await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      status: 'kyc_pending',
      kyc_status: 'pending_review',
      updated_by_profile_id: actorProfileId,
      updated_at: now,
    })
    .eq('id', kycCase.actor_profile_id)

  if (actorError) throw new ApiError(500, 'Os ajustes foram registrados, mas o cadastro da pessoa participante não pôde ser atualizado.', actorError)

  return mapKycCase(data, assets, { mappingChecklist: buildDynamicMappingChecklist(await listActiveMappingRequirements(), assets, data) })
}

export async function authorizeAvatarProduction(companionId, input = {}, { actorProfileId = null } = {}) {
  await assertTableAvailable(AUTHORIZATIONS_TABLE)

  const companion = await getCompanionOrThrow(companionId)
  const actor = await getActorOrThrow(input.actorProfileId)
  const kycCase = await getKycCaseOrThrow(input.kycCaseId)

  if (actor.status === 'blocked') {
    throw new ApiError(409, 'Este ator está bloqueado.')
  }

  if (actor.kyc_status !== 'approved' || kycCase.status !== 'approved') {
    throw new ApiError(409, 'A produção só pode ser autorizada depois do mapeamento aprovado.')
  }

  if (kycCase.actor_profile_id !== actor.id) {
    throw new ApiError(409, 'Este mapeamento não pertence ao ator informado.')
  }

  const mappingAssets = await listAssetsForCase(kycCase.id)
  const mappingChecklist = await assertMappingChecklistComplete(kycCase, mappingAssets)

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('*')
    .eq('companion_id', companion.id)
    .eq('status', 'active')
    .limit(1)

  if (existingError) {
    throw new ApiError(500, 'Erro ao verificar autorização do avatar.', existingError)
  }

  if ((existing || []).length > 0) {
    throw new ApiError(409, 'Este avatar já possui autorização ativa.')
  }

  const now = nowIso()
  const payload = {
    companion_id: companion.id,
    actor_profile_id: actor.id,
    kyc_case_id: kycCase.id,
    status: 'active',
    authorized_for_content_types: input.authorizedForContentTypes?.length ? input.authorizedForContentTypes : [...CONTENT_TYPES],
    starts_at: input.startsAt || now,
    ends_at: input.endsAt || null,
    authorization_note: input.note || null,
    finance_snapshot: input.financeSnapshot || {},
    terms_snapshot: input.termsSnapshot || {},
    metadata: {
      ...(input.metadata || {}),
      source: 'admin_avatar_authorization',
      companionName: companion.name || companion.slug || null,
      authorizedAt: now,
      mappingChecklist: {
        status: mappingChecklist.status,
        completedRequired: mappingChecklist.completedRequired,
        totalRequired: mappingChecklist.totalRequired,
      },
    },
    authorized_by_profile_id: actorProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .insert(payload)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao autorizar produção do avatar.', error)
  }

  await supabaseAdmin
    .from(ACTORS_TABLE)
    .update({
      production_status: 'authorized',
      updated_by_profile_id: actorProfileId,
      updated_at: now,
    })
    .eq('id', actor.id)

  return {
    item: mapAuthorization(data),
    message: 'Avatar autorizado para produção.',
  }
}

export async function revokeAvatarProductionAuthorization(authorizationId, input = {}, { actorProfileId = null } = {}) {
  await assertTableAvailable(AUTHORIZATIONS_TABLE)
  assertUuidLike(authorizationId, 'Autorização')

  const now = nowIso()
  const revokePayload = {
    status: 'revoked',
    revoked_at: now,
    revoked_by_profile_id: actorProfileId,
    updated_at: now,
  }

  if (input.reason) revokePayload.authorization_note = input.reason

  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .update(revokePayload)
    .eq('id', authorizationId)
    .select('*')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao revogar autorização do avatar.', error)
  }

  return {
    item: mapAuthorization(data),
    message: 'Autorização revogada.',
  }
}

export async function listAvatarProductionAuthorizations(companionId) {
  await assertTableAvailable(AUTHORIZATIONS_TABLE)
  await getCompanionOrThrow(companionId)

  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('*')
    .eq('companion_id', companionId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    throw new ApiError(500, 'Erro ao listar autorizações do avatar.', error)
  }

  return {
    items: (data || []).map(mapAuthorization),
  }
}



function isAuthorizationCurrentlyValid(row = {}, { contentType = null } = {}) {
  if (!row || row.status !== 'active') return false

  const now = Date.now()
  const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null
  const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null
  const authorizedTypes = row.authorized_for_content_types || []
  const validStart = !startsAt || startsAt <= now
  const validEnd = !endsAt || endsAt > now
  const validContentType = !contentType || authorizedTypes.length === 0 || authorizedTypes.includes(contentType)

  return Boolean(validStart && validEnd && validContentType)
}

function buildSimpleComplianceReason(code, message, severity = 'block') {
  return { code, message, severity }
}

function summarizeMappingAssetsForCompliance(assets = [], { r2Results = [] } = {}) {
  const safeAssets = Array.isArray(assets) ? assets : []
  const realAssets = safeAssets.filter((asset) => !isDryRunMappingAsset(asset))
  const dryRunAssets = safeAssets.filter(isDryRunMappingAsset)
  const archivedAssets = safeAssets.filter((asset) => String(asset.status || '').toLowerCase() === 'archived' || isQuarantinedMappingAsset(asset))
  const rejectedAssets = safeAssets.filter((asset) => String(asset.status || '').toLowerCase() === 'rejected')
  const privateVaultAssets = realAssets.filter((asset) => String(asset.key || '').startsWith('vault/actor-mapping/'))
  const realR2Candidates = realAssets.filter((asset) => Boolean(asset.bucket && asset.key && String(asset.key).startsWith('vault/actor-mapping/')))

  return {
    total: safeAssets.length,
    real: realAssets.length,
    dryRun: dryRunAssets.length,
    archivedOrQuarantined: archivedAssets.length,
    rejected: rejectedAssets.length,
    privateVault: privateVaultAssets.length,
    realR2Candidates: realR2Candidates.length,
    r2Checked: r2Results.length,
    r2ObjectExists: r2Results.filter((item) => item.exists === true).length,
    r2Missing: r2Results.filter((item) => item.exists === false).length,
    publicAccess: false,
  }
}

function mapComplianceActor(actor = null) {
  if (!actor) return null
  return {
    id: actor.id,
    displayName: actor.display_name || actor.displayName || 'Pessoa participante',
    email: actor.email || null,
    status: actor.status || 'draft',
    mappingStatus: actor.kyc_status || actor.kycStatus || 'not_started',
    productionStatus: actor.production_status || actor.productionStatus || 'not_authorized',
  }
}

function mapComplianceAvatar(companion = {}) {
  return {
    id: companion.id,
    name: companion.name || companion.nome || companion.slug || 'Avatar',
    slug: companion.slug || null,
    isActive: companion.is_active ?? companion.active ?? null,
  }
}

async function listAuthorizationsForCompliance(companionId) {
  const { data, error } = await supabaseAdmin
    .from(AUTHORIZATIONS_TABLE)
    .select('*')
    .eq('companion_id', companionId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    throw new ApiError(500, 'Erro ao listar autorizações do avatar.', error)
  }

  return data || []
}

async function buildR2ComplianceResults(assets = [], { checkR2 = false, limit = 25 } = {}) {
  if (!checkR2) return []

  const candidates = (assets || [])
    .filter((asset) => !isDryRunMappingAsset(asset))
    .filter((asset) => Boolean(asset.bucket && asset.key))
    .filter((asset) => String(asset.key || '').startsWith('vault/actor-mapping/'))
    .slice(0, limit)

  const results = []
  for (const asset of candidates) {
    try {
      const head = await headKycVaultObject({ bucket: asset.bucket, key: asset.key })
      results.push({
        assetId: asset.id,
        exists: Boolean(head.exists),
        contentType: head.contentType || null,
        contentLength: head.contentLength ?? null,
        publicAccess: false,
      })
    } catch (error) {
      results.push({
        assetId: asset.id,
        exists: false,
        error: error.message,
        publicAccess: false,
      })
    }
  }

  return results
}

export async function getAvatarComplianceReport(companionId, { checkR2 = false, contentType = null } = {}) {
  await assertTableAvailable(AUTHORIZATIONS_TABLE)
  const companion = await getCompanionOrThrow(companionId)
  const authorizationRows = await listAuthorizationsForCompliance(companion.id)
  const activeAuthorizationIgnoringContentType = authorizationRows.find((row) => isAuthorizationCurrentlyValid(row)) || null
  const activeAuthorizationRow = authorizationRows.find((row) => isAuthorizationCurrentlyValid(row, { contentType })) || null
  const latestRelevantAuthorizationRow = activeAuthorizationRow || activeAuthorizationIgnoringContentType || authorizationRows[0] || null

  let actorRow = null
  let mappingCaseRow = null
  let mappingAssets = []
  let mappingChecklist = null
  let r2Results = []

  if (latestRelevantAuthorizationRow?.actor_profile_id) {
    try {
      actorRow = await getActorOrThrow(latestRelevantAuthorizationRow.actor_profile_id)
    } catch (error) {
      actorRow = null
    }
  }

  if (latestRelevantAuthorizationRow?.kyc_case_id) {
    try {
      mappingCaseRow = await getKycCaseOrThrow(latestRelevantAuthorizationRow.kyc_case_id)
      mappingAssets = await listAssetsForCase(mappingCaseRow.id)
      mappingChecklist = await buildMappingChecklistFromAssets(mappingAssets, mappingCaseRow)
      r2Results = await buildR2ComplianceResults(mappingAssets, { checkR2 })
    } catch (error) {
      mappingCaseRow = null
      mappingAssets = []
      mappingChecklist = null
      r2Results = []
    }
  }

  const reasons = []

  if (!activeAuthorizationRow) {
    if (contentType && activeAuthorizationIgnoringContentType) {
      reasons.push(buildSimpleComplianceReason('content_type_not_authorized', 'Avatar sem autorização ativa para este tipo de produção.'))
    } else {
      reasons.push(buildSimpleComplianceReason('no_active_authorization', 'Avatar sem autorização ativa para produção.'))
    }
  }

  if (actorRow?.status === 'blocked') {
    reasons.push(buildSimpleComplianceReason('actor_blocked', 'Pessoa participante bloqueada no Admin.'))
  }

  if (!actorRow && latestRelevantAuthorizationRow?.actor_profile_id) {
    reasons.push(buildSimpleComplianceReason('actor_not_found', 'Pessoa participante vinculada à autorização não foi encontrada.'))
  }

  if (!mappingCaseRow && latestRelevantAuthorizationRow?.kyc_case_id) {
    reasons.push(buildSimpleComplianceReason('mapping_not_found', 'Mapeamento vinculado à autorização não foi encontrado.'))
  }

  if (mappingCaseRow && mappingCaseRow.status !== 'approved') {
    reasons.push(buildSimpleComplianceReason('mapping_not_approved', 'Mapeamento ainda não foi aprovado.'))
  }

  if (mappingChecklist && !mappingChecklist.isComplete) {
    reasons.push(buildSimpleComplianceReason('mapping_incomplete', 'Mapeamento incompleto. Ainda faltam materiais obrigatórios.'))
  }

  if (checkR2 && r2Results.some((item) => item.exists === false)) {
    reasons.push(buildSimpleComplianceReason('vault_object_missing', 'Auditoria do cofre encontrou material sem objeto confirmado no R2.'))
  }

  const productionAllowed = Boolean(activeAuthorizationRow && reasons.length === 0)
  const vaultSummary = summarizeMappingAssetsForCompliance(mappingAssets, { r2Results })

  return {
    status: productionAllowed ? 'liberado' : 'bloqueado',
    productionAllowed,
    summary: productionAllowed
      ? 'Avatar liberado para produção real.'
      : reasons[0]?.message || 'Avatar ainda não está liberado para produção real.',
    avatar: mapComplianceAvatar(companion),
    actor: mapComplianceActor(actorRow),
    mapping: mappingCaseRow ? {
      id: mappingCaseRow.id,
      status: mappingCaseRow.status || null,
      caseType: mappingCaseRow.case_type || 'avatar_mapping',
      reviewedAt: mappingCaseRow.reviewed_at || null,
      checklist: mappingChecklist,
    } : null,
    vault: vaultSummary,
    authorization: activeAuthorizationRow ? mapAuthorization(activeAuthorizationRow) : null,
    latestAuthorization: latestRelevantAuthorizationRow ? mapAuthorization(latestRelevantAuthorizationRow) : null,
    authorizations: authorizationRows.map(mapAuthorization),
    reasons,
    checks: {
      hasActiveAuthorization: Boolean(activeAuthorizationRow),
      requestedContentType: contentType || null,
      contentTypeAllowed: Boolean(activeAuthorizationRow),
      actorAllowed: Boolean(actorRow && actorRow.status !== 'blocked'),
      mappingApproved: Boolean(mappingCaseRow && mappingCaseRow.status === 'approved'),
      mappingComplete: Boolean(mappingChecklist?.isComplete),
      vaultChecked: Boolean(checkR2),
      publicAccess: false,
      runPodCalled: false,
      destructiveDelete: false,
    },
    message: productionAllowed
      ? 'Relatório de conformidade OK. Avatar pode produzir quando o lote real for solicitado.'
      : 'Relatório de conformidade encontrou bloqueios. Corrija os itens indicados antes de produzir.',
  }
}


function buildFactoryComplianceErrorMessage(firstReason = null) {
  if (!firstReason) return 'Este avatar ainda não está liberado para produção real.'
  if (firstReason.code === 'no_active_authorization') return PRODUCTION_NOT_AUTHORIZED_MESSAGE
  return firstReason.message || 'Este avatar ainda não está liberado para produção real.'
}

function summarizeComplianceForFactory(report = {}) {
  return {
    status: report.status || 'bloqueado',
    productionAllowed: Boolean(report.productionAllowed),
    summary: report.summary || null,
    reasons: (report.reasons || []).map((reason) => ({
      code: reason.code,
      message: reason.message,
      severity: reason.severity || 'block',
    })),
    checks: {
      ...(report.checks || {}),
      publicAccess: false,
      runPodCalled: false,
      destructiveDelete: false,
    },
  }
}

export async function assertAvatarCompliantForProduction({ companionId, contentType = null, checkR2 = false } = {}) {
  if (!companionId) {
    throw new ApiError(409, PRODUCTION_NOT_AUTHORIZED_MESSAGE)
  }

  const report = await getAvatarComplianceReport(companionId, { checkR2, contentType })
  const compliance = summarizeComplianceForFactory(report)

  if (!report.productionAllowed) {
    const firstReason = report.reasons?.[0] || null
    throw new ApiError(409, buildFactoryComplianceErrorMessage(firstReason), {
      companionId,
      contentType,
      compliance,
    })
  }

  const rows = await listAuthorizationsForCompliance(companionId)
  const activeAuthorizationRow = rows.find((row) => isAuthorizationCurrentlyValid(row, { contentType })) || null

  if (!activeAuthorizationRow) {
    throw new ApiError(409, PRODUCTION_NOT_AUTHORIZED_MESSAGE, {
      companionId,
      contentType,
      compliance,
    })
  }

  return {
    row: activeAuthorizationRow,
    snapshot: buildActiveAuthorizationSnapshot(activeAuthorizationRow),
    compliance,
  }
}

export async function assertAvatarProductionAuthorized({ companionId, contentType = null } = {}) {
  if (!companionId) {
    throw new ApiError(409, PRODUCTION_NOT_AUTHORIZED_MESSAGE)
  }

  let rows = []

  try {
    const { data, error } = await supabaseAdmin
      .from(AUTHORIZATIONS_TABLE)
      .select('*')
      .eq('companion_id', companionId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      throw error
    }

    rows = data || []
  } catch (error) {
    throw new ApiError(409, PRODUCTION_NOT_AUTHORIZED_MESSAGE, {
      companionId,
      contentType,
      error: error.message,
    })
  }

  const now = Date.now()
  const valid = rows.find((row) => {
    const startsAt = row.starts_at ? new Date(row.starts_at).getTime() : null
    const endsAt = row.ends_at ? new Date(row.ends_at).getTime() : null
    const authorizedTypes = row.authorized_for_content_types || []
    const validStart = !startsAt || startsAt <= now
    const validEnd = !endsAt || endsAt > now
    const validContentType = !contentType || authorizedTypes.length === 0 || authorizedTypes.includes(contentType)

    return validStart && validEnd && validContentType
  })

  if (!valid) {
    throw new ApiError(409, PRODUCTION_NOT_AUTHORIZED_MESSAGE, {
      companionId,
      contentType,
    })
  }

  return {
    row: valid,
    snapshot: buildActiveAuthorizationSnapshot(valid),
  }
}
