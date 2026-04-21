import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Image, Sparkles, Heart, Zap, Brain, Mic, Trash2, type LucideIcon } from 'lucide-react'
import clsx from 'clsx'
import type { KeyboardEvent } from 'react'
import { RelHumorPanel } from '@/features/cliente/chat/components/RelHumorPanel'
import { ImagemPanel } from '@/features/cliente/chat/components/ImagemPanel'

type Modo = 'equilibrado' | 'avancado'

interface OpcaoModo {
  id: Modo
  label: string
  descricao: string
  badge?: string
}

const modos: OpcaoModo[] = [
  {
    id: 'equilibrado',
    label: 'Equilibrado',
    descricao: 'Perfeito para chats rápidos, flertes e roleplay casual',
  },
  {
    id: 'avancado',
    label: 'Avançado',
    descricao: '16x mais memória, mais personalidade, conexão mais significativa',
    badge: 'Novo',
  },
]

const sugestoes = [
  'Oi! Você costuma fazer lives? Adoraria te ver ao vivo.',
  'Qual foi o conteúdo que você mais curtiu criar até hoje?',
  'Você tem algum hobby fora daqui que poucos conhecem?',
  'Se a gente pudesse passar um dia juntos, o que faria?',
  'O que te inspirou a começar tudo isso? Tenho curiosidade.',
  'Você prefere praia ou montanha? Te imagino num lugar incrível.',
  'Tem alguma fantasia que você ainda não realizou mas quer muito?',
  'O que você acha que te diferencia das outras? Perguntando mesmo.',
  'Faz tempo que eu queria te chamar... como você está?',
  'Se eu te mandasse uma surpresa, o que você gostaria de receber?',
]

interface Acao {
  icon: LucideIcon
  label: string
  onClick?: () => void
}

function buildAcoes(onImagem: () => void, onSugerir: () => void, onRelHumor: () => void): Acao[] {
  return [
    { icon: Image,    label: 'Imagem',               onClick: onImagem    },
    { icon: Sparkles, label: 'Sugerir',               onClick: onSugerir  },
    { icon: Heart,    label: 'Relacionamento e Humor', onClick: onRelHumor },
  ]
}

function formatarTempo(segundos: number) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ── Visualizador de frequência ──────────────────────────────────
function AudioVisualizer({ analyser }: { analyser: AnalyserNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    function draw() {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteFrequencyData(dataArray)

      const { width, height } = canvas!
      ctx!.clearRect(0, 0, width, height)

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

        // Gradiente por barra
        const alpha = 0.4 + value * 0.6
        ctx!.fillStyle = `rgba(139, 92, 246, ${alpha})`
        ctx!.beginPath()
        ctx!.roundRect(x, y, barWidth, barHeight, 2)
        ctx!.fill()
      }
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser])

  return (
    <canvas
      ref={canvasRef}
      width={220}
      height={36}
      className="h-9 w-full max-w-[220px]"
    />
  )
}

// ────────────────────────────────────────────────────────────────

interface Props {
  onEnviar: (conteudo: string) => void
  disabled?: boolean
}

export function ChatInput({ onEnviar, disabled }: Props) {
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState<Modo>('equilibrado')
  const [modoAberto, setModoAberto] = useState(false)

  const [sugerindo, setSugerindo] = useState(false)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [relHumorAberto, setRelHumorAberto] = useState(false)
  const [relacionamento, setRelacionamento] = useState<string | null>(null)
  const [humor, setHumor] = useState<string | null>(null)

  const [imagemAberto, setImagemAberto] = useState(false)
  const [pose, setPose] = useState<string | null>(null)

  const [gravando, setGravando] = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setModoAberto(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (typewriterRef.current) clearInterval(typewriterRef.current)
    }
  }, [])

  function sugerirMensagem() {
    if (typewriterRef.current) clearInterval(typewriterRef.current)

    const frase = sugestoes[Math.floor(Math.random() * sugestoes.length)]
    setTexto('')
    setSugerindo(true)

    let i = 0
    typewriterRef.current = setInterval(() => {
      i++
      setTexto(frase.slice(0, i))
      if (i >= frase.length) {
        clearInterval(typewriterRef.current!)
        setSugerindo(false)
      }
    }, 30)
  }

  function handleSubmit() {
    const conteudo = texto.trim()
    if (!conteudo) return
    onEnviar(conteudo)
    setTexto('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const iniciarGravacao = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Web Audio API para visualização
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      setAnalyserNode(analyser)

      // MediaRecorder para captura
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      let tempoFinal = 0
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        audioCtx.close()
        setAnalyserNode(null)
        onEnviar(`🎤 Áudio (${formatarTempo(tempoFinal)})`)
        setTempoGravacao(0)
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setGravando(true)
      setTempoGravacao(0)

      timerRef.current = setInterval(() => {
        setTempoGravacao((t) => {
          tempoFinal = t + 1
          return t + 1
        })
      }, 1000)
    } catch {
      // permissão negada ou sem microfone
    }
  }, [onEnviar])

  function pararEEnviar() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setGravando(false)
  }

  function cancelarGravacao() {
    if (timerRef.current) clearInterval(timerRef.current)
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop())
      mediaRecorderRef.current.stop()
    }
    audioCtxRef.current?.close()
    setAnalyserNode(null)
    setGravando(false)
    setTempoGravacao(0)
  }

  const modoAtual = modos.find((m) => m.id === modo)!
  const acoes = buildAcoes(
    () => { setImagemAberto((p) => !p); setRelHumorAberto(false) },
    sugerirMensagem,
    () => { setRelHumorAberto((p) => !p); setImagemAberto(false) },
  )

  /* ── Modo gravação ─────────────────────────── */
  if (gravando) {
    return (
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 px-4 py-3">
        <div className="flex items-center gap-3">

          {/* Ponto pulsando */}
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
          </span>

          {/* Timer */}
          <span className="w-10 shrink-0 text-sm font-semibold tabular-nums text-zinc-100">
            {formatarTempo(tempoGravacao)}
          </span>

          {/* Visualizador de frequência */}
          <div className="flex-1">
            {analyserNode && <AudioVisualizer analyser={analyserNode} />}
          </div>

          {/* Cancelar */}
          <button
            onClick={cancelarGravacao}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 size={15} />
          </button>

          {/* Enviar */}
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

  /* ── Modo normal ───────────────────────────── */
  return (
    <div className="shrink-0 flex flex-col border-t border-zinc-800 bg-zinc-900">

      {/* Painel Imagem */}
      {imagemAberto && (
        <ImagemPanel
          poseSelecionada={pose}
          onPose={setPose}
          onSetTexto={setTexto}
        />
      )}

      {/* Painel Relacionamento e Humor */}
      {relHumorAberto && (
        <RelHumorPanel
          onFechar={() => setRelHumorAberto(false)}
          relacionamento={relacionamento}
          humor={humor}
          onRelacionamento={setRelacionamento}
          onHumor={setHumor}
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
        {/* Ações rápidas */}
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
                (label === 'Relacionamento e Humor' && (relHumorAberto || relacionamento || humor))
                  ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                  : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400'
              )}
            >
              <Icon size={12} className={label === 'Sugerir' && sugerindo ? 'animate-pulse' : ''} />
              {label}
            </button>
          ))}
        </div>

        {/* Direita */}
        <div className="relative flex items-center gap-2" ref={popoverRef}>
          {/* Seletor de modo */}
          <button
            type="button"
            onClick={() => setModoAberto((prev) => !prev)}
            className={clsx(
              'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition',
              modoAberto
                ? 'border-violet-500 bg-violet-600/15 text-violet-400'
                : 'border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400'
            )}
          >
            {modo === 'avancado' ? <Brain size={12} /> : <Zap size={12} />}
            {modoAtual.label}
          </button>

          {/* Popover */}
          {modoAberto && (
            <div className="absolute bottom-full right-0 mb-2 w-72 overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
              {modos.map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => { setModo(opcao.id); setModoAberto(false) }}
                  className={clsx(
                    'w-full px-4 py-3.5 text-left transition',
                    opcao.id === modo
                      ? 'border-l-2 border-violet-500 bg-violet-600/10'
                      : 'hover:bg-zinc-800/60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {opcao.id === 'avancado'
                      ? <Brain size={13} className={opcao.id === modo ? 'text-violet-400' : 'text-zinc-500'} />
                      : <Zap   size={13} className={opcao.id === modo ? 'text-violet-400' : 'text-zinc-500'} />
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
                  <p className="mt-1 pl-5 text-xs leading-relaxed text-zinc-500">
                    {opcao.descricao}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Microfone */}
          <button
            type="button"
            onClick={iniciarGravacao}
            disabled={disabled}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800/60 text-zinc-400 transition hover:border-violet-600/50 hover:bg-violet-600/10 hover:text-violet-400 disabled:opacity-40"
          >
            <Mic size={14} />
          </button>

          {/* Enviar texto */}
          <button
            onClick={handleSubmit}
            disabled={disabled || !texto.trim()}
            className={clsx(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition',
              texto.trim()
                ? 'bg-violet-600 text-white hover:bg-violet-500'
                : 'bg-zinc-800 text-zinc-600'
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
