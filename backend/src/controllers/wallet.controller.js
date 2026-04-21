import { parseOrThrow } from '../utils/validators.js'
import { addPaymentMethodSchema, buyCreditsSchema } from '../validators/wallet.schemas.js'
import {
  addPaymentMethod,
  buyCredits,
  getWalletSummary,
  listCreditHistory,
  listCreditPackages,
  listPaymentHistory,
  listPaymentMethods,
} from '../services/wallet.service.js'

export async function getWalletController(req, res) {
  const data = await getWalletSummary(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getCreditHistoryController(req, res) {
  const data = await listCreditHistory(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getPaymentHistoryController(req, res) {
  const data = await listPaymentHistory(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function getPaymentMethodsController(req, res) {
  const data = await listPaymentMethods(req.auth.profile.id)
  return res.status(200).json(data)
}

export async function addPaymentMethodController(req, res) {
  const input = parseOrThrow(addPaymentMethodSchema, req.body)
  const data = await addPaymentMethod(req.auth.profile.id, input)
  return res.status(201).json(data)
}

export async function getCreditPackagesController(_req, res) {
  const data = await listCreditPackages()
  return res.status(200).json(data)
}

export async function buyCreditsController(req, res) {
  const input = parseOrThrow(buyCreditsSchema, req.body)
  const data = await buyCredits(req.auth.profile.id, input)
  return res.status(200).json(data)
}
