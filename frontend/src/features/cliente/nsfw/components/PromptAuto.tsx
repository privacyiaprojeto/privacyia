interface PromptAutoProps {
  prompt: string
}

export function PromptAuto({ prompt }: PromptAutoProps) {
  return (
    <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/40 px-4 py-3">
      <p className="mb-1 text-xs text-zinc-500">Prompt gerado automaticamente</p>
      <p className="text-sm text-zinc-300">{prompt}</p>
    </div>
  )
}
