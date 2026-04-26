import { useState, useRef, useEffect, useCallback } from 'react'
import type { KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Image, Sparkles, Heart } from 'lucide-react'

type Modo = 'equilibrado' | 'avancado'

export interface OpcaoModo {
  id: Modo
  label: string
  descricao: string
  badge?: string
}

export interface Acao {
  icon: LucideIcon
  label: string
  onClick?: () => void
}

export const modos: OpcaoModo[] = [
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

export function formatarTempo(segundos: number) {
  const m = Math.floor(segundos / 60).toString().padStart(2, '0')
  const s = (segundos % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

interface UseChatInputProps {
  onEnviar: (conteudo: string) => void
  disabled?: boolean
  hasPersona?: boolean
}

export function useChatInput({ onEnviar, hasPersona = false }: UseChatInputProps) {
  const [texto, setTexto] = useState('')
  const [modo, setModo] = useState<Modo>('equilibrado')
  const [modoAberto, setModoAberto] = useState(false)
  const [sugerindo, setSugerindo] = useState(false)
  const [relHumorAberto, setRelHumorAberto] = useState(false)
  const [imagemAberto, setImagemAberto] = useState(false)
  const [pose, setPose] = useState<string | null>(null)
  const [gravando, setGravando] = useState(false)
  const [tempoGravacao, setTempoGravacao] = useState(0)
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null)

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
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
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      audioCtxRef.current = audioCtx
      setAnalyserNode(analyser)

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
  const acoes: Acao[] = [
    { icon: Image, label: 'Imagem', onClick: () => { setImagemAberto((p) => !p); setRelHumorAberto(false) } },
    { icon: Sparkles, label: 'Sugerir', onClick: sugerirMensagem },
    { icon: Heart, label: 'Relacionamento e Humor', onClick: () => { setRelHumorAberto((p) => !p); setImagemAberto(false) } },
  ]

  return {
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
    hasPersona,
    handleSubmit,
    handleKeyDown,
    iniciarGravacao,
    pararEEnviar,
    cancelarGravacao,
  }
}
