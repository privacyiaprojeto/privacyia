import { useState } from 'react'
import { X } from 'lucide-react'
import clsx from 'clsx'
import {
  relationshipOptions,
  moodOptions,
  getRelationshipLabel,
  getMoodLabel,
} from '@/features/cliente/chat/personaOptions'

type AbaRel = 'relacionamento' | 'humor'

interface Props {
  onFechar: () => void
  relationshipType: string | null
  currentMood: string | null
  onRelationshipTypeChange: (value: string) => void
  onCurrentMoodChange: (value: string) => void
  onSalvar?: () => void
  saving?: boolean
}

export function RelHumorPanel({
  onFechar,
  relationshipType,
  currentMood,
  onRelationshipTypeChange,
  onCurrentMoodChange,
  onSalvar,
  saving = false,
}: Props) {
  const [aba, setAba] = useState<AbaRel>('relacionamento')

  const opcoes = aba === 'relacionamento' ? relationshipOptions : moodOptions
  const selecionado = aba === 'relacionamento' ? relationshipType : currentMood
  const onSelecionar =
    aba === 'relacionamento' ? onRelationshipTypeChange : onCurrentMoodChange

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 pt-3 pb-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['relacionamento', 'humor'] as AbaRel[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setAba(tab)}
              className={clsx(
                'rounded-full border px-4 py-1 text-xs font-semibold transition',
                aba === tab
                  ? 'border-violet-500 text-violet-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300',
              )}
            >
              {tab === 'relacionamento' ? 'Relacionamento' : 'Humor'}
            </button>
          ))}
        </div>

        <button
          onClick={onFechar}
          className="flex h-6 w-6 items-center justify-center rounded-full text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
        >
          <X size={14} />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <span className="rounded-full border border-violet-600/30 bg-violet-600/10 px-2.5 py-1 text-[10px] font-semibold text-violet-300">
          Rel: {getRelationshipLabel(relationshipType)}
        </span>
        <span className="rounded-full border border-fuchsia-600/30 bg-fuchsia-600/10 px-2.5 py-1 text-[10px] font-semibold text-fuchsia-300">
          Humor: {getMoodLabel(currentMood)}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {opcoes.map(({ value, label, icon: Icon }) => {
          const ativo = selecionado === value
          return (
            <button
              key={value}
              onClick={() => onSelecionar(value)}
              className={clsx(
                'flex shrink-0 flex-col items-center gap-2 rounded-xl border px-4 py-3 transition',
                ativo
                  ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                  : 'border-zinc-700 bg-zinc-800/50 text-violet-300 hover:border-violet-600/40 hover:bg-violet-600/10 hover:text-violet-300',
              )}
            >
              <Icon size={26} strokeWidth={1.5} />
              <span className="w-max text-[10px] font-medium leading-none">{label}</span>
            </button>
          )
        })}
      </div>

      {onSalvar && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={onSalvar}
            disabled={saving}
            className="rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Salvando...' : 'Salvar dinâmica'}
          </button>
        </div>
      )}
    </div>
  )
}
