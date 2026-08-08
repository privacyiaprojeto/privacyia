import { useMemo, useState } from 'react'
import { FileText, Loader2, Pencil, Plus, Power, PowerOff, Save, X } from 'lucide-react'
import {
  useAudioStorylines,
  useCreateAudioStoryline,
  useUpdateAudioStoryline,
} from '@/features/adm/hooks/useIntelligenceCenter'
import type { AudioStorylineDto } from '@/features/adm/api/intelligenceCenterApi'
import { parseApiError } from '@/shared/utils/parseApiError'

const EMPTY_FORM = { title: '', script: '', voiceTone: '' }

export function AudioStorylinesPanel() {
  const storylinesQuery = useAudioStorylines()
  const createMutation = useCreateAudioStoryline()
  const updateMutation = useUpdateAudioStoryline()
  const [editing, setEditing] = useState<AudioStorylineDto | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [message, setMessage] = useState<string | null>(null)

  const items = storylinesQuery.data?.items || []
  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items])
  const pending = createMutation.isPending || updateMutation.isPending
  const activeError = storylinesQuery.error || createMutation.error || updateMutation.error

  function startEditing(item: AudioStorylineDto) {
    setEditing(item)
    setForm({ title: item.title, script: item.script, voiceTone: item.voiceTone })
    setMessage(null)
  }

  function cancelEditing() {
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  async function handleSubmit() {
    if (form.title.trim().length < 2 || form.script.trim().length < 5 || form.voiceTone.trim().length < 2) return

    if (editing) {
      const result = await updateMutation.mutateAsync({ itemId: editing.id, payload: { title: form.title.trim(), script: form.script.trim(), voiceTone: form.voiceTone.trim() } })
      setMessage(result.message)
      cancelEditing()
      return
    }

    const result = await createMutation.mutateAsync({ title: form.title.trim(), script: form.script.trim(), voiceTone: form.voiceTone.trim() })
    setMessage(result.message)
    setForm(EMPTY_FORM)
  }

  async function handleToggle(item: AudioStorylineDto) {
    if (item.isActive && !window.confirm(`Inativar o enredo “${item.title}” sem apagar o histórico?`)) return
    const result = await updateMutation.mutateAsync({ itemId: item.id, payload: { isActive: !item.isActive } })
    setMessage(result.message)
  }

  return (
    <section className="space-y-6" data-admin-audio-storylines="true">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Biblioteca reutilizável para TTS</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="text-3xl font-black text-white">Enredos de Áudio</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Cadastre roteiros e tons de voz globais. A produção e a publicação continuam em fluxos separados.</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300"><strong className="text-white">{activeCount}</strong> enredo(s) ativo(s)</div>
        </div>
      </div>

      {activeError && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">{parseApiError(activeError)}</div>}
      {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div><h3 className="text-xl font-black text-white">{editing ? 'Editar enredo' : 'Novo enredo'}</h3><p className="mt-1 text-sm text-zinc-500">Conteúdo-base para futuras gerações TTS.</p></div>
            {editing && <button type="button" onClick={cancelEditing} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white" aria-label="Cancelar edição"><X size={17} /></button>}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-zinc-300">Título
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Mensagem de boas-vindas" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>
            <label className="block text-sm font-semibold text-zinc-300">Tom de voz para TTS
              <input value={form.voiceTone} onChange={(event) => setForm((current) => ({ ...current, voiceTone: event.target.value }))} placeholder="Ex.: acolhedor, calmo e próximo" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>
            <label className="block text-sm font-semibold text-zinc-300">Roteiro
              <textarea value={form.script} onChange={(event) => setForm((current) => ({ ...current, script: event.target.value }))} rows={9} placeholder="Escreva o texto-base que poderá ser enviado ao motor TTS." className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>
            <button type="button" onClick={handleSubmit} disabled={pending || form.title.trim().length < 2 || form.script.trim().length < 5 || form.voiceTone.trim().length < 2} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? <Loader2 size={17} className="animate-spin" /> : editing ? <Save size={17} /> : <Plus size={17} />}
              {editing ? 'Salvar alteração' : 'Cadastrar enredo'}
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {storylinesQuery.isLoading && <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-sm text-zinc-500">Carregando enredos…</div>}
          {!storylinesQuery.isLoading && items.length === 0 && <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Nenhum enredo de áudio cadastrado.</div>}
          {items.map((item) => (
            <article key={item.id} className={`rounded-[1.75rem] border p-5 ${item.isActive ? 'border-white/10 bg-white/[0.045]' : 'border-zinc-800 bg-black/20 opacity-60'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0"><div className="flex items-center gap-2"><FileText size={16} className="text-amber-200" /><h3 className="font-black text-white">{item.title}</h3></div><p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Tom: {item.voiceTone}</p><p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">{item.script}</p></div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => startEditing(item)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25"><Pencil size={14} /> Editar</button>
                  <button type="button" onClick={() => handleToggle(item)} disabled={pending} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25 disabled:opacity-40">{item.isActive ? <PowerOff size={14} /> : <Power size={14} />}{item.isActive ? 'Inativar' : 'Reativar'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
