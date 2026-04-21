import { AtrizCardHorizontal } from '@/features/cliente/components/AtrizCardHorizontal'
import type { AtrizPerfil } from '@/shared/types/atriz'

interface SugestoesColunaProps {
  atrizes: AtrizPerfil[]
}

export function SugestoesColuna({ atrizes }: SugestoesColunaProps) {
  return (
    <div className="sticky top-24 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Sugestões
      </h3>
      <div className="flex flex-col gap-3">
        {atrizes.map((atriz) => (
          <AtrizCardHorizontal key={atriz.id} atriz={atriz} />
        ))}
      </div>
    </div>
  )
}
