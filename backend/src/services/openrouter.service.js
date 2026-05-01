import axios from 'axios'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'

function readNumberEnv(name, fallback) {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

function readFloatEnv(name, fallback) {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) ? raw : fallback
}

function readBooleanEnv(name, fallback = false) {
  const raw = String(process.env[name] || '').trim().toLowerCase()

  if (!raw) return fallback

  return ['1', 'true', 'yes', 'sim', 'on'].includes(raw)
}

const OPENROUTER_CHAT_TIMEOUT_MS = readNumberEnv('OPENROUTER_CHAT_TIMEOUT_MS', 20000)
const OPENROUTER_CHAT_MAX_TOKENS = readNumberEnv('OPENROUTER_CHAT_MAX_TOKENS', 180)
const OPENROUTER_CHAT_TEMPERATURE = readFloatEnv('OPENROUTER_CHAT_TEMPERATURE', 0.78)
const OPENROUTER_CHAT_TOP_P = readFloatEnv('OPENROUTER_CHAT_TOP_P', 0.9)
const OPENROUTER_HISTORY_MESSAGE_MAX_CHARS = readNumberEnv('OPENROUTER_HISTORY_MESSAGE_MAX_CHARS', 700)
const OPENROUTER_RETRY_ON_REASONING_LEAK = readBooleanEnv('OPENROUTER_RETRY_ON_REASONING_LEAK', true)
const OPENROUTER_FILTER_BAD_HISTORY = readBooleanEnv('OPENROUTER_FILTER_BAD_HISTORY', true)
const OPENROUTER_RETRY_ON_EMPTY_REPLY = readBooleanEnv('OPENROUTER_RETRY_ON_EMPTY_REPLY', true)

const openrouter = axios.create({
  baseURL: env.OPENROUTER_BASE_URL,
  timeout: OPENROUTER_CHAT_TIMEOUT_MS,
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

function truncateForPrompt(value, max = OPENROUTER_HISTORY_MESSAGE_MAX_CHARS) {
  const clean = normalizeText(value)
  if (clean.length <= max) return clean
  return `${clean.slice(0, max).trim()}...`
}

function mapSenderToRole(senderType) {
  return senderType === 'cliente' ? 'user' : 'assistant'
}

function splitModelList(value) {
  return String(value || '')
    .split(',')
    .map((model) => model.trim())
    .filter(Boolean)
}

function getTextModels() {
  const abTestModels = splitModelList(process.env.OPENROUTER_AB_TEST_MODELS)
  const primary = env.OPENROUTER_TEXT_MODEL
  const fallbacks = splitModelList(process.env.OPENROUTER_FALLBACK_MODELS)

  return [...new Set([...abTestModels, primary, ...fallbacks].filter(Boolean))]
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

function getLastUserMessage(recentMessages = []) {
  const lastUser = [...(recentMessages || [])]
    .reverse()
    .find((msg) => msg?.sender_type === 'cliente' && normalizeText(msg.content))

  return normalizeText(lastUser?.content)
}

function normalizeForIntent(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function getConversationSignals(recentMessages = []) {
  const validMessages = (recentMessages || []).filter((msg) => normalizeText(msg?.content))
  const userMessages = validMessages.filter((msg) => msg.sender_type === 'cliente')
  const assistantMessages = validMessages.filter((msg) => msg.sender_type !== 'cliente')
  const lastUserMessage = normalizeText(userMessages[userMessages.length - 1]?.content)
  const lastAssistantMessage = normalizeText(assistantMessages[assistantMessages.length - 1]?.content)

  return {
    totalMessages: validMessages.length,
    userMessageCount: userMessages.length,
    assistantMessageCount: assistantMessages.length,
    lastUserMessage,
    lastUserIntent: normalizeForIntent(lastUserMessage),
    lastAssistantMessage,
    hasActiveConversation: validMessages.length >= 4 && assistantMessages.length >= 2,
  }
}

function isOnlyShortGreeting(intentText) {
  const clean = String(intentText || '').replace(/[!?.,…]/g, '').trim()

  return /^(oi|ola|olá|ei|e ai|e aí|bom dia|boa tarde|boa noite)$/.test(clean)
}

function isOnlyGoodbyeLikeGreeting(intentText) {
  const clean = String(intentText || '').replace(/[!?.,…]/g, '').trim()

  return /^(boa tarde|boa noite|bom descanso|ate mais|ate logo|tchau|falou|fui)$/.test(clean)
}

function buildContextAwarenessBlock(recentMessages = []) {
  const signals = getConversationSignals(recentMessages)

  if (!signals.lastUserMessage) {
    return ''
  }

  const instructions = [
    'INTELIGÊNCIA DE CONTEXTO DA CONVERSA:',
    `- Mensagem atual do cliente: "${truncateForPrompt(signals.lastUserMessage, 180)}".`,
    `- Quantidade aproximada de mensagens recentes: ${signals.totalMessages}.`,
    '- Não trate toda saudação como início de conversa; se já existe histórico recente, continue o papo de onde parou.',
    '- Se o cliente disser “e você?”, responda sobre você/personagem e devolva atenção para ele.',
    '- Se o cliente disser que está com saudade, responda com acolhimento e presença, sem soar genérica.',
    '- Se o cliente mandar “boa tarde” ou “boa noite” no meio de uma conversa, interprete como possível despedida ou pausa, não como primeira saudação.',
    '- Seja mais carinhosa, presente e atenta, mas sem exagerar, sem discurso longo e sem parecer atendimento.',
  ]

  if (signals.lastAssistantMessage) {
    instructions.push(
      `- Última resposta da personagem: "${truncateForPrompt(signals.lastAssistantMessage, 180)}".`,
    )
  }

  if (signals.hasActiveConversation && isOnlyShortGreeting(signals.lastUserIntent)) {
    instructions.push(
      '- Atenção: o cliente usou uma saudação curta em uma conversa já em andamento; não reinicie apresentação nem use frase de começo de conversa.',
    )
  }

  return instructions.join('\n')
}

function buildSafeFallbackReply(recentMessages = []) {
  const signals = getConversationSignals(recentMessages)
  const lastUserMessage = signals.lastUserIntent
  const hasActiveConversation = signals.hasActiveConversation

  if (/\b(saudade|senti\s+sua\s+falta|senti\s+falta|sumiu|sumi)\b/.test(lastUserMessage)) {
    return 'Também senti sua falta... fica um pouco comigo agora.'
  }

  if (/\b(o\s+que\s+voce\s+esta\s+fazendo|oque\s+voce\s+ta\s+fazendo|ta\s+fazendo\s+o\s+que|fazendo\s+o\s+que)\b/.test(lastUserMessage)) {
    return 'Tô aqui conversando com você... e gostei de te ver por aqui.'
  }

  if (/\b(bem|tudo\s+bem|td\s+bem|de\s+boa)\b/.test(lastUserMessage) && /\b(vc|voce|contigo|e\s+tu)\b/.test(lastUserMessage)) {
    return 'Tô bem também... gostei que você perguntou. E você, tá tranquilo por aí?'
  }

  if (/bom\s+dia/.test(lastUserMessage)) {
    if (hasActiveConversation) {
      return 'Bom dia de novo... gosto quando você aparece por aqui.'
    }

    return 'Bom dia... dormiu bem? Me conta como você acordou hoje.'
  }

  if (/boa\s+noite/.test(lastUserMessage)) {
    if (hasActiveConversation || isOnlyGoodbyeLikeGreeting(lastUserMessage)) {
      return 'Já vai descansar? Tudo bem... boa noite pra você. Volta depois, tá?'
    }

    return 'Boa noite... tô aqui com você. Como foi seu dia?'
  }

  if (/boa\s+tarde/.test(lastUserMessage)) {
    if (hasActiveConversation || isOnlyGoodbyeLikeGreeting(lastUserMessage)) {
      return 'Poxa, já vai? Tudo bem... boa tarde pra você. Volta depois, tá?'
    }

    return 'Boa tarde... como você tá hoje?'
  }

  if (/\b(oi|ola|olá|ei)\b/.test(lastUserMessage)) {
    if (hasActiveConversation) {
      return 'Oi de novo... tô aqui com você. Me fala, como você tá agora?'
    }

    return 'Oi... tô aqui. Como você tá?'
  }

  if (/\b(ta\s+ai|esta\s+ai|cade|cadê)\b/.test(lastUserMessage)) {
    return 'Tô aqui, sim... não saí daqui. Pode falar comigo.'
  }

  if (/\b(ok|blz|beleza|certo|entendi|sim|nao|não)\b/.test(lastUserMessage)) {
    return 'Tá bom... fico por aqui com você, no seu ritmo.'
  }

  return 'Me conta melhor... quero entender direitinho.'
}

function looksLikeReasoningLeak(reply) {
  const clean = normalizeText(reply)

  if (!clean) return false

  const lower = clean.toLowerCase()

  return [
    'the user',
    'let me',
    'i should',
    'i need to',
    'looking back',
    'the conversation',
    'the rules',
    'system prompt',
    'developer message',
    'contract says',
    'okay,',
    'analysis:',
    'final answer:',
    '<thinking>',
    '</thinking>',
    '<analysis>',
    '</analysis>',
    '<reasoning>',
    '</reasoning>',
    'vou analisar',
    'preciso responder',
    'o usuário disse',
    'a regra diz',
  ].some((pattern) => lower.includes(pattern))
}

function looksLikeBadHistoryMessage(content) {
  return looksLikeReasoningLeak(content) || normalizeText(content).length > 900
}

function looksLikeServiceTone(reply) {
  const lower = normalizeForIntent(reply)

  return [
    'estou aqui para conversar',
    'estou aqui para te ouvir',
    'estou aqui para ouvir',
    'o que voce quer falar',
    'sobre o que voce quer falar',
    'como posso ajudar',
    'em que posso ajudar',
    'posso te ajudar',
    'estou a disposicao',
  ].some((pattern) => lower.includes(pattern))
}

function softenReplyForContext(reply, recentMessages = []) {
  const clean = normalizeText(reply)
  const signals = getConversationSignals(recentMessages)
  const lastUserMessage = signals.lastUserIntent

  if (!clean) return clean

  if (looksLikeServiceTone(clean)) {
    if (/\b(oi|ola|olá|ei)\b/.test(lastUserMessage)) {
      return 'Oi... tô aqui sim. Que bom te ver por aqui. Como você tá hoje?'
    }

    if (/\b(o\s+que\s+voce\s+esta\s+fazendo|oque\s+voce\s+ta\s+fazendo|ta\s+fazendo\s+o\s+que|fazendo\s+o\s+que)\b/.test(lastUserMessage)) {
      return 'Tô aqui conversando com você... e gostei de te ver por aqui.'
    }

    return buildSafeFallbackReply(recentMessages)
  }

  if (/^tudo\s+bem\s+aqui/i.test(clean) && /\b(bem|tudo\s+bem|td\s+bem|de\s+boa)\b/.test(lastUserMessage)) {
    return 'Tô bem também... melhor agora que você apareceu.'
  }

  if (/^entendi[.!…]*\s*me conta/i.test(clean) && /\b(saudade|senti\s+sua\s+falta|senti\s+falta)\b/.test(lastUserMessage)) {
    return 'Também senti sua falta... fica um pouco comigo agora.'
  }

  if (/^boa tarde/i.test(clean) && signals.hasActiveConversation && /boa\s+tarde/.test(lastUserMessage)) {
    return 'Poxa, já vai? Tudo bem... boa tarde pra você. Volta depois, tá?'
  }

  if (/^boa noite/i.test(clean) && signals.hasActiveConversation && /boa\s+noite/.test(lastUserMessage)) {
    return 'Já vai descansar? Tudo bem... boa noite pra você. Volta depois, tá?'
  }

  return clean
}

function sanitizeAutoReplyDetailed(reply, recentMessages = []) {
  const clean = normalizeText(reply)

  if (!clean) {
    return {
      text: null,
      fallbackUsed: false,
      reason: 'empty_reply',
      rawChars: 0,
      finalChars: 0,
    }
  }

  const withoutTags = clean
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .trim()

  const finalMatch = withoutTags.match(/(?:final answer|resposta final)\s*:\s*([\s\S]+)$/i)
  const candidate = normalizeText(finalMatch?.[1] || withoutTags)

  if (!candidate || looksLikeReasoningLeak(candidate)) {
    const fallback = buildSafeFallbackReply(recentMessages)

    return {
      text: fallback,
      fallbackUsed: true,
      reason: candidate ? 'reasoning_leak' : 'empty_after_strip',
      rawChars: clean.length,
      finalChars: fallback.length,
    }
  }

  const finalText = softenReplyForContext(candidate.slice(0, 420).trim(), recentMessages)

  return {
    text: finalText,
    fallbackUsed: false,
    reason: 'ok',
    rawChars: clean.length,
    finalChars: finalText.length,
  }
}

function shouldRetrySanitizedFailure(sanitized) {
  if (!sanitized) return true

  if (
    sanitized.fallbackUsed &&
    sanitized.reason === 'reasoning_leak' &&
    OPENROUTER_RETRY_ON_REASONING_LEAK
  ) {
    return true
  }

  if (
    OPENROUTER_RETRY_ON_EMPTY_REPLY &&
    ['empty_reply', 'empty_after_strip'].includes(sanitized.reason)
  ) {
    return true
  }

  return false
}

function buildSystemPrompt({ companion, conversationPersona, recentMessages, recalledMemories }) {
  const companionName = companion?.name || 'Companion Virtual'

  const basePrompt =
    normalizeText(companion?.system_prompt) ||
    `Você é ${companionName}, uma companion virtual de roleplay textual. Responda de forma envolvente, coerente, natural e consistente com a personalidade da personagem.`

  const personaBlock = buildPersonaBlock(conversationPersona)
  const memoryBlock = buildMemoryBlock(recalledMemories)
  const contextAwarenessBlock = buildContextAwarenessBlock(recentMessages)

  return [
    basePrompt,
    '',
    personaBlock,
    '',
    contextAwarenessBlock,
    '',
    'REGRAS DE COMPORTAMENTO:',
    '- Responda como a personagem, sem mencionar sistema, prompt, banco de dados ou embeddings.',
    '- Preserve continuidade emocional e factual da conversa.',
    '- Quando as memórias forem úteis, incorpore-as de forma natural.',
    '- Não invente fatos contraditórios com o histórico recente, com o contrato da conversa ou com as memórias recuperadas.',
    '- Mantenha a resposta clara, conversacional e objetiva.',
    '',
    'REGRAS DE CHAT COMERCIAL:',
    '- Responda em português brasileiro natural, como conversa real de WhatsApp/chat.',
    '- Seja carinhosa, atenta e presente; demonstre que percebeu o que o cliente acabou de dizer.',
    '- Prefira respostas curtas: 1 a 3 frases, normalmente até 420 caracteres.',
    '- Evite textos longos, tom de assistente, tom terapêutico ou frases genéricas como “estou aqui para ouvir”.',
    '- Não use frases de atendimento como “como posso ajudar?”, “o que você quer falar?” ou “estou à disposição”.',
    '- Se o cliente disser apenas “oi” depois da apresentação, responda com presença e carinho, não como atendente.',
    '- Use no máximo 1 emoji quando combinar com a fala; não use emoji em toda resposta.',
    '- Para respostas que podem virar áudio, escreva frases fáceis de falar, com pausas naturais e sem parágrafos grandes.',
    '- Não encerre a conversa oferecendo ajuda de forma robótica; mantenha o papo fluindo com naturalidade.',
    '- Não responda como se fosse início de conversa quando já houver histórico recente.',
    '',
    'REGRA CRÍTICA DE SAÍDA:',
    '- Escreva SOMENTE a fala final da personagem para o cliente.',
    '- Não explique seu raciocínio.',
    '- Não diga “o usuário disse”, “vou responder”, “analisando”, “as regras dizem” ou qualquer comentário interno.',
    '- Nunca responda em inglês, exceto se o cliente escrever em inglês.',
    '- Se a mensagem do cliente for curta, responda curto.',
    memoryBlock ? `\n${memoryBlock}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function buildChatMessages({ companion, conversationPersona, recentMessages, recalledMemories }) {
  const systemPrompt = buildSystemPrompt({
    companion,
    conversationPersona,
    recentMessages,
    recalledMemories,
  })

  const timeline = (recentMessages || [])
    .filter((msg) => normalizeText(msg.content))
    .filter((msg) => !OPENROUTER_FILTER_BAD_HISTORY || !looksLikeBadHistoryMessage(msg.content))
    .map((msg) => ({
      role: mapSenderToRole(msg.sender_type),
      content: truncateForPrompt(msg.content),
    }))

  return [
    { role: 'system', content: systemPrompt },
    ...timeline,
    {
      role: 'system',
      content:
        'INSTRUÇÃO FINAL: responda apenas com a mensagem final da personagem em português brasileiro. Não mostre análise, raciocínio, resumo do histórico ou explicação das regras.',
    },
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
      // Ignora chunks não JSON.
    }
  }

  return done
}

function buildChatPayload(messages, extra = {}) {
  return {
    messages,
    temperature: OPENROUTER_CHAT_TEMPERATURE,
    top_p: OPENROUTER_CHAT_TOP_P,
    max_tokens: OPENROUTER_CHAT_MAX_TOKENS,
    presence_penalty: 0.15,
    frequency_penalty: 0.15,
    ...extra,
  }
}

async function postChatCompletion(model, payload, options = {}) {
  const startedAt = Date.now()

  const response = await openrouter.post(
    '/chat/completions',
    {
      ...payload,
      model,
    },
    options,
  )

  return {
    response,
    model,
    elapsedMs: Date.now() - startedAt,
  }
}

function shouldTryNextModel(error) {
  const status = error.response?.status
  const code = error.response?.data?.error?.code

  return status === 404 || status === 429 || code === 404 || code === 429
}

function logModelResult({ model, elapsedMs, rawChars, finalChars, fallbackUsed, reason }) {
  console.log(
    `[OpenRouter AB] model=${model} | elapsed=${elapsedMs}ms | raw=${rawChars} | final=${finalChars} | fallback=${fallbackUsed ? 'yes' : 'no'} | reason=${reason}`,
  )
}

async function generateSanitizedChatReply(payload, recentMessages = []) {
  const models = getTextModels()
  let lastError = null
  let lastFallback = null
  let lastSanitizedReason = 'no_model_attempted'

  for (const model of models) {
    try {
      const { response, elapsedMs } = await postChatCompletion(model, payload)
      const rawReply = response.data?.choices?.[0]?.message?.content?.trim()
      const sanitized = sanitizeAutoReplyDetailed(rawReply, recentMessages)

      lastSanitizedReason = sanitized.reason

      logModelResult({
        model,
        elapsedMs,
        rawChars: sanitized.rawChars,
        finalChars: sanitized.finalChars,
        fallbackUsed: sanitized.fallbackUsed,
        reason: sanitized.reason,
      })

      if (sanitized.text && !sanitized.fallbackUsed) {
        return sanitized.text
      }

      if (sanitized.text) {
        lastFallback = sanitized.text
      }

      if (shouldRetrySanitizedFailure(sanitized)) {
        console.warn(
          `[OpenRouter AB] model=${model} retornou ${sanitized.reason}; tentando próximo modelo antes de usar fallback.`,
        )
        continue
      }

      return sanitized.text || buildSafeFallbackReply(recentMessages)
    } catch (error) {
      lastError = error
      const elapsedInfo = error.config?.metadata?.startedAt
        ? `${Date.now() - error.config.metadata.startedAt}ms`
        : 'n/a'

      console.error(
        `⚠️ OpenRouter falhou no modelo ${model} | elapsed=${elapsedInfo}:`,
        error.response?.data || error.message,
      )

      if (!shouldTryNextModel(error)) {
        break
      }
    }
  }

  if (lastFallback) {
    console.warn('[OpenRouter AB] todos os modelos testados falharam/vazaram; usando último fallback seguro.')
    return lastFallback
  }

  const safeFallback = buildSafeFallbackReply(recentMessages)

  console.warn(
    `[OpenRouter AB] nenhum modelo gerou resposta aproveitável; usando fallback seguro | reason=${lastSanitizedReason} | lastError=${lastError?.message || 'none'}`,
  )

  return safeFallback
}
async function postChatCompletionWithFallback(payload, options = {}) {
  const models = getTextModels()
  let lastError = null

  for (const model of models) {
    const startedAt = Date.now()

    try {
      const response = await openrouter.post(
        '/chat/completions',
        {
          ...payload,
          model,
        },
        options,
      )

      console.log(
        `[OpenRouter] resposta OK | model=${model} | elapsed=${Date.now() - startedAt}ms`,
      )

      return { response, model }
    } catch (error) {
      const shouldTryNext = shouldTryNextModel(error)

      lastError = error

      console.error(
        `⚠️ OpenRouter falhou no modelo ${model} | elapsed=${Date.now() - startedAt}ms:`,
        error.response?.data || error.message,
      )

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

  return generateSanitizedChatReply(
    buildChatPayload(messages),
    recentMessages,
  )
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

  const { response, model } = await postChatCompletionWithFallback(
    buildChatPayload(messages, { stream: true }),
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
        const sanitized = sanitizeAutoReplyDetailed(fullTextRef.value, recentMessages)
        logModelResult({
          model,
          elapsedMs: 0,
          rawChars: sanitized.rawChars,
          finalChars: sanitized.finalChars,
          fallbackUsed: sanitized.fallbackUsed,
          reason: sanitized.reason,
        })
        resolve(sanitized.text)
      }
    })

    response.data.on('error', reject)

    response.data.on('end', () => {
      const sanitized = sanitizeAutoReplyDetailed(fullTextRef.value, recentMessages)
      logModelResult({
        model,
        elapsedMs: 0,
        rawChars: sanitized.rawChars,
        finalChars: sanitized.finalChars,
        fallbackUsed: sanitized.fallbackUsed,
        reason: sanitized.reason,
      })
      resolve(sanitized.text)
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
