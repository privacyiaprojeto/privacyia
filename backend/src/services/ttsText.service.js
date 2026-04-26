function toStringSafe(value) {
  return String(value || '')
}

function removeEmojis(value) {
  return toStringSafe(value)
    .replace(/[\u{1F1E6}-\u{1F1FF}]/gu, '')
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{FE0F}\u{200D}]/gu, '')
}

function removeMarkdownNoise(value) {
  return toStringSafe(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*_~#>]+/g, ' ')
}

function removeRoleplayStageDirections(value) {
  return toStringSafe(value)
    .replace(/\[[^\]]{1,80}\]/g, ' ')
    .replace(/\((?:sussurrando|rindo|sorri|sorrindo|pausa|suspiro|voz baixa|calma|emocionada|emocionado)[^)]{0,80}\)/giu, ' ')
}

function normalizePortugueseSpeech(value) {
  return toStringSafe(value)
    .replace(/\bdormir bem\b/giu, 'durma bem')
    .replace(/\bboa noite,?\s*durma bem\b/giu, 'boa noite... durma bem')
    .replace(/\bpra\b/giu, 'para')
    .replace(/\bpro\b/giu, 'para o')
    .replace(/\btô\b/giu, 'estou')
    .replace(/\btá\b/giu, 'está')
    .replace(/\bvc\b/giu, 'você')
    .replace(/\bcê\b/giu, 'você')
}

function normalizePauses(value, profileKey = 'neutral') {
  let text = toStringSafe(value)
    .replace(/\.{4,}/g, '...')
    .replace(/\s*\.\.\.\s*/g, '... ')
    .replace(/\s*([?!])\s*/g, '$1 ')
    .replace(/\s*([,;:])\s*/g, '$1 ')
    .replace(/\s*\.\s*/g, '. ')

  const emotionalProfiles = new Set(['soft_night', 'caring', 'soft', 'whisper'])

  if (emotionalProfiles.has(profileKey)) {
    text = text
      .replace(/\bBoa noite, meu amor\b/giu, 'Boa noite, meu amor...')
      .replace(/\bEstou aqui, ouvindo\b/giu, 'Eu estou aqui... ouvindo')
      .replace(/\bEstou aqui\b/giu, 'Eu estou aqui')
      .replace(/\bEstou pertinho\b/giu, 'Estou pertinho')
      .replace(/\bTe amo\b/giu, 'Te amo...')
  }

  return text
}

function collapseWhitespace(value) {
  return toStringSafe(value)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitLongSpeechSentences(value) {
  const text = collapseWhitespace(value)
  const parts = text.match(/[^.!?…]+[.!?…]*/gu) || [text]

  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n')
}

export function normalizeTextForAudioLimit(value) {
  return collapseWhitespace(
    normalizePortugueseSpeech(
      removeRoleplayStageDirections(
        removeMarkdownNoise(
          removeEmojis(value),
        ),
      ),
    ),
  )
}

export function prepareTextForTts(value, { profileKey = 'neutral' } = {}) {
  const cleaned = normalizeTextForAudioLimit(value)
  const withPauses = normalizePauses(cleaned, profileKey)

  return splitLongSpeechSentences(withPauses)
}
