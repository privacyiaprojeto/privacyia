import { useState } from 'react'
import {
  X, User, Users, Briefcase, ClipboardList, Heart, Star, Flame,
  UserCheck, Smile, BookOpen, UserX, Flower2, Moon, Laugh, EyeOff,
  Zap, Crown, type LucideIcon,
} from 'lucide-react'
import clsx from 'clsx'

type AbaRel = 'relacionamento' | 'humor'

interface Opcao {
  id: string
  label: string
  icon: LucideIcon
}

const relacionamentos: Opcao[] = [
  { id: 'padrao',           label: 'Padrão',               icon: User          },
  { id: 'desconhecida',     label: 'Desconhecida',          icon: UserX         },
  { id: 'colega',           label: 'Colega',                icon: Users         },
  { id: 'chefe',            label: 'Chefe',                 icon: Briefcase     },
  { id: 'estagiaria',       label: 'Estagiária',            icon: ClipboardList },
  { id: 'namorada',         label: 'Namorada',              icon: Heart         },
  { id: 'esposa',           label: 'Esposa',                icon: Star          },
  { id: 'amante',           label: 'Amante',                icon: Flame         },
  { id: 'amiga-beneficios', label: 'Amiga com benefícios',  icon: UserCheck     },
  { id: 'amiga',            label: 'Amiga',                 icon: Smile         },
  { id: 'estudante',        label: 'Estudante',             icon: BookOpen      },
]

const humores: Opcao[] = [
  { id: 'padrao',     label: 'Padrão',     icon: User    },
  { id: 'romantico',  label: 'Romântico',  icon: Flower2 },
  { id: 'picante',    label: 'Picante',    icon: Flame   },
  { id: 'timido',     label: 'Tímido',     icon: EyeOff  },
  { id: 'brincalhao', label: 'Brincalhão', icon: Laugh   },
  { id: 'misterioso', label: 'Misterioso', icon: Moon    },
  { id: 'intenso',    label: 'Intenso',    icon: Zap     },
  { id: 'gentil',     label: 'Gentil',     icon: Heart   },
  { id: 'dominante',  label: 'Dominante',  icon: Crown   },
]

interface Props {
  onFechar: () => void
  relacionamento: string | null
  humor: string | null
  onRelacionamento: (id: string) => void
  onHumor: (id: string) => void
}

export function RelHumorPanel({ onFechar, relacionamento, humor, onRelacionamento, onHumor }: Props) {
  const [aba, setAba] = useState<AbaRel>('relacionamento')

  const opcoes = aba === 'relacionamento' ? relacionamentos : humores
  const selecionado = aba === 'relacionamento' ? relacionamento : humor
  const onSelecionar = aba === 'relacionamento' ? onRelacionamento : onHumor

  return (
    <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 pt-3 pb-2">

      {/* Cabeçalho: abas + fechar */}
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
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
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

      {/* Cards — scroll horizontal */}
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {opcoes.map(({ id, label, icon: Icon }) => {
          const ativo = selecionado === id
          return (
            <button
              key={id}
              onClick={() => onSelecionar(id)}
              className={clsx(
                'flex shrink-0 flex-col items-center gap-2 rounded-xl border px-4 py-3 transition',
                ativo
                  ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                  : 'border-zinc-700 bg-zinc-800/50 text-violet-300 hover:border-violet-600/40 hover:bg-violet-600/10 hover:text-violet-300'
              )}
            >
              <Icon size={26} strokeWidth={1.5} />
              <span className="w-max text-[10px] font-medium leading-none">{label}</span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
