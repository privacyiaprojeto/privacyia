import { Router } from 'express'
import {
  mediaDeliveriesRateLimit,
  protectedMediaViewRateLimit,
} from '../middlewares/media-rate-limit.middleware.js'
import {
  claimMediaAssetController,
  createCatalogProductPlaybackAccessController,
  createDeliveryPlaybackAccessController,
  listAvailableMediaAssetsController,
  listMyMediaDeliveriesController,
  previewMediaAssetClaimController,
  protectedDeliveryViewController,
} from '../controllers/media-delivery.controller.js'
import {
  claimDynamicPromptProductSelectionController,
  getDynamicPromptCascadeOptionsController,
  prepareDynamicPromptProductSelectionController,
} from '../controllers/dynamic-prompt.controller.js'

export const mediaDeliveryRoutes = Router()

mediaDeliveryRoutes.get('/assets/available', listAvailableMediaAssetsController)
mediaDeliveryRoutes.get('/dynamic-prompts/options', getDynamicPromptCascadeOptionsController)
mediaDeliveryRoutes.post('/dynamic-prompts/options', getDynamicPromptCascadeOptionsController)
mediaDeliveryRoutes.post('/dynamic-prompts/prepare-selection', prepareDynamicPromptProductSelectionController)
mediaDeliveryRoutes.post('/dynamic-prompts/claim-selection', claimDynamicPromptProductSelectionController)
mediaDeliveryRoutes.get('/deliveries', mediaDeliveriesRateLimit, listMyMediaDeliveriesController)
mediaDeliveryRoutes.get('/deliveries/:deliveryId/playback-access', protectedMediaViewRateLimit, createDeliveryPlaybackAccessController)
mediaDeliveryRoutes.get('/catalog-products/:productId/playback-access', protectedMediaViewRateLimit, createCatalogProductPlaybackAccessController)

// Prévia segura de compra: não executa claim, não cobra e não altera carteira.
mediaDeliveryRoutes.get('/assets/:assetId/claim-preview', previewMediaAssetClaimController)

// Rota principal de produto: M4.8B adiciona guard/preview antes de qualquer claim pago.
// Use POST /media/assets/:assetId/claim?preview=true para validar contrato sem cobrança.
mediaDeliveryRoutes.post('/assets/:assetId/claim', claimMediaAssetController)

// Concessão sem cobrança foi removida da superfície pública /media.
// Use POST /api/admin/factory/assets/:assetId/grant protegido por authMiddleware + adminMiddleware.

mediaDeliveryRoutes.get('/deliveries/:deliveryId/protected-view', protectedMediaViewRateLimit, protectedDeliveryViewController)
