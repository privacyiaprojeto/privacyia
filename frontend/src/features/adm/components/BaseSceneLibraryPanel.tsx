import { useMemo, useState } from 'react'
import { CheckCircle2, Eye, Film, Loader2, Power, PowerOff, Upload, X } from 'lucide-react'
import {
  useBaseScenePreview,
  useBaseScenes,
  useCreateBaseScene,
  useUpdateBaseScene,
} from '@/features/adm/hooks/useSceneDirection'
import type { BaseSceneType } from '@/features/adm/api/sceneDirectionApi'
import { parseApiError } from '@/shared/utils/parseApiError'

const SCENE_TYPE_OPTIONS: Array<{ value: BaseSceneType; label: string; slots: number }> = [
  { value: 'scene_solo_f', label: 'Solo feminino', slots: 1 },
  { value: 'scene_solo_m', label: 'Solo masculino', slots: 1 },
  { value: 'scene_duo_mf', label: 'Dupla masculino/feminino', slots: 2 },
  { value: 'scene_duo_ff', label: 'Dupla feminina', slots: 2 },
  { value: 'scene_duo_mm', label: 'Dupla masculina', slots: 2 },
  { value: 'scene_trio', label: 'Trio', slots: 3 },
]

function sceneTypeLabel(value?: BaseSceneType | null) {
  return SCENE_TYPE_OPTIONS.find((item) => item.value === value)?.label || 'Legado sem classificação'
}

function bytesLabel(value?: number | null) {
  if (!value) return 'Tamanho não informado'
  if (value < 1024 * 1024) return `${Math.max(Math.round(value / 1024), 1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function BaseSceneLibraryPanel() {
  const scenesQuery = useBaseScenes(true)
  const createMutation = useCreateBaseScene()
  const updateMutation = useUpdateBaseScene()
  const previewMutation = useBaseScenePreview()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sceneType, setSceneType] = useState<BaseSceneType>('scene_duo_mf')
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null)

  const scenes = scenesQuery.data?.items || []
  const activeCount = useMemo(() => scenes.filter((item) => item.isActive).length, [scenes])
  const selectedType = SCENE_TYPE_OPTIONS.find((item) => item.value === sceneType) || SCENE_TYPE_OPTIONS[2]
  const isMp4 = Boolean(file && (file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4')))
  const pending = createMutation.isPending || updateMutation.isPending || previewMutation.isPending
  const activeError = scenesQuery.error || createMutation.error || updateMutation.error || previewMutation.error

  async function handleUpload() {
    if (!file || !isMp4 || title.trim().length < 2) {
      setLocalError('Informe um título e selecione um arquivo MP4 válido.')
      return
    }

    setLocalError(null)
    setMessage(null)

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        slotsCount: selectedType.slots,
        sceneType,
        file,
      })
      setTitle('')
      setDescription('')
      setSceneType('scene_duo_mf')
      setFile(null)
      setMessage(result.message || 'Cena adicionada à biblioteca.')
    } catch (error) {
      setLocalError(parseApiError(error) || 'Não foi possível enviar a cena.')
    }
  }

  async function handlePreview(sceneId: string, sceneTitle: string) {
    setLocalError(null)
    try {
      const result = await previewMutation.mutateAsync(sceneId)
      setPreview({ title: sceneTitle, url: result.preview.url })
    } catch (error) {
      setLocalError(parseApiError(error) || 'Não foi possível abrir a prévia protegida.')
    }
  }

  async function handleToggle(sceneId: string, isActive: boolean) {
    if (isActive && !window.confirm('Inativar esta cena base sem apagar o histórico?')) return
    await updateMutation.mutateAsync({ sceneId, payload: { isActive: !isActive } })
  }

  return (
    <section className="space-y-6" data-admin-base-scene-library="true">
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-200/80">Biblioteca privada V2V</p>
            <h2 className="mt-2 text-3xl font-black text-white">Vídeos Base</h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Cadastre cenas MP4 reutilizáveis e classifique a composição antes de qualquer produção operacional.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
            <strong className="text-white">{activeCount}</strong> cena{activeCount === 1 ? '' : 's'} ativa{activeCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {(localError || activeError) && (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-100">
          {localError || parseApiError(activeError)}
        </div>
      )}

      {message && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100">
          <CheckCircle2 size={17} /> {message}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.35fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-6">
          <h3 className="text-xl font-black text-white">Adicionar cena base</h3>
          <p className="mt-1 text-sm text-zinc-500">O arquivo permanece no armazenamento privado e recebe classificação técnica.</p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-semibold text-zinc-300">
              Título
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Cena de praia — dupla" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-sky-300/50" />
            </label>

            <label className="block text-sm font-semibold text-zinc-300">
              Descrição
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Contexto técnico da cena e observações de uso." className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-sky-300/50" />
            </label>

            <label className="block text-sm font-semibold text-zinc-300">
              Classificação de Cena
              <select value={sceneType} onChange={(event) => setSceneType(event.target.value as BaseSceneType)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-sky-300/50">
                {SCENE_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value} — {option.label}</option>)}
              </select>
            </label>

            <label className="block text-sm font-semibold text-zinc-300">
              Arquivo MP4
              <input type="file" accept="video/mp4,.mp4" onChange={(event) => setFile(event.target.files?.[0] || null)} className="mt-2 block w-full rounded-2xl border border-dashed border-white/15 bg-black/35 px-4 py-4 text-sm text-zinc-300 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-black file:text-zinc-950" />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-relaxed text-zinc-500">
              {file ? `${file.name} · ${bytesLabel(file.size)}` : 'Selecione um vídeo MP4 de até 750 MB.'}
            </div>

            <button type="button" onClick={handleUpload} disabled={pending || !file || !isMp4 || title.trim().length < 2} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
              {createMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
              Enviar para biblioteca
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {scenesQuery.isLoading && <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-sm text-zinc-500">Carregando biblioteca…</div>}
          {!scenesQuery.isLoading && scenes.length === 0 && <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-8 text-center text-sm text-zinc-500">Nenhuma cena base cadastrada.</div>}
          {scenes.map((scene) => (
            <article key={scene.id} className={`rounded-[2rem] border p-5 ${scene.isActive ? 'border-white/10 bg-white/[0.045]' : 'border-zinc-800 bg-black/20 opacity-65'}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sky-300/20 bg-sky-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-sky-100">{scene.sceneType || 'legacy_unclassified'}</span>
                    <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-zinc-400">{scene.slotsCount} participante{scene.slotsCount === 1 ? '' : 's'}</span>
                  </div>
                  <h3 className="mt-3 text-lg font-black text-white">{scene.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">{sceneTypeLabel(scene.sceneType)} · {bytesLabel(scene.byteSize)} · {scene.uploadStatus === 'ready' ? 'Arquivo confirmado' : 'Processando upload'}</p>
                  {scene.description && <p className="mt-3 text-sm leading-relaxed text-zinc-400">{scene.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button type="button" onClick={() => handlePreview(scene.id, scene.title)} disabled={scene.uploadStatus !== 'ready' || previewMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25 disabled:opacity-40"><Eye size={15} /> Prévia</button>
                  <button type="button" onClick={() => handleToggle(scene.id, scene.isActive)} disabled={updateMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-200 hover:border-white/25 disabled:opacity-40">{scene.isActive ? <PowerOff size={15} /> : <Power size={15} />}{scene.isActive ? 'Inativar' : 'Reativar'}</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Film size={18} className="text-sky-200" /><h3 className="font-black text-white">{preview.title}</h3></div>
              <button type="button" onClick={() => setPreview(null)} className="rounded-xl border border-white/10 p-2 text-zinc-400 hover:text-white" aria-label="Fechar prévia"><X size={18} /></button>
            </div>
            <video src={preview.url} controls playsInline className="mt-4 max-h-[72vh] w-full rounded-2xl bg-black" />
          </div>
        </div>
      )}
    </section>
  )
}
