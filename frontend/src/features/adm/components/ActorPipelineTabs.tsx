import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Headphones,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Mic2,
  Play,
  Send,
  ShieldCheck,
  Store,
  Trash2,
  Users,
  Video,
} from 'lucide-react'
import type { ActorProfile } from '@/features/adm/api/actorComplianceApi'
import type { FactoryAsset } from '@/features/adm/types'
import { parseApiError } from '@/shared/utils/parseApiError'
import { useAudioStorylines, usePromptDictionaries } from '@/features/adm/hooks/useIntelligenceCenter'
import { useBaseScenes, useSceneCastingCandidates, useSplitBeneficiaries } from '@/features/adm/hooks/useSceneDirection'
import {
  useActorIdentityDatasetReadiness,
  useActorPipelinePublicationProducts,
  useApproveActorPipelineProduct,
  useActorPipelineReviewProducts,
  useActorPipelineSummary,
  useCreateActorPipelineProduction,
  usePublishActorPipelineProduct,
  useRejectActorPipelineProduct,
} from '@/features/adm/hooks/useActorPipeline'
import type {
  ActorPipelineDestination,
  ActorPipelineProduct,
  ActorPipelineProductType,
  ActorPipelinePublicationPayload,
} from '@/features/adm/api/actorPipelineApi'

const PRODUCT_TYPES: Array<{ value: ActorPipelineProductType; label: string; helper: string; icon: typeof ImageIcon }> = [
  { value: 'image', label: 'Imagem', helper: 'Monte a imagem por cenário, roupa, ação, pose e clima.', icon: ImageIcon },
  { value: 'short_video', label: 'Vídeo Curto', helper: 'Vídeo curto com cenário, roupa e ação.', icon: Video },
  { value: 'live_action_v2v', label: 'Live Action', helper: 'Cena em movimento usando um vídeo-base aprovado.', icon: Play },
  { value: 'live_audio', label: 'Live Audio', helper: 'Áudio criado a partir de um roteiro aprovado.', icon: Mic2 },
]

const DESTINATIONS: Array<{ value: ActorPipelineDestination; label: string; helper: string }> = [
  { value: 'feed', label: 'Feed', helper: 'Conteúdo editorial no feed do cliente.' },
  { value: 'premium', label: 'Premium', helper: 'Produto protegido e comprável.' },
  { value: 'public_storefront', label: 'Vitrine Pública', helper: 'Produto destacado na vitrine pública.' },
]

const CATEGORY_LABELS: Record<string, string> = {
  scenario: 'Cenário',
  clothing: 'Vestimenta',
  action: 'Ação',
  pose: 'Pose',
  mood: 'Humor',
  lighting: 'Iluminação',
}

const IMAGE_CATEGORY_ORDER = ['scenario', 'clothing', 'action', 'pose', 'mood', 'lighting'] as const
const IMAGE_INTERNAL_STAGE_MAX_PRODUCTS = 48
const IMAGE_INTERNAL_STAGE_MAX_OUTPUTS = 240
const IMAGE_GLOBAL_REQUEST_GUARD_PRODUCTS = 5000
const IMAGE_GLOBAL_REQUEST_GUARD_OUTPUTS = 25000

function actorStageName(actor: ActorProfile) {
  const metadata = actor.metadata || {}
  const candidates = [metadata.stageName, metadata.artistName, metadata.apelido, metadata.nickname, actor.displayName]
  return String(candidates.find((value) => typeof value === 'string' && value.trim()) || 'Ator/Atriz')
}

function mediaKind(mediaType = '') {
  const normalized = String(mediaType || '').toLowerCase()
  if (normalized.includes('audio')) return 'audio'
  if (normalized.includes('video') || normalized.includes('action')) return 'video'
  return 'image'
}

function mediaLabel(mediaType = '') {
  const kind = mediaKind(mediaType)
  if (kind === 'audio') return 'Live Audio'
  if (kind === 'video') return String(mediaType).toLowerCase().includes('action') ? 'Live Action' : 'Vídeo'
  return 'Imagem'
}

function productTitle(asset: FactoryAsset) {
  return asset.combination?.title || `${mediaLabel(asset.mediaType)} • variação ${asset.variantNumber || 1}`
}

function PipelineMedia({ asset }: { asset: FactoryAsset }) {
  const src = asset.mediaPreview?.previewUrl || asset.mediaPreview?.url || asset.mediaPreview?.thumbnailUrl || null
  const kind = mediaKind(asset.mediaType)

  if (!src) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/35 text-center text-xs font-bold text-zinc-600">
        Preview protegido indisponível
      </div>
    )
  }

  if (kind === 'audio') {
    return (
      <div className="flex min-h-36 flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-black/35 p-5">
        <Headphones className="text-amber-100" size={28} />
        <audio controls preload="metadata" className="w-full" src={src} />
      </div>
    )
  }

  if (kind === 'video') {
    return <video controls preload="metadata" className="aspect-video w-full rounded-2xl border border-white/10 bg-black object-contain" src={src} />
  }

  return <img src={src} alt={productTitle(asset)} className="aspect-[4/3] w-full rounded-2xl border border-white/10 bg-black object-contain" />
}

export function ActorPipelineSummaryPanel({ actor, fallbackProductCount = 0 }: { actor: ActorProfile; fallbackProductCount?: number }) {
  const summaryQuery = useActorPipelineSummary(actor.id)
  const summary = summaryQuery.data

  if (summaryQuery.isLoading) {
    return <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5 text-sm font-bold text-zinc-500">Carregando indicadores e saldo financeiro...</div>
  }

  if (summaryQuery.isError) {
    return <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/10 p-5 text-sm font-bold text-rose-100">{parseApiError(summaryQuery.error)}</div>
  }

  const indicators = summary?.indicators
  const finance = summary?.finance
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PipelineMetric label="Produtos" value={indicators?.totalProducts ?? fallbackProductCount} />
        <PipelineMetric label="Em revisão" value={indicators?.pendingReview ?? 0} />
        <PipelineMetric label="Aguardando publicação" value={indicators?.approvedWaitingPublication ?? 0} />
        <PipelineMetric label="Publicados" value={indicators?.published ?? 0} />
      </div>
      <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/[0.06] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Saldo financeiro do ator</p>
            <h4 className="mt-1 text-2xl font-black text-white">{finance?.estimatedPayoutCredits ?? 0} créditos estimados</h4>
            <p className="mt-2 text-sm text-emerald-50/70">Repasse vigente: {finance?.payoutPercent ?? 0}% • {finance?.deliveries ?? 0} entrega(s).</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Receita bruta</p>
            <p className="mt-1 text-lg font-black text-white">{finance?.grossCredits ?? 0}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function PipelineMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  )
}

export function ActorProductionStudioTab({ actor, onReviewMapping, onOpenAuthorization }: { actor: ActorProfile; onReviewMapping?: () => void; onOpenAuthorization?: () => void }) {
  const dictionariesQuery = usePromptDictionaries()
  const storylinesQuery = useAudioStorylines()
  const baseScenesQuery = useBaseScenes(false)
  const castingQuery = useSceneCastingCandidates()
  const productionMutation = useCreateActorPipelineProduction(actor.id)
  const summaryQuery = useActorPipelineSummary(actor.id)
  const datasetReadinessQuery = useActorIdentityDatasetReadiness(actor.id)
  const [productType, setProductType] = useState<ActorPipelineProductType>('image')
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string[]>>({})
  const [variations, setVariations] = useState(5)
  const [baseSceneId, setBaseSceneId] = useState('')
  const [storylineId, setStorylineId] = useState('')
  const [additionalActorIds, setAdditionalActorIds] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [resultMessage, setResultMessage] = useState('')

  const activeDictionaries = useMemo(() => (dictionariesQuery.data?.items || []).filter((item) => item.isActive), [dictionariesQuery.data])
  const imageCategoryGroups = useMemo(() => IMAGE_CATEGORY_ORDER.map((category) => ({
    category,
    items: activeDictionaries.filter((item) => item.category === category),
  })), [activeDictionaries])
  const missingImageCategories = useMemo(() => imageCategoryGroups
    .filter((group) => group.items.length === 0)
    .map((group) => group.category), [imageCategoryGroups])
  const selectedCountByCategory = useMemo(() => Object.fromEntries(
    imageCategoryGroups.map((group) => [group.category, (selectedByCategory[group.category] || []).length]),
  ), [imageCategoryGroups, selectedByCategory])
  const unselectedImageCategories = useMemo(() => imageCategoryGroups
    .filter((group) => group.items.length > 0 && (selectedByCategory[group.category] || []).length === 0)
    .map((group) => group.category), [imageCategoryGroups, selectedByCategory])
  const activeStorylines = (storylinesQuery.data?.items || []).filter((item) => item.isActive)
  const readyScenes = (baseScenesQuery.data?.items || []).filter((item) => item.isActive && item.uploadStatus === 'ready')
  const selectedScene = readyScenes.find((scene) => scene.id === baseSceneId)
  const extraSlots = Math.max((selectedScene?.slotsCount || 1) - 1, 0)
  const candidates = (castingQuery.data?.items || []).filter((item) => item.actorProfileId !== actor.id)
  const identityLora = summaryQuery.data?.identityLora
  const datasetReadiness = datasetReadinessQuery.data
  const datasetSummary = datasetReadiness?.summary
  const datasetThresholds = datasetReadiness?.thresholds
  const datasetDiagnostics = datasetReadiness?.diagnostics
  const datasetReady = Boolean(datasetReadiness?.readiness.ready)
  const materialsComplete = Boolean(
    datasetSummary
    && datasetThresholds
    && datasetSummary.validUniqueImages >= datasetThresholds.minimumImages
    && datasetSummary.validUniqueVideos >= datasetThresholds.minimumVideos
    && datasetSummary.pendingReviewAssets === 0
    && (datasetDiagnostics?.summary.actionRequired || 0) === 0
    && (datasetReadiness?.coverage?.missingImageTags?.length || 0) === 0
    && (datasetReadiness?.coverage?.missingVideoTags?.length || 0) === 0
  )
  const isVideoProduct = productType === 'short_video' || productType === 'live_action_v2v'
  const isImageProduct = productType === 'image'
  const usesImageChoices = productType === 'image' || productType === 'short_video'
  const productCreationUnlocked = actor.productionStatus === 'authorized' && Boolean(identityLora?.allProductProductionUnlocked)
  const identityProductionLocked = !productCreationUnlocked
  const videoProductionLocked = Boolean(isVideoProduct && !identityLora?.videoProductionUnlocked)
  const imageChoicesUnavailable = Boolean(usesImageChoices && (dictionariesQuery.isLoading || dictionariesQuery.isError || missingImageCategories.length > 0))
  const imageChoicesIncomplete = Boolean(usesImageChoices && !imageChoicesUnavailable && unselectedImageCategories.length > 0)
  const imageBaseProductCount = useMemo(() => {
    if (!isImageProduct || imageChoicesUnavailable || imageChoicesIncomplete) return 0
    return imageCategoryGroups.reduce((total, group) => total * Math.max((selectedByCategory[group.category] || []).length, 0), 1)
  }, [imageCategoryGroups, imageChoicesIncomplete, imageChoicesUnavailable, isImageProduct, selectedByCategory])
  const estimatedOutputCount = isImageProduct ? imageBaseProductCount * variations : variations
  const internalStageProductCapacity = isImageProduct
    ? Math.max(1, Math.min(IMAGE_INTERNAL_STAGE_MAX_PRODUCTS, Math.floor(IMAGE_INTERNAL_STAGE_MAX_OUTPUTS / Math.max(variations, 1))))
    : 1
  const estimatedInternalStageCount = isImageProduct && imageBaseProductCount > 0
    ? Math.ceil(imageBaseProductCount / internalStageProductCapacity)
    : 0
  const imageGlobalProductGuardExceeded = Boolean(isImageProduct && imageBaseProductCount > IMAGE_GLOBAL_REQUEST_GUARD_PRODUCTS)
  const imageGlobalOutputGuardExceeded = Boolean(isImageProduct && estimatedOutputCount > IMAGE_GLOBAL_REQUEST_GUARD_OUTPUTS)
  const productConfigurationLocked = imageChoicesUnavailable
    || imageChoicesIncomplete
    || imageGlobalProductGuardExceeded
    || imageGlobalOutputGuardExceeded
    || (productType === 'live_action_v2v' && !baseSceneId)
    || (productType === 'live_audio' && !storylineId)
  const submitLocked = identityProductionLocked || videoProductionLocked || productConfigurationLocked
  const submitLockMessage = identityProductionLocked
    ? 'Prepare e aprove a identidade do ator antes de criar produtos'
    : videoProductionLocked
      ? 'Identidade para vídeos ainda não aprovada'
    : dictionariesQuery.isLoading && usesImageChoices
      ? 'Carregando opções de criação'
      : dictionariesQuery.isError && usesImageChoices
        ? 'Não foi possível carregar as opções de criação'
        : missingImageCategories.length > 0 && usesImageChoices
          ? 'A Biblioteca de criação ainda está incompleta'
          : imageChoicesIncomplete
            ? 'Escolha ao menos uma opção por categoria'
            : imageGlobalProductGuardExceeded
              ? 'A solicitação ultrapassa a proteção geral de produtos'
              : imageGlobalOutputGuardExceeded
                ? 'A solicitação ultrapassa a proteção geral de mídias'
                : productType === 'live_action_v2v' && !baseSceneId
                  ? 'Selecione uma cena-base'
                  : productType === 'live_audio' && !storylineId
                    ? 'Selecione um roteiro de áudio'
                    : undefined
  const identityBlockMessage = identityLora?.state === 'schema_pending'
    ? 'A preparação da identidade do ator ainda não está disponível.'
    : identityLora?.state === 'dry_run_ready'
      ? 'Os materiais foram conferidos. A criação e a validação da identidade ainda estão pendentes.'
      : identityLora?.state === 'adapter_approved_injection_pending'
        ? 'A identidade foi aprovada, mas ainda não está integrada à produção.'
        : 'A identidade do ator ainda precisa ser preparada e aprovada.'

  useEffect(() => {
    setAdditionalActorIds((current) => Array.from({ length: extraSlots }, (_, index) => current[index] || ''))
  }, [extraSlots])

  function toggleImageSelection(category: string, itemId: string) {
    setSelectedByCategory((current) => {
      const selected = current[category] || []
      const next = selected.includes(itemId)
        ? selected.filter((value) => value !== itemId)
        : [...selected, itemId]
      return { ...current, [category]: next }
    })
  }

  function selectAllImageCategory(category: string, itemIds: string[]) {
    setSelectedByCategory((current) => ({ ...current, [category]: itemIds }))
  }

  function clearImageCategory(category: string) {
    setSelectedByCategory((current) => ({ ...current, [category]: [] }))
  }

  async function handleSubmit() {
    setResultMessage('')
    if (identityProductionLocked) {
      window.alert('Prepare, treine e aprove a identidade do ator antes de enviar qualquer produto para produção.')
      return
    }
    const dictionarySelections = Object.values(selectedByCategory).flat().filter(Boolean).map((id) => ({ id }))
    if (usesImageChoices && dictionariesQuery.isLoading) {
      window.alert('Aguarde o carregamento das opções de criação.')
      return
    }
    if (usesImageChoices && dictionariesQuery.isError) {
      window.alert('Não foi possível carregar as opções de criação. Atualize a página e tente novamente.')
      return
    }
    if (usesImageChoices && missingImageCategories.length > 0) {
      window.alert(`A Biblioteca de criação ainda não possui opções ativas para: ${missingImageCategories.map((category) => CATEGORY_LABELS[category] || category).join(', ')}.`)
      return
    }
    if (usesImageChoices && unselectedImageCategories.length > 0) {
      window.alert(`Escolha ao menos uma opção para: ${unselectedImageCategories.map((category) => CATEGORY_LABELS[category] || category).join(', ')}.`)
      return
    }
    if (isImageProduct && imageBaseProductCount > IMAGE_GLOBAL_REQUEST_GUARD_PRODUCTS) {
      window.alert(`A solicitação ultrapassa a proteção geral de ${IMAGE_GLOBAL_REQUEST_GUARD_PRODUCTS} produtos base. Revise as seleções antes de continuar.`)
      return
    }
    if (isImageProduct && estimatedOutputCount > IMAGE_GLOBAL_REQUEST_GUARD_OUTPUTS) {
      window.alert(`A solicitação ultrapassa a proteção geral de ${IMAGE_GLOBAL_REQUEST_GUARD_OUTPUTS} mídias. Revise as seleções ou a quantidade de variações.`)
      return
    }
    if (productType === 'live_action_v2v' && !baseSceneId) {
      window.alert('Selecione um Vídeo Base.')
      return
    }
    if (productType === 'live_audio' && !storylineId) {
      window.alert('Selecione um Enredo de Áudio.')
      return
    }

    try {
      const result = await productionMutation.mutateAsync({
        productType,
        dictionarySelections,
        variations: productType === 'live_action_v2v' ? 1 : variations,
        baseSceneId: productType === 'live_action_v2v' ? baseSceneId : null,
        storylineId: productType === 'live_audio' ? storylineId : null,
        additionalCast: productType === 'live_action_v2v'
          ? additionalActorIds.map((actorProfileId) => actorProfileId
              ? { participantType: 'actor' as const, actorProfileId }
              : { participantType: 'virtual_extra' as const, extraType: 'custom' as const, customDescription: 'participante adulto genérico autorizado para composição' })
          : [],
        notes: notes.trim() || null,
      })
      setResultMessage(result.message)
    } catch (error) {
      window.alert(parseApiError(error))
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Criação de produtos</p>
        <h4 className="mt-1 text-2xl font-black text-white">Linha de montagem de {actorStageName(actor)}</h4>
        <p className="mt-2 text-sm leading-relaxed text-zinc-500">Escolha o produto e defina como ele deve ser criado. A produção seguirá as aprovações e travas deste ator.</p>
      </div>

      {identityLora?.kycApproved && !identityLora.allProductProductionUnlocked && (
        <div className="rounded-[2rem] border border-amber-300/30 bg-amber-300/[0.08] p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border border-amber-300/25 bg-black/25 p-3 text-amber-100">
                <LockKeyhole size={22} />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Preparação da identidade</p>
                <h5 className="mt-1 text-lg font-black text-white">Criação de produtos bloqueada até a identidade ficar pronta</h5>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-zinc-400">{identityBlockMessage}</p>
                {identityLora.latestRun && (
                  <p className="mt-2 text-xs font-bold text-zinc-500">
                    {identityLora.latestRun.statusLabel} • {identityLora.latestRun.imageCount} foto(s) • {identityLora.latestRun.videoCount} vídeo(s)
                  </p>
                )}
                {identityLora.approvedAdapter && (
                  <p className="mt-2 text-xs font-bold text-emerald-100/80">
                    Identidade aprovada para vídeos
                  </p>
                )}
                {datasetReadinessQuery.isLoading ? (
                  <p className="mt-3 text-xs font-bold text-zinc-500">Conferindo o conjunto de identidade...</p>
                ) : datasetReadinessQuery.isError ? (
                  <p className="mt-3 text-xs font-bold text-rose-200">Não foi possível conferir os materiais agora.</p>
                ) : datasetSummary && datasetThresholds ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">Fotos válidas</p>
                      <p className="mt-1 text-lg font-black text-white">{datasetSummary.validUniqueImages}/{datasetThresholds.minimumImages}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">Vídeos válidos</p>
                      <p className="mt-1 text-lg font-black text-white">{datasetSummary.validUniqueVideos}/{datasetThresholds.minimumVideos}</p>
                    </div>
                    <div className="rounded-2xl border border-sky-300/15 bg-sky-300/[0.06] px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-sky-100/65">Aguardando decisão</p>
                      <p className="mt-1 text-lg font-black text-sky-100">{datasetSummary.pendingReviewAssets}</p>
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 ${datasetReady ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10'}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.13em] opacity-65">Materiais do ator</p>
                      <p className="mt-1 text-sm font-black">{materialsComplete ? 'Completos' : 'Ainda incompletos'}</p>
                    </div>
                  </div>
                ) : null}
                {datasetDiagnostics && datasetDiagnostics.summary.actionRequired > 0 && (
                  <div className="mt-3 rounded-2xl border border-amber-300/20 bg-black/25 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-black text-amber-100">Ações necessárias antes de continuar</p>
                        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Apenas situações que exigem decisão, correção ou novo envio aparecem aqui.</p>
                      </div>
                      <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-100">
                        {datasetDiagnostics.summary.actionRequired} ação(ões)
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {datasetDiagnostics.summary.reasons.filter((reason) => reason.requiresAction).slice(0, 5).map((reason) => (
                        <span key={reason.reasonCode} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-zinc-300">
                          {reason.count} × {reason.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {datasetDiagnostics && datasetDiagnostics.summary.actionRequired === 0 && datasetDiagnostics.summary.noActionRequired > 0 && (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                    <p className="text-xs font-black text-zinc-300">Nenhuma ação pendente nos materiais históricos</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Cópias repetidas e versões anteriores estão guardadas, mas não impedem a autorização e a preparação.</p>
                  </div>
                )}
              </div>
            </div>
            {materialsComplete ? (
              <button type="button" onClick={onOpenAuthorization} disabled={!onOpenAuthorization || datasetReadinessQuery.isLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60">
                <ShieldCheck size={17} /> {actor.productionStatus === 'authorized' ? 'Continuar preparação da identidade' : 'Autorizar uso para preparar identidade'}
              </button>
            ) : (
              <button type="button" onClick={onReviewMapping} disabled={!onReviewMapping || datasetReadinessQuery.isLoading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-5 py-3 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-60">
                <ShieldCheck size={17} /> Ver materiais e próximos envios
              </button>
            )}
          </div>
          <div className="mt-4 border-t border-white/10 pt-3 text-[11px] font-semibold leading-relaxed text-zinc-500">
            <p>Os materiais já foram analisados. O sistema conta apenas fotos e vídeos aprovados, diferentes entre si e em boas condições.</p>
            {datasetSummary && (
              <p className="mt-1">Arquivos aprovados: {datasetSummary.approvedMappingAssets}. Fotos e vídeos aproveitados: {datasetSummary.includedVisualAssets}. Arquivos que não entram nesta etapa: {datasetSummary.excludedAssets}.</p>
            )}
            {actor.productionStatus !== 'authorized' && (
              <p className="mt-1 font-black text-amber-100/80">A autorização de uso ainda precisa ser registrada antes de preparar a identidade.</p>
            )}
            <p className="mt-1">Nenhum produto será criado enquanto a identidade não estiver preparada, aprovada e integrada.</p>
          </div>
        </div>
      )}

      {productCreationUnlocked && identityLora?.approvedAdapter && (
        <div className="rounded-[2rem] border border-emerald-300/25 bg-emerald-300/[0.07] p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-emerald-200" size={22} />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Identidade do ator aprovada</p>
              <p className="mt-1 text-sm font-bold text-zinc-300">Criação de produtos liberada para os tipos autorizados.</p>
            </div>
          </div>
        </div>
      )}

      {productCreationUnlocked ? (
        <>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PRODUCT_TYPES.map((item) => {
            const Icon = item.icon
            const active = productType === item.value
            const itemRequiresLora = item.value === 'short_video' || item.value === 'live_action_v2v'
            const itemLocked = Boolean(itemRequiresLora && !identityLora?.videoProductionUnlocked)
            return (
              <button key={item.value} type="button" disabled={itemLocked} title={itemLocked ? 'Identidade para vídeos ainda não aprovada' : undefined} onClick={() => setProductType(item.value)} className={itemLocked ? 'cursor-not-allowed rounded-[1.5rem] border border-white/5 bg-black/15 p-4 text-left text-zinc-700 opacity-60' : active ? 'rounded-[1.5rem] border border-amber-300/35 bg-amber-300 p-4 text-left text-zinc-950' : 'rounded-[1.5rem] border border-white/10 bg-black/25 p-4 text-left text-zinc-300 hover:border-white/25'}>
                <Icon size={20} />
                <span className="mt-3 block text-sm font-black">{item.label}</span>
                <span className={active ? 'mt-1 block text-xs font-semibold text-zinc-800' : 'mt-1 block text-xs font-semibold text-zinc-500'}>{item.helper}</span>
              </button>
            )
          })}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
          {(productType === 'image' || productType === 'short_video') && (
            <div>
              <div className="mb-5">
                <p className="text-sm font-black text-white">{productType === 'image' ? 'Como deseja a imagem?' : 'Como deseja o vídeo?'}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">Escolha cenário, vestimenta, ação, pose, humor e iluminação. Na imagem, você pode marcar 1, várias ou todas as opções em cada categoria para montar vários produtos de uma só vez.</p>
              </div>
              {dictionariesQuery.isError && (
                <div className="mb-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">
                  Não foi possível carregar as opções de criação. Atualize a página e tente novamente.
                </div>
              )}
              {productType === 'image' ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {imageCategoryGroups.map(({ category, items }) => {
                      const selected = selectedByCategory[category] || []
                      const disabled = dictionariesQuery.isLoading || dictionariesQuery.isError || items.length === 0
                      const allSelected = items.length > 0 && selected.length === items.length
                      return (
                        <div key={category} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{CATEGORY_LABELS[category] || category}</p>
                              <p className="mt-1 text-[11px] font-semibold text-zinc-500">{selectedCountByCategory[category] || 0} selecionada(s)</p>
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={() => selectAllImageCategory(category, items.map((item) => item.id))} disabled={disabled || allSelected} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40">Todos</button>
                              <button type="button" onClick={() => clearImageCategory(category)} disabled={disabled || selected.length === 0} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-300 disabled:cursor-not-allowed disabled:opacity-40">Limpar</button>
                            </div>
                          </div>
                          <div className="mt-3 space-y-2">
                            {disabled && (
                              <div className="rounded-2xl border border-dashed border-white/10 bg-black/15 px-4 py-3 text-xs font-bold text-zinc-500">
                                {dictionariesQuery.isLoading ? 'Carregando opções...' : dictionariesQuery.isError ? 'Erro ao carregar' : 'Sem opções ativas'}
                              </div>
                            )}
                            {!disabled && items.map((item) => {
                              const checked = selected.includes(item.id)
                              return (
                                <label key={item.id} className={checked ? 'flex cursor-pointer items-center gap-3 rounded-2xl border border-amber-300/35 bg-amber-300/[0.08] px-4 py-3 text-sm font-bold text-white' : 'flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm font-bold text-zinc-200 hover:border-white/20'}>
                                  <input type="checkbox" checked={checked} onChange={() => toggleImageSelection(category, item.id)} className="h-4 w-4 accent-amber-300" />
                                  <span>{item.label}</span>
                                </label>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Produtos base</p>
                        <p className="mt-1 text-2xl font-black text-white">{imageBaseProductCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Variações por produto</p>
                        <p className="mt-1 text-2xl font-black text-white">{variations}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Mídias estimadas</p>
                        <p className="mt-1 text-2xl font-black text-white">{estimatedOutputCount || 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Etapas internas</p>
                        <p className="mt-1 text-2xl font-black text-white">{estimatedInternalStageCount || 0}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-zinc-500">O sistema cruza automaticamente as escolhas e organiza a solicitação em etapas internas de até {internalStageProductCapacity} produto(s), respeitando até {IMAGE_INTERNAL_STAGE_MAX_OUTPUTS} mídias por etapa. As etapas seguintes ficam na fila de espera sem exigir nova ação do Admin.</p>
                  </div>
                </>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {imageCategoryGroups.map(({ category, items }) => (
                    <label key={category} className="block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">{CATEGORY_LABELS[category] || category}</span>
                      <select
                        value={selectedByCategory[category]?.[0] || ''}
                        onChange={(event) => setSelectedByCategory((current) => ({ ...current, [category]: event.target.value ? [event.target.value] : [] }))}
                        disabled={dictionariesQuery.isLoading || dictionariesQuery.isError || items.length === 0}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">{dictionariesQuery.isLoading ? 'Carregando...' : items.length === 0 ? 'Sem opções ativas' : 'Selecione'}</option>
                        {items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    </label>
                  ))}
                </div>
              )}
              {!dictionariesQuery.isLoading && !dictionariesQuery.isError && missingImageCategories.length > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-50">
                  A Biblioteca de criação ainda precisa de opções para: {missingImageCategories.map((category) => CATEGORY_LABELS[category] || category).join(', ')}. O envio permanece bloqueado até a configuração ficar completa.
                </div>
              )}
              {!dictionariesQuery.isLoading && !dictionariesQuery.isError && isImageProduct && estimatedInternalStageCount > 1 && !imageGlobalProductGuardExceeded && !imageGlobalOutputGuardExceeded && (
                <div className="mt-4 rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4 text-sm font-bold text-sky-50">
                  Esta solicitação será organizada automaticamente em {estimatedInternalStageCount} etapas internas. Você acompanhará uma única produção; os blocos técnicos permanecerão ocultos.
                </div>
              )}
              {!dictionariesQuery.isLoading && !dictionariesQuery.isError && isImageProduct && (imageGlobalProductGuardExceeded || imageGlobalOutputGuardExceeded) && (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">
                  {imageGlobalProductGuardExceeded ? `A solicitação ultrapassa a proteção geral de ${IMAGE_GLOBAL_REQUEST_GUARD_PRODUCTS} produtos base.` : `A solicitação ultrapassa a proteção geral de ${IMAGE_GLOBAL_REQUEST_GUARD_OUTPUTS} mídias.`} Revise as seleções antes de continuar.
                </div>
              )}
            </div>
          )}

          {productType === 'live_action_v2v' && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Vídeo Base</span>
                <select value={baseSceneId} onChange={(event) => setBaseSceneId(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none">
                  <option value="">Selecione uma cena</option>
                  {readyScenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.title} • {scene.sceneType || 'sem classificação'} • {scene.slotsCount} pessoa(s)</option>)}
                </select>
              </label>
              {Array.from({ length: extraSlots }, (_, index) => (
                <label key={index} className="block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Participante {index + 2}</span>
                  <select value={additionalActorIds[index] || ''} onChange={(event) => setAdditionalActorIds((current) => current.map((value, itemIndex) => itemIndex === index ? event.target.value : value))} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none">
                    <option value="">Extra virtual adulto</option>
                    {candidates.map((candidate) => <option key={candidate.actorProfileId} value={candidate.actorProfileId}>{candidate.displayName}</option>)}
                  </select>
                </label>
              ))}
            </div>
          )}

          {productType === 'live_audio' && (
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Enredo e tom de voz</span>
              <select value={storylineId} onChange={(event) => setStorylineId(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-bold text-white outline-none">
                <option value="">Selecione um enredo</option>
                {activeStorylines.map((item) => <option key={item.id} value={item.id}>{item.title} • {item.voiceTone}</option>)}
              </select>
            </label>
          )}

          <div className="mt-5 grid gap-4 md:grid-cols-[220px_1fr]">
            {productType !== 'live_action_v2v' && (
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Quantidade de Variações</span>
                <input type="number" min={1} max={20} value={variations} onChange={(event) => setVariations(Math.min(Math.max(Number(event.target.value || 1), 1), 20))} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-black text-white outline-none" />
              </label>
            )}
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Direção complementar</span>
              <input value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white outline-none" placeholder="Opcional: enquadramento, ritmo, intenção narrativa..." />
            </label>
          </div>
        </div>

        {resultMessage && <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-50">{resultMessage}</div>}
        <button type="button" onClick={() => void handleSubmit()} disabled={productionMutation.isPending || submitLocked} title={submitLockMessage} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
          {productionMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : submitLocked ? <LockKeyhole size={18} /> : <Send size={18} />}
          {productionMutation.isPending ? 'Enviando...' : submitLocked ? submitLockMessage : isImageProduct && imageBaseProductCount > 1 ? `Enviar ${imageBaseProductCount} produtos para produção` : 'Enviar para Produção'}
        </button>
        </>
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-6 text-center">
          <LockKeyhole className="mx-auto text-amber-100" size={28} />
          <h5 className="mt-3 text-lg font-black text-white">Produtos ainda não podem ser montados</h5>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">Primeiro conclua a autorização, o registro do conjunto, o treinamento, a revisão e a integração da identidade. Depois disso, Imagem, Vídeo Curto, Live Action e Live Audio serão liberados.</p>
        </div>
      )}
    </section>
  )
}

export function ActorExclusiveReviewTab({ actor }: { actor: ActorProfile }) {
  const productsQuery = useActorPipelineReviewProducts(actor.id)
  const approveMutation = useApproveActorPipelineProduct(actor.id)
  const rejectMutation = useRejectActorPipelineProduct(actor.id)
  const items = productsQuery.data?.items || []

  async function approve(asset: ActorPipelineProduct) {
    try {
      await approveMutation.mutateAsync({ assetId: asset.id, notes: `Aprovado na Revisão de qualidade de ${actorStageName(actor)}.` })
    } catch (error) {
      window.alert(parseApiError(error))
    }
  }

  async function reject(asset: ActorPipelineProduct) {
    const reason = window.prompt('Informe o motivo do descarte/rejeição:')?.trim()
    if (!reason) return
    try {
      await rejectMutation.mutateAsync({ assetId: asset.id, reason })
    } catch (error) {
      window.alert(parseApiError(error))
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Revisão de qualidade</p>
        <h4 className="mt-1 text-2xl font-black text-white">Produtos aguardando revisão de {actorStageName(actor)}</h4>
        <p className="mt-2 text-sm text-zinc-500">Aqui aparecem apenas os produtos deste ator que aguardam uma decisão de qualidade.</p>
      </div>
      {productsQuery.isLoading && <PipelineEmpty icon={Clock3} title="Carregando produtos pendentes..." />}
      {productsQuery.isError && <PipelineError error={productsQuery.error} />}
      {!productsQuery.isLoading && !productsQuery.isError && items.length === 0 && <PipelineEmpty icon={CheckCircle2} title="Nenhum produto aguardando revisão." helper="Novas saídas da Linha de Montagem aparecerão aqui automaticamente." />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((asset) => (
          <article key={asset.id} className="rounded-[2rem] border border-white/10 bg-black/25 p-4">
            <PipelineMedia asset={asset} />
            <h5 className="mt-4 line-clamp-2 text-base font-black text-white">{productTitle(asset)}</h5>
            <p className="mt-1 text-xs font-bold text-zinc-500">{mediaLabel(asset.mediaType)} • Variação {asset.variantNumber || 1}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => void approve(asset)} disabled={approveMutation.isPending || rejectMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white hover:bg-emerald-400 disabled:opacity-50"><CheckCircle2 size={16} />Aprovar</button>
              <button type="button" onClick={() => void reject(asset)} disabled={approveMutation.isPending || rejectMutation.isPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500 disabled:opacity-50"><Trash2 size={16} />Rejeitar</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

type SplitDraft = {
  actor1Percent: string
  actor1Storefront: boolean
  actor2Id: string
  actor2Percent: string
  actor2Storefront: boolean
  companyId: string
  companyPercent: string
  companyStorefront: boolean
}

const INITIAL_SPLIT: SplitDraft = {
  actor1Percent: '50',
  actor1Storefront: true,
  actor2Id: '',
  actor2Percent: '0',
  actor2Storefront: false,
  companyId: '',
  companyPercent: '0',
  companyStorefront: false,
}

export function ActorPublicationStorefrontTab({ actor }: { actor: ActorProfile }) {
  const productsQuery = useActorPipelinePublicationProducts(actor.id)
  const beneficiariesQuery = useSplitBeneficiaries()
  const publishMutation = usePublishActorPipelineProduct(actor.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [destination, setDestination] = useState<ActorPipelineDestination>('premium')
  const [price, setPrice] = useState('')
  const [description, setDescription] = useState('')
  const [split, setSplit] = useState<SplitDraft>(INITIAL_SPLIT)
  const items = productsQuery.data?.items || []
  const selected = items.find((item) => item.id === selectedId) || null
  const beneficiaries = beneficiariesQuery.data?.items || []
  const actors = beneficiaries.filter((item) => item.type === 'actor' && item.id !== actor.id && item.active)
  const companies = beneficiaries.filter((item) => item.type === 'company' && item.active)

  useEffect(() => {
    if (selectedId && !items.some((item) => item.id === selectedId)) setSelectedId(null)
  }, [items, selectedId])

  useEffect(() => {
    if (!selected) return
    setPrice(String(selected.price?.credits || selected.combination?.priceCredits || ''))
    setDescription(selected.combination?.title || '')
    const existing = selected.splits?.items || []
    const actor1 = existing.find((item) => item.beneficiaryType === 'actor' && item.beneficiaryId === actor.id)
    const actor2 = existing.find((item) => item.beneficiaryType === 'actor' && item.beneficiaryId !== actor.id)
    const company = existing.find((item) => item.beneficiaryType === 'company')
    setSplit({
      actor1Percent: String(actor1?.splitPercentage ?? 50),
      actor1Storefront: actor1?.displayOnStorefront ?? true,
      actor2Id: actor2?.beneficiaryId || '',
      actor2Percent: String(actor2?.splitPercentage ?? 0),
      actor2Storefront: actor2?.displayOnStorefront ?? false,
      companyId: company?.beneficiaryId || '',
      companyPercent: String(company?.splitPercentage ?? 0),
      companyStorefront: company?.displayOnStorefront ?? false,
    })
  }, [selected?.id, actor.id])

  async function publish() {
    if (!selected) return
    const priceCredits = Number(price)
    if (!Number.isInteger(priceCredits) || priceCredits < 1) return window.alert('Informe um preço inteiro positivo.')
    if (description.trim().length < 3) return window.alert('Informe uma descrição para a vitrine.')

    const splits: ActorPipelinePublicationPayload['splits'] = [{
      beneficiaryId: actor.id,
      beneficiaryType: 'actor' as const,
      splitPercentage: Number(split.actor1Percent || 0),
      displayOnStorefront: split.actor1Storefront,
      sortOrder: 0,
    }]
    if (split.actor2Id && Number(split.actor2Percent || 0) > 0) splits.push({ beneficiaryId: split.actor2Id, beneficiaryType: 'actor' as const, splitPercentage: Number(split.actor2Percent), displayOnStorefront: split.actor2Storefront, sortOrder: 1 })
    if (split.companyId && Number(split.companyPercent || 0) > 0) splits.push({ beneficiaryId: split.companyId, beneficiaryType: 'company' as const, splitPercentage: Number(split.companyPercent), displayOnStorefront: split.companyStorefront, sortOrder: 2 })
    const total = splits.reduce((sum, item) => sum + item.splitPercentage, 0)
    if (total > 100) return window.alert('A soma dos repasses não pode ultrapassar 100%.')

    try {
      await publishMutation.mutateAsync({ assetId: selected.id, payload: { destination, priceCredits, description: description.trim(), splits } })
      setSelectedId(null)
      window.alert('Produto publicado com sucesso.')
    } catch (error) {
      window.alert(parseApiError(error))
    }
  }

  return (
    <section className="space-y-5">
      <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Publicação & Vitrine</p>
        <h4 className="mt-1 text-2xl font-black text-white">Split financeiro e vitrine seletiva</h4>
        <p className="mt-2 text-sm text-zinc-500">Somente produtos aprovados e ainda ocultos são exibidos. A publicação mantém o storage privado e libera o produto pelos contratos existentes.</p>
      </div>
      {productsQuery.isLoading && <PipelineEmpty icon={Clock3} title="Carregando produtos aprovados..." />}
      {productsQuery.isError && <PipelineError error={productsQuery.error} />}
      {!productsQuery.isLoading && !productsQuery.isError && items.length === 0 && <PipelineEmpty icon={Store} title="Nenhum produto aguardando publicação." helper="Aprove um item na Revisão de qualidade para que ele apareça aqui." />}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,.9fr)_minmax(420px,1.1fr)]">
        <div className="space-y-3">
          {items.map((asset) => (
            <button key={asset.id} type="button" onClick={() => setSelectedId(asset.id)} className={selectedId === asset.id ? 'w-full rounded-[1.5rem] border border-amber-300/35 bg-amber-300/10 p-3 text-left' : 'w-full rounded-[1.5rem] border border-white/10 bg-black/25 p-3 text-left hover:border-white/25'}>
              <div className="grid grid-cols-[120px_1fr] gap-3">
                <PipelineMedia asset={asset} />
                <div className="min-w-0 py-1">
                  <p className="line-clamp-2 text-sm font-black text-white">{productTitle(asset)}</p>
                  <p className="mt-2 text-xs font-bold text-zinc-500">{mediaLabel(asset.mediaType)} • Aprovado</p>
                  <p className="mt-2 text-xs text-zinc-600">Clique para definir destino, preço, descrição e repasses.</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
          {!selected && <PipelineEmpty icon={Store} title="Selecione um produto aprovado." helper="O formulário comercial será aberto sem sair do modal do ator." />}
          {selected && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Produto selecionado</p>
                <h5 className="mt-1 text-xl font-black text-white">{productTitle(selected)}</h5>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {DESTINATIONS.map((item) => (
                  <button key={item.value} type="button" onClick={() => setDestination(item.value)} className={destination === item.value ? 'rounded-2xl border border-amber-300/35 bg-amber-300 p-3 text-left text-zinc-950' : 'rounded-2xl border border-white/10 bg-black/30 p-3 text-left text-zinc-300'}>
                    <span className="block text-sm font-black">{item.label}</span>
                    <span className={destination === item.value ? 'mt-1 block text-[11px] font-semibold text-zinc-800' : 'mt-1 block text-[11px] font-semibold text-zinc-500'}>{item.helper}</span>
                  </button>
                ))}
              </div>
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Preço</span>
                  <input value={price} onChange={(event) => setPrice(event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-black text-white outline-none" placeholder="Créditos" />
                </label>
                <label>
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Descrição</span>
                  <input value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm font-semibold text-white outline-none" placeholder="Descrição pública do produto" />
                </label>
              </div>

              <div className="rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <div className="flex items-center gap-2"><Users size={17} className="text-amber-100" /><h6 className="text-sm font-black text-white">Repasse triplo</h6></div>
                <p className="mt-1 text-xs text-zinc-500">A plataforma recebe automaticamente o percentual restante até 100%.</p>
                <div className="mt-4 space-y-3">
                  <SplitRow title="Ator 1" subtitle={actorStageName(actor)} percent={split.actor1Percent} onPercent={(value) => setSplit((current) => ({ ...current, actor1Percent: value }))} checked={split.actor1Storefront} onChecked={(value) => setSplit((current) => ({ ...current, actor1Storefront: value }))} />
                  <SelectableSplitRow title="Ator 2" value={split.actor2Id} options={actors.map((item) => ({ id: item.id, label: item.name }))} onSelect={(value) => setSplit((current) => ({ ...current, actor2Id: value }))} percent={split.actor2Percent} onPercent={(value) => setSplit((current) => ({ ...current, actor2Percent: value }))} checked={split.actor2Storefront} onChecked={(value) => setSplit((current) => ({ ...current, actor2Storefront: value }))} />
                  <SelectableSplitRow title="Empresa" value={split.companyId} options={companies.map((item) => ({ id: item.id, label: item.name }))} onSelect={(value) => setSplit((current) => ({ ...current, companyId: value }))} percent={split.companyPercent} onPercent={(value) => setSplit((current) => ({ ...current, companyPercent: value }))} checked={split.companyStorefront} onChecked={(value) => setSplit((current) => ({ ...current, companyStorefront: value }))} />
                </div>
              </div>

              <button type="button" onClick={() => void publish()} disabled={publishMutation.isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-950 hover:bg-amber-200 disabled:opacity-50">
                {publishMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Store size={18} />}
                {publishMutation.isPending ? 'Publicando...' : 'Publicar Produto'}
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function SplitRow({ title, subtitle, percent, onPercent, checked, onChecked }: { title: string; subtitle: string; percent: string; onPercent: (value: string) => void; checked: boolean; onChecked: (value: boolean) => void }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 md:grid-cols-[1fr_110px_220px] md:items-center">
      <div><p className="text-sm font-black text-white">{title}</p><p className="mt-1 text-xs text-zinc-500">{subtitle}</p></div>
      <div className="flex items-center gap-2"><input value={percent} onChange={(event) => onPercent(event.target.value.replace(/[^0-9.]/g, ''))} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-black text-white" /><span className="text-xs font-black text-zinc-500">%</span></div>
      <label className="flex items-center gap-2 text-xs font-black text-zinc-300"><input type="checkbox" checked={checked} onChange={(event) => onChecked(event.target.checked)} className="size-4 accent-amber-300" />Exibir na Vitrine Deste Ator</label>
    </div>
  )
}

function SelectableSplitRow({ title, value, options, onSelect, percent, onPercent, checked, onChecked }: { title: string; value: string; options: Array<{ id: string; label: string }>; onSelect: (value: string) => void; percent: string; onPercent: (value: string) => void; checked: boolean; onChecked: (value: boolean) => void }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/35 p-3 md:grid-cols-[1fr_110px_220px] md:items-center">
      <label><span className="text-xs font-black text-zinc-500">{title}</span><select value={value} onChange={(event) => onSelect(event.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-bold text-white"><option value="">Não definido</option>{options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <div className="flex items-center gap-2"><input value={percent} onChange={(event) => onPercent(event.target.value.replace(/[^0-9.]/g, ''))} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-sm font-black text-white" /><span className="text-xs font-black text-zinc-500">%</span></div>
      <label className="flex items-center gap-2 text-xs font-black text-zinc-300"><input type="checkbox" checked={checked} disabled={!value} onChange={(event) => onChecked(event.target.checked)} className="size-4 accent-amber-300" />Exibir na Vitrine Deste Ator</label>
    </div>
  )
}

function PipelineEmpty({ icon: Icon, title, helper }: { icon: typeof Store; title: string; helper?: string }) {
  return <div className="rounded-[2rem] border border-dashed border-white/10 bg-black/20 p-8 text-center"><Icon className="mx-auto text-zinc-700" size={28} /><p className="mt-3 text-sm font-black text-zinc-300">{title}</p>{helper && <p className="mt-2 text-xs text-zinc-600">{helper}</p>}</div>
}

function PipelineError({ error }: { error: unknown }) {
  return <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm font-bold text-rose-100">{parseApiError(error)}</div>
}
