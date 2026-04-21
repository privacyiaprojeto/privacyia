import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import { loginController, signUpController } from '../controllers/auth.controller.js'

const router = Router()

router.post('/login', asyncHandler(loginController))
router.post('/sign-up', asyncHandler(signUpController))

export { router as authRoutes }
