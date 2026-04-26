import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  Image,
  Loader2,
  MessageCircle,
  Play,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import clsx from 'clsx'

import { api } from '@/shared/lib/axios'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { mockAtrizes } from '@/mocks/data/atrizes'

type PerfilAtriz = {
  id: string
  slug: string
  nome: string
  avatar: string | null
  banner: string | null
  videoUrl: string | null
  descricao: string
  idade: number | null
  altura: string | null
  fotos: string[]
  online: boolean
  totalConteudos: number
  totalChats: number
  seguidores: number
}

type PersonaForm = {
  relationshipType: string
  currentMood: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const RELATIONSHIPS = [
  'desconhecidos',
  'casados',
  'namoro secreto',
  'amizade provocante',
  'mestre/submissa',
]

const MOODS = [
  'natural',
  'tímida',
  'carinhosa',
  'provocadora',
  'ciumenta',
  'dominante',
]

function toSlug(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function normalizePerfil(raw: any): PerfilAtriz {
  return {
    id: String(raw.id),
    slug: raw.slug ?? toSlug(raw.nome ?? raw.name ?? 'atriz'),
    nome: raw.nome ?? raw.name ?? 'Companion',
    avatar: raw.avatar ?? raw.avatar_url ?? null,
    banner: raw.banner ?? raw.banner_url ?? raw.avatar_url ?? raw.avatar ?? null,
    videoUrl: raw.videoUrl ?? raw.video_url ?? null,
    descricao: raw.descricao ?? raw.bio ?? 'Perfil premium da companion.',
    idade: raw.idade ?? raw.age ?? null,
    altura: raw.altura ?? raw.height_label ?? null,
    fotos: raw.fotos ?? raw.gallery_urls ?? raw.galleryUrls ?? [],
    online: Boolean(raw.online ?? raw.is_online ?? true),
    totalConteudos: raw.totalConteudos ?? raw.total_conteudos ?? raw.fotos?.length ?? raw.gallery_urls?.length ?? 0,
    totalChats: raw.totalChats ?? raw.total_chats ?? 0,
    seguidores: raw.seguidores ?? raw.followers ?? 0,
  }
}

function fallbackByParam(param: string): PerfilAtriz | null {
  const found = mockAtrizes.find((item) => item.slug === param || item.id === param)

  if (!found) return null

  return normalizePerfil({
    ...found,
    online: true,
    totalConteudos: found.fotos.length,
    totalChats: 0,
    seguidores: 0,
  })
}

export function AtrizPerfilPage() {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [atriz, setAtriz] = useState<PerfilAtriz | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  const [persona, setPersona] = useState<PersonaForm>({
    relationshipType: 'desconhecidos',
    currentMood: 'natural',
  })

  const hasRealUuid = useMemo(() => Boolean(atriz?.id && UUID_RE.test(atriz.id)), [atriz?.id])

  useEffect(() => {
    let active = true

    async function loadPerfil() {
      setLoading(true)
      setErro(null)

      try {
        let lookupId = slug

        if (!UUID_RE.test(slug)) {
          const { data: lista } = await api.get('/atrizes')
          const found = (lista || []).find((item: any) => {
            const itemSlug = item.slug ?? toSlug(item.nome ?? item.name ?? '')
            return itemSlug === slug
          })

          if (found?.id) {
            lookupId = found.id
          } else {
            const fallback = fallbackByParam(slug)
            if (active) {
              setAtriz(fallback)
              setErro(fallback ? null : 'Atriz não encontrada.')
            }
            return
          }
        }

        const { data } = await api.get(`/atrizes/${lookupId}/perfil`)

        if (active) {
          setAtriz(normalizePerfil(data))
        }
      } catch (error) {
        console.error('Erro ao carregar perfil da atriz:', error)

        const fallback = fallbackByParam(slug)

        if (active) {
          setAtriz(fallback)
          setErro(fallback ? null : 'Atriz não encontrada.')
        }
      } finally {
        if (active) setLoading(false)
      }
    }

    loadPerfil()

    return () => {
      active = false
    }
  }, [slug])

  async function handleStartChat() {
    if (!atriz || !hasRealUuid) return

    try {
      setStartingChat(true)

      const { data } = await api.post('/chat/conversas/start', {
        companionId: atriz.id,
        relationshipType: persona.relationshipType,
        currentMood: persona.currentMood,
      })

      navigate(`/cliente/chat/${data.id}`)
    } catch (error) {
      console.error('Erro ao iniciar conversa:', error)
    } finally {
      setStartingChat(false)
    }
  }

  if (loading) {
    return (
      <ClienteLayout>
        <div className="flex h-[calc(100vh-9rem)] overflow-hidden">
          <div className="w-full animate-pulse border-r border-zinc-800 bg-zinc-950 md:w-1/3" />
          <div className="hidden flex-1 p-4 md:block">
            <div className="grid grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="aspect-square rounded-2xl bg-zinc-800" />
              ))}
            </div>
          </div>
        </div>
      </ClienteLayout>
    )
  }

  if (erro || !atriz) {
    return (
      <ClienteLayout>
        <div className="flex h-[calc(100vh-9rem)] items-center justify-center px-6">
          <div className="max-w-md text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-zinc-900 ring-1 ring-zinc-800">
              <UserRound size={34} className="text-zinc-500" />
            </div>

            <h1 className="mt-6 text-2xl font-semibold text-white">
              Companion não encontrada
            </h1>

            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Não conseguimos localizar esse perfil. Ele pode ter sido removido,
              estar indisponível ou o link pode estar incorreto.
            </p>

            <button
              onClick={() => navigate('/cliente/descobrir')}
              className="mt-6 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:scale-105"
            >
              Explorar Companions
            </button>
          </div>
        </div>
      </ClienteLayout>
    )
  }

  return (
    <ClienteLayout>
      <div className="flex h-[calc(100vh-9rem)] overflow-hidden bg-zinc-950">
        <aside className="w-full shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 md:w-[380px]">
          <div className="relative">
            <div className="relative h-[280px] overflow-hidden rounded-b-3xl bg-zinc-900">
              {atriz.videoUrl ? (
                <video
                  src={atriz.videoUrl}
                  poster={atriz.avatar ?? atriz.banner ?? undefined}
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : atriz.banner ? (
                <img src={atriz.banner} alt={atriz.nome} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                  <Image size={44} className="text-zinc-700" />
                </div>
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-black/30" />

              <button
                onClick={() => navigate(-1)}
                className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur transition hover:bg-black/70"
              >
                <ArrowLeft size={17} />
              </button>

              {atriz.online && (
                <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-emerald-300 backdrop-blur">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Online
                </div>
              )}
            </div>

            <div className="relative -mt-14 px-5">
              <div className="rounded-3xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl shadow-black/40 backdrop-blur">
                <div className="flex items-center gap-3">
                  {atriz.avatar ? (
                    <img
                      src={atriz.avatar}
                      alt={atriz.nome}
                      className="h-16 w-16 rounded-2xl border border-white/20 object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/20">
                      <UserRound className="text-violet-300" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h1 className="truncate text-xl font-bold text-white">{atriz.nome}</h1>
                      <BadgeCheck size={18} className="shrink-0 text-violet-400" />
                    </div>
                    <p className="text-xs text-zinc-400">Criadora verificada</p>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-zinc-300">
                  {atriz.descricao}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-300">
                    Verificada
                  </span>
                  <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
                    Premium
                  </span>
                  <span className="rounded-full border border-pink-500/30 bg-pink-500/10 px-3 py-1 text-xs font-semibold text-pink-300">
                    IA personalizada
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 border-y border-zinc-800">
            <div className="py-4 text-center">
              <p className="text-sm font-bold text-white">{atriz.totalConteudos}</p>
              <p className="text-[11px] text-zinc-500">Conteúdos</p>
            </div>
            <div className="border-x border-zinc-800 py-4 text-center">
              <p className="text-sm font-bold text-white">{atriz.totalChats}</p>
              <p className="text-[11px] text-zinc-500">Chats</p>
            </div>
            <div className="py-4 text-center">
              <p className="text-sm font-bold text-white">{atriz.seguidores}</p>
              <p className="text-[11px] text-zinc-500">Seguidores</p>
            </div>
          </div>

          <div className="space-y-3 px-5 py-5">
            <button
              onClick={() => setModalAberto(true)}
              disabled={!hasRealUuid}
              className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle size={16} className="mr-2 inline" />
              Conversar com {atriz.nome.split(' ')[0]}
            </button>

            {!hasRealUuid && (
              <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-200">
                Perfil visual carregado do fallback. Para iniciar chat, use uma companion vinda da API real.
              </p>
            )}

            <button
              onClick={() => navigate('/cliente/gerar-imagem')}
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-900 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800"
            >
              <Sparkles size={16} className="mr-2 inline" />
              Gerar conteúdo
            </button>
          </div>

          <div className="px-5 pb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Detalhes
            </h2>

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-lg">👑</p>
                <p className="mt-1 text-xs text-zinc-300">{atriz.idade ? `${atriz.idade} anos` : 'Premium'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-lg">📏</p>
                <p className="mt-1 text-xs text-zinc-300">{atriz.altura ?? 'Perfil'}</p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 text-center">
                <p className="text-lg">✨</p>
                <p className="mt-1 text-xs text-zinc-300">Exclusiva</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="hidden flex-1 overflow-y-auto p-5 md:block">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Galeria</h2>
              <p className="text-sm text-zinc-500">Prévia visual da companion</p>
            </div>

            <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-400">
              {atriz.fotos.length} itens
            </div>
          </div>

          {atriz.fotos.length === 0 ? (
            <div className="flex h-[60vh] flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-800 bg-zinc-900/40 text-zinc-500">
              <Image size={36} />
              <p className="mt-3 text-sm">Nenhuma imagem disponível.</p>
            </div>
          ) : (
            <div className="columns-2 gap-4 xl:columns-3">
              {atriz.fotos.map((foto, index) => (
                <div
                  key={`${foto}-${index}`}
                  className={clsx(
                    'group relative mb-4 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/20',
                    index % 3 === 0 ? 'aspect-[3/4]' : index % 3 === 1 ? 'aspect-square' : 'aspect-[4/5]',
                  )}
                >
                  <img
                    src={foto}
                    alt=""
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />

                  {index === 0 && (
                    <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      Destaque
                    </div>
                  )}

                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 transition group-hover:opacity-100">
                    <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
                      Preview
                    </span>
                    <Heart size={18} className="text-white" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Configurar dinâmica</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Escolha a lente da conversa antes de iniciar o chat.
                </p>
              </div>

              <button
                onClick={() => setModalAberto(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Relacionamento
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {RELATIONSHIPS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setPersona((prev) => ({ ...prev, relationshipType: item }))}
                      className={clsx(
                        'rounded-xl border px-3 py-2 text-sm capitalize transition',
                        persona.relationshipType === item
                          ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700',
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Humor
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  {MOODS.map((item) => (
                    <button
                      key={item}
                      onClick={() => setPersona((prev) => ({ ...prev, currentMood: item }))}
                      className={clsx(
                        'rounded-xl border px-3 py-2 text-sm capitalize transition',
                        persona.currentMood === item
                          ? 'border-pink-500 bg-pink-500/20 text-pink-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700',
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleStartChat}
              disabled={startingChat}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-pink-500 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {startingChat ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play size={16} className="mr-2" />
                  Iniciar chat
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </ClienteLayout>
  )
}