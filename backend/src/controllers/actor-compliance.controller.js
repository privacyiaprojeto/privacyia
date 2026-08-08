import {
  acceptActorOnboardingInvite,
  approveActorKycAsset,
  approveActorKycCase,
  auditActorMappingVaultAsset,
  createActorOnboardingMappingCase,
  createActorKycAssetEditedCopy,
  authorizeAvatarProduction,
  blockActorProfile,
  createActorKycCase,
  createActorProfile,
  generateActorOnboardingInvite,
  getActorKycCase,
  getActorOnboardingPortal,
  getActorMappingChecklist,
  getAvatarComplianceReport,
  getActorMappingVaultAssetStream,
  listActorKycCases,
  listActorMappingVaultTestArtifacts,
  listActorProfiles,
  listAvatarProductionAuthorizations,
  registerActorKycAsset,
  quarantineActorMappingVaultTestArtifacts,
  registerActorOnboardingMappingAsset,
  reclassifyActorKycAsset,
  rejectActorKycAsset,
  rejectActorKycCase,
  revokeAvatarProductionAuthorization,
  unblockActorProfile,
} from '../services/actor-compliance.service.js'
import { parseOrThrow } from '../utils/validators.js'
import {
  acceptActorInviteSchema,
  approveKycAssetSchema,
  approveKycCaseSchema,
  createKycCaseSchema,
  createKycAssetEditedCopySchema,
  authorizeAvatarProductionSchema,
  blockActorProfileSchema,
  createActorProfileSchema,
  generateActorInviteSchema,
  listActorProfilesQuerySchema,
  listMappingVaultTestArtifactsQuerySchema,
  quarantineMappingVaultTestArtifactsSchema,
  registerKycAssetSchema,
  reclassifyKycAssetSchema,
  rejectKycAssetSchema,
  rejectKycCaseSchema,
  revokeAvatarProductionAuthorizationSchema,
  unblockActorProfileSchema,
} from '../validators/actor-compliance.schemas.js'

function actorProfileId(req) {
  return req.auth?.profile?.id || null
}


function quoteHeaderFilename(filename = 'material-mapeamento.bin') {
  const safe = String(filename || 'material-mapeamento.bin')
    .replace(/[\r\n"]/g, '-')
    .slice(0, 140)

  return `"${safe || 'material-mapeamento.bin'}"`
}

function ok(res, data, status = 200) {
  return res.status(status).json({ success: true, data })
}

export async function listActorProfilesController(req, res, next) {
  try {
    const query = parseOrThrow(listActorProfilesQuerySchema, req.query || {})
    return ok(res, await listActorProfiles(query))
  } catch (error) {
    return next(error)
  }
}

export async function createActorProfileController(req, res, next) {
  try {
    const input = parseOrThrow(createActorProfileSchema, req.body)
    return ok(res, await createActorProfile(input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function blockActorProfileController(req, res, next) {
  try {
    const input = parseOrThrow(blockActorProfileSchema, req.body || {})
    return ok(res, await blockActorProfile(req.params.actorId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}


export async function unblockActorProfileController(req, res, next) {
  try {
    const input = parseOrThrow(unblockActorProfileSchema, req.body || {})
    return ok(res, await unblockActorProfile(req.params.actorId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function generateActorInviteController(req, res, next) {
  try {
    const input = parseOrThrow(generateActorInviteSchema, req.body || {})
    return ok(res, await generateActorOnboardingInvite(req.params.actorId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function acceptActorInviteController(req, res, next) {
  try {
    const input = parseOrThrow(acceptActorInviteSchema, req.body || {})
    return ok(res, await acceptActorOnboardingInvite(req.params.inviteToken, input))
  } catch (error) {
    return next(error)
  }
}


export async function getActorOnboardingPortalController(req, res, next) {
  try {
    return ok(res, await getActorOnboardingPortal(req.params.inviteToken))
  } catch (error) {
    return next(error)
  }
}

export async function createActorOnboardingMappingCaseController(req, res, next) {
  try {
    const input = parseOrThrow(createKycCaseSchema, req.body || {})
    return ok(res, await createActorOnboardingMappingCase(req.params.inviteToken, input), 201)
  } catch (error) {
    return next(error)
  }
}

export async function registerActorOnboardingMappingAssetController(req, res, next) {
  try {
    const input = parseOrThrow(registerKycAssetSchema, req.body || {})
    return ok(res, await registerActorOnboardingMappingAsset(req.params.inviteToken, input), 201)
  } catch (error) {
    return next(error)
  }
}

export async function createKycCaseController(req, res, next) {
  try {
    const input = parseOrThrow(createKycCaseSchema, req.body || {})
    return ok(res, await createActorKycCase(req.params.actorId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function listActorKycCasesController(req, res, next) {
  try {
    return ok(res, await listActorKycCases(req.params.actorId))
  } catch (error) {
    return next(error)
  }
}

export async function getKycCaseController(req, res, next) {
  try {
    return ok(res, await getActorKycCase(req.params.kycCaseId))
  } catch (error) {
    return next(error)
  }
}


export async function getKycCaseMappingChecklistController(req, res, next) {
  try {
    return ok(res, await getActorMappingChecklist(req.params.kycCaseId))
  } catch (error) {
    return next(error)
  }
}

export async function registerKycAssetController(req, res, next) {
  try {
    const input = parseOrThrow(registerKycAssetSchema, req.body || {})
    return ok(res, await registerActorKycAsset(req.params.kycCaseId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function auditKycAssetVaultController(req, res, next) {
  try {
    const checkR2 = String(req.query?.checkR2 || 'false').toLowerCase() === 'true'
    return ok(res, await auditActorMappingVaultAsset(req.params.assetId, { checkR2 }))
  } catch (error) {
    return next(error)
  }
}


export async function viewKycAssetVaultController(req, res, next) {
  try {
    const download = String(req.query?.download || 'false').toLowerCase() === 'true'
    const result = await getActorMappingVaultAssetStream(req.params.assetId, { download })

    res.setHeader('Content-Type', result.contentType || 'application/octet-stream')
    if (result.contentLength !== null && result.contentLength !== undefined) {
      res.setHeader('Content-Length', String(result.contentLength))
    }
    res.setHeader('Content-Disposition', `${result.disposition}; filename=${quoteHeaderFilename(result.filename)}`)
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Privacy-IA-Vault', 'actor-mapping-private')

    result.bodyStream.on?.('error', next)
    return result.bodyStream.pipe(res)
  } catch (error) {
    return next(error)
  }
}


export async function createKycAssetEditedCopyController(req, res, next) {
  try {
    const input = parseOrThrow(createKycAssetEditedCopySchema, req.body || {})
    return ok(res, await createActorKycAssetEditedCopy(req.params.assetId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function reclassifyKycAssetController(req, res, next) {
  try {
    const input = parseOrThrow(reclassifyKycAssetSchema, req.body || {})
    return ok(res, await reclassifyActorKycAsset(req.params.assetId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function approveKycAssetController(req, res, next) {
  try {
    const input = parseOrThrow(approveKycAssetSchema, req.body || {})
    return ok(res, await approveActorKycAsset(req.params.assetId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function rejectKycAssetController(req, res, next) {
  try {
    const input = parseOrThrow(rejectKycAssetSchema, req.body || {})
    return ok(res, await rejectActorKycAsset(req.params.assetId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function listMappingVaultTestArtifactsController(req, res, next) {
  try {
    const query = parseOrThrow(listMappingVaultTestArtifactsQuerySchema, req.query || {})
    return ok(res, await listActorMappingVaultTestArtifacts(query))
  } catch (error) {
    return next(error)
  }
}

export async function quarantineMappingVaultTestArtifactsController(req, res, next) {
  try {
    const input = parseOrThrow(quarantineMappingVaultTestArtifactsSchema, req.body || {})
    return ok(res, await quarantineActorMappingVaultTestArtifacts(input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function approveKycCaseController(req, res, next) {
  try {
    const input = parseOrThrow(approveKycCaseSchema, req.body || {})
    return ok(res, await approveActorKycCase(req.params.kycCaseId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function rejectKycCaseController(req, res, next) {
  try {
    const input = parseOrThrow(rejectKycCaseSchema, req.body || {})
    return ok(res, await rejectActorKycCase(req.params.kycCaseId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function authorizeAvatarProductionController(req, res, next) {
  try {
    const input = parseOrThrow(authorizeAvatarProductionSchema, req.body || {})
    return ok(res, await authorizeAvatarProduction(req.params.avatarId, input, { actorProfileId: actorProfileId(req) }), 201)
  } catch (error) {
    return next(error)
  }
}

export async function revokeAvatarProductionAuthorizationController(req, res, next) {
  try {
    const input = parseOrThrow(revokeAvatarProductionAuthorizationSchema, req.body || {})
    return ok(res, await revokeAvatarProductionAuthorization(req.params.authorizationId, input, { actorProfileId: actorProfileId(req) }))
  } catch (error) {
    return next(error)
  }
}

export async function listAvatarProductionAuthorizationsController(req, res, next) {
  try {
    return ok(res, await listAvatarProductionAuthorizations(req.params.avatarId))
  } catch (error) {
    return next(error)
  }
}


export async function getAvatarComplianceReportController(req, res, next) {
  try {
    const checkR2 = String(req.query?.checkR2 || 'false').toLowerCase() === 'true'
    const contentType = req.query?.contentType ? String(req.query.contentType) : null
    return ok(res, await getAvatarComplianceReport(req.params.avatarId, { checkR2, contentType }))
  } catch (error) {
    return next(error)
  }
}
