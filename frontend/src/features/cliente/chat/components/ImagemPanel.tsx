import { Flame } from 'lucide-react'
import clsx from 'clsx'

interface Pose {
  id: string
  label: string
  thumb: string
}

const poses: Pose[] = [
  { id: 'em-pe',     label: 'Em Pé',     thumb: 'https://nemora.ai/_next/image?url=%2Fassets%2Fimages%2Ftraits%2Ffemale%2FIG_POSE_Standing.png&w=3840&q=75'   },
  { id: 'sentada',   label: 'Sentada',   thumb: 'https://nemora.ai/_next/image?url=%2Fassets%2Fimages%2Ftraits%2Ffemale%2FIG_POSE_Sitting.png&w=3840&q=75'    },
  { id: 'deitada',   label: 'Deitada',   thumb: 'https://nemora.ai/_next/image?url=%2Fassets%2Fimages%2Ftraits%2Ffemale%2FIG_POSE_Lying-down.png&w=3840&q=75' },
  { id: 'ajoelhada', label: 'Ajoelhada', thumb: 'https://nemora.ai/_next/image?url=%2Fassets%2Fimages%2Ftraits%2Ffemale%2FIG_POSE_Kneeling.png&w=3840&q=75'   },
  { id: 'agachada',  label: 'Agachada',  thumb: 'https://nemora.ai/_next/image?url=%2Fassets%2Fimages%2Ftraits%2Ffemale%2FIG_POSE_Squatting.png&w=3840&q=75'  },
]

interface Props {
  poseSelecionada: string | null
  onPose: (id: string) => void
  onSetTexto: (mensagem: string) => void
}

export function ImagemPanel({ poseSelecionada, onPose, onSetTexto }: Props) {
  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 pt-3 pb-3">

      {/* Toggle Conteúdo Quente — desabilitado */}
      <div className="mb-3 flex cursor-not-allowed items-center gap-2 opacity-40">
        <Flame size={15} className="text-zinc-500" />
        <span className="text-xs font-medium text-zinc-500">Conteúdo Quente</span>
        <div className="relative ml-1 h-5 w-9 rounded-full bg-zinc-700">
          <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow" />
        </div>
      </div>

      {/* Cards de poses */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        {poses.map(({ id, label, thumb }) => {
          const ativo = poseSelecionada === id
          return (
            <button
              key={id}
              onClick={() => { onPose(id); onSetTexto(`Me envia uma foto de você ${label}`) }}
              className={clsx(
                'group flex shrink-0 flex-col overflow-hidden rounded-2xl border transition',
                ativo
                  ? 'border-violet-500'
                  : 'border-zinc-700 hover:border-zinc-500'
              )}
            >
              <div className="relative h-28 w-24 overflow-hidden bg-zinc-800">
                <img
                  src={thumb}
                  alt={label}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="bg-zinc-800/80 px-2 py-1.5 text-center text-[11px] font-medium text-zinc-400">
                {label}
              </div>
            </button>
          )
        })}
      </div>

    </div>
  )
}
