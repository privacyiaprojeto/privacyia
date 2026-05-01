import { api } from '@/shared/lib/axios'
import type { AtrizPerfilPublico } from '@/features/cliente/atriz-perfil/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function normalizePerfil(raw: Partial<AtrizPerfilPublico>): AtrizPerfilPublico {
  const avatar = raw.avatar || raw.banner || raw.videoUrl || ''
  const banner = raw.banner || raw.videoUrl || avatar
  const videoUrl = raw.videoUrl || banner || avatar
  const fotos = raw.fotos?.length ? raw.fotos : [avatar, banner, videoUrl].filter(Boolean)

  return {
    id: String(raw.id),
    slug: raw.slug || String(raw.id),
    nome: raw.nome || 'Companion',
    avatar,
    banner,
    videoUrl,
    descricao: raw.descricao || 'Perfil premium da companion.',
    idade: raw.idade || 0,
    altura: raw.altura || '',
    fotos,
    assinaturaAtiva: raw.assinaturaAtiva ?? true,
    online: raw.online ?? true,
    totalConteudos: raw.totalConteudos || fotos.length,
    totalChats: raw.totalChats || 0,
    seguidores: raw.seguidores || 0,
    nivelAtual: raw.nivelAtual || 1,
    xpAtual: raw.xpAtual || 0,
    xpProximoNivel: raw.xpProximoNivel || 100,
    liveActions: raw.liveActions || [],
    liveAudios: raw.liveAudios || [],
    historico: raw.historico || [],
  }
}

export async function getAtrizPerfilPublico(slug: string): Promise<AtrizPerfilPublico> {
  // Lógica solicitada por Lorenzo: ID real da API usa endpoint de perfil; mock/slug mantém endpoint público.
  const endpoint = UUID_RE.test(slug) ? `/atrizes/${slug}/perfil` : `/atrizes/${slug}`
  const { data } = await api.get<Partial<AtrizPerfilPublico>>(endpoint)
  return normalizePerfil(data)
}
