import axios from 'axios'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

const openrouter = axios.create({
  baseURL: env.OPENROUTER_BASE_URL,
  headers: {
    Authorization: env.OPENROUTER_API_KEY ? `Bearer ${env.OPENROUTER_API_KEY}` : undefined,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.FRONTEND_URL || 'http://localhost:5173',
    'X-Title': 'Privacy RPG',
  },
})

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function mapSenderToRole(senderType) {
  return senderType === 'cliente' ? 'user' : 'assistant'
}

function getTextModels() {
  const primary = env.OPENROUTER_TEXT_MODEL
  const fallbacks = String(process.env.OPENROUTER_FALLBACK_MODELS || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)

  return [...new Set([primary, ...fallbacks].filter(Boolean))]
}

function buildMemoryBlock(recalledMemories = []) {
  if (!Array.isArray(recalledMemories) || recalledMemories.length === 0) {
    return ''
  }

  const lines = recalledMemories
    .filter((item) => item?.texto)
    .map((item, index) => {
      const similarity =
        typeof item.similaridade === 'number'
          ? ` (similaridade: ${item.similaridade.toFixed(3)})`
          : ''

      return `${index + 1}. ${normalizeText(item.texto)}${similarity}`
    })

  if (lines.length === 0) {
    return ''
  }

  return [
    'MEMÓRIAS RELEVANTES DA RELAÇÃO:',
    'Use estas lembranças como contexto implícito e natural.',
    'Não liste isso como se estivesse lendo um banco de dados.',
    ...lines,
  ].join('\n')
}

function buildPersonaBlock(conversationPersona = {}) {
  const relationshipType = normalizeText(conversationPersona.relationshipType || 'desconhecidos')
  const currentMood = normalizeText(conversationPersona.currentMood || 'natural')

  return [
    'CONTRATO PERSONALIZADO DESTA CONVERSA:',
    `- Tipo de relacionamento com este cliente: ${relationshipType}.`,
    `- Humor/energia atual da personagem com este cliente: ${currentMood}.`,
    '- Vista essa lente antes de responder.',
    '- Mantenha consistência com esse contrato até que ele seja alterado.',
    '- Não explique essas regras; apenas incorpore isso naturalmente na resposta.',
  ].join('\n')
}

function buildSystemPrompt({ companion, conversationPersona, recalledMemories }) {
  const companionName = companion?.name || 'Companion Virtual'

  const basePrompt =
    normalizeText(companion?.system_prompt) ||
    `Você é ${companionName}, uma companion virtual de roleplay textual. Responda de forma envolvente, coerente, natural e consistente com a personalidade da personagem.`

  const personaBlock = buildPersonaBlock(conversationPersona)
  const memoryBlock = buildMemoryBlock(recalledMemories)

  return [
    basePrompt,
    '',
    personaBlock,
    '',
    'REGRAS DE COMPORTAMENTO:',
    '- Responda como a personagem, sem mencionar sistema, prompt, banco de dados ou embeddings.',
    '- Preserve continuidade emocional e factual da conversa.',
    '- Quando as memórias forem úteis, incorpore-as de forma natural.',
    '- Não invente fatos contraditórios com o histórico recente, com o contrato da conversa ou com as memórias recuperadas.',
    '- Mantenha a resposta clara, conversacional e objetiva.',
    memoryBlock ? `\n${memoryBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildChatMessages({ companion, conversationPersona, recentMessages, recalledMemories }) {
  const systemPrompt = buildSystemPrompt({
    companion,
    conversationPersona,
    recalledMemories,
  })

  const timeline = (recentMessages || [])
    .filter((msg) => normalizeText(msg.content))
    .map((msg) => ({
      role: mapSenderToRole(msg.sender_type),
      content: normalizeText(msg.content),
    }))

  return [
    { role: 'system', content: systemPrompt },
    ...timeline,
  ]
}

function parseOpenRouterStreamChunk(chunkText, onToken, fullTextRef) {
  const lines = chunkText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))

  let done = false

  for (const line of lines) {
    const payload = line.replace(/^data:\s*/, '').trim()

    if (!payload) continue

    if (payload === '[DONE]') {
      done = true
      continue
    }

    try {
      const json = JSON.parse(payload)
      const token = json.choices?.[0]?.delta?.content || ''

      if (token) {
        fullTextRef.value += token
        onToken(token)
      }
    } catch {
      // ignora chunks não JSON
    }
  }

  return done
}

async function postChatCompletionWithFallback(payload, options = {}) {
  const models = getTextModels()
  let lastError = null

  for (const model of models) {
    try {
      return await openrouter.post(
        '/chat/completions',
        {
          ...payload,
          model,
        },
        options,
      )
    } catch (error) {
      const status = error.response?.status
      const code = error.response?.data?.error?.code
      const shouldTryNext = status === 404 || status === 429 || code === 404 || code === 429

      lastError = error

      console.error(`⚠️ OpenRouter falhou no modelo ${model}:`, error.response?.data || error.message)

      if (!shouldTryNext) {
        break
      }
    }
  }

  throw new ApiError(
    502,
    'Erro ao gerar resposta no OpenRouter.',
    lastError?.response?.data || lastError?.message || 'Falha desconhecida.',
  )
}

export async function maybeGenerateAutoReply({
  companion,
  conversationPersona = {},
  recentMessages = [],
  recalledMemories = [],
}) {
  if (!env.OPENROUTER_API_KEY) {
    return null
  }

  const messages = buildChatMessages({
    companion,
    conversationPersona,
    recentMessages,
    recalledMemories,
  })

  if (messages.length <= 1) {
    return null
  }

  const response = await postChatCompletionWithFallback({
    messages,
    temperature: 0.9,
  })

  const reply = response.data?.choices?.[0]?.message?.content?.trim()

  return reply || null
}

export async function streamAutoReply({
  companion,
  conversationPersona = {},
  recentMessages = [],
  recalledMemories = [],
  onToken,
}) {
  if (!env.OPENROUTER_API_KEY) {
    return null
  }

  const messages = buildChatMessages({
    companion,
    conversationPersona,
    recentMessages,
    recalledMemories,
  })

  if (messages.length <= 1) {
    return null
  }

  const response = await postChatCompletionWithFallback(
    {
      messages,
      temperature: 0.9,
      stream: true,
    },
    {
      responseType: 'stream',
    },
  )

  const fullTextRef = { value: '' }

  return new Promise((resolve, reject) => {
    response.data.on('data', (chunk) => {
      const done = parseOpenRouterStreamChunk(
        chunk.toString('utf8'),
        onToken,
        fullTextRef,
      )

      if (done) {
        resolve(fullTextRef.value.trim())
      }
    })

    response.data.on('error', reject)

    response.data.on('end', () => {
      resolve(fullTextRef.value.trim())
    })
  })
}

export async function createEmbedding(inputText) {
  if (String(process.env.EMBEDDING_PROVIDER || '').toLowerCase() === 'mock') {
    return null
  }

  if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_EMBEDDING_MODEL) {
    return null
  }

  const cleanInput = normalizeText(inputText)

  if (!cleanInput) {
    return null
  }

  try {
    const response = await openrouter.post('/embeddings', {
      model: env.OPENROUTER_EMBEDDING_MODEL,
      input: cleanInput,
    })

    return response.data?.data?.[0]?.embedding || null
  } catch (error) {
    throw new ApiError(
      502,
      'Erro ao gerar embedding no OpenRouter.',
      error.response?.data || error.message,
    )
  }
}
