import { supabaseAdmin } from '../config/supabase.js'

const nowIso = () => new Date().toISOString()

function normalizeStatus(value) {
  const status = String(value || '').trim()
  return status || null
}

function toPositiveInteger(value, fallback = 10, max = 50) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function buildSafety() {
  return {
    runPodCalledByThisService: false,
    r2RealUploadByThisService: false,
    r2HeadExecutedByThisService: false,
    destructiveDelete: false,
    paymentExecutedByThisService: false,
    walletChangedByThisService: false,
    creditLedgerCreatedByThisService: false,
    publicClientUrlCreatedByThisService: false,
    realQueueJobCreated: false,
    databaseMutationExecutedByThisService: false,
  }
}

async function safeCount({ table, filters = [] }) {
  try {
    let query = supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })

    for (const filter of filters) {
      if (!filter?.column || filter.value === undefined || filter.value === null || filter.value === '') continue
      query = query.eq(filter.column, filter.value)
    }

    const { count, error } = await query

    if (error) {
      return {
        ok: false,
        table,
        count: 0,
        error: error.message,
        code: error.code || null,
      }
    }

    return {
      ok: true,
      table,
      count: Number(count || 0),
      error: null,
      code: null,
    }
  } catch (error) {
    return {
      ok: false,
      table,
      count: 0,
      error: error?.message || 'Erro inesperado ao contar registros.',
      code: error?.code || null,
    }
  }
}

async function safeRecent({ table, select = '*', filters = [], orderBy = 'created_at', limit = 10 }) {
  try {
    let query = supabaseAdmin
      .from(table)
      .select(select)
      .limit(limit)

    for (const filter of filters) {
      if (!filter?.column || filter.value === undefined || filter.value === null || filter.value === '') continue
      query = query.eq(filter.column, filter.value)
    }

    if (orderBy) query = query.order(orderBy, { ascending: false })

    const { data, error } = await query

    if (error) {
      return {
        ok: false,
        table,
        items: [],
        error: error.message,
        code: error.code || null,
      }
    }

    return {
      ok: true,
      table,
      items: Array.isArray(data) ? data : [],
      error: null,
      code: null,
    }
  } catch (error) {
    return {
      ok: false,
      table,
      items: [],
      error: error?.message || 'Erro inesperado ao listar registros recentes.',
      code: error?.code || null,
    }
  }
}

function compactActor(row = {}) {
  return {
    id: row.id || null,
    displayName: row.display_name || row.name || row.full_name || row.nome || null,
    email: row.email || null,
    status: row.status || null,
    profileIdPresent: Boolean(row.profile_id),
    companionId: row.companion_id || row.avatar_id || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function compactInvite(row = {}) {
  return {
    id: row.id || null,
    actorProfileId: row.actor_profile_id || row.actor_id || null,
    email: row.email || null,
    status: row.status || null,
    acceptedAt: row.accepted_at || null,
    expiresAt: row.expires_at || null,
    createdAt: row.created_at || null,
  }
}

function compactKycCase(row = {}) {
  return {
    id: row.id || null,
    actorProfileId: row.actor_profile_id || row.actor_id || null,
    companionId: row.companion_id || row.avatar_id || null,
    status: row.status || null,
    submittedAt: row.submitted_at || null,
    approvedAt: row.approved_at || null,
    rejectedAt: row.rejected_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function compactProductionRow(row = {}) {
  return {
    id: row.id || null,
    status: row.status || null,
    mediaType: row.media_type || null,
    companionId: row.companion_id || row.avatar_id || null,
    combinationId: row.combination_id || row.media_combination_id || null,
    batchId: row.batch_id || null,
    batchItemId: row.batch_item_id || null,
    protected: row.protected ?? row.is_protected ?? null,
    currentAssignments: row.current_assignments ?? null,
    maxAssignments: row.max_assignments ?? null,
    publishedAt: row.published_at || null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function compactCombination(row = {}) {
  return {
    id: row.id || null,
    companionId: row.companion_id || row.avatar_id || null,
    mediaType: row.media_type || null,
    title: row.title || row.label || null,
    priceCredits: row.price_credits ?? null,
    visibleToClient: row.visible_to_client ?? null,
    adminOnly: row.admin_only ?? null,
    active: row.is_active ?? null,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  }
}

function extractWarnings(results = []) {
  return results
    .filter((item) => item && item.ok === false)
    .map((item) => ({
      table: item.table,
      error: item.error,
      code: item.code || null,
    }))
}

export async function getAdminOperationalDashboard({ limit = 10 } = {}) {
  const safeLimit = toPositiveInteger(limit, 10, 50)

  const counts = await Promise.all([
    safeCount({ table: 'actor_profiles' }),
    safeCount({ table: 'actor_onboarding_invites', filters: [{ column: 'status', value: 'pending' }] }),
    safeCount({ table: 'actor_onboarding_invites', filters: [{ column: 'status', value: 'accepted' }] }),
    safeCount({ table: 'actor_kyc_cases', filters: [{ column: 'status', value: 'pending' }] }),
    safeCount({ table: 'actor_kyc_cases', filters: [{ column: 'status', value: 'approved' }] }),
    safeCount({ table: 'actor_kyc_cases', filters: [{ column: 'status', value: 'rejected' }] }),
    safeCount({ table: 'avatar_production_authorizations' }),
    safeCount({ table: 'media_generation_batches', filters: [{ column: 'status', value: 'queued' }] }),
    safeCount({ table: 'media_generation_batches', filters: [{ column: 'status', value: 'running' }] }),
    safeCount({ table: 'media_generation_batch_items', filters: [{ column: 'status', value: 'qa_pending' }] }),
    safeCount({ table: 'media_asset_variants', filters: [{ column: 'status', value: 'qa_pending' }] }),
    safeCount({ table: 'media_asset_variants', filters: [{ column: 'status', value: 'available' }] }),
    safeCount({ table: 'media_asset_variants', filters: [{ column: 'status', value: 'rejected' }] }),
    safeCount({ table: 'media_combinations', filters: [{ column: 'visible_to_client', value: true }] }),
    safeCount({ table: 'user_media_deliveries' }),
    safeCount({ table: 'gallery_items' }),
  ])

  const recent = await Promise.all([
    safeRecent({
      table: 'actor_profiles',
      select: 'id, display_name, name, full_name, nome, email, status, profile_id, companion_id, avatar_id, created_at, updated_at',
      limit: safeLimit,
    }),
    safeRecent({
      table: 'actor_onboarding_invites',
      select: 'id, actor_profile_id, actor_id, email, status, accepted_at, expires_at, created_at',
      limit: safeLimit,
    }),
    safeRecent({
      table: 'actor_kyc_cases',
      select: 'id, actor_profile_id, actor_id, companion_id, avatar_id, status, submitted_at, approved_at, rejected_at, created_at, updated_at',
      limit: safeLimit,
    }),
    safeRecent({
      table: 'media_generation_batches',
      select: 'id, status, companion_id, combination_id, created_at, updated_at',
      limit: safeLimit,
    }),
    safeRecent({
      table: 'media_asset_variants',
      select: 'id, status, media_type, companion_id, combination_id, batch_id, batch_item_id, protected, is_protected, current_assignments, max_assignments, published_at, created_at, updated_at',
      limit: safeLimit,
    }),
    safeRecent({
      table: 'media_combinations',
      select: 'id, companion_id, avatar_id, media_type, title, label, price_credits, visible_to_client, admin_only, is_active, created_at, updated_at',
      filters: [{ column: 'visible_to_client', value: true }],
      limit: safeLimit,
    }),
  ])

  const countByTable = Object.fromEntries(counts.map((item) => [
    `${item.table}:${item.table === 'actor_onboarding_invites'
      ? 'status'
      : item.table === 'actor_kyc_cases'
        ? 'status'
        : item.table === 'media_generation_batches'
          ? 'status'
          : item.table === 'media_generation_batch_items'
            ? 'status'
            : item.table === 'media_asset_variants'
              ? 'status'
              : item.table === 'media_combinations'
                ? 'visibility'
                : 'all'}:${item.count}:${item.ok}`,
    item,
  ]))

  const findCount = (table, statusOrVisibility = null, occurrence = 0) => {
    const matches = counts.filter((item) => item.table === table)
    if (!statusOrVisibility) return matches[occurrence]?.count ?? 0

    const indexByTable = {
      actor_onboarding_invites: ['pending', 'accepted'],
      actor_kyc_cases: ['pending', 'approved', 'rejected'],
      media_generation_batches: ['queued', 'running'],
      media_generation_batch_items: ['qa_pending'],
      media_asset_variants: ['qa_pending', 'available', 'rejected'],
      media_combinations: ['visible_to_client'],
    }

    const index = indexByTable[table]?.indexOf(statusOrVisibility)
    return index >= 0 ? matches[index]?.count ?? 0 : 0
  }

  return {
    milestone: 'M4.1',
    name: 'Painel Admin/Fábrica operacional — leitura consolidada sem financeiro real',
    generatedAt: nowIso(),
    counters: {
      actors: {
        total: findCount('actor_profiles'),
      },
      invites: {
        pending: findCount('actor_onboarding_invites', 'pending'),
        accepted: findCount('actor_onboarding_invites', 'accepted'),
      },
      mappingCases: {
        pending: findCount('actor_kyc_cases', 'pending'),
        approved: findCount('actor_kyc_cases', 'approved'),
        rejected: findCount('actor_kyc_cases', 'rejected'),
      },
      avatarAuthorizations: {
        total: findCount('avatar_production_authorizations'),
      },
      production: {
        batchesQueued: findCount('media_generation_batches', 'queued'),
        batchesRunning: findCount('media_generation_batches', 'running'),
        batchItemsQaPending: findCount('media_generation_batch_items', 'qa_pending'),
        assetsQaPending: findCount('media_asset_variants', 'qa_pending'),
        assetsAvailable: findCount('media_asset_variants', 'available'),
        assetsRejected: findCount('media_asset_variants', 'rejected'),
      },
      publication: {
        visibleCombinations: findCount('media_combinations', 'visible_to_client'),
      },
      protectedDelivery: {
        deliveries: findCount('user_media_deliveries'),
        galleryItems: findCount('gallery_items'),
      },
    },
    recent: {
      actors: (recent[0]?.items || []).map(compactActor),
      invites: (recent[1]?.items || []).map(compactInvite),
      mappingCases: (recent[2]?.items || []).map(compactKycCase),
      batches: (recent[3]?.items || []).map(compactProductionRow),
      assets: (recent[4]?.items || []).map(compactProductionRow),
      publishedCombinations: (recent[5]?.items || []).map(compactCombination),
    },
    diagnostics: {
      rawCountKeys: Object.keys(countByTable).length,
      warnings: [...extractWarnings(counts), ...extractWarnings(recent)],
      statusFilterHint: normalizeStatus('ready'),
    },
    safety: buildSafety(),
  }
}
