import { env } from '../config/env.js'
import { ApiError } from '../utils/apiError.js'
import { getAvatarComplianceReport } from './actor-compliance.service.js'
import {
  createGuidedProductionBatch,
  previewGuidedCombinations,
} from './creation-admin.service.js'

const CONFIRM_REAL_PRODUCTION_PHRASE = 'CONFIRMAR PRODUCAO REAL DE 1 ITEM'

function truthy(value) {
  if (typeof value === 'boolean') return value
  return ['true', '1', 'yes', 'sim', 'on'].includes(String(value || '').trim().toLowerCase())
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  return truthy(value)
}

function normalizeSelections(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, items]) => {
        const normalizedItems = Array.isArray(items)
          ? items.filter(Boolean).map(String)
          : items
            ? [String(items)]
            : []

        return [String(key), normalizedItems]
      })
      .filter(([key, items]) => key && items.length > 0),
  )
}

function buildSafetyFlags({ realMode, confirmationOk, envAllowed }) {
  return {
    requestedRealProduction: Boolean(realMode),
    confirmationRequired: Boolean(realMode),
    confirmationOk: Boolean(confirmationOk),
    envAllowed: Boolean(envAllowed),
    runPodWillBeCalledByThisRequest: false,
    runPodMayBeCalledByWorkerAfterQueue: Boolean(realMode && confirmationOk && envAllowed),
    r2UploadMayHappenByWorkerAfterQueue: Boolean(realMode && confirmationOk && envAllowed),
    destructiveDelete: false,
    paymentExecuted: false,
    walletChanged: false,
  }
}

function buildPreflightSummary({ preview, compliance, realMode, confirmationOk, envAllowed }) {
  const reasons = []

  if (preview.total !== 1) {
    reasons.push({
      code: 'selection_not_single_item',
      message: 'A produção real controlada exige exatamente 1 combinação selecionada.',
      severity: 'block',
      details: { total: preview.total },
    })
  }

  if (realMode && !envAllowed) {
    reasons.push({
      code: 'real_production_env_not_allowed',
      message: 'Produção real bloqueada. Ative ALLOW_REAL_SINGLE_ITEM_PRODUCTION=true apenas no momento controlado.',
      severity: 'block',
    })
  }

  if (realMode && !confirmationOk) {
    reasons.push({
      code: 'confirmation_phrase_missing',
      message: `Confirmação obrigatória ausente. Use exatamente: ${CONFIRM_REAL_PRODUCTION_PHRASE}`,
      severity: 'block',
    })
  }

  if (realMode && !env.RUNPOD_API_KEY) {
    reasons.push({
      code: 'runpod_api_key_missing',
      message: 'RUNPOD_API_KEY não está configurada.',
      severity: 'block',
    })
  }

  if (realMode && !env.RUNPOD_IMAGE_ENDPOINT_ID) {
    reasons.push({
      code: 'runpod_image_endpoint_missing',
      message: 'RUNPOD_IMAGE_ENDPOINT_ID não está configurado.',
      severity: 'block',
    })
  }

  if (realMode && compliance && !compliance.productionAllowed) {
    reasons.push({
      code: 'avatar_not_compliant',
      message: compliance.summary || 'Avatar ainda não está liberado para produção real.',
      severity: 'block',
      details: { complianceReasons: compliance.reasons || [] },
    })
  }

  return {
    canStart: reasons.length === 0,
    reasons,
  }
}

function sanitizePreview(preview = {}) {
  return {
    companionId: preview.companionId || null,
    contentType: preview.contentType || 'image',
    contentTypeLabel: preview.contentTypeLabel || 'Imagem',
    total: Number(preview.total || 0),
    groups: preview.groups || [],
    preview: (preview.preview || []).slice(0, 3),
    limited: Boolean(preview.limited),
  }
}

function sanitizeCompliance(compliance = null) {
  if (!compliance) return null

  return {
    status: compliance.status || 'desconhecido',
    productionAllowed: Boolean(compliance.productionAllowed),
    summary: compliance.summary || null,
    avatar: compliance.avatar || null,
    actor: compliance.actor || null,
    authorization: compliance.authorization || null,
    mapping: compliance.mapping
      ? {
          id: compliance.mapping.id || null,
          status: compliance.mapping.status || null,
          checklist: compliance.mapping.checklist
            ? {
                isComplete: Boolean(compliance.mapping.checklist.isComplete),
                missingRequired: compliance.mapping.checklist.missingRequired || [],
              }
            : null,
        }
      : null,
    reasons: (compliance.reasons || []).map((reason) => ({
      code: reason.code || null,
      message: reason.message || null,
      severity: reason.severity || 'block',
    })),
    checks: {
      ...(compliance.checks || {}),
      runPodCalled: false,
      destructiveDelete: false,
      publicAccess: false,
    },
  }
}

function sanitizeBatchResult(result = {}) {
  return {
    batch: result.batch
      ? {
          id: result.batch.id || null,
          status: result.batch.status || null,
          companionId: result.batch.companionId || null,
          companionName: result.batch.companionName || null,
          contentType: result.batch.contentType || 'image',
          workerLabel: result.batch.workerLabel || null,
          totalItems: result.batch.totalItems || 0,
          realImageWorker: Boolean(result.batch.realImageWorker),
          productionAuthorizationId: result.batch.productionAuthorizationId || null,
          compliance: result.batch.compliance || null,
        }
      : null,
    items: (result.items || []).map((item) => ({
      id: item.id || null,
      status: item.status || null,
      combinationId: item.combinationId || null,
      label: item.label || null,
    })),
    queueJobs: (result.queueJobs || []).map((job) => ({
      id: job.id || null,
      name: job.name || null,
      batchItemId: job.batchItemId || null,
    })),
    message: result.message || null,
  }
}

export async function preflightControlledSingleRealImageProduction(input = {}) {
  const companionId = input.companionId || input.companion_id || null
  const selections = normalizeSelections(input.selections || {})
  const dryRunOnly = normalizeBoolean(input.dryRunOnly ?? input.dry_run_only, true)
  const generateRealMedia = normalizeBoolean(input.generateRealMedia ?? input.generate_real_media, false)
  const realMode = generateRealMedia && dryRunOnly !== true
  const confirmation = String(input.confirmPhrase || input.confirmation || '').trim()
  const confirmationOk = confirmation === CONFIRM_REAL_PRODUCTION_PHRASE
  const envAllowed = truthy(process.env.ALLOW_REAL_SINGLE_ITEM_PRODUCTION)

  if (!companionId) {
    throw new ApiError(400, 'companionId é obrigatório para a produção controlada de 1 item.')
  }

  if (Object.keys(selections).length === 0) {
    throw new ApiError(400, 'Selecione exatamente uma combinação antes de produzir.')
  }

  const preview = await previewGuidedCombinations({
    companionId,
    contentType: 'image',
    selections,
  })

  const compliance = realMode
    ? await getAvatarComplianceReport(companionId, { contentType: 'image', checkR2: false })
    : null

  const summary = buildPreflightSummary({
    preview,
    compliance,
    realMode,
    confirmationOk,
    envAllowed,
  })

  return {
    mode: realMode ? 'real_image_preflight' : 'safe_preflight',
    canStart: summary.canStart,
    reasons: summary.reasons,
    requiredConfirmationPhrase: realMode ? CONFIRM_REAL_PRODUCTION_PHRASE : null,
    preview: sanitizePreview(preview),
    compliance: sanitizeCompliance(compliance),
    safety: buildSafetyFlags({ realMode, confirmationOk, envAllowed }),
  }
}

export async function startControlledSingleRealImageProduction(input = {}, { actorProfileId = null } = {}) {
  const companionId = input.companionId || input.companion_id || null
  const selections = normalizeSelections(input.selections || {})
  const dryRunOnly = normalizeBoolean(input.dryRunOnly ?? input.dry_run_only, true)
  const generateRealMedia = normalizeBoolean(input.generateRealMedia ?? input.generate_real_media, false)
  const realMode = generateRealMedia && dryRunOnly !== true

  const preflight = await preflightControlledSingleRealImageProduction({
    companionId,
    selections,
    dryRunOnly,
    generateRealMedia,
    confirmPhrase: input.confirmPhrase || input.confirmation || '',
  })

  if (!preflight.canStart) {
    throw new ApiError(409, 'Produção real controlada bloqueada pelo pré-check de segurança.', preflight)
  }

  const result = await createGuidedProductionBatch({
    companionId,
    contentType: 'image',
    selections,
    requestedVariants: 1,
    generateRealMedia: realMode,
    dryRunOnly: !realMode,
  }, { actorProfileId })

  return {
    mode: realMode ? 'real_image_queued' : 'safe_dry_run_queued',
    realMode,
    preflight,
    production: sanitizeBatchResult(result),
    safety: {
      ...preflight.safety,
      batchCreated: true,
      queued: true,
      runPodCalledByApiRequest: false,
      runPodWillRunOnlyInWorker: Boolean(realMode),
    },
  }
}

export const CONTROLLED_REAL_PRODUCTION_CONFIRMATION = CONFIRM_REAL_PRODUCTION_PHRASE
