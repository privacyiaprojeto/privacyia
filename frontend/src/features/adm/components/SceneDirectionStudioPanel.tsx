import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Film,
  Loader2,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  UsersRound,
  Video,
  X,
} from 'lucide-react'
import {
  useBaseScenePreview,
  useBaseScenes,
  useCreateBaseScene,
  useCreateSceneDirection,
  useSceneCastingCandidates,
  useSceneDirections,
  useUpdateBaseScene,
} from '@/features/adm/hooks/useSceneDirection'
import type { CreateSceneDirectionPayload, SceneDirectionStatus } from '@/features/adm/api/sceneDirectionApi'
import { parseApiError } from '@/shared/utils/parseApiError'

type StudioTab = 'library' | 'direction' | 'history'
type CastChoice = { value: string; customDescription?: string }

const EXTRA_OPTIONS = [
  { value: 'extra:generic_black_man', label: 'Personagem Virtual — Homem Negro Genérico' },
  { value: 'extra:generic_white_muscular_man', label: 'Personagem Virtual — Homem Branco Musculoso' },
  { value: 'extra:generic_asian_woman', label: 'Personagem Virtual — Mulher Asiática' },
  { value: 'extra:custom', label: 'Personagem Virtual — Personalizado' },
]

function statusPresentation(status: SceneDirectionStatus) {
  const map: Record<string, { label: string; className: string }> = {
    planned: { label: 'Direção preparada', className: 'border-sky-300/20 bg-sky-300/10 text-sky-100' },
    queued: { label: 'Na fila', className: 'border-amber-300/20 bg-amber-300/10 text-amber-100' },
    processing: { label: 'Em produção', className: 'border-violet-300/20 bg-violet-300/10 text-violet-100' },
    qa_pending: { label: 'Aguardando revisão', className: 'border-blue-300/20 bg-blue-300/10 text-blue-100' },
    completed: { label: 'Concluída', className: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' },
    failed: { label: 'Requer atenção', className: 'border-rose-300/20 bg-rose-300/10 text-rose-100' },
    cancelled: { label: 'Cancelada', className: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-300' },
  }
  return map[status] || map.planned
}

function bytesLabel(value?: number | null) {
  if (!value) return 'Tamanho não informado'
  if (value < 1024 * 1024) return `${Math.max(Math.round(value / 1024), 1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function SceneDirectionStudioPanel() {
  const [activeTab, setActiveTab] = useState<StudioTab>('direction')
  const scenesQuery = useBaseScenes(true)
  const castQuery = useSceneCastingCandidates()
  const directionsQuery = useSceneDirections()
  const createSceneMutation = useCreateBaseScene()
  const updateSceneMutation = useUpdateBaseScene()
  const previewMutation = useBaseScenePreview()
  const createDirectionMutation = useCreateSceneDirection()

  const [sceneTitle, setSceneTitle] = useState('')
  const [sceneDescription, setSceneDescription] = useState('')
  const [sceneSlots, setSceneSlots] = useState(2)
  const [sceneFile, setSceneFile] = useState<File | null>(null)
  const [sceneMessage, setSceneMessage] = useState<string | null>(null)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewTitle, setPreviewTitle] = useState('')

  const [productionMode, setProductionMode] = useState<'v2v' | 'i2v'>('v2v')
  const [baseSceneId, setBaseSceneId] = useState('')
  const [castChoices, setCastChoices] = useState<CastChoice[]>([{ value: '' }])
  const [directionPrompt, setDirectionPrompt] = useState('')
  const [directionMessage, setDirectionMessage] = useState<string | null>(null)
  const [directionError, setDirectionError] = useState<string | null>(null)

  const scenes = scenesQuery.data?.items || []
  const activeScenes = useMemo(() => scenes.filter((scene) => scene.isActive && scene.uploadStatus === 'ready'), [scenes])
  const selectedScene = useMemo(() => activeScenes.find((scene) => scene.id === baseSceneId) || null, [activeScenes, baseSceneId])
  const expectedSlots = productionMode === 'i2v' ? 1 : selectedScene?.slotsCount || 1
  const candidates = castQuery.data?.items || []

  useEffect(() => {
    if (productionMode === 'i2v') {
      setBaseSceneId('')
      setCastChoices((current) => [{ value: current[0]?.value || '', customDescription: current[0]?.customDescription || '' }])
      return
    }

    if (!baseSceneId && activeScenes[0]?.id) setBaseSceneId(activeScenes[0].id)
  }, [activeScenes, baseSceneId, productionMode])

  useEffect(() => {
    setCastChoices((current) => Array.from({ length: expectedSlots }, (_, index) => current[index] || { value: '' }))
  }, [expectedSlots])

  const sceneFileIsMp4 = Boolean(sceneFile && (sceneFile.type === 'video/mp4' || sceneFile.name.toLowerCase().endsWith('.mp4')))
  const canCreateScene = Boolean(sceneTitle.trim().length >= 2 && sceneFile && sceneFileIsMp4 && !createSceneMutation.isPending)
  const allSlotsFilled = castChoices.length === expectedSlots && castChoices.every((choice) => {
    if (!choice.value) return false
    return choice.value !== 'extra:custom' || Boolean(choice.customDescription?.trim())
  })
  const canCreateDirection = Boolean(
    directionPrompt.trim().length >= 5
      && allSlotsFilled
      && (productionMode === 'i2v' || selectedScene)
      && !createDirectionMutation.isPending,
  )

  async function handleCreateScene() {
    if (!canCreateScene || !sceneFile) return
    setSceneError(null)
    setSceneMessage(null)

    try {
      const result = await createSceneMutation.mutateAsync({
        title: sceneTitle,
        description: sceneDescription,
        slotsCount: sceneSlots,
        file: sceneFile,
      })
      setSceneTitle('')
      setSceneDescription('')
      setSceneSlots(2)
      setSceneFile(null)
      setSceneMessage(result.message || 'Cena adicionada à biblioteca.')
    } catch (error) {
      setSceneError(parseApiError(error) || 'Não foi possível adicionar a cena agora.')
    }
  }

  async function handlePreview(sceneId: string, title: string) {
    setSceneError(null)
    try {
      const result = await previewMutation.mutateAsync(sceneId)
      setPreviewTitle(title)
      setPreviewUrl(result.preview.url)
    } catch (error) {
      setSceneError(parseApiError(error) || 'Não foi possível abrir a prévia protegida.')
    }
  }

  function updateCastChoice(index: number, value: string) {
    setCastChoices((current) => current.map((choice, choiceIndex) => choiceIndex === index ? { value, customDescription: '' } : choice))
    setDirectionMessage(null)
    setDirectionError(null)
  }

  function updateCustomDescription(index: number, value: string) {
    setCastChoices((current) => current.map((choice, choiceIndex) => choiceIndex === index ? { ...choice, customDescription: value } : choice))
  }

  async function handleCreateDirection() {
    if (!canCreateDirection) return
    setDirectionError(null)
    setDirectionMessage(null)

    const slots: CreateSceneDirectionPayload['slots'] = castChoices.map((choice, index) => {
      if (choice.value.startsWith('actor:')) {
        const actorProfileId = choice.value.replace('actor:', '')
        const candidate = candidates.find((item) => item.actorProfileId === actorProfileId)
        return {
          slotIndex: index + 1,
          participantType: 'actor',
          actorProfileId,
          companionId: candidate?.companionId || null,
        }
      }

      const extraType = choice.value.replace('extra:', '') as 'generic_black_man' | 'generic_white_muscular_man' | 'generic_asian_woman' | 'custom'
      return {
        slotIndex: index + 1,
        participantType: 'virtual_extra',
        extraType,
        customDescription: choice.customDescription || '',
      }
    })

    try {
      const result = await createDirectionMutation.mutateAsync({
        productionMode,
        baseSceneId: productionMode === 'v2v' ? baseSceneId : null,
        slots,
        prompt: directionPrompt,
        execute: true,
      })
      setDirectionMessage(result.processing.message)
      setDirectionPrompt('')
      setActiveTab('history')
    } catch (error) {
      setDirectionError(parseApiError(error) || 'Não foi possível registrar a produção agora.')
    }
  }

  const tabs: Array<{ id: StudioTab; label: string; helper: string }> = [
    { id: 'direction', label: 'Nova Direção', helper: 'Cena, elenco e ambientação' },
    { id: 'library', label: 'Biblioteca de Cenas', helper: 'Vídeos base privados' },
    { id: 'history', label: 'Produções', helper: 'Acompanhamento da fila' },
  ]

  return (
    <section className="space-y-6" data-admin-scene-direction-studio="true">
      <div className="rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-300/[0.12] via-white/[0.04] to-black/20 p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-black/25 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-violet-100"><Film size={14} /> Produção em vídeo</span>
            <h2 className="mt-4 text-3xl font-black text-white md:text-4xl">Estúdio de Direção de Cena</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">Escolha uma cena base ou uma produção solo, monte um elenco de até três participantes e envie uma direção estruturada para a fila protegida.</p>
          </div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-50">
            <div className="flex items-center gap-2 font-black"><ShieldCheck size={17} /> Armazenamento privado</div>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-emerald-50/70">Cenas e resultados usam acesso temporário. Nenhuma URL pública é gravada.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.045] p-3 md:grid-cols-3">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`rounded-2xl p-4 text-left transition ${activeTab === tab.id ? 'bg-white text-zinc-950 shadow-xl shadow-white/10' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}>
            <strong className="block text-sm font-black">{tab.label}</strong>
            <span className="mt-1 block text-xs opacity-70">{tab.helper}</span>
          </button>
        ))}
      </div>

      {activeTab === 'library' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)]">
          <div className="h-fit rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Nova cena base</p>
            <h3 className="mt-2 text-2xl font-black text-white">Cadastrar referência MP4</h3>
            <div className="mt-5 space-y-4">
              <label className="block"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Título</span><input value={sceneTitle} onChange={(event) => setSceneTitle(event.target.value)} placeholder="Interação Casal Praia 01" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/40" /></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Descrição</span><textarea value={sceneDescription} onChange={(event) => setSceneDescription(event.target.value)} rows={3} placeholder="Movimento, enquadramento e observações para a direção." className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm text-white outline-none focus:border-violet-300/40" /></label>
              <label className="block"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Quantidade de atores na cena</span><select value={sceneSlots} onChange={(event) => setSceneSlots(Number(event.target.value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"><option value={1}>1 ator</option><option value={2}>2 atores</option><option value={3}>3 atores</option></select></label>
              <label className="block cursor-pointer rounded-2xl border border-dashed border-white/15 bg-black/25 p-5 text-center transition hover:border-violet-300/40">
                <Upload className="mx-auto text-violet-100" size={22} />
                <span className="mt-2 block text-sm font-black text-white">{sceneFile?.name || 'Selecionar vídeo MP4'}</span>
                <span className="mt-1 block text-xs text-zinc-500">Até 750 MB, enviado direto ao cofre privado.</span>
                <input type="file" accept="video/mp4" className="sr-only" onChange={(event) => { setSceneFile(event.target.files?.[0] || null); setSceneError(null); setSceneMessage(null) }} />
              </label>
              {sceneFile && !sceneFileIsMp4 && <p className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">Escolha um arquivo MP4.</p>}
              {sceneError && <p className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{sceneError}</p>}
              {sceneMessage && <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm font-bold text-emerald-100">{sceneMessage}</p>}
              <button type="button" onClick={handleCreateScene} disabled={!canCreateScene} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{createSceneMutation.isPending ? <><Loader2 className="animate-spin" size={17} /> Enviando cena…</> : <><Plus size={17} /> Adicionar à biblioteca</>}</button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Biblioteca privada</p><h3 className="mt-2 text-2xl font-black text-white">Cenas disponíveis</h3></div><span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-zinc-300">{scenes.length}</span></div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {scenes.map((scene) => (
                <article key={scene.id} className={`overflow-hidden rounded-[1.5rem] border p-4 ${scene.isActive ? 'border-white/10 bg-black/25' : 'border-zinc-800 bg-black/15 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-3"><span className="rounded-2xl border border-violet-300/15 bg-violet-300/10 p-3 text-violet-100"><Video size={18} /></span><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${scene.uploadStatus === 'ready' ? 'bg-emerald-300/15 text-emerald-100' : scene.uploadStatus === 'failed' ? 'bg-rose-300/15 text-rose-100' : 'bg-amber-300/15 text-amber-100'}`}>{scene.uploadStatus === 'ready' ? 'Pronta' : scene.uploadStatus === 'failed' ? 'Falhou' : 'Enviando'}</span></div>
                  <h4 className="mt-4 truncate text-lg font-black text-white" title={scene.title}>{scene.title}</h4>
                  <p className="mt-2 line-clamp-3 min-h-[3.75rem] text-sm leading-relaxed text-zinc-500">{scene.description || 'Sem observações adicionais.'}</p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-black text-zinc-300"><span className="rounded-full border border-white/10 px-2.5 py-1">{scene.slotsCount} participante(s)</span><span className="rounded-full border border-white/10 px-2.5 py-1">{bytesLabel(scene.byteSize)}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => handlePreview(scene.id, scene.title)} disabled={scene.uploadStatus !== 'ready'} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white transition hover:border-violet-300/40 disabled:opacity-40">Ver vídeo</button><button type="button" onClick={() => updateSceneMutation.mutate({ sceneId: scene.id, payload: { isActive: !scene.isActive } })} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-300 transition hover:text-white">{scene.isActive ? 'Inativar' : 'Reativar'}</button></div>
                </article>
              ))}
              {!scenesQuery.isLoading && scenes.length === 0 && <div className="col-span-full rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center"><Film className="mx-auto text-zinc-600" /><p className="mt-3 font-black text-white">Nenhuma cena cadastrada</p><p className="mt-1 text-sm text-zinc-500">Adicione o primeiro vídeo de referência para começar.</p></div>}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'direction' && (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
          <div className="space-y-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <div><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Passo 1 — A cena</p><h3 className="mt-2 text-2xl font-black text-white">Escolha o ponto de partida</h3></div>
            <div className="grid gap-3 md:grid-cols-2">
              <button type="button" onClick={() => setProductionMode('v2v')} className={`rounded-2xl border p-4 text-left transition ${productionMode === 'v2v' ? 'border-violet-300/40 bg-violet-300/10' : 'border-white/10 bg-black/25'}`}><Film className="text-violet-100" size={20} /><strong className="mt-3 block text-white">Cena Base — V2V</strong><span className="mt-1 block text-xs text-zinc-500">Mantém movimento e enquadramento do vídeo escolhido.</span></button>
              <button type="button" onClick={() => setProductionMode('i2v')} className={`rounded-2xl border p-4 text-left transition ${productionMode === 'i2v' ? 'border-violet-300/40 bg-violet-300/10' : 'border-white/10 bg-black/25'}`}><UserRound className="text-violet-100" size={20} /><strong className="mt-3 block text-white">Produção Solo — I2V</strong><span className="mt-1 block text-xs text-zinc-500">Uma pessoa, sem vídeo base obrigatório.</span></button>
            </div>
            {productionMode === 'v2v' && <label className="block"><span className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Cena da biblioteca</span><select value={baseSceneId} onChange={(event) => setBaseSceneId(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none"><option value="">Selecione uma cena</option>{activeScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} — {scene.slotsCount} participante(s)</option>)}</select>{activeScenes.length === 0 && <span className="mt-2 block text-xs text-amber-100">Cadastre e ative uma cena MP4 na Biblioteca.</span>}</label>}

            <div className="border-t border-white/10 pt-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Passo 2 — O elenco</p><h3 className="mt-2 text-2xl font-black text-white">Preencha {expectedSlots} posição(ões)</h3></div>
            <div className="grid gap-4 md:grid-cols-2">
              {castChoices.map((choice, index) => (
                <div key={index} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-violet-300/15 text-xs font-black text-violet-100">{index + 1}</span><strong className="text-sm text-white">Posição {index + 1}</strong></div>
                  <select value={choice.value} onChange={(event) => updateCastChoice(index, event.target.value)} className="mt-3 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-bold text-white outline-none"><option value="">Escolha ator ou personagem virtual</option><optgroup label="Atores mapeados">{candidates.map((candidate) => <option key={candidate.actorProfileId} value={`actor:${candidate.actorProfileId}`}>{candidate.displayName}{candidate.companion?.name ? ` — ${candidate.companion.name}` : ''}</option>)}</optgroup><optgroup label="Personagens virtuais">{EXTRA_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup></select>
                  {choice.value === 'extra:custom' && <textarea value={choice.customDescription || ''} onChange={(event) => updateCustomDescription(index, event.target.value)} rows={3} placeholder="Descreva aparência e função do personagem extra." className="mt-3 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none focus:border-violet-300/40" />}
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 pt-5"><p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Passo 3 — Ambientação</p><h3 className="mt-2 text-2xl font-black text-white">Direção de cenário e ação</h3><textarea value={directionPrompt} onChange={(event) => { setDirectionPrompt(event.target.value); setDirectionMessage(null); setDirectionError(null) }} rows={5} placeholder="Quarto neon luxuoso, noite chuvosa, câmera suave e iluminação cinematográfica." className="mt-4 w-full resize-y rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-sm leading-relaxed text-white outline-none placeholder:text-zinc-600 focus:border-violet-300/40" /></div>
            {directionError && <p className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">{directionError}</p>}
            {directionMessage && <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-100">{directionMessage}</p>}
          </div>

          <aside className="sticky top-6 h-fit rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Resumo da direção</p>
            <div className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-zinc-500">Modo</span><strong className="text-white">{productionMode.toUpperCase()}</strong></div><div className="flex justify-between gap-3"><span className="text-zinc-500">Cena</span><strong className="max-w-[180px] truncate text-right text-white">{productionMode === 'i2v' ? 'Produção solo' : selectedScene?.title || 'Não selecionada'}</strong></div><div className="flex justify-between gap-3"><span className="text-zinc-500">Elenco</span><strong className="text-white">{castChoices.filter((choice) => choice.value).length}/{expectedSlots}</strong></div></div>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-emerald-100" size={18} /><div><strong className="text-sm text-white">Disparo protegido</strong><p className="mt-1 text-xs leading-relaxed text-zinc-500">O backend valida autorizações, cria o pedido nominal e só chama a fila quando ela estiver habilitada.</p></div></div></div>
            <button type="button" onClick={handleCreateDirection} disabled={!canCreateDirection} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">{createDirectionMutation.isPending ? <><Loader2 className="animate-spin" size={18} /> Enviando…</> : <><Sparkles size={18} /> Gerar Produção</>}</button>
            {!allSlotsFilled && <p className="mt-3 text-center text-xs text-zinc-600">Preencha todas as posições do elenco.</p>}
          </aside>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Pós-produção</p><h3 className="mt-2 text-2xl font-black text-white">Produções recentes</h3></div><span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-black text-zinc-300">{directionsQuery.data?.items?.length || 0}</span></div>
          <div className="mt-5 space-y-3">
            {(directionsQuery.data?.items || []).map((direction) => {
              const presentation = statusPresentation(direction.status)
              return <article key={direction.id} className="grid gap-4 rounded-2xl border border-white/10 bg-black/25 p-4 lg:grid-cols-[1fr_auto] lg:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black ${presentation.className}`}>{presentation.label}</span><span className="text-xs font-bold text-zinc-600">{direction.productionMode.toUpperCase()} • {direction.slotsCount} participante(s)</span></div><h4 className="mt-3 truncate font-black text-white">{direction.castSlots.map((slot) => slot.displayName).join(' + ') || 'Elenco não informado'}</h4><p className="mt-1 line-clamp-2 text-sm text-zinc-500">{direction.prompt}</p>{direction.errorMessage && <p className="mt-2 text-xs font-bold text-rose-100">{direction.errorMessage}</p>}</div><div className="flex items-center gap-2 text-zinc-500">{direction.status === 'processing' || direction.status === 'queued' ? <Clock3 size={18} /> : direction.status === 'failed' ? <AlertTriangle size={18} className="text-rose-100" /> : <CheckCircle2 size={18} className="text-emerald-100" />}<span className="text-xs font-bold">{direction.outputAssetId ? 'Produto enviado à revisão' : 'Acompanhamento ativo'}</span></div></article>
            })}
            {!directionsQuery.isLoading && (directionsQuery.data?.items?.length || 0) === 0 && <div className="rounded-[1.5rem] border border-dashed border-white/10 p-10 text-center"><UsersRound className="mx-auto text-zinc-600" /><p className="mt-3 font-black text-white">Nenhuma direção registrada</p><p className="mt-1 text-sm text-zinc-500">A primeira produção aparecerá aqui após o disparo.</p></div>}
          </div>
        </div>
      )}

      {previewUrl && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Prévia de ${previewTitle}`}>
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Prévia protegida</p><h3 className="mt-1 text-xl font-black text-white">{previewTitle}</h3></div><button type="button" onClick={() => setPreviewUrl(null)} className="rounded-full border border-white/10 p-2 text-zinc-300 hover:text-white"><X size={18} /></button></div><video src={previewUrl} controls playsInline className="mt-5 max-h-[70vh] w-full rounded-2xl bg-black" /><p className="mt-3 text-xs text-zinc-600">O acesso expira automaticamente e não representa uma URL pública.</p></div>
        </div>
      )}
    </section>
  )
}
