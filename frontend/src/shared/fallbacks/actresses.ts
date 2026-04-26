import type { Atriz } from '@/shared/types/atriz'
import type { Secao } from '@/features/cliente/descobrir/types'
import type { AtrizPerfilPublico, HistoricoItem, LiveActionItem, LiveAudioItem } from '@/features/cliente/atriz-perfil/types'
import type { AtrizPerfil as ChatAtrizPerfil, Conversa, MediaGerada, Mensagem } from '@/features/cliente/chat/types'
import {
  DEFAULT_CURRENT_MOOD,
  DEFAULT_RELATIONSHIP_TYPE,
} from '@/features/cliente/chat/personaOptions'
import { mockAtrizes } from '@/mocks/data/atrizes'
import { secoes as mockSecoes } from '@/mocks/data/secoes'
import { conversas as mockConversas, mensagens as mockMensagens } from '@/mocks/data/chat'

const actionsFallback = [
  { id: 'acao-1', nome: 'Sorriso especial', nivelRequerido: 1, bloqueado: false },
  { id: 'acao-2', nome: 'Mensagem carinhosa', nivelRequerido: 1, bloqueado: false },
  { id: 'acao-3', nome: 'Resposta exclusiva', nivelRequerido: 2, bloqueado: true },
  { id: 'acao-4', nome: 'Cena cinematográfica', nivelRequerido: 3, bloqueado: true },
] satisfies LiveActionItem[]

const audiosFallback = [
  { id: 'audio-1', titulo: 'Boa noite', duracao: '00:12', bloqueado: false },
  { id: 'audio-2', titulo: 'Mensagem especial', duracao: '00:19', bloqueado: false },
  { id: 'audio-3', titulo: 'Áudio premium', duracao: '00:28', bloqueado: true },
] satisfies LiveAudioItem[]

function bySlug(slug?: string | null) {
  if (!slug) return undefined
  return mockAtrizes.find((item) => item.slug === slug)
}

function byId(id?: string | null) {
  if (!id) return undefined
  return mockAtrizes.find((item) => item.id === id)
}

function byName(name?: string | null) {
  if (!name) return undefined
  return mockAtrizes.find((item) => item.nome.toLowerCase() === name.toLowerCase())
}

function fallbackImages(source?: { avatar?: string | null; banner?: string | null; videoUrl?: string | null; fotos?: string[] | null }) {
  const avatar = source?.avatar || source?.banner || source?.videoUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=800&q=80'
  const banner = source?.banner || source?.videoUrl || avatar
  const videoUrl = source?.videoUrl || banner || avatar
  const fotos = source?.fotos?.length
    ? source.fotos
    : [avatar, banner, videoUrl, avatar, banner, videoUrl].filter(Boolean)

  return { avatar, banner, videoUrl, fotos }
}

function mergeBase<T extends { avatar?: string | null; banner?: string | null; videoUrl?: string | null; fotos?: string[] | null }>(
  base: T | undefined,
  mock: Partial<Atriz> | undefined,
) {
  const media = fallbackImages({
    avatar: base?.avatar ?? mock?.avatar ?? null,
    banner: base?.banner ?? mock?.banner ?? null,
    videoUrl: base?.videoUrl ?? mock?.videoUrl ?? null,
    fotos: base?.fotos ?? mock?.fotos ?? null,
  })

  return {
    ...base,
    avatar: base?.avatar || mock?.avatar || media.avatar,
    banner: base?.banner || mock?.banner || media.banner,
    videoUrl: base?.videoUrl || mock?.videoUrl || media.videoUrl,
    fotos: base?.fotos?.length ? base.fotos : mock?.fotos || media.fotos,
  }
}

export function enrichAtriz(atriz?: Partial<Atriz> | null): Atriz {
  const mock = bySlug(atriz?.slug) || byId(atriz?.id) || byName(atriz?.nome)
  const merged = mergeBase(atriz || undefined, mock)

  return {
    id: atriz?.id || mock?.id || `fallback-${(atriz?.slug || atriz?.nome || 'perfil').toLowerCase().replace(/\s+/g, '-')}`,
    slug: atriz?.slug || mock?.slug || String((atriz?.nome || mock?.nome || 'perfil').toLowerCase().replace(/\s+/g, '-')),
    nome: atriz?.nome || mock?.nome || 'Criadora',
    avatar: merged.avatar,
    banner: merged.banner,
    videoUrl: merged.videoUrl,
    descricao: atriz?.descricao || mock?.descricao || 'Perfil premium com conteúdo em destaque e visual cinematográfico.',
    idade: atriz?.idade || mock?.idade || 24,
    altura: atriz?.altura || mock?.altura || '1.68m',
    fotos: merged.fotos,
    thumbnailUrl: atriz?.thumbnailUrl || mock?.thumbnailUrl || merged.avatar,
    runpodVoiceId: atriz?.runpodVoiceId || mock?.runpodVoiceId || null,
  }
}

function buildHistorico(source: Atriz): HistoricoItem[] {
  const firstVideo: HistoricoItem = {
    id: `${source.id}-video`,
    tipo: 'video',
    url: source.videoUrl,
    criadaEm: new Date().toISOString(),
  }

  const photos = source.fotos.slice(0, 11).map((url, index) => ({
    id: `${source.id}-foto-${index + 1}`,
    tipo: 'foto' as const,
    url,
    criadaEm: new Date(Date.now() - (index + 1) * 86400000).toISOString(),
  }))

  return [firstVideo, ...photos]
}

export function enrichAtrizPublicProfile(atriz?: Partial<AtrizPerfilPublico> | null): AtrizPerfilPublico {
  const baseAtriz = enrichAtriz({
    id: atriz?.id,
    slug: atriz?.slug,
    nome: atriz?.nome,
    avatar: atriz?.avatar,
    banner: atriz?.banner,
    videoUrl: atriz?.videoUrl,
    descricao: atriz?.descricao,
    idade: atriz?.idade,
    altura: atriz?.altura,
    fotos: atriz?.fotos,
    thumbnailUrl: atriz?.thumbnailUrl,
    runpodVoiceId: atriz?.runpodVoiceId,
  })

  const historico = atriz?.historico?.length ? atriz.historico : buildHistorico(baseAtriz)

  return {
    id: atriz?.id || baseAtriz.id,
    slug: atriz?.slug || baseAtriz.slug,
    nome: atriz?.nome || baseAtriz.nome,
    avatar: baseAtriz.avatar,
    banner: baseAtriz.banner,
    videoUrl: baseAtriz.videoUrl,
    descricao: atriz?.descricao || baseAtriz.descricao,
    idade: atriz?.idade || baseAtriz.idade,
    altura: atriz?.altura || baseAtriz.altura,
    fotos: atriz?.fotos?.length ? atriz.fotos : baseAtriz.fotos,
    assinaturaAtiva: atriz?.assinaturaAtiva ?? false,
    online: atriz?.online ?? true,
    totalConteudos: atriz?.totalConteudos || historico.length,
    totalChats: atriz?.totalChats || 12,
    seguidores: atriz?.seguidores || 3200,
    nivelAtual: atriz?.nivelAtual || 1,
    xpAtual: atriz?.xpAtual || 42,
    xpProximoNivel: atriz?.xpProximoNivel || 100,
    liveActions: atriz?.liveActions?.length ? atriz.liveActions : actionsFallback,
    liveAudios: atriz?.liveAudios?.length ? atriz.liveAudios : audiosFallback,
    historico,
  }
}

export function enrichAtrizesList(list?: Atriz[] | null): Atriz[] {
  if (!list?.length) {
    return mockAtrizes.map((item) => enrichAtriz(item))
  }

  return list.map((item) => enrichAtriz(item))
}

export function enrichSections(sections?: Secao[] | null): Secao[] {
  if (!sections?.length) {
    return mockSecoes.map((section) => ({
      id: section.id,
      titulo: section.titulo,
      atrizes: section.atrizes.map((item) => enrichAtriz(item)),
    }))
  }

  return sections.map((section) => ({
    ...section,
    atrizes: enrichAtrizesList(section.atrizes),
  }))
}

export function enrichChatProfile(profile?: Partial<ChatAtrizPerfil> | null): ChatAtrizPerfil {
  const atriz = enrichAtriz({
    id: profile?.id,
    nome: profile?.nome,
    avatar: profile?.avatar || undefined,
    descricao: profile?.descricao,
    idade: profile?.idade,
    altura: profile?.altura,
    fotos: profile?.fotos,
  })

  return {
    id: profile?.id || atriz.id,
    nome: profile?.nome || atriz.nome,
    avatar: profile?.avatar || atriz.avatar,
    online: profile?.online ?? true,
    descricao: profile?.descricao || atriz.descricao,
    idade: profile?.idade || atriz.idade,
    altura: profile?.altura || atriz.altura,
    fotos: profile?.fotos?.length ? profile.fotos : atriz.fotos,
  }
}

export function enrichTimeline(atrizId: string, timeline?: MediaGerada[] | null): MediaGerada[] {
  if (timeline?.length) return timeline

  const atriz = enrichAtriz(byId(atrizId))
  return buildHistorico(atriz).map((item) => ({
    id: item.id,
    atrizId,
    tipo: item.tipo,
    url: item.url,
    criadaEm: item.criadaEm,
  }))
}

export function enrichConversations(list?: Conversa[] | null): Conversa[] {
  if (!list?.length) {
    return mockConversas.map((conversation) => ({
      ...conversation,
      relationshipType: conversation.relationshipType || DEFAULT_RELATIONSHIP_TYPE,
      currentMood: conversation.currentMood || DEFAULT_CURRENT_MOOD,
    }))
  }

  return list.map((item) => {
    const fallback = byId(item.atriz.id) || byName(item.atriz.nome)
    return {
      ...item,
      relationshipType: item.relationshipType || DEFAULT_RELATIONSHIP_TYPE,
      currentMood: item.currentMood || DEFAULT_CURRENT_MOOD,
      atriz: {
        ...item.atriz,
        avatar: item.atriz.avatar || fallback?.avatar || null,
        online: item.atriz.online ?? true,
      },
      ultimaMensagem: item.ultimaMensagem || 'Conversa iniciada',
      ultimaHora: item.ultimaHora || 'agora',
      naoLidas: item.naoLidas ?? 0,
    }
  })
}

export function enrichMessages(conversationId: string, list?: Mensagem[] | null): Mensagem[] {
  if (list?.length) return list
  return mockMensagens.filter((item) => item.conversaId === conversationId)
}
