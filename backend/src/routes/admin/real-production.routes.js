import { Router } from 'express'
import { getAdminOperationalDashboardController } from '../../controllers/admin-operational-dashboard.controller.js'
import {
  getAdminRealProductionReadiness,
} from '../../controllers/admin-real-production-readiness.controller.js'
import {
  getRealProductionPrepConfigController,
  inspectRealProductionCandidateController,
} from '../../controllers/admin-real-production-prep.controller.js'
import {
  configureRealProductionCandidateController,
  getRealProductionCandidateConfigController,
} from '../../controllers/admin-real-production-candidate-config.controller.js'
import {
  auditRealProductionAvatarComplianceController,
  configureRealProductionAvatarComplianceController,
  getRealProductionAvatarComplianceConfigController,
} from '../../controllers/admin-real-production-avatar-compliance.controller.js'
import {
  createRealProductionCombinationController,
  getRealProductionCombinationCreateConfigController,
  previewRealProductionCombinationCreateController,
} from '../../controllers/admin-real-production-combination-create.controller.js'
import {
  auditRealProductionExecutionController,
  previewRealProductionExecutionController,
  startRealProductionExecutionController,
} from '../../controllers/admin-real-production-execution.controller.js'
import {
  getRealProductionAuditConfigController,
  postJobRealProductionAuditController,
  preRunRealProductionAuditController,
  watchPostJobRealProductionAuditController,
} from '../../controllers/admin-real-production-audit.controller.js'
import {
  getRealProductionWatchdogConfigController,
  inspectRealProductionStuckJobController,
  markRealProductionStuckJobFailedController,
} from '../../controllers/admin-real-production-watchdog.controller.js'
import {
  decideRealProductionQaAssetController,
  getRealProductionQaControlConfigController,
  inspectRealProductionQaAssetController,
} from '../../controllers/admin-real-production-qa-control.controller.js'
import {
  decideRealProductionReleaseController,
  getRealProductionReleaseConfigController,
  inspectRealProductionReleaseController,
} from '../../controllers/admin-real-production-release.controller.js'

const router = Router()
const base = '/api/admin/factory/real-production'

// Leitura operacional consolidada para o Painel Admin do Milestone 4.
router.get('/api/admin/factory/operational-dashboard', getAdminOperationalDashboardController)

// Readiness e preparação do candidato/produto.
router.get(`${base}/readiness`, getAdminRealProductionReadiness)
router.get(`${base}/prep/config`, getRealProductionPrepConfigController)
router.post(`${base}/prep/inspect`, inspectRealProductionCandidateController)
router.get(`${base}/candidate-config/config`, getRealProductionCandidateConfigController)
router.post(`${base}/candidate-config/configure`, configureRealProductionCandidateController)

// Conformidade e combinação real controlada.
router.get(`${base}/avatar-compliance/config`, getRealProductionAvatarComplianceConfigController)
router.get(`${base}/avatar-compliance/audit`, auditRealProductionAvatarComplianceController)
router.post(`${base}/avatar-compliance/configure`, configureRealProductionAvatarComplianceController)
router.get(`${base}/combinations/config`, getRealProductionCombinationCreateConfigController)
router.post(`${base}/combinations/preview`, previewRealProductionCombinationCreateController)
router.post(`${base}/combinations/create`, createRealProductionCombinationController)

// Execução real controlada. O start continua protegido por readiness, envs, frase e executeQueue.
router.post(`${base}/execution/preview`, previewRealProductionExecutionController)
router.post(`${base}/execution/start`, startRealProductionExecutionController)
router.get(`${base}/execution/:batchId/audit`, auditRealProductionExecutionController)

// Auditoria e watchdog.
router.get(`${base}/audit/config`, getRealProductionAuditConfigController)
router.post(`${base}/audit/pre-run`, preRunRealProductionAuditController)
router.post(`${base}/audit/post-job`, postJobRealProductionAuditController)
router.post(`${base}/audit/watch`, watchPostJobRealProductionAuditController)
router.get(`${base}/watchdog/config`, getRealProductionWatchdogConfigController)
router.post(`${base}/watchdog/inspect`, inspectRealProductionStuckJobController)
router.post(`${base}/watchdog/mark-failed`, markRealProductionStuckJobFailedController)

// QA pós-produção real e release/publicação controlada.
router.get(`${base}/qa/config`, getRealProductionQaControlConfigController)
router.post(`${base}/qa/inspect`, inspectRealProductionQaAssetController)
router.post(`${base}/qa/decision`, decideRealProductionQaAssetController)
router.get(`${base}/release/config`, getRealProductionReleaseConfigController)
router.post(`${base}/release/inspect`, inspectRealProductionReleaseController)
router.post(`${base}/release/decision`, decideRealProductionReleaseController)

export default router
