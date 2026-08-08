import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { insertAdminAuditAdaptive } from './admin-audit-adaptive.service.js'

const COMBINATIONS_TABLE = 'media_combinations'
const COMPANIONS_TABLE = 'companions'

const SPRINT = '6.3N'
const NARRATIVE_TYPES = ['live_audio', 'live_action']

const TYPE_LABELS = {
  live_audio: 'Audio Live',
  live_action: 'Live Action',
}

const CLIENT_CARD_LABELS = {
  live_audio: 'Card de áudio narrativo ao lado do chat',
  live_action: 'Card de cena/Live Action ao lado do chat ou feed, conforme curadoria',
}

function nowIso() {
  return new Date().toISOString()
}

function boolEnv(name) {
  return String(process.env[name] || '').toLowerCase() === 'true'
}

function slugify(value, fallback = 'narrative-product') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function getMissingColumn(error) {
  const message = error?.message || ''
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || null
}

function cleanPayload(payload) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined))
}

async function insertAdaptive(table, payload, label) {
  const currentPayload = cleanPayload(payload)
  const removedColumns = []

  while (Object.keys(currentPayload).length > 0) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .insert(currentPayload)
      .select('*')
      .single()

    if (!error) {
      return { data, removedColumns }
    }

    const missingColumn = getMissingColumn(error)

    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    throw new ApiError(500, `Erro ao inserir ${label}.`, {
      table,
      error: error.message || String(error),
      code: error.code || null,
      removedColumns,
    })
  }

  throw new ApiError(500, `Payload de ${label} ficou vazio antes da inserção.`, { table, removedColumns })
}

async function insertNarrativeCombinationWithFallback(payload, contentType) {
  const attempts = contentType === 'live_audio'
    ? ['live_audio', 'audio', undefined]
    : ['live_action', 'video', undefined]

  const errors = []

  for (const mediaType of attempts) {
    const currentPayload = { ...payload }
    if (mediaType) currentPayload.media_type = mediaType
    else delete currentPayload.media_type

    try {
      const result = await insertAdaptive(COMBINATIONS_TABLE, currentPayload, `produto narrativo ${contentType}`)
      return {
        ...result,
        acceptedMediaType: mediaType || null,
      }
    } catch (error) {
      const message = String(error?.message || '')
      const details = error?.details || {}
      const retryable = message.includes('media_type') || String(details?.error || '').includes('media_type')
      errors.push({ mediaType: mediaType || null, error: message })
      if (retryable) continue
      throw error
    }
  }

  throw new ApiError(500, `Nenhum media_type foi aceito para produto narrativo ${contentType}.`, { attempts: errors })
}

function validateNarrativeType(contentType) {
  if (!NARRATIVE_TYPES.includes(contentType)) {
    throw new ApiError(400, 'O Estúdio Narrativo só aceita Audio Live e Live Action.', {
      contentType,
      allowed: NARRATIVE_TYPES,
    })
  }
}

function buildNarrativePrompt(input, companion = {}) {
  const avatarName = companion?.name || companion?.slug || 'avatar'
  const parts = [
    `Produto narrativo para ${avatarName}`,
    `Tipo: ${TYPE_LABELS[input.contentType] || input.contentType}`,
    input.event ? `Evento: ${input.event}` : null,
    input.mood ? `Humor: ${input.mood}` : null,
    input.location ? `Local: ${input.location}` : null,
    input.narrativeIntent ? `Intenção narrativa: ${input.narrativeIntent}` : null,
    input.voiceStyle ? `Voz/estilo: ${input.voiceStyle}` : null,
    input.visualStyle && input.contentType === 'live_action' ? `Estilo visual: ${input.visualStyle}` : null,
    `Duração desejada: ${input.durationSeconds} segundos`,
    input.manualPrompt ? `Direção manual do Admin: ${input.manualPrompt}` : null,
  ].filter(Boolean)

  return parts.join('\n')
}

function buildClientCard(input) {
  return {
    title: input.publicTitle,
    description: input.publicDescription || '',
    durationSeconds: input.durationSeconds,
    priceCredits: input.priceCredits,
    contentType: input.contentType,
    contentTypeLabel: TYPE_LABELS[input.contentType] || input.contentType,
    placement: input.publishDestination,
    cardKind: input.contentType === 'live_audio' ? 'audio_live_card' : 'live_action_card',
    lockedBeforePurchase: true,
    mediaVisibleBeforePurchase: false,
    showGenerateButtonBeforePurchase: false,
    ctaLabel: input.priceCredits > 0 ? 'Comprar' : 'Liberar',
    friendlyProcessingMessage: input.contentType === 'live_audio'
      ? '{avatarName} está preparando esse áudio para você...'
      : '{avatarName} está preparando esse momento para você...',
  }
}

function buildSafety() {
  return {
    runPodCalledByThisService: false,
    r2RealUploadByThisService: false,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    databaseMutationExecutedByThisService: false,
  }
}

async function getCompanionIfPossible(companionId) {
  if (!companionId) return null

  const { data, error } = await supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('id, name, slug, avatar_url, thumbnail_url, atriz_id, actress_id')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    return {
      id: companionId,
      name: null,
      slug: null,
      lookupWarning: error.message || String(error),
    }
  }

  return data || { id: companionId, name: null, slug: null, lookupWarning: 'companion_not_found_in_safe_preview' }
}

export function getNarrativeStudioSpec() {
  return {
    sprint: SPRINT,
    status: 'NARRATIVE_STUDIO_SPEC_READY',
    name: 'Estúdio Narrativo Admin',
    purpose: 'Produzir Audio Live e Live Action como produtos narrativos pré-gerados e compráveis, sem misturar com áudio do chat, imagem dinâmica ou vídeo curto por quadradinhos.',
    contentTypes: [
      {
        value: 'live_audio',
        label: 'Audio Live',
        description: 'Áudio pré-gerado, narrativo, com título de vitrine e compra protegida ao lado do chat.',
        clientCard: CLIENT_CARD_LABELS.live_audio,
      },
      {
        value: 'live_action',
        label: 'Live Action',
        description: 'Cena/vídeo narrativo pré-produzido, com título de vitrine e compra protegida.',
        clientCard: CLIENT_CARD_LABELS.live_action,
      },
    ],
    adminFields: [
      'avatar',
      'tipo de produto',
      'título público',
      'descrição curta',
      'evento/situação',
      'humor',
      'local',
      'intenção narrativa',
      'prompt/roteiro manual',
      'voz/estilo',
      'estilo visual quando Live Action',
      'duração desejada',
      'preço em créditos',
      'destino de publicação',
      'QA obrigatório',
    ],
    rules: {
      separatedFromChatAudio: true,
      separatedFromDynamicImageVideoPrompts: true,
      clientSeesCardNotPrompt: true,
      clientMediaVisibleOnlyAfterPurchase: true,
      adminCanDraftBeforeGenerating: true,
      actorReadOnlyAfterApproval: true,
      qaBeforePublication: true,
    },
    safety: buildSafety(),
  }
}

export async function previewNarrativeProduct(input) {
  validateNarrativeType(input.contentType)
  const companion = await getCompanionIfPossible(input.companionId)
  const prompt = buildNarrativePrompt(input, companion)
  const clientCard = buildClientCard(input)
  const avatarName = companion?.name || companion?.slug || 'Avatar'

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_PRODUCT_PREVIEW_READY',
    dryRun: true,
    companion: {
      id: companion?.id || input.companionId,
      name: companion?.name || null,
      slug: companion?.slug || null,
      lookupWarning: companion?.lookupWarning || null,
    },
    product: {
      contentType: input.contentType,
      contentTypeLabel: TYPE_LABELS[input.contentType] || input.contentType,
      publicTitle: input.publicTitle,
      publicDescription: input.publicDescription || '',
      durationSeconds: input.durationSeconds,
      priceCredits: input.priceCredits,
      publishDestination: input.publishDestination,
      isFreePreview: input.isFreePreview,
      isExclusiveForSale: input.isExclusiveForSale,
      qaRequired: input.qaRequired,
      clientCard: {
        ...clientCard,
        friendlyProcessingMessage: clientCard.friendlyProcessingMessage.replace('{avatarName}', avatarName || 'A avatar'),
      },
    },
    narrative: {
      event: input.event || '',
      mood: input.mood || '',
      location: input.location || '',
      narrativeIntent: input.narrativeIntent || '',
      manualPromptPresent: Boolean(input.manualPrompt),
      voiceStyle: input.voiceStyle || '',
      visualStyle: input.visualStyle || '',
      internalPromptPreview: prompt,
      internalPromptVisibleToClient: false,
    },
    nextSteps: [
      'Salvar rascunho narrativo no Admin.',
      'Enviar para o worker específico de Audio Live ou Live Action em sprint futuro.',
      'Submeter a QA.',
      'Publicar como card comprável, sem liberar a mídia antes da compra.',
    ],
    safety: buildSafety(),
  }
}

function buildCombinationPayload(input, preview, actorProfileId = null) {
  const now = nowIso()
  const companion = preview.companion || {}
  const publicTitle = input.publicTitle
  const prompt = preview.narrative.internalPromptPreview
  const clientCard = preview.product.clientCard

  const metadata = {
    source: 'admin_narrative_studio',
    sprint: SPRINT,
    status: 'draft',
    createdBy: actorProfileId,
    companionId: input.companionId,
    contentType: input.contentType,
    contentTypeLabel: TYPE_LABELS[input.contentType] || input.contentType,
    narrative: {
      event: input.event || '',
      mood: input.mood || '',
      location: input.location || '',
      narrativeIntent: input.narrativeIntent || '',
      manualPrompt: input.manualPrompt || '',
      voiceStyle: input.voiceStyle || '',
      visualStyle: input.visualStyle || '',
      durationSeconds: input.durationSeconds,
    },
    publication: {
      status: 'draft',
      adminVisible: true,
      actorVisible: false,
      clientCardVisible: false,
      clientMediaVisibleBeforePurchase: false,
      destination: input.publishDestination,
      isFreePreview: input.isFreePreview,
      isExclusiveForSale: input.isExclusiveForSale,
      qaRequired: input.qaRequired,
    },
    clientCard,
    promptInternalOnly: true,
    generatedAt: now,
  }

  return {
    companion_id: input.companionId,
    atriz_id: companion.atriz_id || undefined,
    actress_id: companion.actress_id || companion.atriz_id || undefined,
    combination_key: `${input.contentType}:${input.companionId}:narrative:${Date.now()}`,
    name: publicTitle,
    title: publicTitle,
    label: publicTitle,
    slug: slugify(`${companion.slug || companion.name || 'avatar'}-${input.contentType}-${publicTitle}`),
    status: 'draft',
    is_active: false,
    active: false,
    visible_to_client: false,
    admin_only: true,
    price_credits: input.priceCredits,
    prompt,
    prompt_template: prompt,
    prompt_final: prompt,
    guided_selections: [],
    display_payload: {
      source: 'narrative_studio',
      publicTitle: input.publicTitle,
      publicDescription: input.publicDescription || '',
      clientCard,
    },
    config: {
      source: 'narrative_studio',
      contentType: input.contentType,
      mediaKind: input.contentType,
      narrativeProduct: true,
    },
    metadata,
    created_at: now,
    updated_at: now,
  }
}

export async function createNarrativeProductDraft(input, { actorProfileId = null } = {}) {
  validateNarrativeType(input.contentType)

  const preview = await previewNarrativeProduct(input)
  const requestedMutation = boolEnv('RUN_6_3N3_NARRATIVE_DRAFT_MUTATION') || boolEnv('RUN_6_3N_NARRATIVE_STUDIO_MUTATION')
  const mutationAllowed = boolEnv('ALLOW_6_3N3_NARRATIVE_DRAFT_CREATE') || boolEnv('ALLOW_6_3N_NARRATIVE_DRAFT_CREATE')
  const confirmationPhrase = String(process.env.NARRATIVE_STUDIO_6_3N3_CONFIRMATION_PHRASE || process.env.NARRATIVE_STUDIO_6_3N_CONFIRMATION_PHRASE || '')
  const confirmationOk = confirmationPhrase === 'CRIAR RASCUNHO NARRATIVO 6.3N3' || confirmationPhrase === 'CRIAR RASCUNHO NARRATIVO 6.3N'
  const dryRunOnly = input.dryRunOnly !== false

  if (dryRunOnly || !requestedMutation || !mutationAllowed || !confirmationOk) {
    return {
      sprint: SPRINT,
      status: 'NARRATIVE_DRAFT_BLOCKED_BY_GUARD',
      dryRun: true,
      requestedApply: !dryRunOnly,
      blockers: [
        ...(dryRunOnly ? ['dry_run_only'] : []),
        ...(!requestedMutation ? ['mutation_env_not_requested'] : []),
        ...(!mutationAllowed ? ['mutation_env_not_allowed'] : []),
        ...(!confirmationOk ? ['confirmation_phrase_missing_or_invalid'] : []),
      ],
      preview,
      safety: buildSafety(),
    }
  }

  const payload = buildCombinationPayload(input, preview, actorProfileId)
  const inserted = await insertNarrativeCombinationWithFallback(payload, input.contentType)
  const audit = await insertAdminAuditAdaptive({
    profileId: actorProfileId,
    action: 'narrative_studio.draft.create',
    entityType: 'media_combination',
    entityId: inserted.data?.id || null,
    message: `Rascunho narrativo ${TYPE_LABELS[input.contentType]} criado pelo Estúdio Narrativo 6.3N.`,
    sprint: SPRINT,
    metadata: {
      contentType: input.contentType,
      publicTitle: input.publicTitle,
      priceCredits: input.priceCredits,
      companionId: input.companionId,
      acceptedMediaType: inserted.acceptedMediaType,
      removedColumns: inserted.removedColumns,
    },
  })

  return {
    sprint: SPRINT,
    status: 'NARRATIVE_DRAFT_CREATED_CONTROLLED',
    dryRun: false,
    requestedApply: true,
    mutationEnvAllowed: true,
    confirmationOk: true,
    draft: {
      id: inserted.data?.id || null,
      title: inserted.data?.title || inserted.data?.name || input.publicTitle,
      contentType: input.contentType,
      acceptedMediaType: inserted.acceptedMediaType,
      priceCredits: input.priceCredits,
      visibleToClient: inserted.data?.visible_to_client ?? false,
      adminOnly: inserted.data?.admin_only ?? true,
      status: inserted.data?.status || 'draft',
      removedColumns: inserted.removedColumns,
    },
    audit,
    safety: {
      ...buildSafety(),
      databaseMutationExecutedByThisService: true,
    },
  }
}


function asObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

function normalizeNarrativeContentType(row = {}) {
  const metadata = asObject(row.metadata)
  const config = asObject(row.config)
  const raw = metadata.contentType || config.contentType || config.mediaKind || row.media_type || row.content_type || ''
  const normalized = String(raw || '').toLowerCase()

  if (normalized === 'live_audio' || normalized === 'audio_live' || normalized === 'audio') return 'live_audio'
  if (normalized === 'live_action' || normalized === 'video_live' || normalized === 'video') return 'live_action'

  return null
}

function isNarrativeStudioRow(row = {}) {
  const metadata = asObject(row.metadata)
  const config = asObject(row.config)
  const displayPayload = asObject(row.display_payload)

  return (
    metadata.source === 'admin_narrative_studio' ||
    config.source === 'narrative_studio' ||
    displayPayload.source === 'narrative_studio' ||
    Boolean(metadata.narrative) ||
    Boolean(config.narrativeProduct)
  )
}

function normalizeNarrativeDraft(row = {}) {
  const metadata = asObject(row.metadata)
  const displayPayload = asObject(row.display_payload)
  const publication = asObject(metadata.publication)
  const clientCard = asObject(metadata.clientCard || displayPayload.clientCard)
  const contentType = normalizeNarrativeContentType(row)
  const title = row.title || row.name || row.label || displayPayload.publicTitle || clientCard.title || 'Produto narrativo'

  return {
    id: row.id,
    title,
    publicTitle: displayPayload.publicTitle || clientCard.title || title,
    publicDescription: displayPayload.publicDescription || clientCard.description || '',
    contentType,
    contentTypeLabel: TYPE_LABELS[contentType] || contentType || 'Narrativo',
    companionId: row.companion_id || metadata.companionId || null,
    actressId: row.actress_id || row.atriz_id || null,
    status: row.status || metadata.status || publication.status || 'draft',
    publicationStatus: publication.status || row.status || 'draft',
    priceCredits: Number(row.price_credits ?? clientCard.priceCredits ?? 0),
    durationSeconds: Number(clientCard.durationSeconds ?? metadata.narrative?.durationSeconds ?? 0),
    publishDestination: publication.destination || clientCard.placement || 'admin_only',
    visibleToClient: Boolean(row.visible_to_client),
    adminOnly: row.admin_only !== false,
    isActive: Boolean(row.is_active || row.active),
    actorVisible: Boolean(publication.actorVisible),
    clientCardVisible: Boolean(publication.clientCardVisible),
    clientMediaVisibleBeforePurchase: Boolean(publication.clientMediaVisibleBeforePurchase),
    internalPromptVisibleToClient: false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || row.created_at || null,
  }
}

async function fetchNarrativeRows(limit = 50) {
  const safeLimit = Math.min(Math.max(Number(limit || 50), 1), 200)

  const attempts = [
    async () => supabaseAdmin.from(COMBINATIONS_TABLE).select('*').order('updated_at', { ascending: false }).limit(safeLimit),
    async () => supabaseAdmin.from(COMBINATIONS_TABLE).select('*').order('created_at', { ascending: false }).limit(safeLimit),
    async () => supabaseAdmin.from(COMBINATIONS_TABLE).select('*').limit(safeLimit),
  ]

  const errors = []

  for (const attempt of attempts) {
    const { data, error } = await attempt()
    if (!error) return { rows: data || [], errors }
    errors.push({ message: error.message || String(error), code: error.code || null })
  }

  return { rows: [], errors }
}

export async function listNarrativeProductDrafts(filters = {}) {
  const { rows, errors } = await fetchNarrativeRows(filters.limit || 50)
  const companionId = filters.companionId || null
  const contentType = filters.contentType ? String(filters.contentType) : null
  const status = filters.status ? String(filters.status) : null

  const items = rows
    .filter(isNarrativeStudioRow)
    .map(normalizeNarrativeDraft)
    .filter((item) => item.contentType)
    .filter((item) => !companionId || item.companionId === companionId)
    .filter((item) => !contentType || item.contentType === contentType)
    .filter((item) => !status || item.status === status || item.publicationStatus === status)
    .slice(0, Math.min(Math.max(Number(filters.limit || 50), 1), 200))

  const byStatus = items.reduce((acc, item) => {
    const key = item.status || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const byType = items.reduce((acc, item) => {
    const key = item.contentType || 'unknown'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return {
    sprint: '6.3N3',
    status: 'NARRATIVE_DRAFTS_READ_MODEL_READY',
    generatedAt: nowIso(),
    filters: {
      limit: Number(filters.limit || 50),
      companionId,
      contentType,
      status,
    },
    total: items.length,
    byStatus,
    byType,
    items,
    warnings: errors.length ? ['fallback_query_used_or_some_query_attempts_failed'] : [],
    queryAttempts: errors,
    safety: buildSafety(),
  }
}

export async function inspectNarrativeDraftsReadiness() {
  const drafts = await listNarrativeProductDrafts({ limit: 50 })

  return {
    sprint: '6.3N3',
    status: 'NARRATIVE_DRAFTS_READY',
    checkedAt: nowIso(),
    rules: {
      adminCanCreateGuardedDraft: true,
      adminCanListNarrativeDrafts: true,
      clientStillSeesCardNotInternalPrompt: true,
      realGenerationStillDisabledByThisSprint: true,
      draftDoesNotCreateDeliveryOrCharge: true,
    },
    drafts: {
      total: drafts.total,
      byStatus: drafts.byStatus,
      byType: drafts.byType,
      sample: drafts.items.slice(0, 5),
    },
    blockers: [],
    warnings: drafts.warnings,
    safety: buildSafety(),
  }
}

export async function inspectNarrativeStudioReadiness() {
  return {
    sprint: SPRINT,
    status: 'NARRATIVE_STUDIO_READY',
    spec: getNarrativeStudioSpec(),
    checks: [
      { key: 'audio_live_separated_from_chat_audio', ok: true },
      { key: 'live_action_separated_from_short_video', ok: true },
      { key: 'admin_has_manual_prompt_fields', ok: true },
      { key: 'client_card_does_not_expose_internal_prompt', ok: true },
      { key: 'draft_creation_guarded_by_env_and_phrase', ok: true },
      { key: 'no_runpod_r2_payment_wallet_in_this_sprint', ok: true },
    ],
    safety: buildSafety(),
  }
}
