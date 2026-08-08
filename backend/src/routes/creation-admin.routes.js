import { Router } from 'express'
import {
  createCreationItemsController,
  createCreationTitleController,
  createGuidedCombinationDraftController,
  createGuidedProductionBatchController,
  getAvatarCreationOptionsController,
  listClientCreationModelsController,
  listContentTypesController,
  listCreationAvatarsController,
  listCreationTitlesController,
  previewGuidedCombinationsController,
  saveAvatarCreationOptionsController,
  updateCreationItemController,
  updateClientCreationModelVisibilityController,
  updateCreationTitleController,
} from '../controllers/creation-admin.controller.js'

const router = Router()

router.get('/api/admin/creation/content-types', listContentTypesController)
router.get('/api/admin/creation/titles', listCreationTitlesController)
router.post('/api/admin/creation/titles', createCreationTitleController)
router.patch('/api/admin/creation/titles/:titleId', updateCreationTitleController)
router.post('/api/admin/creation/titles/:titleId/items', createCreationItemsController)
router.patch('/api/admin/creation/items/:itemId', updateCreationItemController)
router.get('/api/admin/creation/avatars', listCreationAvatarsController)
router.get('/api/admin/avatars/:avatarId/creation-options', getAvatarCreationOptionsController)
router.put('/api/admin/avatars/:avatarId/creation-options', saveAvatarCreationOptionsController)
router.post('/api/admin/creation/combinations/preview', previewGuidedCombinationsController)
router.post('/api/admin/creation/combinations', createGuidedCombinationDraftController)
router.post('/api/admin/creation/production-batches', createGuidedProductionBatchController)
router.get('/api/admin/creation/client-models', listClientCreationModelsController)
router.patch('/api/admin/creation/client-models/:combinationId/visibility', updateClientCreationModelVisibilityController)

export default router
