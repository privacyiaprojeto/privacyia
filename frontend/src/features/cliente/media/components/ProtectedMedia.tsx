import Hls from 'hls.js'
import { AlertCircle, Clock3, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  isProtectedPlaybackSource,
  requestProtectedPlaybackAccess,
  type MediaAvailabilityStatus,
  type MediaStreamKind,
} from '@/features/cliente/media/api/protectedPlaybackApi'

interface ProtectedMediaProps {
  sourceUrl?: string | null
  mediaType: 'image' | 'video' | 'audio'
  mediaStatus?: MediaAvailabilityStatus | null
  streamKind?: MediaStreamKind
  alt?: string
  className?: string
  containerClassName?: string
  controls?: boolean
  autoPlay?: boolean
  muted?: boolean
  loop?: boolean
  playsInline?: boolean
  poster?: string
  preload?: 'none' | 'metadata' | 'auto'
  stateMessage?: string | null
  onReady?: () => void
  onError?: (message: string) => void
}

interface RuntimeMediaState {
  status: 'loading' | MediaAvailabilityStatus | 'error'
  playbackUrl: string | null
  streamKind: MediaStreamKind
  message: string | null
}

function MediaStatePanel({ status, message }: { status: RuntimeMediaState['status']; message?: string | null }) {
  const processing = status === 'processing' || status === 'loading'
  const text = message || (processing ? 'Em preparação' : 'Mídia indisponível')

  return (
    <div className="flex h-full min-h-[160px] w-full items-center justify-center bg-zinc-950/90 px-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-300">
          {status === 'loading' ? <Loader2 size={19} className="animate-spin" /> : processing ? <Clock3 size={19} /> : <AlertCircle size={19} />}
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100">{processing ? 'Em preparação' : 'Indisponível'}</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{text}</p>
        </div>
      </div>
    </div>
  )
}

function inferDirectStreamKind(sourceUrl: string, mediaType: ProtectedMediaProps['mediaType']): MediaStreamKind {
  if (sourceUrl.toLowerCase().includes('.m3u8')) return 'hls'
  if (mediaType === 'audio') return 'audio'
  if (mediaType === 'image') return 'image'
  return 'progressive'
}

export function ProtectedMedia({
  sourceUrl,
  mediaType,
  mediaStatus,
  streamKind,
  alt = 'Mídia protegida',
  className = 'h-full w-full object-contain',
  containerClassName = 'h-full w-full overflow-hidden bg-black',
  controls = true,
  autoPlay = false,
  muted = false,
  loop = false,
  playsInline = true,
  poster,
  preload = 'metadata',
  stateMessage,
  onReady,
  onError,
}: ProtectedMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [runtime, setRuntime] = useState<RuntimeMediaState>(() => {
    if (mediaStatus === 'processing') return { status: 'processing', playbackUrl: null, streamKind: null, message: stateMessage || null }
    if (mediaStatus === 'unavailable' || !sourceUrl) return { status: 'unavailable', playbackUrl: null, streamKind: null, message: stateMessage || null }
    return { status: isProtectedPlaybackSource(sourceUrl) ? 'loading' : 'ready', playbackUrl: isProtectedPlaybackSource(sourceUrl) ? null : sourceUrl, streamKind: streamKind || inferDirectStreamKind(sourceUrl, mediaType), message: stateMessage || null }
  })

  const stableSource = useMemo(() => sourceUrl || null, [sourceUrl])

  useEffect(() => {
    let cancelled = false

    if (mediaStatus === 'processing') {
      setRuntime({ status: 'processing', playbackUrl: null, streamKind: null, message: stateMessage || 'Mídia em preparação.' })
      return () => { cancelled = true }
    }

    if (mediaStatus === 'unavailable' || !stableSource) {
      setRuntime({ status: 'unavailable', playbackUrl: null, streamKind: null, message: stateMessage || 'Mídia indisponível.' })
      return () => { cancelled = true }
    }

    if (!isProtectedPlaybackSource(stableSource)) {
      setRuntime({ status: 'ready', playbackUrl: stableSource, streamKind: streamKind || inferDirectStreamKind(stableSource, mediaType), message: stateMessage || 'Disponível.' })
      return () => { cancelled = true }
    }

    setRuntime({ status: 'loading', playbackUrl: null, streamKind: null, message: 'Abrindo streaming protegido...' })
    void requestProtectedPlaybackAccess(stableSource)
      .then((access) => {
        if (cancelled) return
        setRuntime({
          status: access.mediaStatus,
          playbackUrl: access.playbackUrl || null,
          streamKind: access.streamKind || streamKind || null,
          message: access.userMessage || stateMessage || null,
        })
      })
      .catch((error) => {
        if (cancelled) return
        const message = error instanceof Error ? error.message : 'Não foi possível abrir esta mídia.'
        setRuntime({ status: 'error', playbackUrl: null, streamKind: null, message })
        onError?.(message)
      })

    return () => { cancelled = true }
  }, [mediaStatus, mediaType, stableSource, stateMessage, streamKind, onError])

  useEffect(() => {
    if (mediaType !== 'video' || runtime.status !== 'ready' || !runtime.playbackUrl) return undefined
    if (runtime.streamKind !== 'hls' && !runtime.playbackUrl.toLowerCase().includes('.m3u8')) return undefined

    const video = videoRef.current
    if (!video) return undefined

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = runtime.playbackUrl
      return undefined
    }

    if (!Hls.isSupported()) {
      const message = 'Este navegador não oferece suporte ao streaming HLS.'
      setRuntime((current) => ({ ...current, status: 'error', playbackUrl: null, message }))
      onError?.(message)
      return undefined
    }

    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false,
      backBufferLength: 30,
    })
    hls.loadSource(runtime.playbackUrl)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      onReady?.()
      if (autoPlay) void video.play().catch(() => undefined)
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      const message = 'O streaming protegido foi interrompido.'
      setRuntime((current) => ({ ...current, status: 'error', playbackUrl: null, message }))
      onError?.(message)
      hls.destroy()
    })

    return () => hls.destroy()
  }, [autoPlay, mediaType, onError, onReady, runtime.playbackUrl, runtime.status, runtime.streamKind])

  function blockContextMenu(event: React.MouseEvent) {
    event.preventDefault()
  }

  if (runtime.status !== 'ready' || !runtime.playbackUrl) {
    return (
      <div className={containerClassName} onContextMenu={blockContextMenu}>
        <MediaStatePanel status={runtime.status} message={runtime.message} />
      </div>
    )
  }

  if (mediaType === 'image') {
    return (
      <div className={containerClassName} onContextMenu={blockContextMenu}>
        <img
          src={runtime.playbackUrl}
          alt={alt}
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onLoad={onReady}
          onError={() => onError?.('Não foi possível carregar a imagem protegida.')}
          className={className}
        />
      </div>
    )
  }

  if (mediaType === 'audio') {
    return (
      <div className={containerClassName} onContextMenu={blockContextMenu}>
        <audio
          src={runtime.playbackUrl}
          controls={controls}
          autoPlay={autoPlay}
          preload={preload}
          controlsList="nodownload noremoteplayback noplaybackrate"
          onCanPlay={onReady}
          onError={() => onError?.('Não foi possível reproduzir o áudio protegido.')}
          className={className}
        />
      </div>
    )
  }

  const usesHls = runtime.streamKind === 'hls' || runtime.playbackUrl.toLowerCase().includes('.m3u8')
  return (
    <div className={containerClassName} onContextMenu={blockContextMenu}>
      <video
        ref={videoRef}
        src={usesHls ? undefined : runtime.playbackUrl}
        controls={controls}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        playsInline={playsInline}
        poster={poster}
        preload={preload}
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        disableRemotePlayback
        onCanPlay={onReady}
        onError={() => {
          if (!usesHls) onError?.('Não foi possível reproduzir o vídeo protegido.')
        }}
        onDragStart={(event) => event.preventDefault()}
        className={className}
      >
        Seu navegador não suporta reprodução de vídeo.
      </video>
    </div>
  )
}
