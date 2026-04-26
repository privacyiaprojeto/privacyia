import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAtrizesAssinadas } from '@/features/cliente/nsfw/hooks/useAtrizesAssinadas'
import { useOpcoesVideo } from '@/features/cliente/nsfw/gerar-video/hooks/useOpcoesVideo'
import { useGerarVideo } from '@/features/cliente/nsfw/gerar-video/hooks/useGerarVideo'
import { useGeradosVideo } from '@/features/cliente/nsfw/gerar-video/hooks/useGeradosVideo'
import { useDenunciarVideo } from '@/features/cliente/nsfw/gerar-video/hooks/useDenunciarVideo'
import { useCreditos } from '@/shared/hooks/useCreditos'
import { buildPromptVideo } from '@/features/cliente/nsfw/utils/buildPrompt'
import { CUSTO_VIDEO } from '@/features/cliente/nsfw/types'
import type { TipoOpcaoVideo } from '@/features/cliente/nsfw/gerar-video/types'

const SELECOES_VAZIAS: Record<TipoOpcaoVideo, string | null> = {
  acao: null,
  roupa: null,
  localizacao: null,
}

export function useGerarVideoPage() {
  const [searchParams] = useSearchParams()
  const [atrizId, setAtrizId] = useState<string | null>(searchParams.get('atrizId'))
  const [selecionadas, setSelecionadas] = useState<Record<TipoOpcaoVideo, string | null>>(SELECOES_VAZIAS)
  const [modalAberto, setModalAberto] = useState(false)

  const { data: atrizes = [], isLoading: loadingAtrizes } = useAtrizesAssinadas()
  const { data: opcoes = [], isLoading: loadingOpcoes } = useOpcoesVideo()
  const { data: gerados = [], isLoading: loadingGerados } = useGeradosVideo()
  const { data: creditosData } = useCreditos()
  const gerarVideo = useGerarVideo()
  const denunciarVideo = useDenunciarVideo()

  const atrizSelecionada = atrizes.find((a) => a.id === atrizId)
  const creditos = creditosData?.creditos ?? 0
  const semCreditos = creditos < CUSTO_VIDEO
  const podeLancar = atrizId !== null && !semCreditos && !gerarVideo.isPending

  const prompt = useMemo(() => {
    if (!atrizSelecionada) return ''
    return buildPromptVideo(atrizSelecionada.nome, selecionadas, opcoes)
  }, [atrizSelecionada, selecionadas, opcoes])

  function toggleOpcao(categoria: TipoOpcaoVideo, id: string) {
    setSelecionadas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === id ? null : id,
    }))
  }

  function handleGerar() {
    if (!atrizId) return
    gerarVideo.mutate({ atrizId, ...selecionadas })
  }

  function selecionarAtriz(id: string) {
    setAtrizId(id)
    setSelecionadas(SELECOES_VAZIAS)
  }

  return {
    atrizes,
    atrizSelecionada,
    opcoes,
    gerados,
    creditosData,
    creditos,
    semCreditos,
    podeLancar,
    prompt,
    selecionadas,
    modalAberto,
    loadingAtrizes,
    loadingOpcoes,
    loadingGerados,
    gerarVideo,
    denunciarVideo,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    setModalAberto,
  }
}