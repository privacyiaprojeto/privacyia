import {
  getFactoryAdminSummary,
  listFactoryPublishableProducts,
  updateFactoryPublishableProductPublication,
  grantFactoryAssetToProfile,
  listFactoryAdminAssets,
  listFactoryAdminBatches,
  listFactoryAdminBatchItems,
  listFactoryAdminDeliveries,
  getFactoryAdminImageCycle,
} from '../services/factory-admin.service.js'
import {
  listCommercialPricingAudit,
  resolveCommercialPriceForAsset,
  updateAssetCommercialPrice,
  updateCombinationCommercialPrice,
  updateBatchCommercialPrice,
} from '../services/commercial-pricing.service.js'
import { getAdminFinancialSalesReport } from '../services/admin-finance.service.js'
import {
  getActorPayoutFinanceReport,
  updateActorPayoutRule,
} from '../services/actor-finance.service.js'
import { getOperationalMarginReport } from '../services/operational-cost.service.js'
import { getAdmin360FinancialReport } from '../services/admin-360.service.js'
import {
  getDemoTestDataHygieneAudit,
  archiveDemoTestDataLogically,
} from '../services/demo-test-hygiene.service.js'
import {
  preflightControlledSingleRealImageProduction,
  startControlledSingleRealImageProduction,
} from '../services/controlled-real-production.service.js'





export async function preflightControlledSingleRealImageProductionController(req, res, next) {
  try {
    const result = await preflightControlledSingleRealImageProduction({
      ...(req.query || {}),
      ...(req.body || {}),
      companionId: req.body?.companionId || req.body?.companion_id || req.query?.companionId || req.query?.companion_id || null,
      selections: req.body?.selections || {},
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function startControlledSingleRealImageProductionController(req, res, next) {
  try {
    const result = await startControlledSingleRealImageProduction(req.body || {}, {
      actorProfileId: req.auth?.profile?.id || null,
    })

    return res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getDemoTestDataHygieneAuditController(req, res, next) {
  try {
    const result = await getDemoTestDataHygieneAudit({
      limit: req.query?.limit || 1000,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function archiveDemoTestDataLogicallyController(req, res, next) {
  try {
    const result = await archiveDemoTestDataLogically({
      dryRun: req.body?.dryRun ?? req.query?.dryRun ?? true,
      confirmPhrase: req.body?.confirmPhrase || req.body?.confirmation || '',
      limit: req.body?.limit || req.query?.limit || 1000,
      reason: req.body?.reason || 'admin_controlled_demo_test_archive',
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAdmin360FinancialReportController(req, res, next) {
  try {
    const result = await getAdmin360FinancialReport({
      period: req.query?.period || '30d',
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 500,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getOperationalMarginReportController(req, res, next) {
  try {
    const result = await getOperationalMarginReport({
      period: req.query?.period || '30d',
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 500,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getActorPayoutFinanceReportController(req, res, next) {
  try {
    const result = await getActorPayoutFinanceReport({
      period: req.query?.period || '30d',
      limit: req.query?.limit || 500,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateActorPayoutRuleController(req, res, next) {
  try {
    const result = await updateActorPayoutRule(
      req.params?.actorId,
      req.body || {},
      { adminProfileId: req.auth?.profile?.id || null },
    )

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getAdminFinancialSalesReportController(req, res, next) {
  try {
    const result = await getAdminFinancialSalesReport({
      period: req.query?.period || '30d',
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 300,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function getFactoryAdminSummaryController(req, res, next) {
  try {
    const result = await getFactoryAdminSummary()

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}


// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_START
export async function getFactoryAdminImageCycleController(req, res, next) {
  try {
    const result = await getFactoryAdminImageCycle({
      status: req.query?.status || 'all',
      limit: req.query?.limit || 24,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
// M4.9B_ADMIN_IMAGE_CYCLE_WIRING_END

export async function listFactoryAdminAssetsController(req, res, next) {
  try {
    const result = await listFactoryAdminAssets({
      status: req.query?.status || null,
      mediaType: req.query?.mediaType || null,
      companionId: req.query?.companionId || null,
      combinationId: req.query?.combinationId || null,
      limit: req.query?.limit || 30,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listFactoryAdminBatchesController(req, res, next) {
  try {
    const result = await listFactoryAdminBatches({
      status: req.query?.status || null,
      companionId: req.query?.companionId || null,
      limit: req.query?.limit || 30,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listFactoryAdminBatchItemsController(req, res, next) {
  try {
    const result = await listFactoryAdminBatchItems({
      batchId: req.params?.batchId,
      status: req.query?.status || null,
      limit: req.query?.limit || 50,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listFactoryAdminDeliveriesController(req, res, next) {
  try {
    const result = await listFactoryAdminDeliveries({
      profileId: req.query?.profileId || null,
      companionId: req.query?.companionId || null,
      combinationId: req.query?.combinationId || null,
      mediaType: req.query?.mediaType || null,
      limit: req.query?.limit || 30,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}



export async function listFactoryPublishableProductsController(req, res, next) {
  try {
    const result = await listFactoryPublishableProducts({
      status: req.query?.status || 'available',
      publicationStatus: req.query?.publicationStatus || req.query?.publication || 'all',
      mediaType: req.query?.mediaType || null,
      companionId: req.query?.companionId || null,
      limit: req.query?.limit || 80,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateFactoryPublishableProductPublicationController(req, res, next) {
  try {
    const result = await updateFactoryPublishableProductPublication(
      req.params?.assetId,
      req.body || {},
      { actorProfileId: req.auth?.profile?.id || null },
    )

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function grantFactoryAssetController(req, res, next) {
  try {
    const result = await grantFactoryAssetToProfile({
      actorProfileId: req.auth?.profile?.id || null,
      targetProfileId: req.body?.targetProfileId || req.body?.profileId || null,
      assetId: req.params?.assetId,
      deliverySource: req.body?.deliverySource || 'admin_grant',
    })

    return res.status(result?.alreadyDelivered ? 200 : 201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function listCommercialPricingAuditController(req, res, next) {
  try {
    const result = await listCommercialPricingAudit({
      companionId: req.query?.companionId || null,
      mediaType: req.query?.mediaType || null,
      status: req.query?.status || 'available',
      limit: req.query?.limit || 80,
      offset: req.query?.offset || 0,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function quoteCommercialPriceController(req, res, next) {
  try {
    const assetId = req.body?.assetId || req.query?.assetId || req.params?.assetId || null
    const result = await resolveCommercialPriceForAsset({ assetId })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateAssetCommercialPriceController(req, res, next) {
  try {
    const result = await updateAssetCommercialPrice(
      req.params?.assetId,
      req.body || {},
      { actorProfileId: req.auth?.profile?.id || null },
    )

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateCombinationCommercialPriceController(req, res, next) {
  try {
    const result = await updateCombinationCommercialPrice(
      req.params?.combinationId,
      req.body || {},
      { actorProfileId: req.auth?.profile?.id || null },
    )

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}

export async function updateBatchCommercialPriceController(req, res, next) {
  try {
    const result = await updateBatchCommercialPrice(
      req.params?.batchId,
      req.body || {},
      { actorProfileId: req.auth?.profile?.id || null },
    )

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
