import { supabaseAdmin } from '../config/supabase.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { uploadAudioBuffer } from './storage.service.js'
import { getReferenceAudioBase64, selectVoiceProfile } from './voiceProfile.service.js'
import { generateSpeechWithRunPod } from './providers/runpod.provider.js'
import { normalizeTextForAudioLimit, prepareTextForTts } from './ttsText.service.js'

const audioGenerationLocks = new Set()

function normalizeSpeechText(value) {
  return normalizeTextForAudioLimit(value)
}

function getAudioTextLength(value) {
  return normalizeSpeechText(value).length
}

function buildLockKey({ conversationId, messageId }) {
  return `${conversationId}:${messageId}`
}

async function getOwnedConversation(profileId, conversationId) {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, profile_id, companion_id, relationship_type, current_mood')
    .eq('id', conversationId)
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao validar conversa.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Conversa não encontrada.')
  }

  return data
}

async function getMessageForAudio({ conversationId, messageId }) {
  const { data, error } = await supabaseAdmin
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_type,
      content,
      audio_url,
      audio_allowed,
      audio_status,
      audio_provider,
      audio_voice_profile_id
    `)
    .eq('id', messageId)
    .eq('conversation_id', conversationId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar mensagem para áudio.', error)
  }

  if (!data) {
    throw new ApiError(404, 'Mensagem não encontrada nesta conversa.')
  }

  return data
}

async function updateMessageAudioState(messageId, payload) {
  const { error } = await supabaseAdmin
    .from('messages')
    .update(payload)
    .eq('id', messageId)

  if (error) {
    throw new ApiError(500, 'Erro ao atualizar estado do áudio da mensagem.', error)
  }
}

function validateMessageCanGenerateAudio(message) {
  if (message.sender_type !== 'atriz') {
    throw new ApiError(400, 'Áudio só pode ser gerado para mensagens da atriz.')
  }

  if (message.audio_url) {
    return
  }

  if (message.audio_allowed === false) {
    throw new ApiError(403, 'Áudio não está habilitado para esta mensagem.')
  }

  const maxChars = Number(env.TTS_MAX_CHARS || 350)
  const textLength = getAudioTextLength(message.content)

  if (textLength > maxChars) {
    throw new ApiError(
      413,
      `Mensagem muito longa para áudio. Limite atual: ${maxChars} caracteres. Esta mensagem tem ${textLength} caracteres.`,
    )
  }
}

async function blockLongMessageAudio(message) {
  const maxChars = Number(env.TTS_MAX_CHARS || 350)
  const textLength = getAudioTextLength(message.content)

  if (textLength <= maxChars || message.audio_url) {
    return false
  }

  await updateMessageAudioState(message.id, {
    audio_allowed: false,
    audio_status: 'blocked_too_long',
    audio_error: `Mensagem com ${textLength} caracteres excede o limite de ${maxChars}.`,
  })

  return true
}

export async function generateMessageAudio({ profileId, conversationId, messageId }) {
  const conversation = await getOwnedConversation(profileId, conversationId)
  const message = await getMessageForAudio({ conversationId: conversation.id, messageId })

  if (message.audio_url) {
    return {
      audioUrl: message.audio_url,
      cached: true,
      audioStatus: message.audio_status || 'completed',
    }
  }

  const wasBlocked = await blockLongMessageAudio(message)

  if (wasBlocked) {
    validateMessageCanGenerateAudio({ ...message, audio_allowed: false })
  }

  validateMessageCanGenerateAudio(message)

  const lockKey = buildLockKey({ conversationId: conversation.id, messageId: message.id })

  if (audioGenerationLocks.has(lockKey)) {
    throw new ApiError(409, 'O áudio desta mensagem já está sendo gerado. Tente novamente em instantes.')
  }

  audioGenerationLocks.add(lockKey)

  try {
    // Revalidação de cache dentro do lock para evitar jobs duplicados no RunPod.
    const freshMessage = await getMessageForAudio({ conversationId: conversation.id, messageId: message.id })

    if (freshMessage.audio_url) {
      return {
        audioUrl: freshMessage.audio_url,
        cached: true,
        audioStatus: freshMessage.audio_status || 'completed',
      }
    }

    validateMessageCanGenerateAudio(freshMessage)

    await updateMessageAudioState(message.id, {
      audio_status: 'generating',
      audio_error: null,
    })

    const voiceProfile = await selectVoiceProfile({
      companionId: conversation.companion_id,
      text: freshMessage.content,
      currentMood: conversation.current_mood,
    })

    const cleanText = prepareTextForTts(freshMessage.content, {
      profileKey: voiceProfile.profileKey,
    })

    console.log(
      `[TTS Gateway] texto normalizado | original=${String(freshMessage.content || '').length} chars | tts=${cleanText.length} chars | perfil=${voiceProfile.profileKey}`,
    )

    const referenceAudio = await getReferenceAudioBase64(voiceProfile.referenceAudioUrl)

    const generatedAudio = await generateSpeechWithRunPod({
      text: cleanText,
      voiceProfile,
      referenceAudio,
    })

    const extension = generatedAudio.extension || 'mp3'
    const audioKey = `audio/messages/${message.id}-${voiceProfile.profileKey}-${Date.now()}.${extension}`
    const audioUrl = await uploadAudioBuffer({
      buffer: generatedAudio.buffer,
      key: audioKey,
      contentType: generatedAudio.mimeType || 'audio/mpeg',
    })

    await updateMessageAudioState(message.id, {
      audio_url: audioUrl,
      audio_status: 'completed',
      audio_provider: voiceProfile.provider || 'runpod_fish_speech',
      audio_voice_profile_id: voiceProfile.id,
      audio_error: null,
      audio_generated_at: new Date().toISOString(),
    })

    return {
      audioUrl,
      cached: false,
      audioStatus: 'completed',
      voiceProfile: {
        id: voiceProfile.id,
        profileKey: voiceProfile.profileKey,
        emotion: voiceProfile.emotion,
      },
    }
  } catch (error) {
    if (!(error instanceof ApiError)) {
      await updateMessageAudioState(message.id, {
        audio_status: 'failed',
        audio_error: String(error?.message || 'Erro desconhecido ao gerar áudio.').slice(0, 500),
      }).catch((updateError) => {
        console.error('⚠️ Falha ao persistir erro de áudio:', updateError.message)
      })
    }

    throw error
  } finally {
    audioGenerationLocks.delete(lockKey)
  }
}
