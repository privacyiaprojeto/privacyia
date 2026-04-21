import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { authMiddleware } from '../middlewares/auth.middleware.js'
import {
  changePasswordController,
  loginController,
  meController,
  signUpController,
} from '../controllers/auth.controller.js'

const router = Router()

router.post('/login', asyncHandler(loginController))
router.post('/sign-up', asyncHandler(signUpController))
router.get('/me', authMiddleware, asyncHandler(meController))
router.post('/change-password', authMiddleware, asyncHandler(changePasswordController))

export { router as authRoutes }
