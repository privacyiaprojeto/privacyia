import { Router } from 'express'
import {
  approveActorPipelineProductController,
  authorizeActorIdentityPreparationController,
  createActorPipelineProductionController,
  createActorIdentityLoraReadinessController,
  prepareActorIdentityTrainingExecutionPlanController,
  startActorIdentityTrainingController,
  refreshActorIdentityTrainingStatusController,
  startActorIdentityPreviewController,
  refreshActorIdentityPreviewStatusController,
  getActorIdentityPreviewMediaController,
  runActorIdentityVideoForensicAuditController,
  runActorIdentityTrainingTargetAuditController,
  decideActorIdentityReviewController,
  registerActorIdentityDatasetController,
  getActorIdentityLoraSummaryController,
  getActorIdentityDatasetReadinessController,
  getActorPipelineSummaryController,
  listActorPipelinePublicationProductsController,
  listActorPipelineReviewProductsController,
  publishActorPipelineProductController,
  rejectActorPipelineProductController,
} from '../../controllers/actor-pipeline.controller.js'

const router = Router()
const base = '/api/admin/actors/:actorId/pipeline'

router.get(`${base}/summary`, getActorPipelineSummaryController)
router.get(`${base}/identity-lora`, getActorIdentityLoraSummaryController)
router.get(`${base}/identity-lora/dataset-readiness`, getActorIdentityDatasetReadinessController)
router.post(`${base}/identity-preparation/authorize`, authorizeActorIdentityPreparationController)
router.post(`${base}/identity-lora/dataset-register`, registerActorIdentityDatasetController)
router.post(`${base}/identity-lora/readiness`, createActorIdentityLoraReadinessController)
router.post(`${base}/identity-lora/execution-plan`, prepareActorIdentityTrainingExecutionPlanController)
router.post(`${base}/identity-lora/train`, startActorIdentityTrainingController)
router.post(`${base}/identity-lora/training-status`, refreshActorIdentityTrainingStatusController)
router.post(`${base}/identity-lora/preview`, startActorIdentityPreviewController)
router.post(`${base}/identity-lora/preview-status`, refreshActorIdentityPreviewStatusController)
router.get(`${base}/identity-lora/preview-media`, getActorIdentityPreviewMediaController)
router.post(`${base}/identity-lora/forensic-audit`, runActorIdentityVideoForensicAuditController)
router.post(`${base}/identity-lora/training-target-audit`, runActorIdentityTrainingTargetAuditController)
router.post(`${base}/identity-lora/review-decision`, decideActorIdentityReviewController)
router.post(`${base}/production`, createActorPipelineProductionController)
router.get(`${base}/review-products`, listActorPipelineReviewProductsController)
router.get(`${base}/publication-products`, listActorPipelinePublicationProductsController)
router.post(`${base}/products/:assetId/approve`, approveActorPipelineProductController)
router.post(`${base}/products/:assetId/reject`, rejectActorPipelineProductController)
router.post(`${base}/products/:assetId/publish`, publishActorPipelineProductController)

export default router
