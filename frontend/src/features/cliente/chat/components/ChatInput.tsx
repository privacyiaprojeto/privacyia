import { useEffect, useRef } from 'react'
import { Send, Mic, Trash2, Brain, Zap } from 'lucide-react'
import clsx from 'clsx'
import { RelHumorPanel } from '@/features/cliente/chat/components/RelHumorPanel'
import { ImagemPanel } from '@/features/cliente/chat/components/ImagemPanel'
import { useChatInput, modos, formatarTempo } from '@/features/cliente/chat/hooks/useChatInput'

function AudioVisualizer({ analyser }: { analyser: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const canvasSafe = canvas
    const ctx = canvasSafe.getContext('2d')
    if (!ctx) return
    const ctxSafe = ctx
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)
      const width = canvasSafe.width
      const height = canvasSafe.height
      ctxSafe.clearRect(0, 0, width, height)
      const barCount = 48
      const barWidth = 3
      const gap = 2
      const totalWidth = barCount * (barWidth + gap) - gap
      const startX = (width - totalWidth) / 2

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * bufferLength * 0.6)
        const value = dataArray[index] / 255
        const barHeight = Math.max(3, value * height * 0.85)
        const x = startX + i * (barWidth + gap)
        const y = (height - barHeight) / 2
        const alpha = 0.4 + value * 0.6

        ctxSafe.fillStyle = `rgba(139, 92, 246, ${alpha})`
        ctxSafe.beginPath()
        ctxSafe.roundRect(x, y, barWidth, barHeight, 2)
        ctxSafe.fill()
      }
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return <canvas ref={canvasRef} width={220} height={36} className="h-9 w-full max-w-[220px]" />
}

interface Props {
  onEnviar: (conteudo: string) => void
  disabled?: boolean
  relationshipType?: string | null
  currentMood?: string | null
  onRelationshipTypeChange?: (value: string) => void
  onCurrentMoodChange?: (value: string) => void
  onSalvarPersona?: () => void
  savingPersona?: boolean
}

export function ChatInput({
  onEnviar,
  disabled,
  relationshipType = null,
  currentMood = null,
  onRelationshipTypeChange,
  onCurrentMoodChange,
  onSalvarPersona,
  savingPersona = false,
}: Props) {
  const {
    texto,
    setTexto,
    modo,
    setModo,
    modoAberto,
    setModoAberto,
    sugerindo,
    relHumorAberto,
    setRelHumorAberto,
    imagemAberto,
    pose,
    setPose,
    gravando,
    tempoGravacao,
    analyserNode,
    popoverRef,
    modoAtual,
    acoes,
    handleSubmit,
    handleKeyDown,
    iniciarGravacao,
    pararEEnviar,
    cancelarGravacao,
  } = useChatInput({
    onEnviar,
    disabled,
    hasPersona: Boolean(relationshipType || currentMood),
  })

  if (gravando) {
    return (
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>
          <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-zinc-100">
            {formatarTempo(tempoGravacao)}
          </span>
          <div className="flex-1">
            {analyserNode && <AudioVisualizer analyser={analyserNode} />}
          </div>
          <button
            onClick={cancelarGravacao}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>
          <button
            onClick={pararEEnviar}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="shrink-0 flex flex-col border-t border-zinc-800 bg-zinc-900">
      {imagemAberto && (
        <ImagemPanel poseSelecionada={pose} onPose={setPose} onSetTexto={setTexto} />
      )}

      {relHumorAberto && (
        <RelHumorPanel
          onFechar={() => setRelHumorAberto(false)}
          relationshipType={relationshipType}
          currentMood={currentMood}
          onRelationshipTypeChange={(value) => onRelationshipTypeChange?.(value)}
          onCurrentMoodChange={(value) => onCurrentMoodChange?.(value)}
          onSalvar={onSalvarPersona}
          saving={savingPersona}
        />
      )}

      <div className="px-4 pt-3 pb-4">
        <textarea
          value={texto}
          onChange={(e) => { if (!sugerindo) setTexto(e.target.value) }}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Digite uma mensagem..."
          rows={1}
          className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none disabled:opacity-50"
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {acoes.map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                type="button"
                onClick={onClick}
                className={clsx(
                  'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                  (label === 'Sugerir' && sugerindo) ||
                  (label === 'Imagem' && (imagemAberto || pose)) ||
                  (label === 'Relacionamento e Humor' && (relHumorAberto || relationshipType || currentMood))
                    ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                    : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400',
                )}
              >
                <Icon size={12} className={label === 'Sugerir' && sugerindo ? 'animate-pulse' : ''} />
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex items-center gap-2" ref={popoverRef}>
            <button
              type="button"
              onClick={() => setModoAberto((prev) => !prev)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
                modoAberto
                  ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400',
              )}
            >
              {modo === 'avancado' ? <Brain size={12} /> : <Zap size={12} />}
              {modoAtual.label}
            </button>

            {modoAberto && (
              <div className="absolute bottom-full right-0 mb-2 w-72 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
                {modos.map((opcao) => (
                  <button
                    key={opcao.id}
                    type="button"
                    onClick={() => { setModo(opcao.id); setModoAberto(false) }}
                    className={clsx(
                      'w-full px-4 py-3.5 text-left transition',
                      opcao.id === modo ? 'border-l-2 border-violet-500 bg-violet-600/10' : 'hover:bg-zinc-800/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {opcao.id === 'avancado'
                        ? <Brain size={13} className={opcao.id === modo ? 'text-violet-400' : 'text-zinc-500'} />
                        : <Zap size={13} className={opcao.id === modo ? 'text-violet-400' : 'text-zinc-500'} />
                      }
                      <span className={clsx('text-sm font-semibold', opcao.id === modo ? 'text-violet-400' : 'text-zinc-100')}>
                        {opcao.label}
                      </span>
                      {opcao.badge && (
                        <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white">
                          {opcao.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 pl-5 text-xs leading-relaxed text-zinc-500">{opcao.descricao}</p>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={iniciarGravacao}
              disabled={disabled}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-400 transition hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400 disabled:opacity-40"
            >
              <Mic size={14} />
            </button>

            <button
              onClick={handleSubmit}
              disabled={disabled || !texto.trim()}
              className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition',
                texto.trim() ? 'bg-violet-600 text-white hover:bg-violet-500' : 'bg-zinc-800 text-zinc-600',
              )}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
