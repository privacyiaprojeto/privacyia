import { Router } from 'express'
import {
  createAudioStorylineController,
  createPromptDictionaryController,
  listAudioStorylinesController,
  listPromptDictionariesController,
  updateAudioStorylineController,
  updatePromptDictionaryController,
} from '../../controllers/intelligence-center.controller.js'

const router = Router()
const base = '/api/admin/intelligence'

router.get(`${base}/prompt-dictionaries`, listPromptDictionariesController)
router.post(`${base}/prompt-dictionaries`, createPromptDictionaryController)
router.patch(`${base}/prompt-dictionaries/:itemId`, updatePromptDictionaryController)

router.get(`${base}/audio-storylines`, listAudioStorylinesController)
router.post(`${base}/audio-storylines`, createAudioStorylineController)
router.patch(`${base}/audio-storylines/:itemId`, updateAudioStorylineController)

export default router
