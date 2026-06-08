import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAtrizesAssinadas } from '@/features/cliente/nsfw/hooks/useAtrizesAssinadas'
import { useOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useOpcoesImagem'
import { useGerarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGerarImagem'
import { useGeradosImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGeradosImagem'
import { useDenunciarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useDenunciarImagem'
import { useCreditos } from '@/shared/hooks/useCreditos'
import { buildPromptImagem } from '@/features/cliente/nsfw/utils/buildPrompt'
import { CUSTO_IMAGEM } from '@/features/cliente/nsfw/types'
import type { ItemGerado } from '@/features/cliente/nsfw/types'
import type { TipoOpcaoImagem } from '@/features/cliente/nsfw/gerar-imagem/types'

const SELECOES_VAZIAS: Record<TipoOpcaoImagem, string | null> = {
  posicao: null,
  ambiente: null,
  acessorio: null,
  roupa: null,
}

type FeedbackGeracao =
  | { kind: 'processing'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

export function useGerarImagemPage() {
  const [searchParams] = useSearchParams()
  const [atrizId, setAtrizId] = useState<string | null>(searchParams.get('atrizId'))
  const [selecionadas, setSelecionadas] = useState<Record<TipoOpcaoImagem, string | null>>(SELECOES_VAZIAS)
  const [modalAberto, setModalAberto] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackGeracao>(null)
  const [midiaAtiva, setMidiaAtiva] = useState<ItemGerado | null>(null)

  const { data: atrizes = [], isLoading: loadingAtrizes } = useAtrizesAssinadas()
  const { data: opcoes = [], isLoading: loadingOpcoes } = useOpcoesImagem()
  const {
    data: gerados = [],
    isLoading: loadingGerados,
    refetch: refetchGerados,
  } = useGeradosImagem()
  const {
    data: creditosData,
    refetch: refetchCreditos,
  } = useCreditos()
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

  const geradosVisiveis = useMemo(() => {
    return [...gerados]
      .filter((item) => {
        const status = String(item.status || '').toLowerCase()
        return !['erro', 'falhou', 'failed', 'error'].includes(status)
      })
      .sort((a, b) => {
        const aDate = new Date(a.criadaEm || 0).getTime()
        const bDate = new Date(b.criadaEm || 0).getTime()
        return bDate - aDate
      })
  }, [gerados])

  function toggleOpcao(categoria: TipoOpcaoImagem, id: string) {
    setSelecionadas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === id ? null : id,
    }))
  }

  function handleGerar() {
    if (!atrizId || gerarImagem.isPending) return

    setFeedback({
      kind: 'processing',
      message: 'A IA está gerando sua imagem. Isso pode levar alguns segundos...',
    })

    gerarImagem.mutate(
      {
        atrizId,
        posicaoId: selecionadas.posicao,
        ambienteId: selecionadas.ambiente,
        acessorioId: selecionadas.acessorio,
        roupaId: selecionadas.roupa,
      },
      {
        onSuccess: async () => {
          await Promise.allSettled([
            refetchGerados(),
            refetchCreditos(),
          ])

          setFeedback({
            kind: 'success',
            message: 'Imagem gerada com sucesso. Sua galeria foi atualizada.',
          })
        },
        onError: () => {
          setFeedback({
            kind: 'error',
            message: 'Não foi possível concluir esta geração agora. Tente novamente em instantes.',
          })
        },
      },
    )
  }

  function selecionarAtriz(id: string) {
    setAtrizId(id)
    setSelecionadas(SELECOES_VAZIAS)
  }

  function abrirMidia(item: ItemGerado) {
    setMidiaAtiva(item)
  }

  function fecharMidia() {
    setMidiaAtiva(null)
  }

  useEffect(() => {
    if (!feedback || feedback.kind === 'processing') return

    const timer = window.setTimeout(() => {
      setFeedback(null)
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [feedback])

  return {
    atrizes,
    atrizSelecionada,
    opcoes,
    gerados: geradosVisiveis,
    creditosData,
    creditos,
    semCreditos,
    podeLancar,
    prompt,
    selecionadas,
    modalAberto,
    feedback,
    midiaAtiva,
    loadingAtrizes,
    loadingOpcoes,
    loadingGerados,
    gerarImagem,
    denunciarImagem,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    abrirMidia,
    fecharMidia,
    setModalAberto,
  }
}
