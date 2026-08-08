import { ApiError } from '../utils/apiError.js'

export const PRODUCTION_CONTRACT_VERSION = 'privacy-production-spec-v1'
export const COMFYUI_ADAPTER_VERSION = 'comfyui-graph-contract-v1'

const ENGINE_BY_TASK = Object.freeze({
  image: 'flux-1-schnell',
  i2v: 'wan-2.1-i2v',
  v2v: 'wan-2.1-v2v',
})

function text(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function nullableText(value) {
  return text(value) || null
}

function positiveNumber(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function normalizeDictionarySelections(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => ({
      category: nullableText(item?.category || item?.titleName || item?.title_name),
      itemId: nullableText(item?.itemId || item?.item_id || item?.id),
      label: nullableText(item?.label || item?.itemName || item?.item_name || item?.technicalSnippet || item?.technical_snippet),
      technicalSnippet: nullableText(item?.technicalSnippet || item?.technical_snippet || item?.label || item?.itemName),
      negativePrompt: nullableText(item?.negativePrompt || item?.negative_prompt),
    }))
    .filter((item) => item.label || item.technicalSnippet)
}

function normalizeReferences(values = []) {
  return (Array.isArray(values) ? values : [])
    .map((item) => ({
      asset_id: nullableText(item?.assetId || item?.asset_id),
      system_tag: nullableText(item?.systemTag || item?.system_tag),
      media_type: nullableText(item?.mediaType || item?.media_type),
      content_type: nullableText(item?.contentType || item?.content_type),
      signed_url: nullableText(item?.url || item?.signedUrl || item?.signed_url),
    }))
    .filter((item) => item.signed_url)
}

function normalizeActorIdentity(slot = {}) {
  const references = normalizeReferences(slot.referenceMedia || slot.reference_media)
  const primary = nullableText(slot.referenceImageUrl || slot.reference_image_url) || references.find((item) => item.media_type === 'image')?.signed_url || references[0]?.signed_url || null

  return {
    slot_index: positiveNumber(slot.slotIndex || slot.slot_index, 1, { min: 1, max: 3 }),
    participant_type: text(slot.participantType || slot.participant_type || 'actor').toLowerCase(),
    actor_profile_id: nullableText(slot.actorProfileId || slot.actor_profile_id),
    companion_id: nullableText(slot.companionId || slot.companion_id),
    authorization_id: nullableText(slot.authorizationId || slot.authorization_id),
    primary_reference_url: primary,
    references,
    reference_source: nullableText(slot.referenceSource || slot.reference_source) || 'approved_mapping_vault',
    extra_type: nullableText(slot.extraType || slot.extra_type),
    custom_description: nullableText(slot.customDescription || slot.custom_description),
  }
}

function buildComfyUiEnvelope({ workflowId, workflowVersion, graph = null, inputBindings = {} } = {}) {
  return {
    adapter: COMFYUI_ADAPTER_VERSION,
    workflow_id: nullableText(workflowId),
    workflow_version: nullableText(workflowVersion),
    graph,
    input_bindings: inputBindings,
  }
}

function baseSpecification({ engine, task, requestId = null, prompt, negativePrompt = null, metadata = {}, comfyui = {} }) {
  if (!text(prompt)) throw new ApiError(422, 'Prompt positivo obrigatório para compilar a produção.')

  return {
    contract_version: PRODUCTION_CONTRACT_VERSION,
    engine,
    task,
    request_id: nullableText(requestId),
    prompt: {
      positive: text(prompt),
      negative: nullableText(negativePrompt),
    },
    comfyui: buildComfyUiEnvelope(comfyui),
    safety: {
      licensed_or_consented_assets_only: true,
      require_approved_identity_references: true,
      private_output_only: true,
      public_url_forbidden: true,
      qa_required: true,
    },
    metadata: {
      ...metadata,
      compiled_at: new Date().toISOString(),
    },
  }
}

export function compileImageProductionSpec({
  requestId = null,
  companion = {},
  prompt,
  negativePrompt = null,
  dictionarySelections = [],
  identityReferences = [],
  camera = {},
  action = {},
  generation = {},
  workflow = {},
  metadata = {},
} = {}) {
  const references = normalizeReferences(identityReferences)
  const spec = baseSpecification({
    engine: ENGINE_BY_TASK.image,
    task: 'image.generate',
    requestId,
    prompt,
    negativePrompt,
    metadata,
    comfyui: {
      workflowId: workflow.id || workflow.workflowId || 'flux-image-v1',
      workflowVersion: workflow.version || workflow.workflowVersion || '1',
      graph: workflow.graph || null,
      inputBindings: {
        positive_prompt: 'prompt.positive',
        negative_prompt: 'prompt.negative',
        identity_references: 'identity.references',
        width: 'output.width',
        height: 'output.height',
        steps: 'sampling.steps',
        seed: 'sampling.seed',
      },
    },
  })

  return {
    ...spec,
    subject: {
      companion_id: nullableText(companion?.id),
      actor_profile_id: nullableText(metadata?.actorProfileId || metadata?.actor_profile_id),
      label: nullableText(companion?.name || companion?.slug),
      adult_confirmed: true,
    },
    identity: {
      source: 'approved_mapping_vault',
      references,
      strict: true,
    },
    dictionaries: normalizeDictionarySelections(dictionarySelections),
    camera: {
      shot: nullableText(camera?.shot),
      angle: nullableText(camera?.angle),
      movement: nullableText(camera?.movement),
    },
    action: {
      label: nullableText(action?.label),
      technical_prompt: nullableText(action?.technicalPrompt || action?.technical_prompt),
    },
    sampling: {
      steps: positiveNumber(generation?.steps, 25, { min: 1, max: 150 }),
      guidance_scale: positiveNumber(generation?.guidanceScale || generation?.guidance_scale, 3.5, { min: 0, max: 30 }),
      seed: generation?.seed ?? null,
    },
    output: {
      format: 'png',
      width: positiveNumber(generation?.width, 1024, { min: 256, max: 4096 }),
      height: positiveNumber(generation?.height, 1024, { min: 256, max: 4096 }),
      private_storage: true,
      initial_status: 'qa_pending',
    },
  }
}

export function compileVideoProductionSpec({
  requestId = null,
  productionMode = 'v2v',
  prompt,
  negativePrompt = null,
  baseVideoUrl = null,
  castSlots = [],
  camera = {},
  action = {},
  generation = {},
  workflow = {},
  metadata = {},
} = {}) {
  const mode = text(productionMode).toLowerCase() === 'i2v' ? 'i2v' : 'v2v'
  const actors = (Array.isArray(castSlots) ? castSlots : []).map(normalizeActorIdentity)
  if (!actors.length || actors.length > 3) throw new ApiError(422, 'A produção de vídeo exige de 1 a 3 participantes.')
  if (actors.filter((item) => item.participant_type === 'actor').some((item) => !item.primary_reference_url || !item.references.length)) {
    throw new ApiError(422, 'Todos os atores precisam de referências aprovadas do Cofre Biométrico.')
  }
  if (mode === 'v2v' && !text(baseVideoUrl)) throw new ApiError(422, 'Vídeo base privado obrigatório para produção V2V.')

  const spec = baseSpecification({
    engine: ENGINE_BY_TASK[mode],
    task: mode === 'v2v' ? 'video.v2v' : 'video.i2v',
    requestId,
    prompt,
    negativePrompt,
    metadata,
    comfyui: {
      workflowId: workflow.id || workflow.workflowId || `wan-2.1-${mode}-v1`,
      workflowVersion: workflow.version || workflow.workflowVersion || '1',
      graph: workflow.graph || null,
      inputBindings: {
        positive_prompt: 'prompt.positive',
        negative_prompt: 'prompt.negative',
        base_video_url: 'conditioning.base_video_url',
        cast: 'identity.actors',
        camera: 'camera',
        action: 'action',
        frames: 'output.frames',
        fps: 'output.fps',
      },
    },
  })

  return {
    ...spec,
    production_mode: mode,
    conditioning: {
      base_video_url: mode === 'v2v' ? text(baseVideoUrl) : null,
      source_image_url: mode === 'i2v' ? actors.find((item) => item.primary_reference_url)?.primary_reference_url || null : null,
    },
    identity: {
      source: 'approved_mapping_vault',
      actors,
      strict: true,
    },
    camera: {
      shot: nullableText(camera?.shot),
      angle: nullableText(camera?.angle),
      movement: nullableText(camera?.movement),
    },
    action: {
      label: nullableText(action?.label),
      technical_prompt: nullableText(action?.technicalPrompt || action?.technical_prompt),
    },
    sampling: {
      steps: positiveNumber(generation?.steps, 30, { min: 1, max: 150 }),
      guidance_scale: positiveNumber(generation?.guidanceScale || generation?.guidance_scale, 5, { min: 0, max: 30 }),
      seed: generation?.seed ?? null,
    },
    output: {
      format: 'mp4',
      width: positiveNumber(generation?.width, 832, { min: 256, max: 4096 }),
      height: positiveNumber(generation?.height, 480, { min: 256, max: 4096 }),
      fps: positiveNumber(generation?.fps, 16, { min: 1, max: 60 }),
      frames: positiveNumber(generation?.frames, mode === 'v2v' ? 81 : 49, { min: 8, max: 1200 }),
      private_storage: true,
      initial_status: 'qa_pending',
    },
  }
}
