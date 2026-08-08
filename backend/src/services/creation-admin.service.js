import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { CONTENT_TYPES } from '../validators/creation-admin.schemas.js'
import { addImageItemJob } from '../queues/image.queue.js'
import { assertAvatarCompliantForProduction } from './actor-compliance.service.js'
import {
  assertApprovedActorIdentityForProduction,
  assertApprovedIdentityAdapterForCompanionVideoProduction,
  requiresApprovedIdentityLora,
} from './actor-identity-lora.service.js'

const TITLES_TABLE = 'prompt_dimensions'
const ITEMS_TABLE = 'prompt_options'
const AVATAR_OPTIONS_TABLE = 'companion_creation_options'
const COMBINATIONS_TABLE = 'media_combinations'
const COMPANIONS_TABLE = 'companions'
const BATCHES_TABLE = 'media_generation_batches'
const BATCH_ITEMS_TABLE = 'media_generation_batch_items'

const CONTENT_TYPE_LABELS = {
  image: 'Imagem',
  video: 'Vídeo',
  short_video: 'Vídeo curto',
  live_action: 'Live Action',
  audio: 'Áudio',
  live_audio: 'Áudio Live',
}

function nowIso() {
  return new Date().toISOString()
}

function normalizeContentTypes(values = []) {
  return [...new Set((values || []).filter((value) => CONTENT_TYPES.includes(value)))]
}

function slugify(value, fallback = 'item') {
  const normalized = String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || fallback
}

function mapTitleRow(row, items = []) {
  const contentTypes = normalizeContentTypes(row.content_types || row.contentTypes || row.metadata?.contentTypes || [])

  return {
    id: row.id,
    code: row.code || row.metadata?.slug || null,
    name: row.name || row.display_name || row.label || row.title || 'Título sem nome',
    displayName: row.display_name || row.name || row.label || row.title || 'Título sem nome',
    description: row.description || row.metadata?.description || '',
    contentTypes,
    contentTypeLabels: contentTypes.map((type) => CONTENT_TYPE_LABELS[type] || type),
    visibleToClient: row.visible_to_client ?? row.visibleToClient ?? true,
    adminOnly: row.admin_only ?? row.adminOnly ?? false,
    isActive: row.is_active ?? row.isActive ?? true,
    sortOrder: Number(row.sort_order || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
    items,
  }
}

function mapItemRow(row) {
  const contentTypes = normalizeContentTypes(row.content_types || row.contentTypes || row.metadata?.contentTypes || [])

  return {
    id: row.id,
    code: row.code || row.metadata?.slug || null,
    titleId: row.dimension_id || row.title_id || row.prompt_dimension_id || null,
    name: row.name || row.display_name || row.label || row.title || 'Item sem nome',
    displayName: row.display_name || row.name || row.label || row.title || 'Item sem nome',
    description: row.description || row.metadata?.description || '',
    contentTypes,
    contentTypeLabels: contentTypes.map((type) => CONTENT_TYPE_LABELS[type] || type),
    visibleToClient: row.visible_to_client ?? row.visibleToClient ?? true,
    adminOnly: row.admin_only ?? row.adminOnly ?? false,
    isActive: row.is_active ?? row.isActive ?? true,
    technicalSnippet: row.technical_snippet || row.metadata?.technicalSnippet || '',
    negativePrompt: row.negative_prompt || row.metadata?.negativePrompt || '',
    sortOrder: Number(row.sort_order || 0),
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapCompanion(row) {
  return {
    id: row.id,
    name: row.name || row.slug || 'Avatar sem nome',
    slug: row.slug || null,
    avatarUrl: row.avatar_url || null,
    thumbnailUrl: row.thumbnail_url || null,
    isActive: row.is_active ?? true,
  }
}

function mapCombinationRow(row) {
  return {
    id: row.id,
    key: row.combination_key || null,
    title: row.title || null,
    mediaType: row.media_type || row.content_type || null,
    companionId: row.companion_id || null,
    priceCredits: Number(row.price_credits || 0),
    visibleToClient: row.visible_to_client ?? true,
    adminOnly: row.admin_only ?? false,
    isActive: row.is_active ?? true,
    guidedSelections: row.guided_selections || row.metadata?.guidedSelections || {},
    metadata: row.metadata || {},
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

async function assertTableAvailable(table) {
  const { error } = await supabaseAdmin
    .from(table)
    .select('id')
    .limit(1)

  if (error) {
    throw new ApiError(500, `Tabela ${table} indisponível. Execute o SQL do Sprint 5.5 antes de usar a Fábrica Guiada.`, {
      table,
      error: error.message,
    })
  }
}

export function listContentTypes() {
  return CONTENT_TYPES.map((value) => ({
    value,
    label: CONTENT_TYPE_LABELS[value] || value,
  }))
}

export async function listCreationTitles({ contentType = null, includeInactive = false } = {}) {
  await assertTableAvailable(TITLES_TABLE)

  let titlesQuery = supabaseAdmin
    .from(TITLES_TABLE)
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (!includeInactive) titlesQuery = titlesQuery.eq('is_active', true)
  if (contentType) titlesQuery = titlesQuery.contains('content_types', [contentType])

  const { data: titles, error: titlesError } = await titlesQuery

  if (titlesError) {
    throw new ApiError(500, 'Erro ao listar títulos de criação.', titlesError)
  }

  const titleIds = (titles || []).map((title) => title.id)
  let items = []

  if (titleIds.length > 0) {
    let itemsQuery = supabaseAdmin
      .from(ITEMS_TABLE)
      .select('*')
      .in('dimension_id', titleIds)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })

    if (!includeInactive) itemsQuery = itemsQuery.eq('is_active', true)

    const { data, error } = await itemsQuery

    if (error) {
      throw new ApiError(500, 'Erro ao listar itens de criação.', error)
    }

    items = data || []
  }

  const itemsByTitleId = new Map()
  for (const item of items) {
    const key = item.dimension_id
    const current = itemsByTitleId.get(key) || []
    current.push(mapItemRow(item))
    itemsByTitleId.set(key, current)
  }

  return {
    contentTypes: listContentTypes(),
    items: (titles || []).map((title) => mapTitleRow(title, itemsByTitleId.get(title.id) || [])),
  }
}

export async function createCreationTitle(input, { actorProfileId = null } = {}) {
  await assertTableAvailable(TITLES_TABLE)

  const now = nowIso()
  const payload = {
    code: slugify(input.name, 'titulo'),
    name: input.name,
    display_name: input.name,
    label: input.name,
    description: input.description || '',
    content_types: normalizeContentTypes(input.contentTypes),
    visible_to_client: input.visibleToClient,
    admin_only: input.adminOnly,
    is_active: true,
    sort_order: input.sortOrder || 0,
    metadata: {
      ...(input.metadata || {}),
      createdBy: actorProfileId,
      source: 'admin_guided_factory',
    },
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(TITLES_TABLE)
    .insert(payload)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao criar título de criação.', error)
  }

  return mapTitleRow(data, [])
}

export async function updateCreationTitle(titleId, input, { actorProfileId = null } = {}) {
  await assertTableAvailable(TITLES_TABLE)

  const payload = {
    ...(input.name ? { code: slugify(input.name, 'titulo'), name: input.name, display_name: input.name, label: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || '' } : {}),
    ...(input.contentTypes ? { content_types: normalizeContentTypes(input.contentTypes) } : {}),
    ...(input.visibleToClient !== undefined ? { visible_to_client: input.visibleToClient } : {}),
    ...(input.adminOnly !== undefined ? { admin_only: input.adminOnly } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    ...(input.metadata ? { metadata: { ...input.metadata, updatedBy: actorProfileId } } : {}),
    updated_at: nowIso(),
  }

  const { data, error } = await supabaseAdmin
    .from(TITLES_TABLE)
    .update(payload)
    .eq('id', titleId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar título de criação.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Título de criação não encontrado.')
  }

  return mapTitleRow(data, [])
}

export async function createCreationItems(titleId, input, { actorProfileId = null } = {}) {
  await assertTableAvailable(ITEMS_TABLE)

  const { data: title, error: titleError } = await supabaseAdmin
    .from(TITLES_TABLE)
    .select('*')
    .eq('id', titleId)
    .maybeSingle()

  if (titleError) {
    throw new ApiError(500, 'Erro ao validar título para criação de itens.', titleError)
  }

  if (!title) {
    throw new ApiError(404, 'Título de criação não encontrado.')
  }

  const now = nowIso()
  const titleContentTypes = normalizeContentTypes(title.content_types || [])
  const payload = input.items.map((item, index) => ({
    dimension_id: titleId,
    code: `${slugify(title.code || title.name, 'titulo')}-${slugify(item.name, 'item')}`,
    name: item.name,
    display_name: item.name,
    label: item.name,
    description: item.description || '',
    content_types: normalizeContentTypes(item.contentTypes || titleContentTypes),
    visible_to_client: item.visibleToClient,
    admin_only: item.adminOnly,
    is_active: true,
    technical_snippet: item.technicalSnippet || '',
    negative_prompt: item.negativePrompt || '',
    sort_order: item.sortOrder || index,
    metadata: {
      ...(item.metadata || {}),
      createdBy: actorProfileId,
      source: 'admin_guided_factory',
      slug: slugify(item.name),
    },
    created_at: now,
    updated_at: now,
  }))

  const { data, error } = await supabaseAdmin
    .from(ITEMS_TABLE)
    .insert(payload)
    .select('*')

  if (error) {
    throw new ApiError(500, 'Erro ao criar itens de criação.', error)
  }

  return {
    items: (data || []).map(mapItemRow),
  }
}

export async function updateCreationItem(itemId, input, { actorProfileId = null } = {}) {
  await assertTableAvailable(ITEMS_TABLE)

  const payload = {
    ...(input.name ? { code: slugify(input.name, 'item'), name: input.name, display_name: input.name, label: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description || '' } : {}),
    ...(input.contentTypes ? { content_types: normalizeContentTypes(input.contentTypes) } : {}),
    ...(input.visibleToClient !== undefined ? { visible_to_client: input.visibleToClient } : {}),
    ...(input.adminOnly !== undefined ? { admin_only: input.adminOnly } : {}),
    ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
    ...(input.technicalSnippet !== undefined ? { technical_snippet: input.technicalSnippet || '' } : {}),
    ...(input.negativePrompt !== undefined ? { negative_prompt: input.negativePrompt || '' } : {}),
    ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
    ...(input.metadata ? { metadata: { ...input.metadata, updatedBy: actorProfileId } } : {}),
    updated_at: nowIso(),
  }

  const { data, error } = await supabaseAdmin
    .from(ITEMS_TABLE)
    .update(payload)
    .eq('id', itemId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar item de criação.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Item de criação não encontrado.')
  }

  return mapItemRow(data)
}

export async function listCreationAvatars({ includeInactive = false } = {}) {
  let query = supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('id, name, slug, avatar_url, thumbnail_url, is_active, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar avatares.', error)
  }

  return {
    items: (data || []).map(mapCompanion),
  }
}

export async function getAvatarCreationOptions(companionId) {
  await assertTableAvailable(AVATAR_OPTIONS_TABLE)

  const [titlesResult, companionResult, optionsResult] = await Promise.all([
    listCreationTitles({ includeInactive: false }),
    supabaseAdmin
      .from(COMPANIONS_TABLE)
      .select('id, name, slug, avatar_url, thumbnail_url, is_active')
      .eq('id', companionId)
      .maybeSingle(),
    supabaseAdmin
      .from(AVATAR_OPTIONS_TABLE)
      .select('*')
      .eq('companion_id', companionId),
  ])

  if (companionResult.error) {
    throw new ApiError(500, 'Erro ao validar avatar.', companionResult.error)
  }

  if (!companionResult.data) {
    throw new ApiError(404, 'Avatar não encontrado.')
  }

  if (optionsResult.error) {
    throw new ApiError(500, 'Erro ao carregar opções do avatar.', optionsResult.error)
  }

  const rows = optionsResult.data || []
  const enabledContentTypes = normalizeContentTypes(rows.filter((row) => row.content_type).map((row) => row.content_type))
  const enabledItemIds = rows.filter((row) => row.option_id && row.is_enabled !== false).map((row) => row.option_id)
  const visibleToClientItemIds = rows.filter((row) => row.option_id && row.visible_to_client === true).map((row) => row.option_id)

  return {
    companion: mapCompanion(companionResult.data),
    enabledContentTypes,
    enabledItemIds,
    visibleToClientItemIds,
    titles: titlesResult.items,
  }
}

export async function saveAvatarCreationOptions(companionId, input, { actorProfileId = null } = {}) {
  await assertTableAvailable(AVATAR_OPTIONS_TABLE)

  const now = nowIso()
  const rows = []

  for (const type of normalizeContentTypes(input.enabledContentTypes || [])) {
    rows.push({
      companion_id: companionId,
      dimension_id: null,
      option_id: null,
      content_type: type,
      is_enabled: true,
      visible_to_client: false,
      metadata: { source: 'content_type_toggle', updatedBy: actorProfileId },
      created_at: now,
      updated_at: now,
    })
  }

  for (const optionId of input.enabledItemIds || []) {
    rows.push({
      companion_id: companionId,
      dimension_id: null,
      option_id: optionId,
      content_type: null,
      is_enabled: true,
      visible_to_client: (input.visibleToClientItemIds || []).includes(optionId),
      metadata: { source: 'option_toggle', updatedBy: actorProfileId },
      created_at: now,
      updated_at: now,
    })
  }

  const { error: deleteError } = await supabaseAdmin
    .from(AVATAR_OPTIONS_TABLE)
    .delete()
    .eq('companion_id', companionId)

  if (deleteError) {
    throw new ApiError(500, 'Erro ao limpar opções anteriores do avatar.', deleteError)
  }

  if (rows.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from(AVATAR_OPTIONS_TABLE)
      .insert(rows)

    if (insertError) {
      throw new ApiError(500, 'Erro ao salvar opções do avatar.', insertError)
    }
  }

  return getAvatarCreationOptions(companionId)
}

function cartesian(groups = []) {
  if (groups.length === 0) return []

  return groups.reduce((acc, group) => {
    const previous = acc.length > 0 ? acc : [[]]
    return previous.flatMap((combo) => group.items.map((item) => [...combo, { title: group.title, item }]))
  }, [])
}

export async function previewGuidedCombinations(input) {
  const titlesResult = await listCreationTitles({ contentType: input.contentType })
  const selectedGroups = []

  for (const title of titlesResult.items) {
    const selectedIds = input.selections[title.id] || []
    const items = title.items.filter((item) => selectedIds.includes(item.id))

    if (items.length > 0) {
      selectedGroups.push({ title, items })
    }
  }

  const combinations = cartesian(selectedGroups)

  return {
    companionId: input.companionId,
    contentType: input.contentType,
    contentTypeLabel: CONTENT_TYPE_LABELS[input.contentType] || input.contentType,
    groups: selectedGroups.map((group) => ({
      title: {
        id: group.title.id,
        name: group.title.name,
      },
      items: group.items.map((item) => ({ id: item.id, name: item.name })),
    })),
    total: combinations.length,
    preview: combinations.slice(0, 30).map((combo, index) => ({
      index: index + 1,
      label: combo.map((entry) => `${entry.title.name}: ${entry.item.name}`).join(' • '),
      selections: combo.map((entry) => ({
        titleId: entry.title.id,
        titleName: entry.title.name,
        itemId: entry.item.id,
        itemName: entry.item.name,
      })),
    })),
    limited: combinations.length > 30,
  }
}


function getMissingColumn(error) {
  const message = error?.message || ''
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || null
}

function cleanPayload(payload) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined))
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
      if (removedColumns.length > 0) {
        console.warn(`[guided-factory] ${label}: colunas ignoradas por não existirem no schema: ${removedColumns.join(', ')}`)
      }

      return data
    }

    const missingColumn = getMissingColumn(error)

    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    throw new ApiError(500, `Erro ao inserir ${label}.`, {
      table,
      error: error.message,
      code: error.code || null,
    })
  }

  throw new ApiError(500, `Payload de ${label} ficou vazio antes da inserção.`)
}

function mediaTypeCandidatesForContentType(contentType) {
  const candidatesByType = {
    image: ['image', 'imagem', 'photo', 'foto'],
    video: ['video'],
    short_video: ['short_video', 'video'],
    live_action: ['live_action', 'video'],
    audio: ['audio'],
    live_audio: ['live_audio', 'audio'],
  }

  return candidatesByType[contentType] || [contentType]
}

function mediaKindForContentType(contentType) {
  const mediaKindByType = {
    image: 'imagem',
    video: 'video',
    short_video: 'video',
    live_action: 'live_action',
    audio: 'audio',
    live_audio: 'live_audio',
  }

  return mediaKindByType[contentType] || contentType
}

function workerLabelForContentType(contentType) {
  const labels = {
    image: 'worker de imagem',
    video: 'worker de vídeo',
    short_video: 'worker de vídeo curto',
    live_action: 'worker de live action',
    audio: 'worker de TTS/áudio',
    live_audio: 'worker de áudio live/TTS',
  }

  return labels[contentType] || 'worker da fábrica'
}

function shouldUseRealImageWorker(input) {
  return input.contentType === 'image' && input.generateRealMedia !== false && input.dryRunOnly !== true
}

export const M4_1_FACTORY_OPERATION_CONFIRMATION = 'CONFIRMAR FABRICA OPERACIONAL M4.1'

const TRUTHY_FACTORY_VALUES = new Set(['1', 'true', 'yes', 'sim', 'on', 'enabled', 'habilitado'])

function envFlagEnabled(name) {
  return TRUTHY_FACTORY_VALUES.has(String(process.env[name] || '').trim().toLowerCase())
}

function shouldRequireProductionAuthorization(input) {
  return input.generateRealMedia !== false && input.dryRunOnly !== true
}

function shouldEnqueueGuidedProductionJob(input) {
  return input.enqueueJobs === true
    && input.dryRunOnly !== true
    && shouldUseRealImageWorker(input)
    && envFlagEnabled('ALLOW_M4_1_FACTORY_ENQUEUE')
    && String(input.confirmationPhrase || '').trim() === M4_1_FACTORY_OPERATION_CONFIRMATION
}

function buildGuidedProductionSafety(input, queueJobs = []) {
  const queueJobCreated = queueJobs.length > 0

  return {
    runPodCalled: false,
    r2Called: false,
    workerCalledByThisRequest: false,
    paymentExecuted: false,
    walletChanged: false,
    creditLedgerCreated: false,
    deliveryCreated: false,
    galleryItemCreated: false,
    publicationChanged: false,
    availabilityChanged: false,
    publicClientUrlCreated: false,
    destructiveDelete: false,
    clientUiChanged: false,
    schemaChanged: false,
    routeCreated: false,
    queueJobCreated,
    enqueueRequested: input.enqueueJobs === true,
    enqueueAllowed: shouldEnqueueGuidedProductionJob(input),
    safePlanningOnly: !queueJobCreated,
  }
}

async function insertWithMediaTypeFallback(table, basePayload, label, contentType) {
  const attempts = [...mediaTypeCandidatesForContentType(contentType), undefined]
  const errors = []

  for (const mediaType of attempts) {
    const payload = { ...basePayload }

    if (mediaType === undefined) {
      delete payload.media_type
    } else {
      payload.media_type = mediaType
    }

    try {
      return await insertAdaptive(table, payload, `${label} (${mediaType || 'sem media_type'})`)
    } catch (error) {
      const message = String(error?.message || '')
      const details = error?.details || error?.cause || {}
      const retryable = message.includes('media_type') || String(details?.error || '').includes('media_type')
      errors.push(`${mediaType || 'sem media_type'} => ${message}`)

      if (retryable) continue
      throw error
    }
  }

  throw new ApiError(500, `Nenhum media_type foi aceito para ${label}.`, { attempts: errors })
}

async function getCompanionForProduction(companionId) {
  const { data, error } = await supabaseAdmin
    .from(COMPANIONS_TABLE)
    .select('*')
    .eq('id', companionId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar avatar para produção guiada.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Avatar não encontrado para produção guiada.')
  }

  return data
}

function buildCompanionRefs(companion = {}) {
  return {
    companion_id: companion.id,
    atriz_id: companion.atriz_id || undefined,
    actress_id: companion.actress_id || companion.atriz_id || undefined,
  }
}

async function buildGuidedCombinationSource(input) {
  const titlesResult = await listCreationTitles({ contentType: input.contentType })
  const selectedGroups = []

  for (const title of titlesResult.items) {
    const selectedIds = input.selections[title.id] || []
    const items = title.items.filter((item) => selectedIds.includes(item.id))

    if (items.length > 0) {
      selectedGroups.push({ title, items })
    }
  }

  const combinations = cartesian(selectedGroups)

  return {
    selectedGroups,
    combinations,
  }
}

function buildCombinationLabel(combo) {
  return combo.map((entry) => `${entry.title.name}: ${entry.item.name}`).join(' • ')
}

function buildGuidedSelections(combo) {
  return combo.map((entry) => ({
    titleId: entry.title.id,
    titleName: entry.title.name,
    itemId: entry.item.id,
    itemName: entry.item.name,
    technicalSnippet: entry.item.technicalSnippet || entry.item.name,
    negativePrompt: entry.item.negativePrompt || '',
  }))
}

function buildGuidedPrompt({ companion, contentType, combo }) {
  const snippets = combo
    .map((entry) => entry.item.technicalSnippet || entry.item.name)
    .filter(Boolean)

  const companionName = companion?.name || companion?.slug || 'avatar'

  if (contentType === 'audio' || contentType === 'live_audio') {
    return [
      `direção de áudio para ${companionName}`,
      ...snippets,
      'tom natural e coerente com o avatar',
    ].join(', ')
  }

  if (contentType === 'video' || contentType === 'short_video' || contentType === 'live_action') {
    return [
      `direção visual em vídeo para ${companionName}`,
      ...snippets,
      'imagem limpa, qualidade alta, composição profissional',
    ].join(', ')
  }

  return [
    `photorealistic editorial portrait of ${companionName}`,
    ...snippets,
    'solo adult subject',
    'cinematic lighting',
    'professional photography',
    'high detail',
    'non-explicit',
  ].join(', ')
}

function buildNegativePrompt(combo) {
  const negatives = combo
    .map((entry) => entry.item.negativePrompt)
    .filter(Boolean)

  return [
    ...negatives,
    'low quality',
    'blurry',
    'distorted face',
    'bad anatomy',
    'watermark',
    'text',
    'logo',
  ].join(', ')
}

async function insertGuidedMediaCombination({ companion, input, combo, index, actorProfileId, productionAuthorization = null }) {
  const now = nowIso()
  const label = buildCombinationLabel(combo)
  const guidedSelections = buildGuidedSelections(combo)
  const prompt = buildGuidedPrompt({ companion, contentType: input.contentType, combo })
  const negativePrompt = buildNegativePrompt(combo)
  const key = `${input.contentType}:${companion.id}:${Date.now()}:${index + 1}`

  const payload = {
    ...buildCompanionRefs(companion),
    actor_profile_id: productionAuthorization?.snapshot?.actorProfileId,
    avatar_production_authorization_id: productionAuthorization?.snapshot?.id,
    media_origin: productionAuthorization ? 'authorized_actor_production' : undefined,
    finance_snapshot: productionAuthorization?.snapshot?.financeSnapshot,
    combination_key: key,
    name: label,
    title: label,
    label,
    slug: slugify(`${companion.slug || companion.name}-${input.contentType}-${index + 1}`, 'guided-combination'),
    status: 'active',
    is_active: true,
    active: true,
    visible_to_client: false,
    admin_only: true,
    price_credits: 0,
    prompt,
    prompt_template: prompt,
    prompt_final: prompt,
    negative_prompt: negativePrompt,
    guided_selections: guidedSelections,
    config: {
      source: 'guided_factory_production',
      contentType: input.contentType,
      mediaKind: mediaKindForContentType(input.contentType),
    },
    metadata: {
      source: 'guided_factory_production',
      createdBy: actorProfileId,
      companionId: companion.id,
      contentType: input.contentType,
      contentTypeLabel: CONTENT_TYPE_LABELS[input.contentType] || input.contentType,
      mediaKind: mediaKindForContentType(input.contentType),
      workerLabel: workerLabelForContentType(input.contentType),
      guidedSelections,
      productionAuthorization: productionAuthorization?.snapshot || null,
      prompt,
      negativePrompt,
      generatedAt: now,
    },
    created_at: now,
    updated_at: now,
  }

  return insertWithMediaTypeFallback(COMBINATIONS_TABLE, payload, 'combinação guiada de produção', input.contentType)
}

async function insertGuidedBatch({
  companion,
  input,
  totalCombinations,
  totalPhysicalItems,
  actorProfileId,
  productionAuthorization = null,
}) {
  const now = nowIso()
  const refs = buildCompanionRefs(companion)
  const title = `Lote guiado • ${companion.name || companion.slug || 'Avatar'} • ${CONTENT_TYPE_LABELS[input.contentType] || input.contentType}`
  const initialStatus = shouldEnqueueGuidedProductionJob(input) ? 'queued' : 'planned'

  const payload = {
    ...refs,
    profile_id: actorProfileId,
    user_id: actorProfileId,
    actor_profile_id: productionAuthorization?.snapshot?.actorProfileId,
    avatar_production_authorization_id: productionAuthorization?.snapshot?.id,
    media_origin: productionAuthorization ? 'authorized_actor_production' : 'guided_factory_dry_run',
    finance_snapshot: productionAuthorization?.snapshot?.financeSnapshot,
    name: title,
    title,
    label: title,
    status: initialStatus,
    source: 'guided_factory',
    job_origin: 'admin_guided_factory',
    media_type: input.contentType,
    content_type: input.contentType,
    total_items: totalPhysicalItems,
    total_count: totalPhysicalItems,
    queued_items: totalPhysicalItems,
    processing_items: 0,
    qa_pending_items: 0,
    completed_items: 0,
    failed_items: 0,
    generated_count: 0,
    approved_count: 0,
    rejected_count: 0,
    requested_variants: input.requestedVariants || 1,
    metadata: {
      source: 'guided_factory_production',
      canonicalItemModel: 'one_item_one_physical_variant',
      createdBy: actorProfileId,
      companionId: companion.id,
      companionName: companion.name || companion.slug || null,
      contentType: input.contentType,
      contentTypeLabel: CONTENT_TYPE_LABELS[input.contentType] || input.contentType,
      mediaKind: mediaKindForContentType(input.contentType),
      totalCombinations,
      totalPhysicalItems,
      variantsPerCombination: input.requestedVariants || 1,
      workerLabel: workerLabelForContentType(input.contentType),
      realImageWorker: shouldUseRealImageWorker(input),
      enqueueJobs: shouldEnqueueGuidedProductionJob(input),
      safePlanningOnly: !shouldEnqueueGuidedProductionJob(input),
      productionAuthorizationId: productionAuthorization?.snapshot?.id || null,
    },
    created_at: now,
    updated_at: now,
  }

  return insertWithMediaTypeFallback(BATCHES_TABLE, payload, 'lote guiado de produção', input.contentType)
}

async function insertGuidedBatchItem({
  batch,
  companion,
  combination,
  input,
  combo,
  combinationIndex,
  variantNumber,
  itemIndex,
  actorProfileId,
  productionAuthorization = null,
}) {
  const now = nowIso()
  const prompt = buildGuidedPrompt({ companion, contentType: input.contentType, combo })
  const negativePrompt = buildNegativePrompt(combo)
  const mediaKind = mediaKindForContentType(input.contentType)
  const refs = buildCompanionRefs(companion)
  const initialStatus = shouldEnqueueGuidedProductionJob(input) ? 'queued' : 'planned'
  const idempotencyKey = `guided-factory:${batch.id}:${combination.id}:variant:${variantNumber}`

  const generationPayload = {
    source: 'guided_factory_production',
    canonicalItemModel: 'one_item_one_physical_variant',
    productionAuthorization: productionAuthorization?.snapshot || null,
    factoryMode: shouldEnqueueGuidedProductionJob(input) ? 'real_image' : 'safe_planning',
    factory_mode: shouldEnqueueGuidedProductionJob(input) ? 'real_image' : 'safe_planning',
    dryRun: !shouldEnqueueGuidedProductionJob(input),
    dry_run: !shouldEnqueueGuidedProductionJob(input),
    provider: shouldEnqueueGuidedProductionJob(input) ? 'production_queue' : 'safe_planning',
    contentType: input.contentType,
    content_type: input.contentType,
    mediaKind,
    media_kind: mediaKind,
    variantNumber,
    variant_number: variantNumber,
    prompt,
    prompt_text: prompt,
    prompt_final: prompt,
    negative_prompt: negativePrompt,
    guidedSelections: buildGuidedSelections(combo),
    generationConfig: {
      width: 1024,
      height: 1024,
      steps: 28,
      guidance_scale: 6.5,
    },
  }

  const payload = {
    batch_id: batch.id,
    ...refs,
    profile_id: actorProfileId,
    user_id: actorProfileId,
    actor_profile_id: productionAuthorization?.snapshot?.actorProfileId,
    avatar_production_authorization_id: productionAuthorization?.snapshot?.id,
    media_origin: productionAuthorization ? 'authorized_actor_production' : 'guided_factory_dry_run',
    finance_snapshot: productionAuthorization?.snapshot?.financeSnapshot,
    combination_id: combination.id,
    media_combination_id: combination.id,
    status: initialStatus,
    source: 'guided_factory',
    job_origin: 'admin_guided_factory',
    media_type: input.contentType,
    content_type: input.contentType,
    requested_variants: 1,
    variant_number: variantNumber,
    item_index: itemIndex,
    idempotency_key: idempotencyKey,
    prompt,
    prompt_text: prompt,
    prompt_final: prompt,
    negative_prompt: negativePrompt,
    generation_params: generationPayload,
    generation_payload: generationPayload,
    metadata: {
      ...generationPayload,
      batch_id: batch.id,
      combination_id: combination.id,
      companion_id: companion.id,
      combinationIndex: combinationIndex + 1,
      variantNumber,
      physicalVariant: true,
      idempotencyKey,
      createdBy: actorProfileId,
      workerLabel: workerLabelForContentType(input.contentType),
      created_at: now,
    },
    created_at: now,
    updated_at: now,
  }

  return insertWithMediaTypeFallback(BATCH_ITEMS_TABLE, payload, 'item físico do lote guiado', input.contentType)
}

async function enqueueGuidedBatchItem({
  batch,
  item,
  combination,
  companion,
  input,
  variantNumber,
  productionAuthorization = null,
}) {
  const mediaKind = mediaKindForContentType(input.contentType)
  const realImageWorker = shouldUseRealImageWorker(input)

  return addImageItemJob({
    batchItemId: item.id,
    batchId: batch.id,
    combinationId: combination.id,
    requestedVariants: 1,
    nextStatus: 'qa_pending',
    delayMs: 0,
    real: realImageWorker,
    metadata: {
      source: 'guided_factory_production',
      canonicalItemModel: 'one_item_one_physical_variant',
      companionId: companion.id,
      contentType: input.contentType,
      mediaKind,
      variantNumber,
      workerLabel: workerLabelForContentType(input.contentType),
      realImageWorker,
      productionAuthorization: productionAuthorization?.snapshot || null,
    },
    jobPayload: {
      companionId: companion.id,
      companion_id: companion.id,
      mediaType: input.contentType,
      media_type: input.contentType,
      mediaKind,
      media_kind: mediaKind,
      contentType: input.contentType,
      content_type: input.contentType,
      variantNumber,
      variant_number: variantNumber,
      factoryMode: shouldEnqueueGuidedProductionJob(input) ? 'real_image' : 'safe_planning',
      factory_mode: shouldEnqueueGuidedProductionJob(input) ? 'real_image' : 'safe_planning',
      mode: shouldEnqueueGuidedProductionJob(input) ? 'real_image' : 'safe_planning',
      generateRealImage: shouldEnqueueGuidedProductionJob(input),
      generate_real_image: shouldEnqueueGuidedProductionJob(input),
      productionAuthorizationId: productionAuthorization?.snapshot?.id || null,
      production_authorization_id: productionAuthorization?.snapshot?.id || null,
      actorProfileId: productionAuthorization?.snapshot?.actorProfileId || null,
      actor_profile_id: productionAuthorization?.snapshot?.actorProfileId || null,
      width: 1024,
      height: 1024,
      steps: 28,
      guidance_scale: 6.5,
    },
  })
}

export async function createGuidedProductionBatch(input, { actorProfileId = null } = {}) {
  await assertTableAvailable(TITLES_TABLE)
  await assertTableAvailable(ITEMS_TABLE)

  const companion = await getCompanionForProduction(input.companionId)
  const productionAuthorization = shouldRequireProductionAuthorization(input)
    ? await assertAvatarCompliantForProduction({ companionId: companion.id, contentType: input.contentType })
    : null

  if (productionAuthorization) {
    await assertApprovedActorIdentityForProduction({
      actorProfileId: productionAuthorization.snapshot?.actorProfileId,
      companionId: companion.id,
      authorizationId: productionAuthorization.snapshot?.id,
      contentType: input.contentType,
    })
  } else if (requiresApprovedIdentityLora(input.contentType)) {
    await assertApprovedIdentityAdapterForCompanionVideoProduction({
      companionId: companion.id,
      contentType: input.contentType,
    })
  }

  const { selectedGroups, combinations } = await buildGuidedCombinationSource(input)

  if (selectedGroups.length === 0 || combinations.length === 0) {
    throw new ApiError(400, 'Nenhuma combinação selecionada para criar o lote.')
  }

  if (combinations.length > 80) {
    throw new ApiError(400, 'Lote muito grande. Reduza a seleção antes de fabricar.', {
      total: combinations.length,
      limit: 80,
    })
  }

  const requestedVariants = Math.max(Number(input.requestedVariants || 1), 1)
  const totalPhysicalItems = combinations.length * requestedVariants

  const batch = await insertGuidedBatch({
    companion,
    input,
    totalCombinations: combinations.length,
    totalPhysicalItems,
    actorProfileId,
    productionAuthorization,
  })

  const items = []
  const queueJobs = []
  let itemIndex = 0

  for (const [combinationIndex, combo] of combinations.entries()) {
    const combination = await insertGuidedMediaCombination({
      companion,
      input,
      combo,
      index: combinationIndex,
      actorProfileId,
      productionAuthorization,
    })

    for (let variantNumber = 1; variantNumber <= requestedVariants; variantNumber += 1) {
      itemIndex += 1

      const item = await insertGuidedBatchItem({
        batch,
        companion,
        combination,
        input,
        combo,
        combinationIndex,
        variantNumber,
        itemIndex,
        actorProfileId,
        productionAuthorization,
      })

      const job = shouldEnqueueGuidedProductionJob(input)
        ? await enqueueGuidedBatchItem({
          batch,
          item,
          combination,
          companion,
          input,
          variantNumber,
          productionAuthorization,
        })
        : null

      items.push({
        id: item.id,
        status: item.status || 'planned',
        combinationId: combination.id,
        variantNumber,
        label: `${combination.title || combination.name || buildCombinationLabel(combo)} • Variação ${variantNumber}`,
      })

      if (job) {
        queueJobs.push({
          id: job?.id || null,
          name: job?.name || null,
          batchItemId: item.id,
          variantNumber,
        })
      }
    }
  }

  return {
    batch: {
      id: batch.id,
      status: batch.status || 'queued',
      companionId: companion.id,
      companionName: companion.name || companion.slug || 'Avatar',
      contentType: input.contentType,
      contentTypeLabel: CONTENT_TYPE_LABELS[input.contentType] || input.contentType,
      workerLabel: workerLabelForContentType(input.contentType),
      totalItems: items.length,
      totalCombinations: combinations.length,
      requestedVariants,
      canonicalItemModel: 'one_item_one_physical_variant',
      realImageWorker: shouldUseRealImageWorker(input),
      queueJobsCreated: queueJobs.length,
      safePlanningOnly: queueJobs.length === 0,
      productionAuthorizationId: productionAuthorization?.snapshot?.id || null,
      compliance: productionAuthorization?.compliance || null,
    },
    items,
    queueJobs,
    safety: buildGuidedProductionSafety(input, queueJobs),
    operation: {
      status: queueJobs.length > 0 ? 'queued_for_controlled_production' : 'safe_planning_created',
      confirmationRequiredForQueue: M4_1_FACTORY_OPERATION_CONFIRMATION,
      generatedMediaNow: false,
      publishNow: false,
      chargeNow: false,
    },
    message: queueJobs.length > 0
      ? 'Pedido criado e enviado para produção controlada. Acompanhe a revisão antes de liberar qualquer conteúdo.'
      : 'Pedido de produção criado em modo seguro. Ele fica disponível para acompanhamento antes da geração final.',
  }
}

export async function createGuidedCombinationDraft(input, { actorProfileId = null } = {}) {
  const preview = await previewGuidedCombinations(input)

  if (preview.total === 0) {
    throw new ApiError(400, 'Nenhuma combinação selecionada para salvar.')
  }

  if (preview.total > 250) {
    throw new ApiError(400, 'Lote muito grande para salvar como rascunho. Reduza a seleção antes de continuar.', {
      total: preview.total,
    })
  }

  const now = nowIso()
  const rows = preview.preview.map((combo, index) => ({
    companion_id: input.companionId,
    media_type: input.contentType,
    combination_key: `${input.contentType}:${input.companionId}:${index + 1}:${Date.now()}`,
    title: combo.label,
    price_credits: 0,
    is_active: false,
    visible_to_client: false,
    admin_only: true,
    guided_selections: combo.selections,
    metadata: {
      source: 'guided_factory_draft',
      createdBy: actorProfileId,
      contentType: input.contentType,
      generatedAt: now,
    },
    created_at: now,
    updated_at: now,
  }))

  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .insert(rows)
    .select('*')

  if (error) {
    throw new ApiError(500, 'Erro ao salvar combinações guiadas.', error)
  }

  return {
    total: (data || []).length,
    items: (data || []).map(mapCombinationRow),
  }
}


export async function updateClientCreationModelVisibility(combinationId, input, { actorProfileId = null } = {}) {
  if (!combinationId) {
    throw new ApiError(400, 'Modelo de criação obrigatório.')
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select('id, metadata')
    .eq('id', combinationId)
    .maybeSingle()

  if (existingError) {
    throw new ApiError(500, 'Erro ao validar modelo de criação antes da publicação.', existingError)
  }

  if (!existing) {
    throw new ApiError(404, 'Modelo de criação não encontrado.')
  }

  const now = nowIso()
  const payload = {
    visible_to_client: input.visibleToClient,
    admin_only: input.adminOnly ?? !input.visibleToClient,
    is_active: input.isActive ?? true,
    ...(input.priceCredits !== undefined ? { price_credits: Number(input.priceCredits || 0) } : {}),
    updated_at: now,
    metadata: {
      ...(existing.metadata || {}),
      publication: {
        visibleToClient: input.visibleToClient,
        updatedBy: actorProfileId,
        updatedAt: now,
        reason: input.visibleToClient ? 'Publicado para cliente pelo Admin.' : 'Ocultado do cliente pelo Admin.',
      },
    },
  }

  const { data, error } = await supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .update(payload)
    .eq('id', combinationId)
    .select('*')
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar publicação do modelo para cliente.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Modelo de criação não encontrado.')
  }

  return mapCombinationRow(data)
}

export async function listClientCreationModels({ companionId = null, contentType = null } = {}) {
  let query = supabaseAdmin
    .from(COMBINATIONS_TABLE)
    .select('*')
    .eq('is_active', true)
    .eq('visible_to_client', true)
    .order('created_at', { ascending: false })
    .limit(200)

  if (companionId) query = query.eq('companion_id', companionId)
  if (contentType) query = query.eq('media_type', contentType)

  const { data, error } = await query

  if (error) {
    throw new ApiError(500, 'Erro ao listar modelos disponíveis para cliente.', error)
  }

  return {
    items: (data || []).map(mapCombinationRow),
  }
}
