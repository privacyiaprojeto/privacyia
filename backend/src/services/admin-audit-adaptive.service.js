import { supabaseAdmin } from '../config/supabase.js'

const AUDIT_TABLE = 'admin_audit_logs'

function nowIso() {
  return new Date().toISOString()
}

function getMissingColumn(error) {
  const message = error?.message || ''
  const match = message.match(/Could not find the '([^']+)' column/i)
  return match?.[1] || null
}

function cleanPayload(payload) {
  return Object.fromEntries(Object.entries(payload || {}).filter(([, value]) => value !== undefined))
}

function normalizeAuditPayload(input = {}) {
  const details = {
    ...(input.details || {}),
    ...(input.metadata || {}),
    sprint: input.sprint || input.details?.sprint || input.metadata?.sprint || null,
  }

  return cleanPayload({
    profile_id: input.profileId || input.profile_id || input.actorProfileId || null,
    actor_profile_id: input.actorProfileId || input.actor_profile_id || null,
    user_id: input.profileId || input.userId || input.user_id || null,
    action: input.action || 'admin.audit',
    event_type: input.eventType || input.event_type || input.action || 'admin.audit',
    entity_type: input.entityType || input.entity_type || input.targetType || null,
    entity_id: input.entityId || input.entity_id || input.targetId || null,
    target_type: input.targetType || input.target_type || input.entityType || null,
    target_id: input.targetId || input.target_id || input.entityId || null,
    resource_type: input.resourceType || input.resource_type || input.entityType || null,
    resource_id: input.resourceId || input.resource_id || input.entityId || null,
    message: input.message || null,
    notes: input.notes || input.message || null,
    details,
    metadata: details,
    payload: details,
    created_at: input.createdAt || nowIso(),
    updated_at: input.updatedAt || nowIso(),
  })
}

export async function insertAdminAuditAdaptive(input = {}) {
  const payload = normalizeAuditPayload(input)
  const currentPayload = { ...payload }
  const removedColumns = []

  while (Object.keys(currentPayload).length > 0) {
    const { data, error } = await supabaseAdmin
      .from(AUDIT_TABLE)
      .insert(currentPayload)
      .select('*')
      .maybeSingle()

    if (!error) {
      return {
        ok: true,
        data: data || null,
        removedColumns,
      }
    }

    const missingColumn = getMissingColumn(error)

    if (missingColumn && Object.prototype.hasOwnProperty.call(currentPayload, missingColumn)) {
      delete currentPayload[missingColumn]
      removedColumns.push(missingColumn)
      continue
    }

    return {
      ok: false,
      data: null,
      removedColumns,
      error: error.message || String(error),
      code: error.code || null,
    }
  }

  return {
    ok: false,
    data: null,
    removedColumns,
    error: 'payload_empty_after_schema_adaptation',
    code: null,
  }
}


export async function insertAdminAuditLogAdaptive(input = {}, _options = {}) {
  return insertAdminAuditAdaptive(input)
}

export async function inspectAdminAuditLogAdaptive({ entityId = null, action = null, entityType = null, limit = 20 } = {}) {
  const filters = []

  let query = supabaseAdmin
    .from(AUDIT_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityId) {
    query = query.or([
      `entity_id.eq.${entityId}`,
      `target_id.eq.${entityId}`,
      `resource_id.eq.${entityId}`,
    ].join(','))
    filters.push('entityId')
  }

  if (action) {
    query = query.eq('action', action)
    filters.push('action')
  }

  if (entityType) {
    query = query.or([
      `entity_type.eq.${entityType}`,
      `target_type.eq.${entityType}`,
      `resource_type.eq.${entityType}`,
    ].join(','))
    filters.push('entityType')
  }

  const { data, error } = await query

  if (error) {
    return {
      ok: false,
      found: false,
      rows: [],
      total: 0,
      filters,
      error: error.message || String(error),
      code: error.code || null,
    }
  }

  const rows = data || []

  return {
    ok: true,
    found: rows.length > 0,
    rows,
    total: rows.length,
    filters,
    error: null,
    code: null,
  }
}
