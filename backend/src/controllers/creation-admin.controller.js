import {
  createCreationItems,
  createCreationTitle,
  createGuidedCombinationDraft,
  createGuidedProductionBatch,
  getAvatarCreationOptions,
  listClientCreationModels,
  listContentTypes,
  listCreationAvatars,
  listCreationTitles,
  previewGuidedCombinations,
  saveAvatarCreationOptions,
  updateCreationItem,
  updateClientCreationModelVisibility,
  updateCreationTitle,
} from '../services/creation-admin.service.js'
import { parseOrThrow } from '../utils/validators.js'
import {
  avatarCreationOptionsSchema,
  clientModelVisibilitySchema,
  createCreationItemsSchema,
  createCreationTitleSchema,
  listCreationTitlesQuerySchema,
  createProductionBatchSchema,
  previewCombinationsSchema,
  updateCreationItemSchema,
  updateCreationTitleSchema,
} from '../validators/creation-admin.schemas.js'

function actorProfileId(req) {
  return req.auth?.profile?.id || null
}

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function listContentTypesController(_req, res, next) {
  try {
    return ok(res, { items: listContentTypes() })
  } catch (error) {
    return next(error)
  }
}

export async function listCreationTitlesController(req, res, next) {
  try {
    const query = parseOrThrow(listCreationTitlesQuerySchema, req.query || {})
    return ok(res, await listCreationTitles(query))
  } catch (error) {
    return next(error)
  }
}

export async function createCreationTitleController(req, res, next) {
  try {
    const input = parseOrThrow(createCreationTitleSchema, req.body)
    return ok(res, await createCreationTitle(input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function updateCreationTitleController(req, res, next) {
  try {
    const input = parseOrThrow(updateCreationTitleSchema, req.body)
    return ok(res, await updateCreationTitle(req.params.titleId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function createCreationItemsController(req, res, next) {
  try {
    const input = parseOrThrow(createCreationItemsSchema, req.body)
    return ok(res, await createCreationItems(req.params.titleId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function updateCreationItemController(req, res, next) {
  try {
    const input = parseOrThrow(updateCreationItemSchema, req.body)
    return ok(res, await updateCreationItem(req.params.itemId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function listCreationAvatarsController(req, res, next) {
  try {
    return ok(res, await listCreationAvatars({ includeInactive: String(req.query?.includeInactive || 'false') === 'true' }))
  } catch (error) {
    return next(error)
  }
}

export async function getAvatarCreationOptionsController(req, res, next) {
  try {
    return ok(res, await getAvatarCreationOptions(req.params.avatarId))
  } catch (error) {
    return next(error)
  }
}

export async function saveAvatarCreationOptionsController(req, res, next) {
  try {
    const input = parseOrThrow(avatarCreationOptionsSchema, req.body)
    return ok(res, await saveAvatarCreationOptions(req.params.avatarId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function previewGuidedCombinationsController(req, res, next) {
  try {
    const input = parseOrThrow(previewCombinationsSchema, req.body)
    return ok(res, await previewGuidedCombinations(input))
  } catch (error) {
    return next(error)
  }
}

export async function createGuidedCombinationDraftController(req, res, next) {
  try {
    const input = parseOrThrow(previewCombinationsSchema, req.body)
    return ok(res, await createGuidedCombinationDraft(input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}


export async function createGuidedProductionBatchController(req, res, next) {
  try {
    const input = parseOrThrow(createProductionBatchSchema, req.body)
    return ok(res, await createGuidedProductionBatch(input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function listClientCreationModelsController(req, res, next) {
  try {
    return ok(res, await listClientCreationModels({
      companionId: req.query?.companionId || null,
      contentType: req.query?.contentType || null,
    }))
  } catch (error) {
    return next(error)
  }
}


export async function updateClientCreationModelVisibilityController(req, res, next) {
  try {
    const input = parseOrThrow(clientModelVisibilitySchema, req.body)
    return ok(res, await updateClientCreationModelVisibility(req.params.combinationId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}
