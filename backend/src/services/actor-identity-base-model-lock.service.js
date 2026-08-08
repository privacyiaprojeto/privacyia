import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

const BACKEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

export const IDENTITY_BASE_MODEL_LOCK_SCHEMA = 'privacy-identity-base-model-lock-v1'
export const DEFAULT_IDENTITY_BASE_MODEL_LOCK_PATH = 'infra/identity-lora-trainer/base-model.lock.json'
export const IDENTITY_BASE_MODEL_REQUIRED_ARTIFACTS = Object.freeze([
  'diffusion_pytorch_model-00001-of-00007.safetensors',
  'diffusion_pytorch_model-00002-of-00007.safetensors',
  'diffusion_pytorch_model-00003-of-00007.safetensors',
  'diffusion_pytorch_model-00004-of-00007.safetensors',
  'diffusion_pytorch_model-00005-of-00007.safetensors',
  'diffusion_pytorch_model-00006-of-00007.safetensors',
  'diffusion_pytorch_model-00007-of-00007.safetensors',
  'models_t5_umt5-xxl-enc-bf16.pth',
  'Wan2.1_VAE.pth',
])

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

export function stableStringifyIdentityBaseModelLock(value) {
  return JSON.stringify(stableValue(value))
}

export function sha256IdentityBaseModelLock(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function isSha256IdentityBaseModelLock(value) {
  return /^[0-9a-f]{64}$/.test(normalizeLower(value))
}

export function isGitCommitIdentityBaseModelLock(value) {
  return /^[0-9a-f]{40}$/.test(normalizeLower(value))
}

export function resolveIdentityBaseModelLockPath(configuredPath = env.IDENTITY_LORA_BASE_MODEL_LOCK_PATH) {
  const requested = normalizeText(configuredPath) || DEFAULT_IDENTITY_BASE_MODEL_LOCK_PATH
  if (path.isAbsolute(requested)) return path.normalize(requested)
  return path.resolve(BACKEND_ROOT, requested)
}

export function canonicalIdentityBaseModelLockCore(lock) {
  const artifacts = Array.isArray(lock?.artifacts)
    ? lock.artifacts.map((artifact) => ({
      path: normalizeText(artifact?.path),
      sha256: normalizeLower(artifact?.sha256),
      size: Number(artifact?.size || 0),
    })).sort((left, right) => left.path.localeCompare(right.path))
    : []

  return {
    schemaVersion: normalizeText(lock?.schemaVersion),
    repository: normalizeText(lock?.repository),
    revision: normalizeLower(lock?.revision),
    artifacts,
  }
}

export function fingerprintIdentityBaseModelLock(lock) {
  return sha256IdentityBaseModelLock(stableStringifyIdentityBaseModelLock(canonicalIdentityBaseModelLockCore(lock)))
}

function blocker(code, message, details = undefined) {
  return details ? { code, message, details } : { code, message }
}

export function validateIdentityBaseModelLock(lock, options = {}) {
  const expectedRepository = normalizeText(options.expectedRepository ?? env.IDENTITY_LORA_BASE_MODEL)
  const expectedRevision = normalizeLower(options.expectedRevision ?? env.IDENTITY_LORA_BASE_MODEL_REVISION)
  const expectedFingerprint = normalizeLower(options.expectedFingerprint ?? env.IDENTITY_LORA_BASE_MODEL_FINGERPRINT)
  const expectedArtifacts = Array.isArray(options.requiredArtifacts) && options.requiredArtifacts.length > 0
    ? [...options.requiredArtifacts]
    : [...IDENTITY_BASE_MODEL_REQUIRED_ARTIFACTS]
  const blockers = []

  if (!lock || typeof lock !== 'object' || Array.isArray(lock)) {
    blockers.push(blocker('base_model_lock_invalid', 'O arquivo de integridade do modelo-base está ausente ou não contém um documento válido.'))
    return { ready: false, blockers, fingerprintSha256: null, revision: null, artifactCount: 0 }
  }

  const core = canonicalIdentityBaseModelLockCore(lock)
  if (core.schemaVersion !== IDENTITY_BASE_MODEL_LOCK_SCHEMA) {
    blockers.push(blocker('base_model_lock_schema_invalid', 'A versão do arquivo de integridade do modelo-base não é reconhecida.', {
      expected: IDENTITY_BASE_MODEL_LOCK_SCHEMA,
      current: core.schemaVersion || null,
    }))
  }
  if (!core.repository || core.repository !== expectedRepository) {
    blockers.push(blocker('base_model_lock_repository_mismatch', 'O arquivo de integridade pertence a outro modelo-base.', {
      expected: expectedRepository || null,
      current: core.repository || null,
    }))
  }
  if (!isGitCommitIdentityBaseModelLock(core.revision)) {
    blockers.push(blocker('base_model_revision_invalid', 'A revisão fixa do modelo-base não é um commit válido.'))
  } else if (expectedRevision && core.revision !== expectedRevision) {
    blockers.push(blocker('base_model_lock_revision_mismatch', 'A revisão configurada não corresponde ao arquivo de integridade.', {
      expected: expectedRevision,
      current: core.revision,
    }))
  }

  const artifactMap = new Map()
  for (const artifact of core.artifacts) {
    if (!artifact.path || artifactMap.has(artifact.path)) {
      blockers.push(blocker('base_model_lock_artifact_duplicate', 'O arquivo de integridade contém artefatos duplicados ou sem nome.'))
      continue
    }
    artifactMap.set(artifact.path, artifact)
    if (!isSha256IdentityBaseModelLock(artifact.sha256)) {
      blockers.push(blocker('base_model_lock_artifact_sha256_invalid', 'Um artefato do modelo-base não possui SHA-256 válido.', { path: artifact.path }))
    }
    if (!Number.isSafeInteger(artifact.size) || artifact.size <= 0) {
      blockers.push(blocker('base_model_lock_artifact_size_invalid', 'Um artefato do modelo-base não possui tamanho válido.', { path: artifact.path }))
    }
  }

  const missingArtifacts = expectedArtifacts.filter((artifactPath) => !artifactMap.has(artifactPath))
  if (missingArtifacts.length > 0) {
    blockers.push(blocker('base_model_lock_artifacts_missing', 'O arquivo de integridade não cobre todos os artefatos exigidos pelo treinamento.', {
      missingArtifacts,
    }))
  }

  const unexpectedArtifacts = [...artifactMap.keys()].filter((artifactPath) => !expectedArtifacts.includes(artifactPath))
  if (unexpectedArtifacts.length > 0) {
    blockers.push(blocker('base_model_lock_artifacts_unexpected', 'O arquivo de integridade contém artefatos fora do contrato aprovado.', {
      unexpectedArtifacts,
    }))
  }

  const computedFingerprint = fingerprintIdentityBaseModelLock(lock)
  const declaredFingerprint = normalizeLower(lock.fingerprintSha256)
  if (!isSha256IdentityBaseModelLock(declaredFingerprint) || declaredFingerprint !== computedFingerprint) {
    blockers.push(blocker('base_model_lock_fingerprint_invalid', 'A assinatura interna do arquivo de integridade não corresponde ao seu conteúdo.'))
  }
  if (!isSha256IdentityBaseModelLock(expectedFingerprint)) {
    blockers.push(blocker('base_model_fingerprint_missing', 'A assinatura real do modelo-base ainda não foi configurada no backend.'))
  } else if (computedFingerprint !== expectedFingerprint) {
    blockers.push(blocker('base_model_fingerprint_lock_mismatch', 'A assinatura configurada não corresponde ao arquivo de integridade aprovado.', {
      expectedPrefix: expectedFingerprint.slice(0, 12),
      lockPrefix: computedFingerprint.slice(0, 12),
    }))
  }

  if (!isGitCommitIdentityBaseModelLock(expectedRevision)) {
    blockers.push(blocker('base_model_revision_missing', 'A revisão fixa do modelo-base ainda não foi configurada no backend.'))
  }

  return {
    ready: blockers.length === 0,
    blockers,
    fingerprintSha256: computedFingerprint,
    fingerprintPrefix: computedFingerprint.slice(0, 12),
    revision: core.revision || null,
    revisionPrefix: isGitCommitIdentityBaseModelLock(core.revision) ? core.revision.slice(0, 12) : null,
    repository: core.repository || null,
    artifactCount: core.artifacts.length,
    requiredArtifactCount: expectedArtifacts.length,
  }
}

export function inspectConfiguredIdentityBaseModelLock(options = {}) {
  const lockPath = resolveIdentityBaseModelLockPath(options.lockPath)
  if (!fs.existsSync(lockPath)) {
    return {
      ready: false,
      lockPath,
      lockExists: false,
      lock: null,
      blockers: [blocker('base_model_lock_missing', 'O arquivo auditável do modelo-base ainda não foi gerado.')],
      fingerprintSha256: null,
      fingerprintPrefix: null,
      revision: null,
      revisionPrefix: null,
      artifactCount: 0,
      requiredArtifactCount: IDENTITY_BASE_MODEL_REQUIRED_ARTIFACTS.length,
    }
  }

  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    const validation = validateIdentityBaseModelLock(lock, options)
    return { ...validation, lockPath, lockExists: true, lock }
  } catch (error) {
    return {
      ready: false,
      lockPath,
      lockExists: true,
      lock: null,
      blockers: [blocker('base_model_lock_unreadable', 'O arquivo auditável do modelo-base não pôde ser lido com segurança.', {
        reason: error?.message || 'unknown_error',
      })],
      fingerprintSha256: null,
      fingerprintPrefix: null,
      revision: null,
      revisionPrefix: null,
      artifactCount: 0,
      requiredArtifactCount: IDENTITY_BASE_MODEL_REQUIRED_ARTIFACTS.length,
    }
  }
}
