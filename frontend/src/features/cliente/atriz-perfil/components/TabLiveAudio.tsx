import { useState } from 'react'
import { Play, Crown, Volume2, VolumeX } from 'lucide-react'
import clsx from 'clsx'
import type { AtrizPerfilPublico, LiveAudioItem } from '@/features/cliente/atriz-perfil/types'

type AbaAudio = 'stories' | 'outfits'

interface Props {
  atriz: AtrizPerfilPublico
  onTocar?: (item: LiveAudioItem) => void
  playingId?: string | null
}

function AudioRow({ item, onTocar, playingId }: { item: LiveAudioItem; onTocar?: (item: LiveAudioItem) => void; playingId?: string | null }) {
  const isPlaying = playingId === item.id

  return (
    <div className={clsx(
      'flex items-center justify-between rounded-xl bg-zinc-800/60 px-4 py-3 transition',
      !item.bloqueado && 'hover:bg-zinc-800 cursor-pointer',
    )}>
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <span className={clsx(
          'truncate text-sm font-medium',
          item.bloqueado ? 'text-zinc-600 blur-[4px] select-none' : 'text-zinc-200',
        )}>
          {item.bloqueado ? item.titulo.replace(/./g, '█') : item.titulo}
        </span>
      </div>

      <div className="flex items-center gap-3 shrink-0 ml-3">
        <span className="text-xs text-zinc-500">{item.duracao}</span>
        {item.bloqueado ? (
          <Crown size={16} className="text-pink-500" />
        ) : (
          <button
            type="button"
            onClick={() => onTocar?.(item)}
            disabled={isPlaying}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 transition hover:bg-pink-500 disabled:opacity-50"
          >
            <Play size={13} className="fill-white text-white" />
          </button>
        )}
      </div>
    </div>
  )
}

export function TabLiveAudio({ atriz, onTocar, playingId }: Props) {
  const [muted, setMuted] = useState(true)
  const [aba, setAba] = useState<AbaAudio>('stories')

  return (
    <div className="flex h-full gap-6">
      <div className="relative w-[45%] shrink-0 overflow-hidden rounded-2xl bg-zinc-900">
        <video
          src={atriz.videoUrl}
          autoPlay
          loop
          muted={muted}
          playsInline
          className="h-full w-full object-cover"
        />

        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/70 to-transparent px-3 py-3">
          <div className="flex items-center gap-2">
            <img src={atriz.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-pink-500" />
            <span className="text-sm font-semibold text-white">{atriz.nome.split(' ')[0]}</span>
            <span className="text-sm text-zinc-400">{atriz.idade}</span>
          </div>
          <button
            onClick={() => setMuted((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-zinc-800">
          {(['stories', 'outfits'] as AbaAudio[]).map((t) => (
            <button
              key={t}
              onClick={() => setAba(t)}
              className={clsx(
                'flex items-center gap-2 flex-1 justify-center py-3 text-sm font-semibold transition',
                aba === t
                  ? 'border-b-2 border-pink-500 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300',
              )}
            >
              {t === 'stories' ? (
                <><Volume2 size={14} /> Stories</>
              ) : (
                <><span className="text-base leading-none">👗</span> Outfits</>
              )}
            </button>
          ))}
        </div>

        {aba === 'stories' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-1 py-3">
              <span className="text-sm text-zinc-500">Escreva o seu</span>
              <span className="text-sm text-zinc-600">Em breve</span>
            </div>

            <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {atriz.liveAudios.map((item) => (
                <AudioRow key={item.id} item={item} onTocar={onTocar} playingId={playingId} />
              ))}
            </div>
          </div>
        )}

        {aba === 'outfits' && (
          <div className="flex flex-1 items-center justify-center text-zinc-600">
            <span className="text-sm">Em breve</span>
          </div>
        )}
      </div>
    </div>
  )
}
