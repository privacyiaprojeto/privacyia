import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAtrizesAssinadas } from '@/features/cliente/nsfw/hooks/useAtrizesAssinadas'
import { useOpcoesImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useOpcoesImagem'
import { useGerarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGerarImagem'
import { useGeradosImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useGeradosImagem'
import { useDenunciarImagem } from '@/features/cliente/nsfw/gerar-imagem/hooks/useDenunciarImagem'
import { useCreditos } from '@/shared/hooks/useCreditos'
import { buildPromptImagem } from '@/features/cliente/nsfw/utils/buildPrompt'
import { CUSTO_IMAGEM } from '@/features/cliente/nsfw/types'
import {
  getDynamicPromptOptionsImagem,
  prepareDynamicPromptImagem,
} from '@/features/cliente/nsfw/gerar-imagem/api/dynamicPromptImagem'
import type { ItemGerado } from '@/features/cliente/nsfw/types'
import type {
  DynamicPromptOptionsResult,
  DynamicPromptPrepareResult,
  DynamicPromptSelection,
  OpcaoImagem,
  TipoOpcaoImagem,
} from '@/features/cliente/nsfw/gerar-imagem/types'

const SELECOES_VAZIAS: Record<TipoOpcaoImagem, string | null> = {}

type FeedbackGeracao =
  | { kind: 'processing'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string }
  | null

function getCategoriaKey(titleId?: string | null, titleName?: string | null) {
  return titleId || titleName || 'opcao'
}

function getSelectionKey(selection: DynamicPromptSelection) {
  return getCategoriaKey(selection.titleId, selection.titleName)
}

function selectionToOpcao(selection: DynamicPromptSelection): OpcaoImagem | null {
  if (!selection.itemId && !selection.itemName) return null

  const categoria = getCategoriaKey(selection.titleId, selection.titleName)
  const id = selection.itemId || `${categoria}:${selection.itemName}`

  return {
    id,
    label: selection.itemName || 'Opção',
    categoria,
    categoriaLabel: selection.titleName || 'Opção',
    titleId: selection.titleId || undefined,
    titleName: selection.titleName || undefined,
    source: 'guided_factory',
  }
}

function buildOpcoesFromCascade(cascade: DynamicPromptOptionsResult, fallbackSelections: DynamicPromptSelection[] = []) {
  const selected = cascade.selected?.length ? cascade.selected : fallbackSelections
  const selectedOptions = selected.map(selectionToOpcao).filter(Boolean) as OpcaoImagem[]
  const currentOptions = (cascade.currentStep?.options || []).map((option) => ({
    id: option.itemId,
    label: option.itemName,
    categoria: getCategoriaKey(option.titleId, option.titleName),
    categoriaLabel: option.titleName,
    titleId: option.titleId || undefined,
    titleName: option.titleName,
    source: 'guided_factory',
  }))

  const unique = new Map<string, OpcaoImagem>()
  for (const item of [...selectedOptions, ...currentOptions]) {
    unique.set(`${item.categoria}:${item.id}`, item)
  }

  return Array.from(unique.values())
}

function buildSelecionadasFromSelections(selections: DynamicPromptSelection[]) {
  return selections.reduce<Record<string, string | null>>((acc, selection) => {
    const opcao = selectionToOpcao(selection)
    if (!opcao) return acc
    acc[opcao.categoria] = opcao.id
    return acc
  }, {})
}

function optionToSelection(opcao: OpcaoImagem): DynamicPromptSelection {
  return {
    titleId: opcao.titleId || null,
    titleName: opcao.titleName || opcao.categoriaLabel || opcao.categoria,
    itemId: opcao.id,
    itemName: opcao.label,
  }
}

function isSameSelection(a: DynamicPromptSelection | undefined, opcao: OpcaoImagem) {
  if (!a) return false
  return getSelectionKey(a) === opcao.categoria && String(a.itemId || '') === String(opcao.id || '')
}

function buildLocalDeliveryItem({
  response,
  atrizNome,
  atrizId,
}: {
  response: { id: string; url?: string; deliveryId?: string; alreadyDelivered?: boolean }
  atrizNome: string
  atrizId: string
}): ItemGerado | null {
  if (!response.url) return null

  return {
    id: response.deliveryId || response.id,
    atrizId,
    atrizNome,
    tipo: 'imagem',
    url: response.url,
    status: 'concluido',
    progresso: 100,
    criadaEm: new Date().toISOString(),
    denunciado: true,
  }
}

export function useGerarImagemPage() {
  const [searchParams] = useSearchParams()
  const [atrizId, setAtrizId] = useState<string | null>(searchParams.get('atrizId'))
  const [selecionadas, setSelecionadas] = useState<Record<TipoOpcaoImagem, string | null>>(SELECOES_VAZIAS)
  const [modalAberto, setModalAberto] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackGeracao>(null)
  const [midiaAtiva, setMidiaAtiva] = useState<ItemGerado | null>(null)
  const [dynamicMode, setDynamicMode] = useState(false)
  const [dynamicLoading, setDynamicLoading] = useState(false)
  const [dynamicSelections, setDynamicSelections] = useState<DynamicPromptSelection[]>([])
  const [dynamicCascade, setDynamicCascade] = useState<DynamicPromptOptionsResult | null>(null)
  const [dynamicPrepare, setDynamicPrepare] = useState<DynamicPromptPrepareResult | null>(null)
  const [dynamicOpcoes, setDynamicOpcoes] = useState<OpcaoImagem[]>([])
  const [entregasDinamicas, setEntregasDinamicas] = useState<ItemGerado[]>([])

  const { data: atrizes = [], isLoading: loadingAtrizes } = useAtrizesAssinadas()
  const { data: opcoesLegadas = [], isLoading: loadingOpcoesLegadas } = useOpcoesImagem(atrizId)
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
  const opcoes = dynamicMode ? dynamicOpcoes : opcoesLegadas
  const loadingOpcoes = dynamicLoading || (!dynamicMode && loadingOpcoesLegadas)
  const creditos = creditosData?.creditos ?? 0
  const dynamicReady = Boolean(dynamicMode && dynamicCascade?.selectionComplete)
  const alreadyDelivered = Boolean(dynamicPrepare?.alreadyDeliveredToClient)
  const avatarSemProdutoPublicado = Boolean(
    atrizId &&
    dynamicMode &&
    !dynamicLoading &&
    !dynamicReady &&
    opcoes.length === 0 &&
    Number(dynamicCascade?.available?.combinations || 0) === 0
  )
  const custoAtual = dynamicMode
    ? Number(dynamicPrepare?.price?.credits || dynamicCascade?.completedCombinations?.[0]?.priceCredits || 0)
    : CUSTO_IMAGEM
  const semCreditos = dynamicMode
    ? Boolean(dynamicReady && !alreadyDelivered && custoAtual > 0 && creditos < custoAtual)
    : creditos < CUSTO_IMAGEM
  const podeLancar = Boolean(
    atrizId &&
    !gerarImagem.isPending &&
    (
      dynamicMode
        ? dynamicReady && (alreadyDelivered || dynamicPrepare?.readyToBuy === true) && !semCreditos
        : !semCreditos
    ),
  )
  const custoAtualLabel = dynamicMode
    ? avatarSemProdutoPublicado
      ? 'Indisponível no momento'
      : alreadyDelivered
        ? 'Já comprado'
        : dynamicReady && custoAtual > 0
          ? `${custoAtual} créditos`
          : 'Complete as opções'
    : `${CUSTO_IMAGEM} créditos`
  const botaoGerarLabel = dynamicMode
    ? avatarSemProdutoPublicado
      ? 'Indisponível no momento'
      : alreadyDelivered
        ? 'Abrir mídia'
        : 'Confirmar escolha'
    : 'Gerar imagem'

  const prompt = useMemo(() => {
    if (!atrizSelecionada || opcoes.length === 0) return ''
    return buildPromptImagem(atrizSelecionada.nome, selecionadas, opcoes)
  }, [atrizSelecionada, selecionadas, opcoes])

  const geradosVisiveis = useMemo(() => {
    return [...entregasDinamicas, ...gerados]
      .filter((item) => {
        const status = String(item.status || '').toLowerCase()
        return !['erro', 'falhou', 'failed', 'error'].includes(status)
      })
      .filter((item, index, array) => array.findIndex((other) => other.id === item.id) === index)
      .sort((a, b) => {
        const aDate = new Date(a.criadaEm || 0).getTime()
        const bDate = new Date(b.criadaEm || 0).getTime()
        return bDate - aDate
      })
  }, [entregasDinamicas, gerados])

  const carregarCascadeDinamica = useCallback(async (companionId: string, selections: DynamicPromptSelection[]) => {
    setDynamicLoading(true)
    setDynamicPrepare(null)

    try {
      const cascade = await getDynamicPromptOptionsImagem({
        companionId,
        mediaType: 'imagem',
        selections,
      })
      const selectedFromServer = cascade.selected?.length ? cascade.selected : selections
      const options = buildOpcoesFromCascade(cascade, selectedFromServer)

      setDynamicMode(true)
      setDynamicCascade(cascade)
      setDynamicSelections(selectedFromServer)
      setDynamicOpcoes(options)
      setSelecionadas(buildSelecionadasFromSelections(selectedFromServer))

      if (cascade.selectionComplete && cascade.completedCombinations.length === 1) {
        const prepared = await prepareDynamicPromptImagem({
          companionId,
          mediaType: 'imagem',
          selections: selectedFromServer,
          combinationId: cascade.completedCombinations[0].combinationId,
        })
        setDynamicPrepare(prepared)
      }
    } catch (error) {
      console.warn('[GerarImagem] Prompt dinâmico indisponível. Mantendo fluxo anterior.', error)
      setDynamicMode(false)
      setDynamicCascade(null)
      setDynamicSelections([])
      setDynamicPrepare(null)
      setDynamicOpcoes([])
      setSelecionadas(SELECOES_VAZIAS)
    } finally {
      setDynamicLoading(false)
    }
  }, [])

  function toggleOpcao(categoria: TipoOpcaoImagem, id: string) {
    if (dynamicMode && atrizId) {
      const opcao = opcoes.find((item) => item.categoria === categoria && item.id === id)
      if (!opcao) return

      const currentIndex = dynamicSelections.findIndex((selection) => getSelectionKey(selection) === categoria)
      const baseSelections = currentIndex >= 0 ? dynamicSelections.slice(0, currentIndex) : dynamicSelections
      const nextSelections = isSameSelection(dynamicSelections[currentIndex], opcao)
        ? baseSelections
        : [...baseSelections, optionToSelection(opcao)]

      setFeedback(null)
      setSelecionadas(buildSelecionadasFromSelections(nextSelections))
      setDynamicSelections(nextSelections)
      void carregarCascadeDinamica(atrizId, nextSelections)
      return
    }

    setSelecionadas((prev) => ({
      ...prev,
      [categoria]: prev[categoria] === id ? null : id,
    }))
  }

  function buildGuidedSelections() {
    if (dynamicMode) {
      return dynamicSelections.map((selection) => ({
        titleId: selection.titleId || null,
        category: selection.titleName || null,
        itemId: selection.itemId as string,
      })).filter((item) => Boolean(item.itemId))
    }

    return Object.entries(selecionadas)
      .filter(([, itemId]) => Boolean(itemId))
      .map(([categoria, itemId]) => ({
        titleId: opcoes.find((opcao) => opcao.id === itemId)?.titleId || null,
        category: categoria,
        itemId: itemId as string,
      }))
  }

  function handleGerar() {
    if (!atrizId || gerarImagem.isPending) return

    if (dynamicMode && (!dynamicReady || (!alreadyDelivered && dynamicPrepare?.readyToBuy !== true))) {
      setFeedback({
        kind: 'error',
        message: dynamicReady
          ? 'Esta combinação ainda não está liberada para compra.'
          : 'Complete as opções disponíveis antes de confirmar.',
      })
      return
    }

    setFeedback({
      kind: 'processing',
      message: dynamicMode
        ? 'Preparando sua mídia com segurança...'
        : 'A IA está gerando sua imagem. Isso pode levar alguns segundos...',
    })

    gerarImagem.mutate(
      {
        atrizId,
        posicaoId: selecionadas.posicao,
        ambienteId: selecionadas.ambiente,
        acessorioId: selecionadas.acessorio,
        roupaId: selecionadas.roupa,
        guidedSelections: buildGuidedSelections(),
        dynamicClaim: dynamicMode,
        dynamicSelections,
        combinationId: dynamicPrepare?.combinationId || dynamicCascade?.completedCombinations?.[0]?.combinationId || null,
      },
      {
        onSuccess: async (response) => {
          await Promise.allSettled([
            refetchGerados(),
            refetchCreditos(),
          ])

          const localItem = buildLocalDeliveryItem({
            response,
            atrizId,
            atrizNome: atrizSelecionada?.nome || 'Avatar',
          })

          if (localItem) {
            setEntregasDinamicas((prev) => [localItem, ...prev.filter((item) => item.id !== localItem.id)])
            setMidiaAtiva(localItem)
          }

          setFeedback({
            kind: 'success',
            message: response.alreadyDelivered
              ? 'Esta mídia já era sua. Abrimos novamente sem nova cobrança.'
              : dynamicMode
                ? 'Mídia liberada com sucesso. Sua biblioteca foi atualizada.'
                : 'Imagem gerada com sucesso. Sua galeria foi atualizada.',
          })
        },
        onError: () => {
          setFeedback({
            kind: 'error',
            message: 'Não foi possível concluir esta solicitação agora. Tente novamente em instantes.',
          })
        },
      },
    )
  }

  function selecionarAtriz(id: string) {
    setAtrizId(id)
    setSelecionadas(SELECOES_VAZIAS)
    setDynamicSelections([])
    setDynamicPrepare(null)
    setDynamicCascade(null)
    setDynamicOpcoes([])
    setFeedback(null)
  }

  function abrirMidia(item: ItemGerado) {
    setMidiaAtiva(item)
  }

  function fecharMidia() {
    setMidiaAtiva(null)
  }

  useEffect(() => {
    if (!atrizId) {
      setDynamicMode(false)
      setDynamicOpcoes([])
      setDynamicSelections([])
      setDynamicPrepare(null)
      setDynamicCascade(null)
      return
    }

    void carregarCascadeDinamica(atrizId, [])
  }, [atrizId, carregarCascadeDinamica])

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
    dynamicMode,
    dynamicReady,
    dynamicPrepare,
    avatarSemProdutoPublicado,
    custoAtualLabel,
    botaoGerarLabel,
    toggleOpcao,
    handleGerar,
    selecionarAtriz,
    abrirMidia,
    fecharMidia,
    setModalAberto,
  }
}
