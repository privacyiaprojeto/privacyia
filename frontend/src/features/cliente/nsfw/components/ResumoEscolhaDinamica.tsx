import clsx from 'clsx'

interface OpcaoResumoDinamico {
  id: string
  label: string
  categoria: string
  categoriaLabel?: string
  titleName?: string
}

interface ResumoEscolhaDinamicaProps {
  selecionadas: Record<string, string | null | undefined>
  opcoes: OpcaoResumoDinamico[]
  className?: string
}

function getTitulo(opcao: OpcaoResumoDinamico) {
  return opcao.categoriaLabel || opcao.titleName || opcao.categoria || 'Opção'
}

export function ResumoEscolhaDinamica({ selecionadas, opcoes, className }: ResumoEscolhaDinamicaProps) {
  const escolhas = Object.entries(selecionadas || {})
    .map(([categoria, itemId]) => {
      if (!itemId) return null

      const opcao = opcoes.find((item) => item.categoria === categoria && item.id === itemId)
      if (!opcao) return null

      return {
        categoria,
        titulo: getTitulo(opcao),
        item: opcao.label,
      }
    })
    .filter(Boolean) as Array<{ categoria: string; titulo: string; item: string }>

  if (escolhas.length === 0) return null

  return (
    <div className={clsx('rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3', className)}>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
        Sua escolha
      </p>
      <div className="flex flex-wrap gap-2">
        {escolhas.map((escolha) => (
          <div
            key={`${escolha.categoria}:${escolha.item}`}
            className="rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1"
          >
            <span className="text-[11px] font-semibold text-violet-200">{escolha.titulo}: </span>
            <span className="text-[11px] text-zinc-200">{escolha.item}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
        O texto técnico usado internamente não é exibido. A mídia será preparada a partir dos quadradinhos escolhidos.
      </p>
    </div>
  )
}
