import { MessageCircle, Sparkles, Lock, ArrowLeft, BadgeCheck, Play, Image } from 'lucide-react'
import clsx from 'clsx'
import { ClienteLayout } from '@/features/cliente/components/ClienteLayout'
import { TabLiveAction } from '@/features/cliente/atriz-perfil/components/TabLiveAction'
import { TabLiveAudio } from '@/features/cliente/atriz-perfil/components/TabLiveAudio'
import { useAtrizPerfilPage } from '@/features/cliente/atriz-perfil/hooks/useAtrizPerfilPage'
import { fmt, dataRelativa } from '@/features/cliente/atriz-perfil/utils'
import type { HistoricoItem } from '@/features/cliente/atriz-perfil/types'

const ASPECT: Record<number, string> = {
  0: 'aspect-[3/4]', 1: 'aspect-square', 2: 'aspect-[4/5]',
  3: 'aspect-[3/4]', 4: 'aspect-[4/3]', 5: 'aspect-[3/4]',
}

function ItemHistorico({ item }: { item: HistoricoItem }) {
  return (
    <div className="group relative aspect-square overflow-hidden rounded-xl bg-zinc-800 cursor-pointer">
      {item.tipo === 'video' ? (
        <video src={item.url} className="h-full w-full object-cover" muted />
      ) : (
        <img src={item.url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
      )}
      {item.tipo === 'video' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
            <Play size={13} className="fill-white text-white" />
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 opacity-0 transition group-hover:opacity-100">
        <p className="text-[10px] text-zinc-300">{dataRelativa(item.criadaEm)}</p>
      </div>
    </div>
  )
}

export function AtrizPerfilPage() {
  const {
  atriz,
  isLoading,
  isError,
  abaEsq,
  setAbaEsq,
  abaDir,
  setAbaDir,
  tabsDir,
  postsDaAtriz,
  startingChat,
  checkingConversation,
  temConversaAtiva,
  handleConversar,
  navigate,
} = useAtrizPerfilPage()

  if (isLoading) {
    return (
      <ClienteLayout>
        <div className="flex h-[calc(100vh-9rem)] overflow-hidden">
          <div className="w-1/3 shrink-0 animate-pulse border-r border-zinc-800 bg-zinc-900" />
          <div className="flex-1 p-4">
            <div className="columns-2 gap-3 md:columns-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={clsx('mb-3 animate-pulse rounded-2xl bg-zinc-800', ASPECT[i] ?? 'aspect-square')} />
              ))}
            </div>
          </div>
        </div>
      </ClienteLayout>
    )
  }

  if (isError || !atriz) {
    return (
      <ClienteLayout>
        <div className="flex flex-col items-center gap-3 pt-24 text-zinc-500">
          <span className="text-sm">Atriz não encontrada.</span>
          <button onClick={() => navigate(-1)} className="text-xs text-violet-400 underline-offset-2 hover:underline">
            Voltar
          </button>
        </div>
      </ClienteLayout>
    )
  }

  return (
    <ClienteLayout>
      <div className="flex h-[calc(100vh-9rem)] overflow-hidden">

        <aside className="scrollbar-platform w-1/3 shrink-0 overflow-y-auto overflow-x-hidden border-r border-zinc-800 bg-zinc-950 pt-2 pb-24">
          <div className="relative">
            <div className="relative h-[clamp(400px,72vh,520px)] w-full overflow-hidden rounded-b-2xl">
              <video
                src={atriz.videoUrl}
                poster={atriz.avatar}
                className="h-full w-full object-cover object-top"
                autoPlay loop muted playsInline preload="metadata"
              />
              <button
                onClick={() => navigate(-1)}
                className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
              >
                <ArrowLeft size={14} />
              </button>
              {atriz.online && (
                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[11px] font-medium text-emerald-400 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Online
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            </div>

            <div className="relative px-4 pt-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/90 p-3 backdrop-blur">
                <div className="flex items-center gap-2">
                  <img src={atriz.avatar} alt={atriz.nome} className="h-10 w-10 rounded-full border border-white/20 object-cover" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h1 className="truncate text-base font-bold text-white">{atriz.nome}</h1>
                      <BadgeCheck size={15} className="shrink-0 text-violet-400" />
                    </div>
                    <p className="text-[11px] text-zinc-400">Criadora verificada</p>
                  </div>
                </div>
                <p className="mt-2 text-xs leading-snug text-zinc-300/80 line-clamp-2">{atriz.descricao}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 px-4 pt-2">
            <span className="rounded-full border border-violet-600/30 bg-violet-600/10 px-2 py-0.5 text-[10px] font-semibold text-violet-400">✓ Verificada</span>
            <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">Criadora de conteúdo</span>
            {atriz.assinaturaAtiva && (
              <span className="rounded-full border border-emerald-700/30 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Assinante</span>
            )}
          </div>

          <div className="mt-4 grid grid-cols-3 border-y border-zinc-800">
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-sm font-bold text-zinc-100">🔥 {fmt(atriz.totalConteudos)}</span>
              <span className="text-[10px] text-zinc-500">Conteúdos</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 border-x border-zinc-800 py-3">
              <span className="text-sm font-bold text-zinc-100">💬 {fmt(atriz.totalChats)}</span>
              <span className="text-[10px] text-zinc-500">Chats</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-sm font-bold text-zinc-100">💜 {fmt(atriz.seguidores)}</span>
              <span className="text-[10px] text-zinc-500">Seguidores</span>
            </div>
          </div>

          <div className="px-4 pt-4">
            {atriz.assinaturaAtiva ? (
              <div className="flex flex-col gap-2">
                <button
  onClick={handleConversar}
  disabled={startingChat || checkingConversation}
  className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
>
  <MessageCircle size={14} className="mr-1.5 inline" />
  {startingChat
    ? 'Abrindo experiência...'
    : temConversaAtiva
      ? `Conversar com ${atriz.nome.split(' ')[0]}`
      : 'Curtir uma experiência'}
</button>
                <button onClick={() => navigate('/cliente/gerar-imagem')} className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-700">
                  <Sparkles size={14} className="mr-1.5 inline" />
                  Gerar conteúdo
                </button>
              </div>
            ) : (
              <button className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 py-2.5 text-sm font-semibold text-white transition hover:opacity-90">
                Assinar agora
              </button>
            )}
            <p className="mt-2 text-center text-[10px] text-zinc-600">SSL/TLS ENCRYPTED · RISK FREE</p>
          </div>

          <div className="mt-4 flex border-b border-zinc-800">
            {(['sobre', 'personalidade', 'interesses'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setAbaEsq(t)}
                className={clsx(
                  'flex-1 py-2.5 text-[10px] font-semibold uppercase tracking-wider transition',
                  abaEsq === t ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-600 hover:text-zinc-400',
                )}
              >
                {t === 'sobre' ? 'Sobre mim' : t === 'personalidade' ? 'Personalidade' : 'Interesses'}
              </button>
            ))}
          </div>

          <div className="px-4 py-4">
            {abaEsq === 'sobre' && (
              <>
                <p className="text-xs leading-relaxed text-zinc-400">{atriz.descricao}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    { emoji: '👑', label: `${atriz.idade} anos` },
                    { emoji: '📏', label: atriz.altura },
                    { emoji: '✨', label: 'Exclusiva' },
                    { emoji: '🔥', label: 'NSFW' },
                    { emoji: '💜', label: 'Premium' },
                    { emoji: '🌟', label: 'Top Creator' },
                  ].map((attr) => (
                    <div key={attr.label} className="flex flex-col items-center gap-0.5 rounded-xl border border-zinc-800 bg-zinc-900 py-2.5">
                      <span className="text-base leading-none">{attr.emoji}</span>
                      <span className="text-center text-[10px] font-medium text-zinc-400">{attr.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
            {abaEsq === 'personalidade' && (
              <p className="text-xs leading-relaxed text-zinc-400">
                Apaixonada, intensa e autêntica. Cria conexões reais com cada fã de forma única e especial.
              </p>
            )}
            {abaEsq === 'interesses' && (
              <div className="flex flex-wrap gap-1.5">
                {['Fotografia', 'Moda', 'Viagens', 'Arte', 'Fitness', 'Culinária'].map((i) => (
                  <span key={i} className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-400">{i}</span>
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="flex flex-1 flex-col overflow-hidden bg-zinc-950">
          <div className="flex shrink-0 border-b border-zinc-800">
            {tabsDir.map((t) => (
              <button
                key={t.id}
                onClick={() => setAbaDir(t.id)}
                className={clsx(
                  'flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition',
                  abaDir === t.id ? 'border-b-2 border-violet-500 text-violet-400' : 'text-zinc-600 hover:text-zinc-400',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {abaDir === 'posts' && (
            <div className="scrollbar-platform flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-5 gap-3">
                {postsDaAtriz.map((post, i) => (
                  <div key={post.id} className="group relative aspect-[4/5] overflow-hidden rounded-2xl">
                    {post.tipo === 'video' ? (
                      <video
                        src={post.url}
                        className={clsx('h-full w-full object-cover', !atriz.assinaturaAtiva && i >= 2 && 'blur-xl')}
                        muted playsInline preload="metadata"
                      />
                    ) : (
                      <img
                        src={post.url}
                        alt=""
                        className={clsx('h-full w-full object-cover transition duration-300 group-hover:scale-105', !atriz.assinaturaAtiva && i >= 2 && 'blur-xl')}
                      />
                    )}
                    {post.tipo === 'video' && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                          <Play size={16} className="fill-white text-white" />
                        </div>
                      </div>
                    )}
                    {!atriz.assinaturaAtiva && i >= 2 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60 backdrop-blur-sm">
                          <Lock size={18} className="text-zinc-300" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {postsDaAtriz.length === 0 && (
                  <div className="col-span-5 rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-6">
                    <p className="text-center text-sm text-zinc-400">Nenhum post dessa atriz ainda.</p>
                  </div>
                )}
                {!atriz.assinaturaAtiva && (
                  <div className="col-span-5 mt-1 flex flex-col items-center gap-2 rounded-2xl border border-violet-600/20 bg-violet-600/5 px-4 py-6">
                    <p className="text-center text-sm font-semibold text-zinc-200">Assine para ver tudo</p>
                    <button className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:opacity-90">
                      Assinar agora
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {abaDir === 'live_action' && (
            <div className="flex-1 overflow-hidden p-4">
              <TabLiveAction atriz={atriz} />
            </div>
          )}

          {abaDir === 'live_audio' && (
            <div className="flex-1 overflow-hidden p-4">
              <TabLiveAudio atriz={atriz} />
            </div>
          )}

          {abaDir === 'historico' && (
            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4 flex items-center gap-2 text-zinc-500">
                <Image size={14} />
                <span className="text-xs">Conteúdo gerado com essa atriz</span>
              </div>
              {atriz.historico.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-20 text-zinc-600">
                  <p className="text-sm">Nenhum conteúdo gerado ainda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 md:grid-cols-4">
                  {atriz.historico.map((item) => (
                    <ItemHistorico key={item.id} item={item} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </ClienteLayout>
  )
}