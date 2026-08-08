import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'
import { createSignedReadUrl } from './storage.service.js'

const PRIORITY = [
  'face_front',
  'face_profile_left',
  'face_profile_right',
  'face_profile',
  'nsfw_closeup_front',
  'nsfw_closeup_back',
  'body_front',
  'body_back',
  'video_expression',
  'video_walk',
  'nsfw_front',
  'nsfw_back',
]

function rank(tag) {
  const index = PRIORITY.indexOf(String(tag || '').toLowerCase())
  return index < 0 ? 999 : index
}

export async function loadApprovedActorIdentityReferences(actorProfileId, { ttlSeconds = 1800 } = {}) {
  if (!actorProfileId) return []

  const [requirements, assets] = await Promise.all([
    supabaseAdmin
      .from('mapping_requirements')
      .select('id, system_tag, media_type, is_active')
      .eq('is_active', true),
    supabaseAdmin
      .from('actor_kyc_assets')
      .select('id, mapping_requirement_id, r2_bucket, r2_key, content_type, status, created_at')
      .eq('actor_profile_id', actorProfileId)
      .eq('status', 'approved')
      .not('r2_bucket', 'is', null)
      .not('r2_key', 'is', null)
      .order('created_at', { ascending: false }),
  ])

  if (requirements.error) throw new ApiError(500, 'Erro ao carregar requisitos biométricos aprovados.', requirements.error)
  if (assets.error) throw new ApiError(500, 'Erro ao carregar referências aprovadas do Cofre Biométrico.', assets.error)

  const requirementById = new Map((requirements.data || []).map((row) => [row.id, row]))
  const usedTags = new Set()
  const selected = []

  for (const asset of assets.data || []) {
    const requirement = requirementById.get(asset.mapping_requirement_id)
    const systemTag = String(requirement?.system_tag || '').toLowerCase()
    if (!systemTag || usedTags.has(systemTag)) continue
    usedTags.add(systemTag)
    selected.push({
      assetId: asset.id,
      systemTag,
      mediaType: String(requirement?.media_type || '').toLowerCase() || (String(asset.content_type || '').startsWith('video/') ? 'video' : 'image'),
      contentType: asset.content_type || null,
      bucket: asset.r2_bucket,
      key: asset.r2_key,
    })
  }

  selected.sort((left, right) => rank(left.systemTag) - rank(right.systemTag))
  return Promise.all(selected.map(async (item) => ({
    assetId: item.assetId,
    systemTag: item.systemTag,
    mediaType: item.mediaType,
    contentType: item.contentType,
    url: await createSignedReadUrl(item.bucket, item.key, ttlSeconds),
  })))
}
