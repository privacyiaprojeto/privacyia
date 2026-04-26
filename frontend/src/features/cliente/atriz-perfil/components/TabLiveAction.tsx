import { useState } from 'react'
import { Play, Lock, Volume2, VolumeX } from 'lucide-react'
import clsx from 'clsx'
import type { AtrizPerfilPublico, LiveActionItem } from '@/features/cliente/atriz-perfil/types'

interface Props {
  atriz: AtrizPerfilPublico
  onExecutar?: (item: LiveActionItem) => void
  executingId?: string | null
}

function AcaoRow({ item, onExecutar, executingId }: { item: LiveActionItem; onExecutar?: (item: LiveActionItem) => void; executingId?: string | null }) {
  const isExecuting = executingId === item.id

  return (
    <div className={clsx(
      'flex items-center justify-between rounded-xl px-4 py-3 transition',
      item.bloqueado ? 'opacity-60' : 'hover:bg-zinc-800/50 cursor-pointer',
    )}>
      <span className={clsx(
        'text-sm font-medium',
        item.bloqueado ? 'select-none text-zinc-600 blur-[3px]' : 'text-zinc-200',
      )}>
        {item.bloqueado ? '██████████' : item.nome}
      </span>

      {item.bloqueado ? (
        <div className="flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1">
          <Lock size={11} className="text-violet-400" />
          <span className="text-[11px] font-semibold text-violet-400">
            Nível {item.nivelRequerido}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onExecutar?.(item)}
          disabled={isExecuting}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-600 transition hover:bg-pink-500 disabled:opacity-50"
        >
          <Play size={13} className="fill-white text-white" />
        </button>
      )}
    </div>
  )
}

export function TabLiveAction({ atriz, onExecutar, executingId }: Props) {
  const [muted, setMuted] = useState(true)
  const [sugestao] = useState('Olá! Como você está?')

  const xpPct = Math.round((atriz.xpAtual / atriz.xpProximoNivel) * 100)

  return (
    <div className="flex h-full gap-4">
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
            <img src={atriz.avatar} alt="" className="h-8 w-8 rounded-full object-cover ring-2 ring-violet-500" />
            <span className="text-sm font-semibold text-white">{atriz.nome.split(' ')[0]}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-300">
              {atriz.nivelAtual}
            </span>
          </div>
          <button
            onClick={() => setMuted((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm hover:bg-black/70"
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-4 pt-8">
          <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
            <span>Sugestão:</span>
            <button className="flex items-center gap-1.5 rounded-full bg-violet-600/80 px-3 py-1 text-white backdrop-blur-sm hover:bg-violet-600">
              <span>😊</span>
              <span className="text-[11px] font-medium">{sugestao}</span>
            </button>
          </div>
          <div className="flex h-9 items-center rounded-xl bg-white/10 px-3 backdrop-blur-sm">
            <span className="text-xs text-zinc-400">Pergunte qualquer coisa…</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-bold text-zinc-100">Live Action</span>
          <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
            Beta v2
          </span>
        </div>

        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-zinc-200">
              {atriz.nivelAtual}
            </div>
            <span className="text-sm font-semibold text-zinc-200">Nível {atriz.nivelAtual}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-violet-500 transition-all"
              style={{ width: `${xpPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[11px] text-zinc-500">
              {atriz.xpAtual} / {atriz.xpProximoNivel} XP
            </span>
            <span className="text-[11px] text-zinc-600">Nível {atriz.nivelAtual + 1}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col gap-0.5">
            {atriz.liveActions.map((item) => (
              <AcaoRow key={item.id} item={item} onExecutar={onExecutar} executingId={executingId} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
