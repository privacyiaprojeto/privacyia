import { supabaseAdmin } from '../config/supabase.js'

function nowIso() {
  return new Date().toISOString()
}

export async function markClientGenerationQueued({ mediaJobId, generationId, queueJobId, canonical = {} } = {}) {
  await Promise.allSettled([
    mediaJobId ? supabaseAdmin.from('media_jobs').update({
      status: 'processing',
      runpod_job_id: null,
      prompt_payload: canonical,
      updated_at: nowIso(),
    }).eq('id', mediaJobId) : Promise.resolve(),
    generationId ? supabaseAdmin.from('media_generations').update({
      status: 'em_andamento',
      progress: 10,
      eta_seconds: null,
      external_provider: 'bullmq',
      external_job_id: String(queueJobId || ''),
      option_payload: canonical,
      updated_at: nowIso(),
    }).eq('id', generationId) : Promise.resolve(),
  ])
}

export async function markClientGenerationQaPending({ mediaJobId, generationId, assetId, masterAssetId, providerJobId = null } = {}) {
  const payload = { assetId, masterAssetId, privateStorage: true, qaRequired: true, publicUrl: false }
  await Promise.allSettled([
    mediaJobId ? supabaseAdmin.from('media_jobs').update({
      status: 'completed',
      output_media_url: null,
      runpod_job_id: providerJobId,
      updated_at: nowIso(),
    }).eq('id', mediaJobId) : Promise.resolve(),
    generationId ? supabaseAdmin.from('media_generations').update({
      status: 'qa_pending',
      progress: 100,
      eta_seconds: 0,
      result_url: null,
      external_provider: 'bullmq',
      external_job_id: providerJobId || mediaJobId || generationId,
      option_payload: payload,
      updated_at: nowIso(),
    }).eq('id', generationId) : Promise.resolve(),
  ])
}

export async function markClientGenerationFailed({ mediaJobId, generationId, message } = {}) {
  const safeMessage = String(message || 'Falha na produção canônica.').slice(0, 500)
  await Promise.allSettled([
    mediaJobId ? supabaseAdmin.from('media_jobs').update({ status: 'failed', error_message: safeMessage, updated_at: nowIso() }).eq('id', mediaJobId) : Promise.resolve(),
    generationId ? supabaseAdmin.from('media_generations').update({ status: 'erro', progress: 0, eta_seconds: 0, result_url: null, report_reason: safeMessage, updated_at: nowIso() }).eq('id', generationId) : Promise.resolve(),
  ])
}
