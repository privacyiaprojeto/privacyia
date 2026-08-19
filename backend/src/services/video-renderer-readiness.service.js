export const PROTECTED_VIDEO_RENDERER_GATE = 'PROTECTED_VIDEO_RENDERER_ENABLED'

function hasText(value) {
  return Boolean(String(value || '').trim())
}

function hasExplicitBoolean(value) {
  return value === true
    || value === false
    || ['true', 'false'].includes(String(value || '').trim().toLowerCase())
}

function booleanFromEnvironment(name, fallback = false) {
  const normalized = String(process.env[name] || '').trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return fallback
}

function defaultPrivateStorageConfigured() {
  return [
    process.env.R2_ACCOUNT_ID,
    process.env.R2_ACCESS_KEY_ID,
    process.env.R2_SECRET_ACCESS_KEY,
    process.env.R2_BUCKET_NAME,
  ].every(hasText)
}

// Configuration readiness only. This intentionally does not probe Redis, workers,
// FFmpeg/FFprobe or queue liveness; runtime-health evidence remains a separate debt.
export function inspectProtectedVideoRendererReadiness({
  gateConfigured = hasExplicitBoolean(process.env[PROTECTED_VIDEO_RENDERER_GATE]),
  enabled = booleanFromEnvironment(PROTECTED_VIDEO_RENDERER_GATE, false),
  privateStorageConfigured = defaultPrivateStorageConfigured(),
  requireRenditionPipeline = false,
  renditionPipelineConfigured = Boolean(
    booleanFromEnvironment('WORKERS_ENABLED', false)
    && booleanFromEnvironment('RENDITION_QUEUE_ENABLED', false)
  ),
} = {}) {
  const base = {
    renderer: 'video',
    gate: PROTECTED_VIDEO_RENDERER_GATE,
    ready: false,
  }

  if (!gateConfigured) {
    return {
      ...base,
      status: 'NOT_CONFIGURED',
      reasonCode: 'VIDEO_RENDERER_NOT_CONFIGURED',
      userMessage: 'A abertura protegida de vídeo ainda não foi configurada.',
      blockers: ['protected_video_renderer_gate_not_configured'],
    }
  }

  if (!enabled) {
    return {
      ...base,
      status: 'DISABLED',
      reasonCode: 'VIDEO_RENDERER_DISABLED',
      userMessage: 'A abertura protegida de vídeo está desabilitada.',
      blockers: ['protected_video_renderer_gate_disabled'],
    }
  }

  if (!privateStorageConfigured) {
    return {
      ...base,
      status: 'NOT_READY',
      reasonCode: 'VIDEO_RENDERER_NOT_READY',
      userMessage: 'A abertura protegida de vídeo ainda não está pronta.',
      blockers: ['private_r2_access_not_configured'],
    }
  }

  if (requireRenditionPipeline && !renditionPipelineConfigured) {
    return {
      ...base,
      status: 'NOT_READY',
      reasonCode: 'VIDEO_RENDERER_NOT_READY',
      userMessage: 'A produção de vídeo ainda não está pronta para gerar a entrega protegida.',
      blockers: ['protected_video_rendition_pipeline_not_ready'],
    }
  }

  return {
    ...base,
    ready: true,
    status: 'AVAILABLE',
    reasonCode: 'VIDEO_RENDERER_AVAILABLE',
    userMessage: null,
    blockers: [],
  }
}

export default {
  inspectProtectedVideoRendererReadiness,
}
