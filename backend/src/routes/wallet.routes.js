import { Router } from 'express'
import { asyncHandler } from '../utils/asyncHandler.js'
import {
  addPaymentMethodController,
  buyCreditsController,
  getCreditHistoryController,
  getCreditPackagesController,
  getPaymentHistoryController,
  getPaymentMethodsController,
  getWalletController,
} from '../controllers/wallet.controller.js'

const router = Router()

router.get('/', asyncHandler(getWalletController))
router.get('/historico-creditos', asyncHandler(getCreditHistoryController))
router.get('/historico-pagamentos', asyncHandler(getPaymentHistoryController))
router.get('/metodos-pagamento', asyncHandler(getPaymentMethodsController))
router.post('/metodos-pagamento', asyncHandler(addPaymentMethodController))
router.get('/pacotes', asyncHandler(getCreditPackagesController))
router.post('/comprar', asyncHandler(buyCreditsController))

export { router as walletRoutes }
