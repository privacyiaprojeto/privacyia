import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAtrizesAssinadas } from '@/features/cliente/nsfw/hooks/useAtrizesAssinadas'
import { useOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useOpcoesImagem'
import { useGerarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGerarImagem'
import { useGeradosImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGeradosImagem'
import { useDenunciarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useDenunciarImagem'
import { useCreditos } from '@/shared/hooks/useCreditos'
import { buildPromptImagem } from '@/features/cliente/nsfw/utils/buildPrompt'
import { CUSTO_IMAGEM } from '@/features/cliente/nsfw/types'
import type { TipoOpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'

const SELECOES_VAZIAS: Record<TipoOpcaoImagem, string | null> = {
  posicao: null,
  ambiente: null,
  acessorio: null,
  roupa: null,
}

export function useGerarImagemPage() {
  const [searchParams] = useSearchParams()
  const [atrizId, setAtrizId] = useState<string | null>(searchParams.get('atrizId'))
  const [selecionadas, setSelecionadas] = useState<Record<TipoOpcaoImagem, string | null>>(SELECOES_VAZIAS)
  const [modalAberto, setModalAberto] = useState(false)

  const { data: atrizes = [], isLoading: loadingAtrizes } = useAtrizesAssinadas()
  const { data: opcoes = [], isLoading: loadingOpcoes } = useOpcoesImagem()
  const { data: gerados = [], isLoading: loadingGerados } = useGeradosImagem()
  const { data: creditosData } = useCreditos()
  const gerarImagem = useGerarImagem()
  const denunciarImagem = useDenunciarImagem()

  const atrizSelecionada = atrizes.find((a) => a.id === atrizId)
  const creditos = creditosData?.creditos ?? 0
  const semCreditos = creditos < CUSTO_IMAGEM
  const podeLancar = atrizId !== null && !semCreditos && !gerarImagem.isPending

  const prompt = useMemo(() => {
    if (!atrizSelecionada) return ''
    return buildPromptImagem(atrizSelecionada.nome, selecionadas, opcoes)
  }, [atrizSelecionada, selecionadas, opcoes])

  function toggleOpcao(categoria: TipoOpcaoImagem, id: string) {
    setSelecionadas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === id ? null : id,
    }))
  }

  function handleGerar() {
    if (!atrizId) return
    gerarImagem.mutate({ atrizId, ...selecionadas })
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
    gerarImagem,
    denunciarImagem,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    setModalAberto,
  }
}