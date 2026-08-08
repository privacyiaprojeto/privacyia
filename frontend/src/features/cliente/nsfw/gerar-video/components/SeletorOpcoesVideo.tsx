import { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import type { OpcaoVideo, TipoOpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

const LABELS_FIXOS: Record<string, string> = {
  roupa: 'Roupa',
  acao: 'Ação',
  localizacao: 'Cenário',
}

interface SeletorOpcoesVideoProps {
  opcoes: OpcaoVideo[]
  selecionadas: Record<TipoOpcaoVideo, string | null>
  onToggle: (categoria: TipoOpcaoVideo, id: string) => void
}

function getCategoriaLabel(opcao: OpcaoVideo) {
  return opcao.categoriaLabel || opcao.titleName || LABELS_FIXOS[opcao.categoria] || opcao.categoria
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
  const tabs = useMemo(() => {
    const map = new Map<TipoOpcaoVideo, string>()

    for (const opcao of opcoes) {
      if (!map.has(opcao.categoria)) {
        map.set(opcao.categoria, getCategoriaLabel(opcao))
      }
    }

    return Array.from(map.entries()).map(([key, label]) => ({ key, label }))
  }, [opcoes])

  const [tabAtiva, setTabAtiva] = useState<TipoOpcaoVideo>(tabs[0]?.key || 'roupa')

  useEffect(() => {
    if (tabs.length === 0) return
    if (!tabs.some((tab) => tab.key === tabAtiva)) {
      setTabAtiva(tabs[0].key)
    }
  }, [tabs, tabAtiva])

  const opcoesDaTab = opcoes.filter((o) => o.categoria === tabAtiva)

  if (tabs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900/40 p-4 text-xs text-zinc-400">
        Nenhuma opção foi liberada para este avatar ainda.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-zinc-800/60 p-1 scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTabAtiva(tab.key)}
            className={clsx(
              'min-w-[5.5rem] flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition',
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
