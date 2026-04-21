import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  getFeedPostsController,
  getFeedSuggestionsController,
  getFeedTop10Controller,
  likeFeedPostController,
  saveFeedPostController,
} from '../controllers/feed.controller.js'

const router = Router()

router.get('/posts', asyncHandler(getFeedPostsController))
router.get('/sugestoes', asyncHandler(getFeedSuggestionsController))
router.get('/top10', asyncHandler(getFeedTop10Controller))
router.post('/posts/:postId/curtir', asyncHandler(likeFeedPostController))
router.post('/posts/:postId/salvar', asyncHandler(saveFeedPostController))

export { router as feedRoutes }
