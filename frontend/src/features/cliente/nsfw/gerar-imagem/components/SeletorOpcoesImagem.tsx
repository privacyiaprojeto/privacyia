import { useState } from 'react'
import clsx from 'clsx'
import type { OpcaoImagem, TipoOpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'

const TABS: { key: TipoOpcaoImagem; label: string }[] = [
  { key: 'roupa', label: 'Roupa' },
  { key: 'posicao', label: 'Pose' },
  { key: 'acessorio', label: 'Acessório' },
  { key: 'ambiente', label: 'Cenário' },
]

interface SeletorOpcoesImagemProps {
  opcoes: OpcaoImagem[]
  selecionadas: Record<TipoOpcaoImagem, string | null>
  onToggle: (categoria: TipoOpcaoImagem, id: string) => void
}

export function SeletorOpcoesImagem({ opcoes, selecionadas, onToggle }: SeletorOpcoesImagemProps) {
  const [tabAtiva, setTabAtiva] = useState<TipoOpcaoImagem>('roupa')
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
        {opcoesDaTab.map((opcao) => {
          const selecionada = selecionadas[tabAtiva] === opcao.id
          return (
            <button
              key={opcao.id}
              onClick={() => onToggle(tabAtiva, opcao.id)}
              className={clsx(
                'flex-shrink-0 overflow-hidden rounded-2xl transition',
                selecionada ? 'ring-2 ring-violet-500' : 'ring-1 ring-zinc-700 hover:ring-zinc-500',
              )}
            >
              {opcao.imageUrl ? (
                <div className="relative h-24 w-20">
                  <img
                    src={opcao.imageUrl}
                    alt={opcao.label}
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
        })}
      </div>
    </div>
  )
}
