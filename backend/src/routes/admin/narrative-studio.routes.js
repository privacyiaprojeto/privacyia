import { Router } from 'express'
import {
  createNarrativeDraftController,
  getNarrativeStudioSpecController,
  inspectNarrativeDraftsController,
  listNarrativeDraftsController,
  inspectNarrativeStudioController,
  previewNarrativeProductController,
} from '../../controllers/narrative-studio.controller.js'
import {
  getNarrativeProductionConfigController,
  inspectNarrativeProductionController,
  previewNarrativeProductionController,
  requestNarrativeProductionController,
} from '../../controllers/narrative-production.controller.js'
import {
  getNarrativeOutputQaConfigController,
  inspectNarrativeOutputQaController,
  previewNarrativeOutputQaController,
  processNarrativeOutputQaController,
} from '../../controllers/narrative-output-qa.controller.js'
import {
  applyNarrativeOutputQaDecisionController,
  getNarrativeOutputQaDecisionConfigController,
  inspectNarrativeOutputQaDecisionController,
  previewNarrativeOutputQaDecisionController,
} from '../../controllers/narrative-output-qa-decision.controller.js'
import {
  applyNarrativeCardPublicationController,
  getNarrativeCardPublicationConfigController,
  inspectNarrativeCardPublicationController,
  previewNarrativeCardPublicationController,
} from '../../controllers/narrative-card-publication.controller.js'

import {
  applyNarrativeCardPurchaseSimulationController,
  getNarrativeCardPurchaseSimulationConfigController,
  inspectNarrativeCardPurchaseSimulationController,
  previewNarrativeCardPurchaseSimulationController,
} from '../../controllers/narrative-card-purchase-simulation.controller.js'

const router = Router()

router.get('/api/admin/narrative-studio/spec', getNarrativeStudioSpecController)
router.get('/api/admin/narrative-studio/inspect', inspectNarrativeStudioController)
router.get('/api/admin/narrative-studio/drafts', listNarrativeDraftsController)
router.get('/api/admin/narrative-studio/drafts/inspect', inspectNarrativeDraftsController)
router.post('/api/admin/narrative-studio/preview', previewNarrativeProductController)
router.post('/api/admin/narrative-studio/drafts', createNarrativeDraftController)

router.get('/api/admin/narrative-studio/production/config', getNarrativeProductionConfigController)
router.get('/api/admin/narrative-studio/production/inspect', inspectNarrativeProductionController)
router.post('/api/admin/narrative-studio/production/preview', previewNarrativeProductionController)
router.post('/api/admin/narrative-studio/production/request', requestNarrativeProductionController)

router.get('/api/admin/narrative-studio/output-qa/config', getNarrativeOutputQaConfigController)
router.get('/api/admin/narrative-studio/output-qa/inspect', inspectNarrativeOutputQaController)
router.post('/api/admin/narrative-studio/output-qa/preview', previewNarrativeOutputQaController)
router.post('/api/admin/narrative-studio/output-qa/process-simulated', processNarrativeOutputQaController)

router.get('/api/admin/narrative-studio/output-qa/decision/config', getNarrativeOutputQaDecisionConfigController)
router.get('/api/admin/narrative-studio/output-qa/decision/inspect', inspectNarrativeOutputQaDecisionController)
router.post('/api/admin/narrative-studio/output-qa/decision/preview', previewNarrativeOutputQaDecisionController)
router.post('/api/admin/narrative-studio/output-qa/decision/apply', applyNarrativeOutputQaDecisionController)

router.get('/api/admin/narrative-studio/card-publication/config', getNarrativeCardPublicationConfigController)
router.get('/api/admin/narrative-studio/card-publication/inspect', inspectNarrativeCardPublicationController)
router.post('/api/admin/narrative-studio/card-publication/preview', previewNarrativeCardPublicationController)
router.post('/api/admin/narrative-studio/card-publication/apply', applyNarrativeCardPublicationController)

router.get('/api/admin/narrative-studio/card-purchase-simulation/config', getNarrativeCardPurchaseSimulationConfigController)
router.get('/api/admin/narrative-studio/card-purchase-simulation/inspect', inspectNarrativeCardPurchaseSimulationController)
router.post('/api/admin/narrative-studio/card-purchase-simulation/preview', previewNarrativeCardPurchaseSimulationController)
router.post('/api/admin/narrative-studio/card-purchase-simulation/apply', applyNarrativeCardPurchaseSimulationController)

export default router
