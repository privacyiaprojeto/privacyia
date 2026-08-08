import { AtrizCardHorizontal } from '@/features/cliente/components/AtrizCardHorizontal'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface SugestoesColunaProps {
  atrizes: AtrizPerfil[]
}

export function SugestoesColuna({ atrizes }: SugestoesColunaProps) {
  const visiveis = atrizes.slice(0, 6)

  if (visiveis.length === 0) return null

  return (
    <div className="sticky top-24 space-y-3 rounded-3xl border border-zinc-800/80 bg-zinc-950/50 p-3 shadow-xl shadow-black/20">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Sugestões
        </h3>
        <span className="text-[10px] text-zinc-600">Avatares reais</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {visiveis.map((atriz) => (
          <AtrizCardHorizontal key={atriz.id} atriz={atriz} />
        ))}
      </div>
    </div>
  )
}
