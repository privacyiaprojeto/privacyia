import { api } from '@/shared/lib/axios'
import type { ApiEnvelope } from '@/features/adm/types'

export const M45C_SIMULATED_QA_BLOCK_CONFIRMATION = 'BLOQUEAR QA SIMULADO SEM PUBLICAR M4.5C'
export const M45D_CONTROLLED_BATCH_CONFIRMATION = 'CRIAR BATCH CONTROLADO SEM WORKER M4.5D'

export interface M45QaActionPayload {
  assetId: string
  batchId?: string | null
  batchItemId?: string | null
  combinationId?: string | null
}

export interface M45ControlledBatchPayload {
  companionId?: string | null
  contentType?: string
  selections?: Record<string, string[]>
  quantity?: number
  confirmation: string
  sourceBatchId?: string | null
}

export interface M45QaActionResponse {
  ok?: boolean
  success?: boolean
  status?: string
  message?: string
  asset?: Record<string, unknown>
  item?: Record<string, unknown>
  batch?: Record<string, unknown>
  safety?: Record<string, unknown>
  [key: string]: unknown
}

export interface M45ControlledBatchResponse {
  ok?: boolean
  success?: boolean
  status?: string
  message?: string
  batch?: Record<string, unknown>
  batchItem?: Record<string, unknown>
  combination?: Record<string, unknown>
  items?: Array<Record<string, unknown>>
  safety?: Record<string, unknown>
  [key: string]: unknown
}

function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  const maybeEnvelope = payload as ApiEnvelope<T>
  return maybeEnvelope?.data ?? (payload as T)
}

function buildControlledBatchBody(payload: M45ControlledBatchPayload, dryRunOnly: boolean) {
  return {
    companionId: payload.companionId || undefined,
    contentType: payload.contentType || 'image',
    selections: payload.selections || {},
    quantity: payload.quantity || 1,
    dryRunOnly,
    previewOnly: dryRunOnly,
    controlledBatchOnly: true,
    adminOnly: true,
    visibleToClient: false,
    generateRealMedia: false,
    startWorker: false,
    enqueueWorker: false,
    allowWorker: false,
    allowRedis: false,
    allowRunPod: false,
    allowR2Upload: false,
    allowPublicUrl: false,
    allowPublication: false,
    sourceBatchId: payload.sourceBatchId || undefined,
    source: dryRunOnly ? 'm4_5d_admin_controlled_batch_panel_preflight' : 'm4_5d_admin_controlled_batch_panel',
    confirmation: payload.confirmation,
  }
}

export async function inspectM45QaAsset(payload: M45QaActionPayload): Promise<M45QaActionResponse> {
  const { data } = await api.post<ApiEnvelope<M45QaActionResponse> | M45QaActionResponse>(
    '/api/admin/factory/real-production/qa/inspect',
    {
      assetId: payload.assetId,
      batchId: payload.batchId || undefined,
      batchItemId: payload.batchItemId || undefined,
      combinationId: payload.combinationId || undefined,
      headR2: false,
      securePreview: false,
      source: 'm4_5c_admin_controlled_actions_panel',
    },
  )

  return unwrap(data)
}

export async function rejectM45SimulatedQaAsset(payload: M45QaActionPayload & { confirmation: string }): Promise<M45QaActionResponse> {
  if (payload.confirmation !== M45C_SIMULATED_QA_BLOCK_CONFIRMATION) {
    throw new Error('Frase de confirmação inválida. A rejeição controlada não será executada.')
  }

  const { data } = await api.post<ApiEnvelope<M45QaActionResponse> | M45QaActionResponse>(
    '/api/admin/factory/real-production/qa/decision',
    {
      assetId: payload.assetId,
      batchId: payload.batchId || undefined,
      batchItemId: payload.batchItemId || undefined,
      combinationId: payload.combinationId || undefined,
      action: 'reject',
      apply: true,
      allowMutation: true,
      reason: 'M4.5C: asset simulado/noR2/placeholder bloqueado pelo Painel Admin; não aprovar/publicar como mídia real.',
      confirmation: payload.confirmation,
      source: 'm4_5c_admin_controlled_actions_panel',
    },
  )

  return unwrap(data)
}

export async function preflightM45ControlledBatch(payload: M45ControlledBatchPayload): Promise<M45ControlledBatchResponse> {
  if (payload.confirmation !== M45D_CONTROLLED_BATCH_CONFIRMATION) {
    throw new Error('Frase de confirmação inválida. O preflight do batch controlado não será executado.')
  }

  const { data } = await api.post<ApiEnvelope<M45ControlledBatchResponse> | M45ControlledBatchResponse>(
    '/api/admin/creation/production-batches',
    buildControlledBatchBody(payload, true),
  )

  return unwrap(data)
}

export async function createM45ControlledBatch(payload: M45ControlledBatchPayload): Promise<M45ControlledBatchResponse> {
  if (payload.confirmation !== M45D_CONTROLLED_BATCH_CONFIRMATION) {
    throw new Error('Frase de confirmação inválida. A criação controlada do batch não será executada.')
  }

  if (!payload.companionId) {
    throw new Error('Avatar/companion não resolvido para criar batch controlado.')
  }

  if (!payload.selections || Object.keys(payload.selections).length === 0) {
    throw new Error('Seleção de produto ausente. Abra Planejar produto ou use um lote controlado como referência.')
  }

  const { data } = await api.post<ApiEnvelope<M45ControlledBatchResponse> | M45ControlledBatchResponse>(
    '/api/admin/creation/production-batches',
    buildControlledBatchBody(payload, false),
  )

  return unwrap(data)
}
