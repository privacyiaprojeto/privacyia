import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Check,
  Crop,
  Loader2,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  Sparkles,
  X,
  ZoomIn,
} from 'lucide-react'
import type { CreateKycAssetEditedCopyPayload } from '@/features/adm/api/actorComplianceApi'

interface ActorSafeImageEditorProps {
  sourceUrl: string
  sourceFilename?: string | null
  requirementTitle: string
  isSaving?: boolean
  onCancel: () => void
  onSave: (payload: CreateKycAssetEditedCopyPayload) => Promise<void>
}

type CropAspect = 'original' | 'square' | 'portrait'
type Preset = 'none' | 'light_cleanup'

const PREVIEW_LONG_SIDE = 900
const OUTPUT_LONG_SIDE = 1600

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function canvasDimensions(aspect: CropAspect, naturalWidth: number, naturalHeight: number) {
  if (aspect === 'square') return { width: PREVIEW_LONG_SIDE, height: PREVIEW_LONG_SIDE }
  if (aspect === 'portrait') return { width: 800, height: 1000 }

  const ratio = naturalWidth > 0 && naturalHeight > 0 ? naturalWidth / naturalHeight : 1
  if (ratio >= 1) return { width: PREVIEW_LONG_SIDE, height: Math.max(480, Math.round(PREVIEW_LONG_SIDE / ratio)) }
  return { width: Math.max(480, Math.round(PREVIEW_LONG_SIDE * ratio)), height: PREVIEW_LONG_SIDE }
}

function outputDimensions(width: number, height: number) {
  const ratio = width / height
  if (ratio >= 1) return { width: OUTPUT_LONG_SIDE, height: Math.max(640, Math.round(OUTPUT_LONG_SIDE / ratio)) }
  return { width: Math.max(640, Math.round(OUTPUT_LONG_SIDE * ratio)), height: OUTPUT_LONG_SIDE }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível preparar a cópia ajustada.'))
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '')
    reader.readAsDataURL(blob)
  })
}

export function ActorSafeImageEditor({
  sourceUrl,
  sourceFilename,
  requirementTitle,
  isSaving = false,
  onCancel,
  onSave,
}: ActorSafeImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ pointerId: number; x: number; y: number; startOffsetX: number; startOffsetY: number } | null>(null)

  const [imageReady, setImageReady] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [cropAspect, setCropAspect] = useState<CropAspect>('original')
  const [zoom, setZoom] = useState(1)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [saturation, setSaturation] = useState(100)
  const [grayscale, setGrayscale] = useState(0)
  const [preset, setPreset] = useState<Preset>('none')
  const [note, setNote] = useState('')
  const [preparing, setPreparing] = useState(false)

  const dimensions = useMemo(() => canvasDimensions(
    cropAspect,
    imageRef.current?.naturalWidth || 1,
    imageRef.current?.naturalHeight || 1,
  ), [cropAspect, imageReady])

  useEffect(() => {
    setImageReady(false)
    setEditorError('')
    const image = new Image()
    image.onload = () => {
      imageRef.current = image
      setImageReady(true)
    }
    image.onerror = () => setEditorError('Não foi possível abrir a imagem no editor.')
    image.src = sourceUrl
    return () => {
      image.onload = null
      image.onerror = null
      imageRef.current = null
    }
  }, [sourceUrl])

  const draw = useCallback((target: HTMLCanvasElement, output = false) => {
    const image = imageRef.current
    if (!image) return

    const preview = dimensions
    const targetDimensions = output ? outputDimensions(preview.width, preview.height) : preview
    target.width = targetDimensions.width
    target.height = targetDimensions.height

    const context = target.getContext('2d')
    if (!context) throw new Error('O navegador não disponibilizou o editor gráfico.')

    const scaleFactor = targetDimensions.width / preview.width
    const targetOffsetX = offsetX * scaleFactor
    const targetOffsetY = offsetY * scaleFactor
    const baseScale = Math.max(targetDimensions.width / image.naturalWidth, targetDimensions.height / image.naturalHeight)
    const finalScale = baseScale * zoom

    context.save()
    context.fillStyle = '#09090b'
    context.fillRect(0, 0, target.width, target.height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) grayscale(${grayscale}%)`
    context.translate(target.width / 2 + targetOffsetX, target.height / 2 + targetOffsetY)
    context.rotate((rotation * Math.PI) / 180)
    context.scale(finalScale, finalScale)
    context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)
    context.restore()
  }, [brightness, contrast, dimensions, grayscale, offsetX, offsetY, rotation, saturation, zoom])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !imageReady) return
    try {
      draw(canvas, false)
      setEditorError('')
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Não foi possível atualizar a prévia.')
    }
  }, [draw, imageReady])

  function resetEditor() {
    setCropAspect('original')
    setZoom(1)
    setOffsetX(0)
    setOffsetY(0)
    setRotation(0)
    setBrightness(100)
    setContrast(100)
    setSaturation(100)
    setGrayscale(0)
    setPreset('none')
  }

  function applyLightCleanup() {
    setBrightness(104)
    setContrast(106)
    setSaturation(96)
    setGrayscale(0)
    setPreset('light_cleanup')
  }

  function pointerPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = pointerPosition(event)
    dragRef.current = {
      pointerId: event.pointerId,
      x: point.x,
      y: point.y,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const point = pointerPosition(event)
    setOffsetX(clamp(drag.startOffsetX + point.x - drag.x, -PREVIEW_LONG_SIDE, PREVIEW_LONG_SIDE))
    setOffsetY(clamp(drag.startOffsetY + point.y - drag.y, -PREVIEW_LONG_SIDE, PREVIEW_LONG_SIDE))
  }

  function finishPointer(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  async function saveCopy() {
    if (!imageReady || isSaving || preparing) return
    setPreparing(true)
    setEditorError('')
    try {
      const output = document.createElement('canvas')
      draw(output, true)
      const blob = await new Promise<Blob>((resolve, reject) => {
        output.toBlob((result) => result ? resolve(result) : reject(new Error('Não foi possível gerar a cópia ajustada.')), 'image/jpeg', 0.92)
      })
      const base64 = await blobToBase64(blob)
      const cleanName = String(sourceFilename || 'material.jpg').replace(/\.[^.]+$/, '').slice(0, 120)
      await onSave({
        base64,
        contentType: 'image/jpeg',
        byteSize: blob.size,
        originalFilename: `${cleanName}-copia-ajustada.jpg`,
        note: note.trim() || undefined,
        transform: {
          cropAspect,
          zoom,
          offsetX: Math.round(offsetX),
          offsetY: Math.round(offsetY),
          rotation,
          brightness,
          contrast,
          saturation,
          grayscale,
          outputWidth: output.width,
          outputHeight: output.height,
          preset,
        },
      })
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Não foi possível salvar a cópia ajustada.')
    } finally {
      setPreparing(false)
    }
  }

  const busy = preparing || isSaving

  return (
    <div className="fixed inset-0 z-[120] overflow-y-auto bg-black/90 p-3 backdrop-blur-md" role="dialog" aria-modal="true" aria-label="Editor seguro de imagem">
      <div className="mx-auto my-3 w-full max-w-7xl rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/70">
        <header className="flex flex-col gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Editor seguro de imagem</p>
            <h4 className="mt-1 text-2xl font-black text-white">Ajustar uma cópia para nova análise</h4>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">
              {requirementTitle}. O original continuará intacto. Esta ferramenta faz apenas ajustes locais e determinísticos; não recria rosto, corpo ou identidade por IA.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:text-white disabled:opacity-50" aria-label="Fechar editor"><X size={20} /></button>
        </header>

        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            <div className="flex min-h-[420px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/45 p-3">
              {!imageReady && !editorError ? (
                <div className="inline-flex items-center gap-2 text-sm font-bold text-zinc-400"><Loader2 size={20} className="animate-spin" /> Preparando editor...</div>
              ) : (
                <canvas
                  ref={canvasRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={finishPointer}
                  onPointerCancel={finishPointer}
                  className="max-h-[68vh] max-w-full touch-none cursor-grab rounded-xl bg-black shadow-xl active:cursor-grabbing"
                  aria-label="Prévia ajustável da imagem"
                />
              )}
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-zinc-500">Arraste a imagem para ajustar o enquadramento. Use o zoom e a rotação para refinar a cópia.</p>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-white"><Crop size={17} /> Enquadramento</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([
                  ['original', 'Original'],
                  ['square', '1:1'],
                  ['portrait', '4:5'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" onClick={() => { setCropAspect(value); setOffsetX(0); setOffsetY(0) }} className={`rounded-xl border px-2 py-2 text-xs font-black transition ${cropAspect === value ? 'border-amber-300/50 bg-amber-300/15 text-amber-100' : 'border-white/10 bg-black/25 text-zinc-400 hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <label className="mt-4 block text-xs font-black text-zinc-300">
                <span className="flex items-center justify-between"><span className="inline-flex items-center gap-1"><ZoomIn size={14} /> Zoom</span><span>{zoom.toFixed(2)}×</span></span>
                <input type="range" min="1" max="4" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="mt-2 w-full" />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRotation((value) => clamp(value - 90, -180, 180))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-300"><RotateCcw size={15} /> -90°</button>
                <button type="button" onClick={() => setRotation((value) => clamp(value + 90, -180, 180))} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs font-black text-zinc-300"><RotateCw size={15} /> +90°</button>
              </div>
              <label className="mt-3 block text-xs font-black text-zinc-300">
                <span className="flex justify-between"><span>Rotação fina</span><span>{rotation}°</span></span>
                <input type="range" min="-180" max="180" step="1" value={rotation} onChange={(event) => setRotation(Number(event.target.value))} className="mt-2 w-full" />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-black text-white"><SlidersHorizontal size={17} /> Ajustes leves</div>
                <button type="button" onClick={applyLightCleanup} className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-black ${preset === 'light_cleanup' ? 'border-sky-300/40 bg-sky-300/15 text-sky-100' : 'border-white/10 text-zinc-400'}`}><Sparkles size={13} /> Limpeza leve</button>
              </div>
              {([
                ['Brilho', brightness, setBrightness, 50, 150],
                ['Contraste', contrast, setContrast, 50, 150],
                ['Saturação', saturation, setSaturation, 0, 200],
                ['Preto e branco', grayscale, setGrayscale, 0, 100],
              ] as const).map(([label, value, setter, min, max]) => (
                <label key={label} className="mt-3 block text-xs font-black text-zinc-300">
                  <span className="flex justify-between"><span>{label}</span><span>{value}%</span></span>
                  <input type="range" min={min} max={max} step="1" value={value} onChange={(event) => { setter(Number(event.target.value)); setPreset('none') }} className="mt-1 w-full" />
                </label>
              ))}
              <button type="button" onClick={resetEditor} className="mt-4 w-full rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-400 transition hover:text-white">Restaurar ajustes</button>
            </div>

            <label className="block rounded-2xl border border-white/10 bg-white/[0.035] p-4 text-xs font-black text-zinc-300">
              Observação interna opcional
              <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={1500} placeholder="Ex.: reenquadramento para manter o rosto centralizado." className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-semibold text-white outline-none focus:border-amber-300/40" />
            </label>

            {editorError && <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">{editorError}</div>}

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-xs leading-relaxed text-emerald-100/80">
              A nova cópia será privada, ficará como <strong>aguardando análise</strong> e não será aprovada automaticamente. O original não será sobrescrito nem apagado.
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={onCancel} disabled={busy} className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-300 disabled:opacity-50">Cancelar</button>
              <button type="button" onClick={() => void saveCopy()} disabled={!imageReady || busy || Boolean(editorError)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
                {busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />} Criar cópia
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
