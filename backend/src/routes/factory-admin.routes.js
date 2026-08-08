import { Router } from 'express'
import {
  getFactoryAdminSummaryController,
  getFactoryAdminImageCycleController,
  getDemoTestDataHygieneAuditController,
  archiveDemoTestDataLogicallyController,
  preflightControlledSingleRealImageProductionController,
  startControlledSingleRealImageProductionController,
  getAdmin360FinancialReportController,
  getAdminFinancialSalesReportController,
  getActorPayoutFinanceReportController,
  getOperationalMarginReportController,
  updateActorPayoutRuleController,
  listFactoryPublishableProductsController,
  updateFactoryPublishableProductPublicationController,
  grantFactoryAssetController,
  listFactoryAdminAssetsController,
  listFactoryAdminBatchesController,
  listFactoryAdminBatchItemsController,
  listFactoryAdminDeliveriesController,
  listCommercialPricingAuditController,
  quoteCommercialPriceController,
  updateAssetCommercialPriceController,
  updateCombinationCommercialPriceController,
  updateBatchCommercialPriceController,
} from '../controllers/factory-admin.controller.js'

const router = Router()

router.get('/api/admin/factory/summary', getFactoryAdminSummaryController)
router.get('/api/admin/factory/image-cycle', getFactoryAdminImageCycleController)
router.get('/api/admin/factory/hygiene/demo-test/audit', getDemoTestDataHygieneAuditController)
router.post('/api/admin/factory/hygiene/demo-test/archive', archiveDemoTestDataLogicallyController)
router.post('/api/admin/factory/real-production/single-item/preflight', preflightControlledSingleRealImageProductionController)
router.post('/api/admin/factory/real-production/single-item', startControlledSingleRealImageProductionController)
router.get('/api/admin/factory/financial/admin-360-report', getAdmin360FinancialReportController)
router.get('/api/admin/factory/financial/sales-report', getAdminFinancialSalesReportController)
router.get('/api/admin/factory/financial/actor-payouts-report', getActorPayoutFinanceReportController)
router.get('/api/admin/factory/financial/operational-margin-report', getOperationalMarginReportController)
router.patch('/api/admin/factory/financial/actors/:actorId/payout-rule', updateActorPayoutRuleController)
router.get('/api/admin/factory/assets', listFactoryAdminAssetsController)
router.get('/api/admin/factory/publishable-products', listFactoryPublishableProductsController)
router.get('/api/admin/factory/commercial-pricing/audit', listCommercialPricingAuditController)
router.post('/api/admin/factory/commercial-pricing/quote', quoteCommercialPriceController)
router.get('/api/admin/factory/assets/:assetId/commercial-price', quoteCommercialPriceController)
router.patch('/api/admin/factory/assets/:assetId/commercial-price', updateAssetCommercialPriceController)
router.patch('/api/admin/factory/combinations/:combinationId/commercial-price', updateCombinationCommercialPriceController)
router.patch('/api/admin/factory/batches/:batchId/commercial-price', updateBatchCommercialPriceController)
router.patch('/api/admin/factory/publishable-products/:assetId/publication', updateFactoryPublishableProductPublicationController)
router.post('/api/admin/factory/assets/:assetId/grant', grantFactoryAssetController)
router.get('/api/admin/factory/batches', listFactoryAdminBatchesController)
router.get('/api/admin/factory/batches/:batchId/items', listFactoryAdminBatchItemsController)
router.get('/api/admin/factory/deliveries', listFactoryAdminDeliveriesController)

export default router
