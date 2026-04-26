import { useState } from 'react'
import { User, Play } from 'lucide-react'
import clsx from 'clsx'
import { useAtrizPerfil } from '@/features/cliente/chat/hooks/useAtrizPerfil'
import { useTimeline } from '@/features/cliente/chat/hooks/useTimeline'

type Aba = 'perfil' | 'timeline'

interface Props {
  atrizId: string
}

export function AtrizProfilePanel({ atrizId }: Props) {
  const [aba, setAba] = useState<Aba>('perfil')

  const { data: perfil, isPending } = useAtrizPerfil(atrizId)
  const { data: timeline, isPending: loadingTimeline } = useTimeline(atrizId)

  if (isPending) {
    return (
      <div className="hidden w-96 flex-col border-l border-zinc-800 lg:flex">
        <div className="space-y-3 p-4">
          <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-zinc-800" />
          <div className="mx-auto h-4 w-28 animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-full animate-pulse rounded bg-zinc-800" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800" />
        </div>
      </div>
    )
  }

  if (!perfil) return null

  return (
    <div className="hidden w-96 flex-col overflow-y-auto border-l border-zinc-800 lg:flex">

      {/* Tabs — topo do painel */}
      <div className="flex shrink-0 border-b border-zinc-800">
        {(['perfil', 'timeline'] as Aba[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setAba(tab)}
            className={clsx(
              'flex-1 py-3 text-xs font-semibold capitalize tracking-wide transition',
              aba === tab
                ? 'border-b-2 border-violet-500 text-violet-400'
                : 'text-zinc-500 hover:text-zinc-300'
            )}
          >
            {tab === 'perfil' ? 'Perfil' : 'Timeline'}
          </button>
        ))}
      </div>

      {/* ── Aba Perfil ─────────────────────────── */}
      {aba === 'perfil' && (
        <>
          {/* Avatar + gradiente */}
          <div className="shrink-0 bg-gradient-to-b from-violet-900/30 to-zinc-950 px-4 pb-4 pt-6">
            <div className="mx-auto flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-violet-600/40 bg-violet-600/20 shadow-lg shadow-violet-900/20">
              {perfil.avatar ? (
                <img src={perfil.avatar} alt={perfil.nome} className="h-full w-full object-cover" />
              ) : (
                <User size={32} className="text-violet-400" />
              )}
            </div>

            <div className="mt-3 text-center">
              <h2 className="text-sm font-bold text-zinc-100">{perfil.nome}</h2>
              <div className="mt-1 flex items-center justify-center gap-1.5">
                <span className={clsx('h-2 w-2 rounded-full', perfil.online ? 'bg-emerald-500' : 'bg-zinc-600')} />
                <span className="text-[11px] text-zinc-500">
                  {perfil.online ? 'Online agora' : 'Offline'}
                </span>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-4">
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-100">{perfil.idade}</p>
                <p className="text-[10px] text-zinc-500">anos</p>
              </div>
              <div className="h-6 w-px bg-zinc-800" />
              <div className="text-center">
                <p className="text-xs font-semibold text-zinc-100">{perfil.altura}</p>
                <p className="text-[10px] text-zinc-500">altura</p>
              </div>
            </div>
          </div>

          <div className="mx-4 h-px bg-zinc-800" />

          {/* Descrição */}
          <div className="px-4 py-3">
            <p className="text-[12px] leading-relaxed text-zinc-400">{perfil.descricao}</p>
          </div>

          <div className="mx-4 h-px bg-zinc-800" />

          {/* Fotos */}
          <div className="p-4">
            <p className="mb-2 text-[11px] font-medium text-zinc-500">Fotos</p>
            <div className="grid grid-cols-3 gap-1.5">
              {perfil.fotos.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-lg bg-zinc-800">
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 hover:scale-110"
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Aba Timeline ───────────────────────── */}
      {aba === 'timeline' && (
        <div className="p-4">
          {loadingTimeline ? (
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-lg bg-zinc-800" />
              ))}
            </div>
          ) : timeline?.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-zinc-600">
              <p className="text-xs">Nenhum conteúdo gerado</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {timeline?.map((media) => (
                <div
                  key={media.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-zinc-800"
                >
                  <img
                    src={media.url}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                  {media.tipo === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                        <Play size={14} className="fill-white text-white" />
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
                    <p className="text-[9px] text-zinc-300">{media.criadaEm}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
