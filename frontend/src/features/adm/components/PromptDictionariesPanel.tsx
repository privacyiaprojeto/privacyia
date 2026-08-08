import { useMemo, useState } from 'react'
import { Loader2, Pencil, Plus, Power, PowerOff, Save, X } from 'lucide-react'
import {
  useCreatePromptDictionary,
  usePromptDictionaries,
  useUpdatePromptDictionary,
} from '@/features/adm/hooks/useIntelligenceCenter'
import type { PromptDictionaryItemDto } from '@/features/adm/api/intelligenceCenterApi'
import { parseApiError } from '@/shared/utils/parseApiError'

const CATEGORY_OPTIONS = [
  { value: 'scenario', label: 'Cenário' },
  { value: 'clothing', label: 'Roupa' },
  { value: 'action', label: 'Ação' },
  { value: 'pose', label: 'Pose' },
  { value: 'lighting', label: 'Iluminação' },
  { value: 'camera', label: 'Câmera' },
  { value: 'mood', label: 'Humor' },
  { value: 'voice_tone', label: 'Tom de voz' },
]

export function PromptDictionariesPanel() {
  const [category, setCategory] = useState('scenario')
  const [label, setLabel] = useState('')
  const [editing, setEditing] = useState<PromptDictionaryItemDto | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const itemsQuery = usePromptDictionaries(category)
  const createMutation = useCreatePromptDictionary()
  const updateMutation = useUpdatePromptDictionary()
  const items = itemsQuery.data?.items || []
  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items])
  const pending = createMutation.isPending || updateMutation.isPending
  const activeError = itemsQuery.error || createMutation.error || updateMutation.error

  function startEditing(item: PromptDictionaryItemDto) {
    setEditing(item)
    setLabel(item.label)
    setMessage(null)
  }

  function cancelEditing() {
    setEditing(null)
    setLabel('')
  }

  async function handleSubmit() {
    const value = label.trim()
    if (!value) return

    if (editing) {
      const result = await updateMutation.mutateAsync({ itemId: editing.id, payload: { label: value, category } })
      setMessage(result.message)
      cancelEditing()
      return
    }

    const result = await createMutation.mutateAsync({ category, label: value })
    setMessage(result.message)
    setLabel('')
  }

  async function handleToggle(item: PromptDictionaryItemDto) {
    if (item.isActive && !window.confirm(`Inativar “${item.label}” sem apagar o histórico?`)) return
    const result = await updateMutation.mutateAsync({ itemId: item.id, payload: { isActive: !item.isActive } })
    setMessage(result.message)
  }

  return (
    <section className="space-y-6" data-admin-prompt-dictionaries="true">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200/80">Fonte global de variáveis</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white">Dicionários de Prompt</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Centralize cenários, roupas, ações e demais opções reutilizáveis. A operação passa a consumir estes catálogos em vez de listas locais.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300"><strong className="text-white">{activeCount}</strong> item(ns) ativo(s) na categoria</div>
        </div>
      </div>

      {activeError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">{parseApiError(activeError)}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-black text-white">{editing ? 'Editar item' : 'Novo item'}</h3><p className="mt-1 text-sm text-zinc-500">Selecione uma categoria e cadastre a opção global.</p></div>
            {editing && <button type="button" onClick={cancelEditing} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white" aria-label="Cancelar edição"><X size={17} /></button>}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-zinc-300">Categoria
              <select value={category} onChange={(event) => { setCategory(event.target.value); cancelEditing() }} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50">
                {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold text-zinc-300">Item
              <input value={label} onChange={(event) => setLabel(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleSubmit() }} placeholder="Ex.: Praia" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50" />
            </label>
            <button type="button" onClick={handleSubmit} disabled={pending || !label.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? <Loader2 size={17} className="animate-spin" /> : editing ? <Save size={17} /> : <Plus size={17} />}
              {editing ? 'Salvar alteração' : 'Adicionar ao dicionário'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {itemsQuery.isLoading && <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-sm text-zinc-500">Carregando dicionário…</div>}
          {!itemsQuery.isLoading && items.length === 0 && <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Nenhum item nesta categoria.</div>}
          {items.map((item) => (
            <article key={item.id} className={`flex flex-col gap-4 rounded-[1.5rem] border p-4 sm:flex-row sm:items-center sm:justify-between ${item.isActive ? 'border-white/10 bg-white/[0.045]' : 'border-zinc-800 bg-black/20 opacity-60'}`}>
              <div className="min-w-0"><p className="font-black text-white">{item.label}</p><p className="mt-1 text-xs text-zinc-500">{item.category} · {item.isActive ? 'Ativo' : 'Inativo'}</p></div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={() => startEditing(item)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25"><Pencil size={14} /> Editar</button>
                <button type="button" onClick={() => handleToggle(item)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25 disabled:opacity-40">{item.isActive ? <PowerOff size={14} /> : <Power size={14} />}{item.isActive ? 'Inativar' : 'Reativar'}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
