import { parseOrThrow } from '../utils/validators.js'
import {
  createAudioStorylineSchema,
  createPromptDictionarySchema,
  intelligenceItemIdParamSchema,
  listAudioStorylinesQuerySchema,
  listPromptDictionariesQuerySchema,
  updateAudioStorylineSchema,
  updatePromptDictionarySchema,
} from '../validators/intelligence-center.schemas.js'
import {
  createAudioStoryline,
  createPromptDictionary,
  listAudioStorylines,
  listPromptDictionaries,
  updateAudioStoryline,
  updatePromptDictionary,
} from '../services/intelligence-center.service.js'

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

function adminProfileId(req) {
  return req.auth?.profile?.id || null
}

export async function listPromptDictionariesController(req, res, next) {
  try {
    const query = parseOrThrow(listPromptDictionariesQuerySchema, req.query || {})
    return ok(res, await listPromptDictionaries(query))
  } catch (error) {
    return next(error)
  }
}

export async function createPromptDictionaryController(req, res, next) {
  try {
    const input = parseOrThrow(createPromptDictionarySchema, req.body || {})
    return ok(res, await createPromptDictionary(input, { adminProfileId: adminProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function updatePromptDictionaryController(req, res, next) {
  try {
    const { itemId } = parseOrThrow(intelligenceItemIdParamSchema, req.params || {})
    const input = parseOrThrow(updatePromptDictionarySchema, req.body || {})
    return ok(res, await updatePromptDictionary(itemId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function listAudioStorylinesController(req, res, next) {
  try {
    const query = parseOrThrow(listAudioStorylinesQuerySchema, req.query || {})
    return ok(res, await listAudioStorylines(query))
  } catch (error) {
    return next(error)
  }
}

export async function createAudioStorylineController(req, res, next) {
  try {
    const input = parseOrThrow(createAudioStorylineSchema, req.body || {})
    return ok(res, await createAudioStoryline(input, { adminProfileId: adminProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function updateAudioStorylineController(req, res, next) {
  try {
    const { itemId } = parseOrThrow(intelligenceItemIdParamSchema, req.params || {})
    const input = parseOrThrow(updateAudioStorylineSchema, req.body || {})
    return ok(res, await updateAudioStoryline(itemId, input, { adminProfileId: adminProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}
