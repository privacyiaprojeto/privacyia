import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { createEmbedding } from './openrouter.service.js'

const EMBEDDING_DIMENSIONS = 1536
const DEFAULT_MEMORY_THRESHOLD = 0.78

function createMockEmbedding(text) {
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0)
  const input = String(text || '').trim().toLowerCase()

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i)
    const idx = (code + i * 31) % EMBEDDING_DIMENSIONS
    vector[idx] += ((code % 97) + 1) / 100
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => Number((value / norm).toFixed(8)))
}

function normalizeEmbedding(embedding) {
  if (!Array.isArray(embedding)) {
    throw new ApiError(500, 'Embedding inválido: formato inesperado.')
  }

  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new ApiError(
      500,
      `Embedding inválido: esperado ${EMBEDDING_DIMENSIONS} dimensões, recebido ${embedding.length}.`,
    )
  }

  return embedding.map((value) => Number(value))
}

async function generateEmbedding(text) {
  const cleanText = String(text || '').trim()

  if (!cleanText) {
    throw new ApiError(400, 'Texto vazio não pode gerar embedding.')
  }

  try {
    const realEmbedding = await createEmbedding(cleanText)

    if (Array.isArray(realEmbedding) && realEmbedding.length === EMBEDDING_DIMENSIONS) {
      return normalizeEmbedding(realEmbedding)
    }
  } catch {
    // fallback local
  }

  return createMockEmbedding(cleanText)
}

export async function saveMemory(profileId, companionId, text) {
  const memoryText = String(text || '').trim()

  if (!profileId) {
    throw new ApiError(400, 'profileId é obrigatório.')
  }

  if (!companionId) {
    throw new ApiError(400, 'companionId é obrigatório.')
  }

  if (!memoryText) {
    throw new ApiError(400, 'Texto da memória é obrigatório.')
  }

  const embedding = await generateEmbedding(memoryText)

  const { data, error } = await supabaseAdmin
    .from('conversation_memories')
    .insert({
      profile_id: profileId,
      companion_id: companionId,
      memory_text: memoryText,
      embedding,
    })
    .select('id, profile_id, companion_id, memory_text, created_at')
    .single()

  if (error) {
    throw new ApiError(500, 'Erro ao salvar memória vetorial.', error)
  }

  return data
}

export async function recallMemories(
  profileId,
  companionId,
  queryText,
  limit = 8,
  threshold = DEFAULT_MEMORY_THRESHOLD,
) {
  const cleanQuery = String(queryText || '').trim()

  if (!profileId) {
    throw new ApiError(400, 'profileId é obrigatório.')
  }

  if (!companionId) {
    throw new ApiError(400, 'companionId é obrigatório.')
  }

  if (!cleanQuery) {
    throw new ApiError(400, 'Texto da consulta é obrigatório.')
  }

  const queryEmbedding = await generateEmbedding(cleanQuery)

  const { data, error } = await supabaseAdmin.rpc('match_memories', {
    query_embedding: queryEmbedding,
    p_profile_id: profileId,
    p_companion_id: companionId,
    match_count: limit,
    min_similarity: threshold,
  })

  if (error) {
    throw new ApiError(500, 'Erro ao recuperar memórias vetoriais.', error)
  }

  return (data || [])
    .filter((row) => Number(row.similarity || 0) >= threshold)
    .map((row) => ({
      id: row.id,
      texto: row.memory_text,
      similaridade: row.similarity,
      criadaEm: row.created_at,
    }))
}