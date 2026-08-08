import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

const PROMPT_DICTIONARIES_TABLE = 'prompt_dictionaries'
const AUDIO_STORYLINES_TABLE = 'audio_storylines'

function nowIso() {
  return new Date().toISOString()
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase()
}

function mapPromptDictionary(row = {}) {
  return {
    id: row.id,
    category: row.category || '',
    label: row.label || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function mapAudioStoryline(row = {}) {
  return {
    id: row.id,
    title: row.title || '',
    script: row.script || '',
    voiceTone: row.voice_tone || '',
    isActive: row.is_active !== false,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function wrapIntelligenceTableError(message, error) {
  const code = String(error?.code || '')
  if (code === '42P01' || code === '42703') {
    return new ApiError(500, 'Central de Inteligência ainda não instalada. Execute a migração 20260712_admin_intelligence_center.sql.', error)
  }
  if (code === '23505') {
    return new ApiError(409, 'Este item já existe nesta categoria.', error)
  }
  return new ApiError(500, message, error)
}

async function ensureItem(table, itemId, select) {
  const { data, error } = await supabaseAdmin
    .from(table)
    .select(select)
    .eq('id', itemId)
    .maybeSingle()

  if (error) throw wrapIntelligenceTableError('Erro ao validar item da Central de Inteligência.', error)
  if (!data) throw new ApiError(404, 'Item não encontrado.')
  return data
}

export async function listPromptDictionaries({ category, includeInactive = true } = {}) {
  let query = supabaseAdmin
    .from(PROMPT_DICTIONARIES_TABLE)
    .select('id, category, label, is_active, created_at, updated_at')
    .order('category', { ascending: true })
    .order('label', { ascending: true })

  if (category) query = query.eq('category', normalizeCategory(category))
  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw wrapIntelligenceTableError('Erro ao listar dicionários de prompt.', error)
  return { items: (data || []).map(mapPromptDictionary) }
}

export async function createPromptDictionary(input = {}, { adminProfileId = null } = {}) {
  const now = nowIso()
  const payload = {
    category: normalizeCategory(input.category),
    label: normalizeText(input.label),
    is_active: input.isActive !== false,
    metadata: { source: 'admin_intelligence_center' },
    created_by_profile_id: adminProfileId,
    updated_by_profile_id: adminProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(PROMPT_DICTIONARIES_TABLE)
    .insert(payload)
    .select('id, category, label, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapIntelligenceTableError('Erro ao criar item do dicionário.', error)
  return { item: mapPromptDictionary(data), message: 'Item adicionado ao dicionário.' }
}

export async function updatePromptDictionary(itemId, input = {}, { adminProfileId = null } = {}) {
  await ensureItem(PROMPT_DICTIONARIES_TABLE, itemId, 'id')

  const payload = { updated_by_profile_id: adminProfileId, updated_at: nowIso() }
  if (input.category !== undefined) payload.category = normalizeCategory(input.category)
  if (input.label !== undefined) payload.label = normalizeText(input.label)
  if (input.isActive !== undefined) payload.is_active = Boolean(input.isActive)

  const { data, error } = await supabaseAdmin
    .from(PROMPT_DICTIONARIES_TABLE)
    .update(payload)
    .eq('id', itemId)
    .select('id, category, label, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapIntelligenceTableError('Erro ao atualizar item do dicionário.', error)
  return { item: mapPromptDictionary(data), message: data.is_active ? 'Item atualizado.' : 'Item inativado.' }
}

export async function listAudioStorylines({ includeInactive = true } = {}) {
  let query = supabaseAdmin
    .from(AUDIO_STORYLINES_TABLE)
    .select('id, title, script, voice_tone, is_active, created_at, updated_at')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  if (!includeInactive) query = query.eq('is_active', true)

  const { data, error } = await query
  if (error) throw wrapIntelligenceTableError('Erro ao listar enredos de áudio.', error)
  return { items: (data || []).map(mapAudioStoryline) }
}

export async function createAudioStoryline(input = {}, { adminProfileId = null } = {}) {
  const now = nowIso()
  const payload = {
    title: normalizeText(input.title),
    script: String(input.script || '').trim(),
    voice_tone: normalizeText(input.voiceTone),
    is_active: input.isActive !== false,
    metadata: { source: 'admin_intelligence_center', target: 'tts' },
    created_by_profile_id: adminProfileId,
    updated_by_profile_id: adminProfileId,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await supabaseAdmin
    .from(AUDIO_STORYLINES_TABLE)
    .insert(payload)
    .select('id, title, script, voice_tone, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapIntelligenceTableError('Erro ao criar enredo de áudio.', error)
  return { item: mapAudioStoryline(data), message: 'Enredo de áudio criado.' }
}

export async function updateAudioStoryline(itemId, input = {}, { adminProfileId = null } = {}) {
  await ensureItem(AUDIO_STORYLINES_TABLE, itemId, 'id')

  const payload = { updated_by_profile_id: adminProfileId, updated_at: nowIso() }
  if (input.title !== undefined) payload.title = normalizeText(input.title)
  if (input.script !== undefined) payload.script = String(input.script || '').trim()
  if (input.voiceTone !== undefined) payload.voice_tone = normalizeText(input.voiceTone)
  if (input.isActive !== undefined) payload.is_active = Boolean(input.isActive)

  const { data, error } = await supabaseAdmin
    .from(AUDIO_STORYLINES_TABLE)
    .update(payload)
    .eq('id', itemId)
    .select('id, title, script, voice_tone, is_active, created_at, updated_at')
    .single()

  if (error) throw wrapIntelligenceTableError('Erro ao atualizar enredo de áudio.', error)
  return { item: mapAudioStoryline(data), message: data.is_active ? 'Enredo atualizado.' : 'Enredo inativado.' }
}
