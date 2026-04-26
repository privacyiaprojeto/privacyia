import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import { Loader2, Play } from 'lucide-react'
import { generateMessageAudio } from '@/features/cliente/chat/api/generateMessageAudio'
import type { Mensagem } from '@/features/cliente/chat/types'

interface Props {
  mensagem: Mensagem
}

export function MessageBubble({ mensagem }: Props) {
  const isCliente = mensagem.de === 'cliente'
  const [audioUrl, setAudioUrl] = useState<string | null>(mensagem.audioUrl ?? null)
  const [audioLoading, setAudioLoading] = useState(false)
  const audioRequestInFlightRef = useRef(false)

  useEffect(() => {
    if (mensagem.audioUrl) {
      setAudioUrl(mensagem.audioUrl)
    }
  }, [mensagem.audioUrl])

  async function playAudioFromUrl(url: string) {
    await new Audio(url).play()
  }

  async function handlePlayAudio() {
    // Protecao de custo: enquanto uma geracao esta em andamento, nao abrimos outro job RunPod para a mesma mensagem.
    if (isCliente || audioRequestInFlightRef.current) return

    // Cache local/Supabase: se ja existe audioUrl, toca direto pelo HTML5 sem chamar RunPod novamente.
    if (audioUrl) {
      try {
        await playAudioFromUrl(audioUrl)
      } catch (error) {
        console.error('Falha ao tocar áudio da mensagem:', error)
      }
      return
    }

    audioRequestInFlightRef.current = true
    setAudioLoading(true)

    try {
      const response = await generateMessageAudio(mensagem.conversaId, mensagem.id)
      setAudioUrl(response.audioUrl)
      await playAudioFromUrl(response.audioUrl)
    } catch (error) {
      console.error('Falha ao gerar/tocar áudio da mensagem:', error)
    } finally {
      audioRequestInFlightRef.current = false
      setAudioLoading(false)
    }
  }

  return (
    <div className={clsx('flex w-full', isCliente ? 'justify-end' : 'justify-start')}>
      <div
        className={clsx(
          'max-w-[78%] rounded-2xl px-4 py-2.5 text-sm',
          isCliente
            ? 'rounded-br-sm bg-violet-600 text-white'
            : 'rounded-bl-sm bg-zinc-800 text-zinc-100'
        )}
      >
        <p className="leading-relaxed">{mensagem.conteudo}</p>

        {isCliente ? (
          <span
            className={clsx(
              'mt-1 block text-right text-[10px]',
              isCliente ? 'text-violet-300' : 'text-zinc-500'
            )}
          >
            {mensagem.criadaEm}
          </span>
        ) : (
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-zinc-500">
            <button
              type="button"
              onClick={handlePlayAudio}
              disabled={audioLoading}
              aria-label="Tocar áudio da mensagem"
              title="Tocar áudio"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-500 transition hover:text-zinc-300 disabled:cursor-wait disabled:opacity-60"
            >
              {audioLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
            </button>

            <span>{mensagem.criadaEm}</span>
          </div>
        )}
      </div>
    </div>
  )
}
