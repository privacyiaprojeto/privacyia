import { Router } from 'express'
import {
  createMappingRequirementController,
  inactivateMappingRequirementController,
  listMappingRequirementsAdminController,
  updateMappingRequirementController,
} from '../controllers/mapping-requirements.controller.js'
import {
  approveKycAssetController,
  approveKycCaseController,
  auditKycAssetVaultController,
  authorizeAvatarProductionController,
  blockActorProfileController,
  createActorProfileController,
  createKycCaseController,
  createKycAssetEditedCopyController,
  generateActorInviteController,
  getKycCaseController,
  getKycCaseMappingChecklistController,
  getAvatarComplianceReportController,
  listActorKycCasesController,
  listMappingVaultTestArtifactsController,
  listActorProfilesController,
  listAvatarProductionAuthorizationsController,
  quarantineMappingVaultTestArtifactsController,
  registerKycAssetController,
  reclassifyKycAssetController,
  rejectKycAssetController,
  rejectKycCaseController,
  revokeAvatarProductionAuthorizationController,
  unblockActorProfileController,
  viewKycAssetVaultController,
} from '../controllers/actor-compliance.controller.js'

const router = Router()

router.get('/api/admin/mapping-requirements', listMappingRequirementsAdminController)
router.post('/api/admin/mapping-requirements', createMappingRequirementController)
router.patch('/api/admin/mapping-requirements/:requirementId', updateMappingRequirementController)
router.post('/api/admin/mapping-requirements/:requirementId/inactivate', inactivateMappingRequirementController)

router.get('/api/admin/actor-mapping/vault-test-artifacts', listMappingVaultTestArtifactsController)
router.post('/api/admin/actor-mapping/vault-test-artifacts/quarantine', quarantineMappingVaultTestArtifactsController)

router.get('/api/admin/actors', listActorProfilesController)
router.post('/api/admin/actors', createActorProfileController)
router.patch('/api/admin/actors/:actorId/block', blockActorProfileController)
router.patch('/api/admin/actors/:actorId/unblock', unblockActorProfileController)
router.post('/api/admin/actors/:actorId/invites', generateActorInviteController)
router.post('/api/admin/actors/:actorId/kyc-cases', createKycCaseController)
router.get('/api/admin/actors/:actorId/kyc-cases', listActorKycCasesController)

router.get('/api/admin/kyc-cases/:kycCaseId', getKycCaseController)
router.get('/api/admin/kyc-cases/:kycCaseId/mapping-checklist', getKycCaseMappingChecklistController)
router.post('/api/admin/kyc-cases/:kycCaseId/assets', registerKycAssetController)
router.get('/api/admin/kyc-assets/:assetId/vault-audit', auditKycAssetVaultController)
router.get('/api/admin/kyc-assets/:assetId/private-view', viewKycAssetVaultController)
router.post('/api/admin/kyc-assets/:assetId/edited-copy', createKycAssetEditedCopyController)
router.post('/api/admin/kyc-assets/:assetId/reclassify', reclassifyKycAssetController)
router.post('/api/admin/kyc-assets/:assetId/approve', approveKycAssetController)
router.post('/api/admin/kyc-assets/:assetId/reject', rejectKycAssetController)
router.post('/api/admin/kyc-cases/:kycCaseId/approve', approveKycCaseController)
router.post('/api/admin/kyc-cases/:kycCaseId/reject', rejectKycCaseController)

router.get('/api/admin/avatars/:avatarId/compliance-report', getAvatarComplianceReportController)
router.get('/api/admin/avatars/:avatarId/production-authorizations', listAvatarProductionAuthorizationsController)
router.post('/api/admin/avatars/:avatarId/production-authorizations', authorizeAvatarProductionController)
router.post('/api/admin/avatar-production-authorizations/:authorizationId/revoke', revokeAvatarProductionAuthorizationController)

export default router
