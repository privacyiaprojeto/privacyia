import { supabaseAdmin } from '../config/supabase.js'
import { ApiError } from '../utils/apiError.js'

export async function getActressProfile(atrizId) {
  const { data: companion, error } = await supabaseAdmin
    .from('companions')
    .select('id, name, avatar_url, is_online, bio, age, height_label, gallery_urls')
    .eq('id', atrizId)
    .maybeSingle()

  if (error) {
    throw new ApiError(500, 'Erro ao buscar perfil da atriz.', error)
  }

  if (!companion) {
    throw new ApiError(404, 'Atriz não encontrada.')
  }

  return {
    id: companion.id,
    nome: companion.name,
    avatar: companion.avatar_url,
    online: companion.is_online ?? false,
    descricao: companion.bio || '',
    idade: companion.age || 0,
    altura: companion.height_label || '',
    fotos: companion.gallery_urls || [],
  }
}

export async function getActressTimeline(atrizId) {
  const { data, error } = await supabaseAdmin
    .from('gallery_items')
    .select('id, companion_id, media_type, media_url, created_at')
    .eq('companion_id', atrizId)
    .order('created_at', { ascending: false })
    .limit(24)

  if (error) {
    throw new ApiError(500, 'Erro ao buscar timeline da atriz.', error)
  }

  return (data || []).map((item) => ({
    id: item.id,
    atrizId: item.companion_id,
    tipo: item.media_type === 'video' ? 'video' : 'foto',
    url: item.media_url,
    criadaEm: item.created_at,
  }))
}
