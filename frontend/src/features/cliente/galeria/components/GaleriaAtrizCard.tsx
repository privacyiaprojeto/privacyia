import { Link } from 'react-router'
import { Lock, Image } from 'lucide-react'
import clsx from 'clsx'
import type { GaleriaAtriz } from '@/features/cliente/galeria/types'

interface GaleriaAtrizCardProps {
  atriz: GaleriaAtriz
}

export function GaleriaAtrizCard({ atriz }: GaleriaAtrizCardProps) {
  return (
    <Link
      to={`/cliente/atriz/${atriz.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:border-zinc-700"
    >
      {/* Preview da mídia */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-zinc-950">
        <img
          src={atriz.previewUrl}
          alt={atriz.nome}
          className={clsx(
            'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105',
            !atriz.assinaturaAtiva && 'blur-lg'
          )}
        />

        {/* Marca d'água */}
        <span className="absolute bottom-2 right-2 select-none rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white/60 backdrop-blur-sm">
          Privacy IA
        </span>

        {/* Sem assinatura — cadeado */}
        {!atriz.assinaturaAtiva && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-1.5 rounded-xl bg-black/60 px-4 py-3 backdrop-blur-sm">
              <Lock size={20} className="text-zinc-300" />
              <span className="text-xs text-zinc-400">Sem assinatura</span>
            </div>
          </div>
        )}

        {/* Contagem de mídias */}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 backdrop-blur-sm">
          <Image size={10} className="text-zinc-400" />
          <span className="text-[10px] text-zinc-300">{atriz.totalMidias}</span>
        </div>
      </div>

      {/* Rodapé — avatar + nome */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <img
          src={atriz.avatar}
          alt={atriz.nome}
          className="h-7 w-7 rounded-full object-cover ring-1 ring-zinc-700"
        />
        <span className="truncate text-sm font-medium text-zinc-200">{atriz.nome}</span>

        {atriz.assinaturaAtiva && (
          <span className="ml-auto shrink-0 rounded-full bg-violet-600/20 px-2 py-0.5 text-[10px] font-semibold text-violet-400">
            Ativa
          </span>
        )}
      </div>
    </Link>
  )
}
