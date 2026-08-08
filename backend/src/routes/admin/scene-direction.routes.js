import { Router } from 'express'
import {
  completeBaseSceneUploadController,
  createBaseScenePreviewController,
  createBaseSceneUploadController,
  createSceneDirectionController,
  getProductSplitsController,
  listBaseScenesController,
  listSceneCastingCandidatesController,
  listSceneDirectionsController,
  listSplitBeneficiariesController,
  replaceProductSplitsController,
  updateBaseSceneController,
} from '../../controllers/scene-direction.controller.js'

const router = Router()
const base = '/api/admin/scene-direction'

router.get(`${base}/base-scenes`, listBaseScenesController)
router.post(`${base}/base-scenes/upload-session`, createBaseSceneUploadController)
router.post(`${base}/base-scenes/:sceneId/complete`, completeBaseSceneUploadController)
router.patch(`${base}/base-scenes/:sceneId`, updateBaseSceneController)
router.get(`${base}/base-scenes/:sceneId/preview`, createBaseScenePreviewController)

router.get(`${base}/casting-candidates`, listSceneCastingCandidatesController)
router.get(`${base}/directions`, listSceneDirectionsController)
router.post(`${base}/directions`, createSceneDirectionController)

router.get(`${base}/beneficiaries`, listSplitBeneficiariesController)
router.get(`${base}/products/:productId/splits`, getProductSplitsController)
router.put(`${base}/products/:productId/splits`, replaceProductSplitsController)

export default router
