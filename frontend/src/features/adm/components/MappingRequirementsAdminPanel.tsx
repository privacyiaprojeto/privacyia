import { useEffect, useMemo, useState } from 'react'
import { FileAudio, FileImage, Loader2, Pencil, Plus, Power, PowerOff, Save, Video, X } from 'lucide-react'
import {
  useCreateMappingRequirement,
  useInactivateMappingRequirement,
  useMappingRequirements,
  useUpdateMappingRequirement,
} from '@/features/adm/hooks/useMappingRequirements'
import { MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS, type MappingRequirement, type MappingRequirementMediaType, type MappingRequirementSystemTag } from '@/features/adm/api/mappingRequirementsApi'
import { parseApiError } from '@/shared/utils/parseApiError'

const EMPTY_FORM = {
  title: '',
  description: '',
  mediaType: 'image' as MappingRequirementMediaType,
  systemTag: '' as MappingRequirementSystemTag | '',
  isRequired: true,
}

function mediaLabel(mediaType: MappingRequirementMediaType) {
  return mediaType === 'audio' ? 'Áudio' : mediaType === 'video' ? 'Vídeo' : 'Imagem'
}

function MediaIcon({ mediaType }: { mediaType: MappingRequirementMediaType }) {
  if (mediaType === 'audio') return <FileAudio size={18} />
  if (mediaType === 'video') return <Video size={18} />
  return <FileImage size={18} />
}

export function MappingRequirementsAdminPanel() {
  const requirementsQuery = useMappingRequirements(true)
  const createMutation = useCreateMappingRequirement()
  const updateMutation = useUpdateMappingRequirement()
  const inactivateMutation = useInactivateMappingRequirement()
  const [editing, setEditing] = useState<MappingRequirement | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    if (!editing) {
      setForm(EMPTY_FORM)
      return
    }
    setForm({
      title: editing.title,
      description: editing.description,
      mediaType: editing.mediaType,
      systemTag: editing.systemTag || '',
      isRequired: editing.isRequired,
    })
  }, [editing])

  const items = requirementsQuery.data?.items || []
  const activeCount = useMemo(() => items.filter((item) => item.isActive).length, [items])
  const pending = createMutation.isPending || updateMutation.isPending || inactivateMutation.isPending
  const activeError = requirementsQuery.error || createMutation.error || updateMutation.error || inactivateMutation.error

  async function handleSubmit() {
    const title = form.title.trim()
    if (!title) {
      window.alert('Informe o título do requisito.')
      return
    }

    const description = form.description.trim()
    if (description.length < 12) {
      window.alert('Descreva com clareza o que a pessoa participante deve enviar.')
      return
    }

    const payload = {
      title,
      description,
      mediaType: form.mediaType,
      systemTag: form.systemTag || null,
      isRequired: form.isRequired,
    }

    if (editing) {
      await updateMutation.mutateAsync({ requirementId: editing.id, payload })
      setEditing(null)
      return
    }

    await createMutation.mutateAsync(payload)
    setForm(EMPTY_FORM)
  }

  async function handleToggleActive(item: MappingRequirement) {
    if (item.isActive) {
      if (!window.confirm(`Inativar o requisito “${item.title}”? Ele deixará de aparecer para a pessoa participante, sem apagar o histórico.`)) return
      await inactivateMutation.mutateAsync(item.id)
      return
    }

    await updateMutation.mutateAsync({ requirementId: item.id, payload: { isActive: true } })
  }

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-200/80">Configuração do mapeamento</p>
        <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-black text-white">Gestão de Mapeamento</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              Crie as tarefas que aparecerão automaticamente no Painel Ator. Alterações valem para novos envios sem apagar materiais anteriores.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
            <strong className="text-white">{activeCount}</strong> requisito{activeCount === 1 ? '' : 's'} ativo{activeCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {activeError && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
          {parseApiError(activeError)}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black text-white">{editing ? 'Editar requisito' : 'Novo requisito'}</h3>
              <p className="mt-1 text-sm text-zinc-500">Defina o que deve ser enviado, o formato e a orientação que aparecerá no momento da escolha.</p>
            </div>
            {editing && (
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white" aria-label="Cancelar edição">
                <X size={18} />
              </button>
            )}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-zinc-300">
              Título
              <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Foto de rosto" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50" />
            </label>
            <label className="block text-sm font-semibold text-zinc-300">
              Orientação para a pessoa participante
              <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: Envie uma selfie frontal, com o rosto inteiro visível, de frente para uma luz suave e sem filtros." rows={4} className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50" />
              <span className="mt-2 block text-xs font-normal leading-relaxed text-zinc-500">Esta orientação aparece no card de envio assim que a categoria for selecionada. Use linguagem aplicável a qualquer pessoa, sem depender de gênero.</span>
            </label>
            <label className="block text-sm font-semibold text-zinc-300">
              Tipo de mídia
              <select value={form.mediaType} onChange={(event) => setForm((current) => ({ ...current, mediaType: event.target.value as MappingRequirementMediaType }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50">
                <option value="image">Imagem</option>
                <option value="audio">Áudio</option>
                <option value="video">Vídeo</option>
              </select>
            </label>
            <label className="block text-sm font-semibold text-zinc-300">
              Tag de Sistema (Uso Interno)
              <select value={form.systemTag} onChange={(event) => setForm((current) => ({ ...current, systemTag: event.target.value as MappingRequirementSystemTag | '' }))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-violet-300/50">
                <option value="">Sem tag interna</option>
                {MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.value} — {option.label}</option>
                ))}
              </select>
              <span className="mt-2 block text-xs font-normal leading-relaxed text-zinc-500">Referência técnica para automações futuras. Esta informação nunca aparece no Painel Ator.</span>
            </label>
            <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
              <input type="checkbox" checked={form.isRequired} onChange={(event) => setForm((current) => ({ ...current, isRequired: event.target.checked }))} className="h-4 w-4 accent-violet-400" />
              Obrigatório para concluir o mapeamento
            </label>
            <button type="button" disabled={pending} onClick={() => void handleSubmit()} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? <Loader2 size={17} className="animate-spin" /> : editing ? <Save size={17} /> : <Plus size={17} />}
              {editing ? 'Salvar alterações' : 'Criar requisito'}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
          <div>
            <h3 className="text-xl font-black text-white">Requisitos cadastrados</h3>
            <p className="mt-1 text-sm text-zinc-500">Inativar preserva o histórico e remove o card dos próximos acessos da pessoa participante.</p>
          </div>

          <div className="mt-6 space-y-3">
            {requirementsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 p-10 text-sm text-zinc-400"><Loader2 size={18} className="animate-spin" /> Carregando requisitos...</div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">Nenhum requisito cadastrado. Crie o primeiro usando o formulário ao lado.</div>
            ) : items.map((item) => {
              const systemTagOption = MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS.find((option) => option.value === item.systemTag)

              return (
                <article key={item.id} className={`overflow-hidden rounded-2xl border transition ${item.isActive ? 'border-white/10 bg-white/[0.035] hover:border-violet-300/25' : 'border-white/5 bg-black/20 opacity-65'}`}>
                  <div className="grid min-w-0 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="flex min-w-0 gap-3">
                      <div className="shrink-0 rounded-xl bg-violet-400/10 p-2.5 text-violet-200"><MediaIcon mediaType={item.mediaType} /></div>
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h4 className="min-w-0 break-words font-black text-white" title={item.title}>{item.title}</h4>
                          <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-bold text-zinc-400">{mediaLabel(item.mediaType)}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${item.isRequired ? 'bg-amber-400/10 text-amber-200' : 'bg-sky-400/10 text-sky-200'}`}>{item.isRequired ? 'Obrigatório' : 'Opcional'}</span>
                          {!item.isActive && <span className="shrink-0 rounded-full bg-zinc-700 px-2 py-0.5 text-[11px] font-bold text-zinc-300">Inativo</span>}
                        </div>
                        <p className="mt-2 line-clamp-3 break-words text-sm leading-relaxed text-zinc-500" title={item.guidance || item.description || 'Sem orientação cadastrada.'}>
                          {item.guidance || item.description || 'Sem orientação cadastrada.'}
                        </p>
                        <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Tag interna</span>
                          <span className="max-w-full break-all rounded-full border border-violet-300/15 bg-violet-300/10 px-3 py-1 font-mono text-[11px] font-bold text-violet-100">
                            {item.systemTag || 'não definida'}
                          </span>
                          {systemTagOption && <span className="text-xs text-zinc-500">{systemTagOption.label}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2 lg:grid-cols-1">
                      <button type="button" disabled={pending} onClick={() => setEditing(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-white/20 hover:text-white"><Pencil size={14} /> Editar</button>
                      <button type="button" disabled={pending} onClick={() => void handleToggleActive(item)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-white/20 hover:text-white">
                        {item.isActive ? <PowerOff size={14} /> : <Power size={14} />} {item.isActive ? 'Inativar' : 'Reativar'}
                      </button>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
