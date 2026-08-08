import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { generateSpeechWithRunPod } from './providers/runpod.provider.js'
import { withRunPodWorkerLease } from './runpod-worker-lease-guard-6-3R12.service.js'
import { selectVoiceProfile } from './voiceProfile.service.js'
import { prepareTextForTts } from './ttsText.service.js'
import { getExtensionFromContentType, uploadPrivateBufferToR2 } from './storage.service.js'
import { registerMasterForLegacyVariant } from './media-asset-master.service.js'
import { requestDefaultRenditionsForMaster } from './media-rendition.service.js'
import { assertApprovedActorIdentityForProduction } from './actor-identity-lora.service.js'

const ITEMS_TABLE = 'media_generation_batch_items'
const BATCHES_TABLE = 'media_generation_batches'
const COMBINATIONS_TABLE = 'media_combinations'
const ASSETS_TABLE = 'media_asset_variants'
const nowIso = () => new Date().toISOString()

function isMissingColumnError(error) {
  const message = String(error?.message || '').toLowerCase()
  return String(error?.code || '') === '42703' || message.includes('does not exist') || message.includes('column')
}

async function insertAdaptive(table, input, label) {
  let payload = { ...input }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data, error } = await supabaseAdmin.from(table).insert(payload).select('*').maybeSingle()
    if (!error) return data
    if (!isMissingColumnError(error)) throw new ApiError(500, `Erro ao criar ${label}.`, error)
    const match = String(error.message || '').match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i)
      || String(error.message || '').match(/["']([a-zA-Z0-9_]+)["']\s+does not exist/i)
    const column = match?.[1]
    if (!column || !(column in payload)) throw new ApiError(500, `Schema incompatível ao criar ${label}.`, error)
    delete payload[column]
  }
  throw new ApiError(500, `Falha ao adaptar ${label}.`)
}

async function loadContext(itemId) {
  const { data: item, error: itemError } = await supabaseAdmin.from(ITEMS_TABLE).select('*').eq('id', itemId).maybeSingle()
  if (itemError) throw new ApiError(500, 'Erro ao carregar item Live Audio.', itemError)
  if (!item) throw new ApiError(404, 'Item Live Audio não encontrado.')

  const [{ data: batch, error: batchError }, { data: combination, error: combinationError }] = await Promise.all([
    supabaseAdmin.from(BATCHES_TABLE).select('*').eq('id', item.batch_id).maybeSingle(),
    supabaseAdmin.from(COMBINATIONS_TABLE).select('*').eq('id', item.combination_id || item.media_combination_id).maybeSingle(),
  ])
  if (batchError) throw new ApiError(500, 'Erro ao carregar lote Live Audio.', batchError)
  if (combinationError) throw new ApiError(500, 'Erro ao carregar combinação Live Audio.', combinationError)
  if (!batch || !combination) throw new ApiError(409, 'Contexto incompleto para gerar Live Audio.')
  return { item, batch, combination }
}

async function updateStatus(table, id, payload) {
  const { error } = await supabaseAdmin.from(table).update({ ...payload, updated_at: nowIso() }).eq('id', id)
  if (error) console.warn('[actor-pipeline-worker] Falha ao atualizar status.', { table, id, error: error.message })
}

export async function processActorPipelineLiveAudioJob(job) {
  const itemId = job?.data?.batchItemId || job?.data?.batch_item_id
  if (!itemId) throw new ApiError(400, 'batchItemId obrigatório no job Live Audio.')
  const context = await loadContext(itemId)
  const { item, batch, combination } = context
  const metadata = item.metadata || item.generation_payload || {}
  const script = String(metadata.script || item.prompt_final || item.prompt_text || item.prompt || combination.prompt_final || combination.prompt || '').trim()
  if (!script) throw new ApiError(422, 'Texto TTS ausente no item Live Audio.')

  const actorProfileId = item.actor_profile_id || batch.actor_profile_id || combination.actor_profile_id || null
  const companionId = item.companion_id || batch.companion_id || combination.companion_id || null
  const authorizationId = item.avatar_production_authorization_id || batch.avatar_production_authorization_id || combination.avatar_production_authorization_id || null
  await assertApprovedActorIdentityForProduction({
    actorProfileId,
    companionId,
    authorizationId,
    contentType: 'live_audio',
  })

  await Promise.all([
    updateStatus(ITEMS_TABLE, item.id, { status: 'processing', started_at: nowIso() }),
    updateStatus(BATCHES_TABLE, batch.id, { status: 'processing' }),
  ])

  try {
    const voiceProfile = await selectVoiceProfile({
      companionId: item.companion_id || batch.companion_id || combination.companion_id,
      text: script,
      currentMood: metadata.voiceTone || 'neutral',
    })
    const cleanText = prepareTextForTts(script, { profileKey: voiceProfile.profileKey })
    const endpointId = env.RUNPOD_QWEN_TTS_ENDPOINT_ID || env.RUNPOD_AUDIO_ENDPOINT_ID || env.RUNPOD_FISH_SPEECH_ENDPOINT_ID
    const generatedAudio = await withRunPodWorkerLease({
      productionName: 'actor-pipeline-live-audio-worker',
      mediaType: 'audio',
      endpointId,
      runProduction: () => generateSpeechWithRunPod({
        text: cleanText,
        voiceProfile,
        referenceAudio: { url: voiceProfile.referenceAudioUrl, referenceText: voiceProfile.referenceText },
      }),
    })

    const extension = generatedAudio.extension || getExtensionFromContentType(generatedAudio.mimeType || 'audio/mpeg') || 'mp3'
    const assetId = randomUUID()
    const key = `media/companions/${item.companion_id || batch.companion_id}/audio-live/${assetId}.${extension}`
    const storage = await uploadPrivateBufferToR2({
      buffer: generatedAudio.buffer,
      key,
      contentType: generatedAudio.mimeType || 'audio/mpeg',
      metadata: {
        scope: 'actor_pipeline_live_audio',
        actor_profile_id: item.actor_profile_id || batch.actor_profile_id || '',
        companion_id: item.companion_id || batch.companion_id || '',
        batch_id: batch.id,
        batch_item_id: item.id,
      },
    })

    let asset = await insertAdaptive(ASSETS_TABLE, {
      id: assetId,
      combination_id: combination.id,
      batch_id: batch.id,
      batch_item_id: item.id,
      companion_id: item.companion_id || batch.companion_id || combination.companion_id,
      actor_profile_id: item.actor_profile_id || batch.actor_profile_id,
      media_type: 'live_audio',
      variant_number: Number(item.variant_number || 1),
      r2_bucket: storage.bucket,
      r2_key: storage.key,
      status: 'qa_pending',
      max_assignments: 1,
      current_assignments: 0,
      metadata: {
        source: 'actor_pipeline',
        productType: 'live_audio',
        voiceProfileId: voiceProfile.id,
        voiceProfileKey: voiceProfile.profileKey,
        voiceTone: metadata.voiceTone || null,
        generatedAt: nowIso(),
        protected: true,
        publicUrl: false,
      },
      created_at: nowIso(),
      updated_at: nowIso(),
    }, 'asset Live Audio')

    const masterRegistration = await registerMasterForLegacyVariant({
      variant: asset,
      storage: {
        bucket: storage.bucket,
        key: storage.key,
        contentType: generatedAudio.mimeType || 'audio/mpeg',
        byteSize: storage.byteSize || generatedAudio.buffer?.length || null,
      },
      mediaType: 'live_audio',
      contentType: generatedAudio.mimeType || 'audio/mpeg',
      metadata: {
        source: 'actor_pipeline_live_audio',
        actorProfileId: item.actor_profile_id || batch.actor_profile_id || null,
        combinationId: combination.id,
        batchId: batch.id,
        batchItemId: item.id,
      },
    })
    asset = masterRegistration.variant
    const renditionRequests = await requestDefaultRenditionsForMaster({
      masterAssetId: masterRegistration.master.id,
      mediaType: 'live_audio',
      requestedByProfileId: item.profile_id || batch.profile_id || null,
    })

    await updateStatus(ITEMS_TABLE, item.id, {
      status: 'qa_pending',
      completed_at: nowIso(),
      output_asset_id: asset.id,
      result_payload: { assetId: asset.id, masterAssetId: masterRegistration.master.id, previewRenditionId: renditionRequests.preview?.rendition?.id || null, r2Bucket: storage.bucket, r2Key: storage.key, protected: true },
    })

    const { count: remaining } = await supabaseAdmin
      .from(ITEMS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('batch_id', batch.id)
      .in('status', ['queued', 'processing'])
    await updateStatus(BATCHES_TABLE, batch.id, {
      status: Number(remaining || 0) === 0 ? 'qa_pending' : 'processing',
    })

    return { assetId: asset.id, masterAssetId: masterRegistration.master.id, previewRenditionId: renditionRequests.preview?.rendition?.id || null, batchItemId: item.id, status: 'qa_pending', protected: true }
  } catch (error) {
    await Promise.all([
      updateStatus(ITEMS_TABLE, item.id, { status: 'failed', error_message: String(error?.message || error).slice(0, 1000) }),
      updateStatus(BATCHES_TABLE, batch.id, { status: 'failed' }),
    ])
    throw error
  }
}
