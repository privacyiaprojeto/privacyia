import { Router } from 'express'
import {
  acceptActorInviteController,
  createActorOnboardingMappingCaseController,
  getActorOnboardingPortalController,
  registerActorOnboardingMappingAssetController,
} from '../controllers/actor-compliance.controller.js'
import { registerActorAuthByInviteController } from '../controllers/actor-auth.controller.js'

const router = Router()

router.get('/onboarding/invites/:inviteToken', getActorOnboardingPortalController)
router.post('/onboarding/invites/:inviteToken/register-auth', registerActorAuthByInviteController)
router.post('/onboarding/invites/:inviteToken/accept', acceptActorInviteController)
router.post('/onboarding/invites/:inviteToken/mapping-cases', createActorOnboardingMappingCaseController)
router.post('/onboarding/invites/:inviteToken/mapping-assets', registerActorOnboardingMappingAssetController)

export default router
