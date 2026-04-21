import { useState, useRef } from 'react'
import clsx from 'clsx'
import type { OpcaoVideo, TipoOpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

const TABS: { key: TipoOpcaoVideo; label: string }[] = [
  { key: 'roupa', label: 'Roupa' },
  { key: 'acao', label: 'Ação' },
  { key: 'localizacao', label: 'Cenário' },
]

interface SeletorOpcoesVideoProps {
  opcoes: OpcaoVideo[]
  selecionadas: Record<TipoOpcaoVideo, string | null>
  onToggle: (categoria: TipoOpcaoVideo, id: string) => void
}

function CardVideo({ opcao, selecionada, onToggle }: {
  opcao: OpcaoVideo
  selecionada: boolean
  onToggle: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  function handleMouseEnter() {
    videoRef.current?.play()
  }
  function handleMouseLeave() {
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }

  if (opcao.videoUrl) {
    return (
      <button
        onClick={onToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={clsx(
          'relative flex-shrink-0 h-24 w-20 overflow-hidden rounded-2xl transition',
          selecionada ? 'ring-2 ring-violet-500' : 'ring-1 ring-zinc-700 hover:ring-zinc-500',
        )}
      >
        <video
          ref={videoRef}
          src={opcao.videoUrl}
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        />
        <div
          className={clsx(
            'absolute inset-0 flex items-end justify-center pb-1.5 transition',
            selecionada ? 'bg-violet-900/40' : 'bg-black/30',
          )}
        >
          <span className="text-[10px] font-semibold text-white leading-tight text-center px-1">
            {opcao.label}
          </span>
        </div>
      </button>
    )
  }

  return (
    <button
      onClick={onToggle}
      className={clsx(
        'flex-shrink-0 overflow-hidden rounded-2xl transition',
        selecionada ? 'ring-2 ring-violet-500' : 'ring-1 ring-zinc-700 hover:ring-zinc-500',
      )}
    >
      {opcao.imageUrl ? (
        <div className="relative h-24 w-20">
          <img src={opcao.imageUrl} alt={opcao.label} className="h-full w-full object-cover" />
          <div
            className={clsx(
              'absolute inset-0 flex items-end justify-center pb-1.5 transition',
              selecionada ? 'bg-violet-900/40' : 'bg-black/30',
            )}
          >
            <span className="text-[10px] font-semibold text-white leading-tight text-center px-1">
              {opcao.label}
            </span>
          </div>
        </div>
      ) : (
        <div
          className={clsx(
            'flex h-24 w-20 items-center justify-center px-2 text-center text-xs font-medium',
            selecionada ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-300',
          )}
        >
          {opcao.label}
        </div>
      )}
    </button>
  )
}

export function SeletorOpcoesVideo({ opcoes, selecionadas, onToggle }: SeletorOpcoesVideoProps) {
  const [tabAtiva, setTabAtiva] = useState<TipoOpcaoVideo>('roupa')
  const opcoesDaTab = opcoes.filter((o) => o.categoria === tabAtiva)

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-xl bg-zinc-800/60 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabAtiva(tab.key)}
            className={clsx(
              'flex-1 rounded-lg py-1.5 text-xs font-medium transition',
              tabAtiva === tab.key
                ? 'bg-violet-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {opcoesDaTab.map((opcao) => (
          <CardVideo
            key={opcao.id}
            opcao={opcao}
            selecionada={selecionadas[tabAtiva] === opcao.id}
            onToggle={() => onToggle(tabAtiva, opcao.id)}
          />
        ))}
      </div>
    </div>
  )
}
