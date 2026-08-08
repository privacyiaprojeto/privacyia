import { getDynamicPromptCascadeOptions } from '../services/dynamic-prompt.service.js'
import {
  claimDynamicPromptProductSelection,
  prepareDynamicPromptProductSelection,
} from '../services/client-product-selection.service.js'

function parseSelections(value) {
  if (!value) return []
  if (typeof value !== 'string') return value

  try {
    return JSON.parse(value)
  } catch {
    return []
  }
}

export async function getDynamicPromptCascadeOptionsController(req, res, next) {
  try {
    const source = req.method === 'GET' ? req.query || {} : req.body || {}
    const result = await getDynamicPromptCascadeOptions({
      companionId: source.companionId || source.companion_id || null,
      mediaType: source.mediaType || source.media_type || null,
      selections: parseSelections(source.selections || source.selected || []),
      limit: source.limit || 300,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}


export async function prepareDynamicPromptProductSelectionController(req, res, next) {
  try {
    const source = req.body || {}
    const result = await prepareDynamicPromptProductSelection({
      profileId: req.auth?.profile?.id || null,
      companionId: source.companionId || source.companion_id || null,
      mediaType: source.mediaType || source.media_type || null,
      selections: parseSelections(source.selections || source.selected || []),
      combinationId: source.combinationId || source.combination_id || null,
      limit: source.limit || 300,
    })

    return res.status(200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}


export async function claimDynamicPromptProductSelectionController(req, res, next) {
  try {
    const source = req.body || {}
    const result = await claimDynamicPromptProductSelection({
      profileId: req.auth?.profile?.id || null,
      companionId: source.companionId || source.companion_id || null,
      mediaType: source.mediaType || source.media_type || null,
      selections: parseSelections(source.selections || source.selected || []),
      combinationId: source.combinationId || source.combination_id || null,
      deliverySource: source.deliverySource || source.delivery_source || 'button',
      limit: source.limit || 300,
      requireSubscription: true,
    })

    return res.status(result?.charged ? 201 : 200).json({
      success: true,
      data: result,
    })
  } catch (error) {
    return next(error)
  }
}
