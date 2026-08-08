import { api } from '@/shared/lib/axios'
import type { ApiEnvelope, FactoryAssetsResponse, FactoryBatchesResponse } from '@/features/adm/types'

export interface M45CounterGroup {
  [key: string]: number | M45CounterGroup | undefined
}

export interface M45OperationalDashboard {
  milestone?: string
  name?: string
  generatedAt?: string
  counters?: {
    actors?: { total?: number }
    invites?: { pending?: number; accepted?: number }
    mappingCases?: { pending?: number; approved?: number; rejected?: number }
    avatarAuthorizations?: { total?: number }
    production?: {
      batchesQueued?: number
      batchesRunning?: number
      batchItemsQaPending?: number
      assetsQaPending?: number
      assetsAvailable?: number
      assetsRejected?: number
    }
    publication?: { visibleCombinations?: number }
    protectedDelivery?: { deliveries?: number; galleryItems?: number }
    [key: string]: M45CounterGroup | undefined
  }
  recent?: {
    actors?: Array<Record<string, unknown>>
    invites?: Array<Record<string, unknown>>
    mappingCases?: Array<Record<string, unknown>>
    batches?: Array<Record<string, unknown>>
    assets?: Array<Record<string, unknown>>
    publishedCombinations?: Array<Record<string, unknown>>
    [key: string]: Array<Record<string, unknown>> | undefined
  }
  diagnostics?: {
    warnings?: Array<Record<string, unknown>>
    [key: string]: unknown
  }
  safety?: Record<string, unknown>
}

export interface M45ReadinessChecklistItem {
  key?: string
  label?: string
  ok?: boolean
  severity?: string
  humanMessage?: string
  technical?: string
  evidence?: Record<string, unknown>
}

export interface M45RealProductionReadiness {
  sprint?: string
  name?: string
  mode?: string
  requestedQuantity?: number
  canStartSafe?: boolean
  canStartReal?: boolean
  status?: 'SAFE_ONLY' | 'GO_REAL_READY' | 'NO_GO' | string
  requiredConfirmationPhrase?: string
  summary?: {
    totalChecks?: number
    passed?: number
    blockers?: number
    warnings?: number
    blockerKeys?: string[]
    warningKeys?: string[]
  }
  selected?: {
    companionId?: string | null
    combinationId?: string | null
  }
  checklist?: M45ReadinessChecklistItem[]
  safety?: Record<string, unknown>
}

export async function getM45OperationalDashboard(limit = 6): Promise<M45OperationalDashboard> {
  const { data } = await api.get<ApiEnvelope<M45OperationalDashboard>>('/api/admin/factory/operational-dashboard', {
    params: { limit },
  })

  return data.data
}

export async function getM45RealProductionReadiness(): Promise<M45RealProductionReadiness> {
  const { data } = await api.get<ApiEnvelope<M45RealProductionReadiness>>('/api/admin/factory/real-production/readiness', {
    params: {
      mode: 'safe_preflight',
      quantity: 1,
    },
  })

  return data.data
}

export async function getM45QaAssets(limit = 6): Promise<FactoryAssetsResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryAssetsResponse>>('/api/admin/factory/assets', {
    params: {
      status: 'qa_pending',
      limit,
    },
  })

  return data.data
}

export async function getM45RejectedAssets(limit = 6): Promise<FactoryAssetsResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryAssetsResponse>>('/api/admin/factory/assets', {
    params: {
      status: 'rejected',
      limit,
    },
  })

  return data.data
}

export async function getM45Batches(limit = 6): Promise<FactoryBatchesResponse> {
  const { data } = await api.get<ApiEnvelope<FactoryBatchesResponse>>('/api/admin/factory/batches', {
    params: { limit },
  })

  return data.data
}
