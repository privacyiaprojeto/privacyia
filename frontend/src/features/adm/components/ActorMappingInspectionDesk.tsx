import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Crop,
  Eye,
  FileAudio,
  FileImage,
  Loader2,
  Tags,
  Video,
  X,
  XCircle,
} from 'lucide-react'
import {
  fetchKycAssetPrivateBlob,
  type ActorProfile,
  type CreateKycAssetEditedCopyPayload,
  type KycAsset,
} from '@/features/adm/api/actorComplianceApi'
import {
  MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS,
  type MappingRequirement,
} from '@/features/adm/api/mappingRequirementsApi'
import {
  useActorKycCases,
  useApproveKycAsset,
  useApproveKycCase,
  useCreateKycAssetEditedCopy,
  useKycCase,
  useReclassifyKycAsset,
  useRejectKycAsset,
  useRejectKycCase,
} from '@/features/adm/hooks/useActorCompliance'
import { useMappingRequirements } from '@/features/adm/hooks/useMappingRequirements'
import { useActorIdentityDatasetReadiness } from '@/features/adm/hooks/useActorPipeline'
import { parseApiError } from '@/shared/utils/parseApiError'
import { ActorSafeImageEditor } from '@/features/adm/components/ActorSafeImageEditor'

type InspectionTone = 'blue' | 'emerald' | 'rose' | 'zinc'

interface InspectionStatus {
  label: string
  tone: InspectionTone
}

interface InspectionRow {
  rowKey: string
  requirement: MappingRequirement
  asset: KycAsset | null
  assetCount: number
  status: InspectionStatus
  classificationRequired: boolean
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function systemTagLabel(requirement: MappingRequirement) {
  if (!requirement.systemTag) return 'Finalidade não classificada'
  const option = MAPPING_REQUIREMENT_SYSTEM_TAG_OPTIONS.find((item) => item.value === requirement.systemTag)
  return option?.label || 'Finalidade cadastrada'
}

function mappingCaseStatusLabel(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  const labels: Record<string, string> = {
    approved: 'Aprovado',
    rejected: 'Ajustes solicitados',
    pending_review: 'Aguardando revisão',
    not_started: 'Não iniciado',
    draft: 'Em preparação',
  }
  return labels[normalized] || 'Não iniciado'
}

function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function mappingReviewState(kycCase: { status?: string | null; metadata?: Record<string, unknown> } | null) {
  if (!kycCase) return 'not_started'
  const metadata = asPlainRecord(kycCase.metadata)
  const actorSubmission = asPlainRecord(metadata.actorSubmission)
  const adminReview = asPlainRecord(metadata.adminReview)
  if (kycCase.status === 'approved' || adminReview.status === 'approved') return 'approved'
  if (kycCase.status === 'rejected' || adminReview.status === 'changes_requested' || actorSubmission.status === 'changes_requested') return 'changes_requested'
  if (actorSubmission.status === 'changes_in_progress') return 'changes_in_progress'
  if (metadata.actorSubmittedForReview === true || actorSubmission.status === 'sent_for_admin_review' || actorSubmission.sentForReviewAt) return 'sent_for_review'
  return kycCase.status === 'draft' ? 'draft' : 'in_progress'
}

function inspectionStatus(asset: KycAsset | null): InspectionStatus {
  if (!asset) return { label: 'Não enviado', tone: 'zinc' }

  const status = String(asset.status || '').toLowerCase()
  if (status === 'approved') return { label: 'Aprovado', tone: 'emerald' }
  if (status === 'rejected') return { label: 'Ajuste solicitado', tone: 'rose' }
  return { label: 'Em análise', tone: 'blue' }
}

function toneClasses(tone: InspectionTone) {
  if (tone === 'emerald') return 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
  if (tone === 'rose') return 'border-rose-300/25 bg-rose-300/10 text-rose-100'
  if (tone === 'blue') return 'border-sky-300/25 bg-sky-300/10 text-sky-100'
  return 'border-white/10 bg-white/[0.035] text-zinc-300'
}


function datasetDiagnosticClasses(tone?: string) {
  if (tone === 'success') return 'border-emerald-300/20 bg-emerald-300/[0.08] text-emerald-100'
  if (tone === 'danger') return 'border-rose-300/20 bg-rose-300/[0.08] text-rose-100'
  if (tone === 'warning') return 'border-amber-300/20 bg-amber-300/[0.08] text-amber-100'
  if (tone === 'info') return 'border-sky-300/20 bg-sky-300/[0.08] text-sky-100'
  return 'border-white/10 bg-white/[0.035] text-zinc-300'
}

function MediaTypeIcon({ requirement }: { requirement: MappingRequirement }) {
  if (requirement.mediaType === 'audio') return <FileAudio size={18} />
  if (requirement.mediaType === 'video') return <Video size={18} />
  return <FileImage size={18} />
}

function PreviewMedia({ url, contentType, requirement }: { url: string; contentType: string; requirement: MappingRequirement }) {
  const normalized = String(contentType || '').toLowerCase()
  if (normalized.startsWith('video/') || requirement.mediaType === 'video') {
    return <video src={url} controls playsInline className="max-h-[56vh] w-full rounded-2xl bg-black object-contain" />
  }
  if (normalized.startsWith('audio/') || requirement.mediaType === 'audio') {
    return (
      <div className="flex min-h-48 items-center justify-center rounded-2xl border border-white/10 bg-black/35 p-6">
        <audio src={url} controls className="w-full" />
      </div>
    )
  }
  return <img src={url} alt={requirement.title} className="max-h-[56vh] w-full rounded-2xl bg-black object-contain" />
}

export function ActorMappingInspectionDesk({
  actor,
  onProceedToIdentity,
}: {
  actor: ActorProfile
  onProceedToIdentity?: () => void
}) {
  const casesQuery = useActorKycCases(actor.id)
  const requirementsQuery = useMappingRequirements(true)
  const cases = casesQuery.data?.items || []
  const latestCase = cases[0] || null
  const caseQuery = useKycCase(latestCase?.id)
  const datasetReadinessQuery = useActorIdentityDatasetReadiness(actor.id)
  const caseDetail = caseQuery.data || latestCase
  const assets = caseQuery.data?.assets || []
  const allRequirements = requirementsQuery.data?.items || []
  const activeRequirements = allRequirements.filter((requirement) => requirement.isActive)
  const activeRequirementById = new Map(activeRequirements.map((requirement) => [requirement.id, requirement]))

  const approveAssetMutation = useApproveKycAsset()
  const rejectAssetMutation = useRejectKycAsset()
  const createEditedCopyMutation = useCreateKycAssetEditedCopy()
  const reclassifyAssetMutation = useReclassifyKycAsset()
  const approveCaseMutation = useApproveKycCase()
  const rejectCaseMutation = useRejectKycCase()

  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewContentType, setPreviewContentType] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [caseRejectMode, setCaseRejectMode] = useState(false)
  const [caseRejectionReason, setCaseRejectionReason] = useState('')
  const [imageEditorOpen, setImageEditorOpen] = useState(false)
  const [classificationRequirementId, setClassificationRequirementId] = useState('')

  useEffect(() => () => {
    if (previewUrl) window.URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const rows = useMemo<InspectionRow[]>(() => {
    const requirements = allRequirements.filter((requirement) => (
      requirement.isActive
      || assets.some((asset) => asset.mappingRequirementId === requirement.id && asset.status !== 'archived')
    ))

    const requirementRows = requirements.flatMap((requirement) => {
      const requirementAssets = assets
        .filter((asset) => asset.mappingRequirementId === requirement.id && asset.status !== 'archived')
        .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))

      if (requirementAssets.length === 0) {
        if (!requirement.isActive) return []
        return [{
          rowKey: `missing:${requirement.id}`,
          requirement,
          asset: null,
          assetCount: 0,
          status: inspectionStatus(null),
          classificationRequired: false,
        }]
      }

      return requirementAssets.map((asset) => ({
        rowKey: asset.id,
        requirement,
        asset,
        assetCount: requirementAssets.length,
        status: inspectionStatus(asset),
        classificationRequired: !requirement.isActive,
      }))
    })

    const knownRequirementIds = new Set(allRequirements.map((requirement) => requirement.id))
    const orphanRows = assets
      .filter((asset) => asset.status !== 'archived' && (!asset.mappingRequirementId || !knownRequirementIds.has(asset.mappingRequirementId)))
      .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))
      .map((asset) => {
        const mediaType = String(asset.contentType || '').toLowerCase().startsWith('video/')
          ? 'video'
          : String(asset.contentType || '').toLowerCase().startsWith('audio/')
            ? 'audio'
            : 'image'
        const requirement: MappingRequirement = {
          id: `unclassified:${asset.id}`,
          title: 'Arquivo sem categoria válida',
          description: 'Este arquivo foi recebido, mas precisa ser classificado antes da decisão.',
          guidance: 'Abra o arquivo, confira o conteúdo e vincule-o à categoria correta do mesmo mapeamento.',
          mediaType,
          systemTag: null,
          isRequired: false,
          isActive: false,
          acceptedMimeTypes: [],
          accept: '',
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        }
        return {
          rowKey: asset.id,
          requirement,
          asset,
          assetCount: 1,
          status: inspectionStatus(asset),
          classificationRequired: true,
        }
      })

    return [...requirementRows, ...orphanRows]
  }, [assets, allRequirements])

  const selectedRow = rows.find((row) => row.asset?.id === selectedAssetId) || null
  const selectedIsImage = Boolean(selectedRow && (selectedRow.requirement.mediaType === 'image' || String(previewContentType || selectedRow.asset?.contentType || '').toLowerCase().startsWith('image/')))
  const requiredRequirements = activeRequirements.filter((requirement) => requirement.isRequired)
  const activeAssets = assets.filter((asset) => !['archived', 'deleted', 'quarantined'].includes(String(asset.status || '').toLowerCase()))
  const allRequiredApproved = requiredRequirements.length > 0 && requiredRequirements.every((requirement) => activeAssets.some((asset) => asset.mappingRequirementId === requirement.id && asset.status === 'approved'))
  const reviewState = mappingReviewState(caseDetail || latestCase)
  const caseMetadata = asPlainRecord(caseDetail?.metadata || latestCase?.metadata)
  const supplementalReview = asPlainRecord(caseMetadata.identityDatasetSupplement)
  const supplementalReviewStatus = String(supplementalReview.status || '').toLowerCase()
  const changesRequested = ['changes_requested', 'changes_in_progress'].includes(reviewState)
  const receivedCount = activeAssets.length
  const approvedCount = activeAssets.filter((asset) => asset.status === 'approved').length
  const analysisCount = activeAssets.filter((asset) => asset.status === 'pending_review').length
  const rejectedCount = activeAssets.filter((asset) => asset.status === 'rejected').length
  const unclassifiedCount = activeAssets.filter((asset) => !asset.mappingRequirementId || !activeRequirementById.has(asset.mappingRequirementId)).length
  const notSentCount = activeRequirements.filter((requirement) => !activeAssets.some((asset) => asset.mappingRequirementId === requirement.id)).length
  const caseSubmittedForReview = reviewState === 'sent_for_review'
    || ['sent_for_admin_review', 'in_progress'].includes(supplementalReviewStatus)
    || (caseDetail?.status === 'approved' && analysisCount > 0)
  const initialCaseCanClose = caseDetail?.status !== 'approved' && analysisCount === 0
  const datasetSummary = datasetReadinessQuery.data?.summary
  const datasetThresholds = datasetReadinessQuery.data?.thresholds
  const datasetCoverage = datasetReadinessQuery.data?.coverage
  const datasetDiagnostics = datasetReadinessQuery.data?.diagnostics
  const diagnosticByAssetId = useMemo(
    () => new Map((datasetDiagnostics?.assets || []).map((item) => [item.assetId, item] as const)),
    [datasetDiagnostics?.assets],
  )
  const selectedDiagnostic = selectedAssetId ? diagnosticByAssetId.get(selectedAssetId) || null : null
  const identityMaterialsReady = Boolean(
    datasetSummary
    && datasetThresholds
    && datasetSummary.validUniqueImages >= datasetThresholds.minimumImages
    && datasetSummary.validUniqueVideos >= datasetThresholds.minimumVideos
    && datasetSummary.pendingReviewAssets === 0
    && (datasetCoverage?.missingImageTags?.length || 0) === 0
    && (datasetCoverage?.missingVideoTags?.length || 0) === 0
  )

  const activeError = casesQuery.error
    || requirementsQuery.error
    || caseQuery.error
    || approveAssetMutation.error
    || rejectAssetMutation.error
    || createEditedCopyMutation.error
    || reclassifyAssetMutation.error
    || approveCaseMutation.error
    || rejectCaseMutation.error

  function closePreview() {
    setSelectedAssetId(null)
    setPreviewUrl(null)
    setPreviewContentType('')
    setPreviewError('')
    setRejectMode(false)
    setRejectionReason('')
    setImageEditorOpen(false)
    setClassificationRequirementId('')
  }

  async function openInspection(row: InspectionRow) {
    if (!row.asset) return
    if (row.asset.status === 'registered_dry_run') {
      window.alert('Este registro é apenas uma simulação e não possui mídia real para inspecionar.')
      return
    }

    setSelectedAssetId(row.asset.id)
    setPreviewLoading(true)
    setPreviewError('')
    setRejectMode(false)
    setRejectionReason('')
    setImageEditorOpen(false)
    setClassificationRequirementId('')
    setPreviewUrl(null)

    try {
      const result = await fetchKycAssetPrivateBlob(row.asset.id, false)
      setPreviewContentType(result.contentType || row.asset.contentType || '')
      setPreviewUrl(window.URL.createObjectURL(result.blob))
    } catch (error) {
      setPreviewError(parseApiError(error))
    } finally {
      setPreviewLoading(false)
    }
  }

  async function classifySelectedAsset() {
    if (!selectedRow?.asset || !selectedRow.classificationRequired || !classificationRequirementId) return
    await reclassifyAssetMutation.mutateAsync({
      assetId: selectedRow.asset.id,
      mappingRequirementId: classificationRequirementId,
      note: `Categoria corrigida durante a análise nominal de ${actor.displayName}.`,
    })
    closePreview()
  }

  async function approveSelectedAsset() {
    if (!selectedRow?.asset || !caseSubmittedForReview) return
    await approveAssetMutation.mutateAsync({
      assetId: selectedRow.asset.id,
      note: `Aprovado na mesa nominal de ${actor.displayName}.`,
    })
    closePreview()
  }

  async function rejectSelectedAsset() {
    if (!selectedRow?.asset || !rejectionReason.trim() || !caseSubmittedForReview) return
    await rejectAssetMutation.mutateAsync({
      assetId: selectedRow.asset.id,
      reason: rejectionReason.trim(),
    })
    closePreview()
  }

  async function saveEditedCopy(payload: CreateKycAssetEditedCopyPayload) {
    if (!selectedRow?.asset || !selectedIsImage || !caseSubmittedForReview) return
    await createEditedCopyMutation.mutateAsync({
      assetId: selectedRow.asset.id,
      payload,
    })
    setImageEditorOpen(false)
    closePreview()
  }

  async function approveWholeCase() {
    if (!latestCase?.id || !allRequiredApproved || !caseSubmittedForReview || !initialCaseCanClose) return
    await approveCaseMutation.mutateAsync({
      kycCaseId: latestCase.id,
      note: 'Aprovação final após inspeção nominal dos requisitos obrigatórios.',
    })
  }

  async function rejectWholeCase() {
    if (!latestCase?.id || !caseRejectionReason.trim() || !caseSubmittedForReview) return
    await rejectCaseMutation.mutateAsync({
      kycCaseId: latestCase.id,
      reason: caseRejectionReason.trim(),
    })
    setCaseRejectMode(false)
    setCaseRejectionReason('')
  }

  const isLoading = casesQuery.isLoading || requirementsQuery.isLoading || Boolean(latestCase?.id && caseQuery.isLoading)
  const itemDecisionPending = approveAssetMutation.isPending || rejectAssetMutation.isPending || createEditedCopyMutation.isPending || reclassifyAssetMutation.isPending
  const caseDecisionPending = approveCaseMutation.isPending || rejectCaseMutation.isPending

  return (
    <section className="space-y-4">
      <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Revisão do mapeamento</p>
          <h4 className="mt-1 text-2xl font-black text-white">Mapeamento de {actor.displayName}</h4>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Cada arquivo enviado aparece em uma linha própria. Assim, várias fotos ou vídeos da mesma categoria podem ser analisados individualmente sem ocultar versões anteriores.
          </p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs text-zinc-500">Categorias ativas</p><p className="mt-1 text-xl font-black text-white">{activeRequirements.length}</p></div>
          <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs text-zinc-500">Arquivos recebidos</p><p className="mt-1 text-xl font-black text-white">{receivedCount}</p></div>
          <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-3"><p className="text-xs text-sky-100/70">Aguardando decisão</p><p className="mt-1 text-xl font-black text-sky-100">{analysisCount}</p></div>
          <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3"><p className="text-xs text-emerald-100/70">Aprovados</p><p className="mt-1 text-xl font-black text-emerald-100">{approvedCount}</p></div>
          <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-3"><p className="text-xs text-rose-100/70">Substituição solicitada</p><p className="mt-1 text-xl font-black text-rose-100">{rejectedCount}</p></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Categorias sem envio</p><p className="mt-1 text-xl font-black text-zinc-300">{notSentCount}</p></div>
        </div>
        {unclassifiedCount > 0 && (
          <div className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            {unclassifiedCount} arquivo(s) recebido(s) ainda usam uma categoria antiga ou não identificada. Eles aparecem abaixo e precisam ser classificados antes da decisão.
          </div>
        )}
      </div>

      {activeError && (
        <div className="rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">
          {parseApiError(activeError)}
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h5 className="text-lg font-black text-white">Requisitos e materiais enviados</h5>
            <p className="mt-1 text-sm text-zinc-500">Cada decisão é salva imediatamente. Você pode sair e retomar depois sem perder aprovações, ajustes solicitados ou arquivos enviados.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-bold text-zinc-400">
            Situação: {caseDetail?.status === 'approved' && analysisCount > 0 ? 'Mapeamento aprovado • complementos em análise' : changesRequested ? 'Ajustes solicitados' : caseSubmittedForReview ? 'Em análise' : mappingCaseStatusLabel(caseDetail?.status)}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-sky-300/15 bg-sky-300/[0.06] px-4 py-3 text-xs leading-relaxed text-sky-100/80">
          Progresso automático: cada decisão fica registrada por arquivo e vinculada somente a {actor.displayName}. Fechar esta tela não reinicia a análise.
        </div>

        {isLoading ? (
          <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-white/10 p-10 text-sm text-zinc-400">
            <Loader2 size={18} className="animate-spin" /> Carregando mesa de inspeção...
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-zinc-500">
            Nenhum requisito ativo foi configurado em Gestão de Mapeamento.
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {rows.map((row) => (
              <button
                key={row.rowKey}
                type="button"
                onClick={() => void openInspection(row)}
                disabled={!row.asset}
                className={`w-full rounded-2xl border p-4 text-left transition ${toneClasses(row.status.tone)} ${row.asset ? 'hover:-translate-y-0.5 hover:border-white/30' : 'cursor-default'}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 gap-3">
                    <div className="rounded-xl border border-current/15 bg-black/20 p-2.5"><MediaTypeIcon requirement={row.requirement} /></div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h6 className="text-sm font-black text-white">{row.requirement.title}</h6>
                        {row.requirement.isRequired && <span className="rounded-full bg-amber-200/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-100">Obrigatório</span>}
                        {row.classificationRequired && <span className="rounded-full bg-violet-300/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-violet-100">Classificação necessária</span>}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{row.requirement.guidance || row.requirement.description || 'Sem orientação cadastrada.'}</p>
                      <p className="mt-2 text-[11px] font-bold text-violet-200/75">Finalidade: {systemTagLabel(row.requirement)}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                    <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${toneClasses(row.status.tone)}`}>{row.status.label}</span>
                    <span className="text-xs text-zinc-500">{row.asset ? `${row.asset.originalFilename || 'Arquivo enviado'} • ${formatDate(row.asset.createdAt)}` : 'Aguardando envio da pessoa participante'}</span>
                    {row.assetCount > 1 && <span className="text-[11px] text-zinc-600">{row.assetCount} arquivos nesta categoria</span>}
                  </div>
                </div>

                {row.asset?.rejectionReason && (
                  <div className="mt-3 rounded-xl border border-rose-300/20 bg-rose-950/20 px-3 py-2 text-xs text-rose-100">
                    Motivo: {row.asset.rejectionReason}
                  </div>
                )}

                {row.asset && diagnosticByAssetId.get(row.asset.id) && (() => {
                  const diagnostic = diagnosticByAssetId.get(row.asset.id)!
                  return (
                    <div className={`mt-3 rounded-xl border px-3 py-2 text-left ${datasetDiagnosticClasses(diagnostic.tone)}`}>
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] opacity-65">Uso na identidade para vídeos</p>
                      <p className="mt-1 text-xs font-black">{diagnostic.reasonLabel}</p>
                      <p className="mt-1 text-[11px] leading-relaxed opacity-75">{diagnostic.reasonMessage}</p>
                    </div>
                  )
                })()}

                {row.asset && row.asset.status !== 'registered_dry_run' && (
                  <div className="mt-3 inline-flex items-center gap-2 text-xs font-black text-white"><Eye size={14} /> Inspecionar mídia protegida</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {latestCase?.status === 'approved' ? (
        <div className="rounded-[2rem] border border-emerald-300/25 bg-emerald-300/10 p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100/70">Mapeamento geral concluído</p>
              <h5 className="mt-1 text-xl font-black text-white">Todos os arquivos recebidos já possuem decisão</h5>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-emerald-50/70">
                O caso não precisa ser aprovado novamente. A próxima etapa é completar e preparar o conjunto visual usado na identidade para vídeos.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">Arquivos aprovados</p>
                  <p className="mt-1 text-lg font-black text-white">{approvedCount}/{receivedCount}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">Fotos válidas para identidade</p>
                  <p className="mt-1 text-lg font-black text-white">{datasetSummary?.validUniqueImages ?? '—'}/{datasetThresholds?.minimumImages ?? 15}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] text-zinc-500">Vídeos válidos para identidade</p>
                  <p className="mt-1 text-lg font-black text-white">{datasetSummary?.validUniqueVideos ?? '—'}/{datasetThresholds?.minimumVideos ?? 6}</p>
                </div>
                <div className={`rounded-2xl border px-3 py-3 ${identityMaterialsReady ? 'border-emerald-300/20 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10'}`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.13em] opacity-65">Conjunto visual</p>
                  <p className="mt-1 text-sm font-black">{identityMaterialsReady ? 'Pronto para preparação' : 'Complementação necessária'}</p>
                </div>
              </div>
              {datasetDiagnostics && datasetDiagnostics.summary.actionRequired > 0 && (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-black/25 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.13em] text-amber-100">Ações necessárias</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">Mostramos aqui somente o que realmente precisa de uma decisão, correção ou novo envio.</p>
                    </div>
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                      {datasetDiagnostics.summary.actionRequired} ação(ões)
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {datasetDiagnostics.summary.reasons.filter((reason) => reason.requiresAction).slice(0, 6).map((reason) => (
                      <div key={reason.reasonCode} className={`rounded-xl border px-3 py-2 ${datasetDiagnosticClasses(reason.tone)}`}>
                        <p className="text-xs font-black">{reason.count} × {reason.label}</p>
                        <p className="mt-1 text-[11px] leading-relaxed opacity-70">{reason.recommendedAction}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {datasetDiagnostics && datasetDiagnostics.summary.actionRequired === 0 && datasetDiagnostics.summary.noActionRequired > 0 && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                  <p className="text-xs font-black text-zinc-300">Nenhuma ação necessária nos arquivos preservados</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">Cópias repetidas, áudios e versões substituídas continuam no histórico, mas não bloqueiam a próxima etapa.</p>
                </div>
              )}
              <p className="mt-3 text-xs leading-relaxed text-emerald-50/60">
                Áudios, documentos e versões substituídas podem estar aprovados, mas não contam como novas fotos ou vídeos para formar a identidade.
              </p>
            </div>
            <button type="button" onClick={onProceedToIdentity} disabled={!onProceedToIdentity} className="inline-flex min-w-64 items-center justify-center gap-2 rounded-2xl bg-amber-300 px-5 py-4 text-sm font-black text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50">
              Ir para preparação da identidade <ArrowRight size={17} />
            </button>
          </div>
        </div>
      ) : (
        <div className={`rounded-[2rem] border p-5 ${allRequiredApproved ? 'border-emerald-300/25 bg-emerald-300/10' : 'border-amber-300/20 bg-amber-300/10'}`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/60">Decisão final do mapeamento</p>
              <h5 className="mt-1 text-lg font-black text-white">{changesRequested ? 'Ajustes liberados sem apagar o histórico' : allRequiredApproved && analysisCount === 0 ? 'Requisitos obrigatórios aprovados' : caseSubmittedForReview ? 'Inspeção ainda incompleta' : 'Aguardando envio para análise'}</h5>
              <p className="mt-1 text-sm leading-relaxed text-white/65">
                {changesRequested
                  ? 'A pessoa participante pode complementar somente o que foi indicado. Arquivos e decisões anteriores continuam salvos.'
                  : allRequiredApproved && caseSubmittedForReview && analysisCount === 0
                    ? 'A aprovação final está liberada. Esta ação conclui o caso, mas não inicia produção.'
                    : caseSubmittedForReview
                      ? 'Analise todos os materiais aguardando decisão antes de concluir o mapeamento.'
                      : 'As decisões finais ficam bloqueadas até a pessoa participante enviar formalmente este ciclo para análise.'}
              </p>
            </div>
            <div className="flex min-w-64 flex-col gap-2">
              <button type="button" onClick={() => void approveWholeCase()} disabled={!latestCase?.id || !allRequiredApproved || !caseSubmittedForReview || !initialCaseCanClose || caseDecisionPending} className="rounded-2xl bg-emerald-300 px-4 py-3 text-sm font-black text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50">
                {approveCaseMutation.isPending ? 'Concluindo...' : 'Concluir aprovação do mapeamento'}
              </button>
              <button type="button" onClick={() => setCaseRejectMode((current) => !current)} disabled={!latestCase?.id || !caseSubmittedForReview || caseDecisionPending} className="rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-3 text-sm font-black text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-50">
                Solicitar ajustes
              </button>
            </div>
          </div>

          {caseRejectMode && (
            <div className="mt-4 rounded-2xl border border-rose-300/25 bg-black/25 p-4">
              <label className="block text-sm font-black text-rose-100">
                Orientação obrigatória para os ajustes
                <textarea value={caseRejectionReason} onChange={(event) => setCaseRejectionReason(event.target.value)} rows={3} placeholder="Explique o que precisa ser corrigido no conjunto do mapeamento." className="mt-2 w-full resize-none rounded-2xl border border-rose-300/20 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-rose-300/50" />
              </label>
              <div className="mt-3 flex justify-end gap-2">
                <button type="button" onClick={() => { setCaseRejectMode(false); setCaseRejectionReason('') }} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-zinc-300">Cancelar</button>
                <button type="button" onClick={() => void rejectWholeCase()} disabled={!caseRejectionReason.trim() || rejectCaseMutation.isPending} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Enviar solicitação de ajustes</button>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedRow && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Inspeção de ${selectedRow.requirement.title}`}>
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/60">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Inspeção protegida</p>
                <h5 className="mt-1 text-2xl font-black text-white">{selectedRow.requirement.title}</h5>
                <p className="mt-1 text-sm text-zinc-500">{selectedRow.requirement.guidance || selectedRow.requirement.description}</p>
              </div>
              <button type="button" onClick={closePreview} className="rounded-xl border border-white/10 p-2 text-zinc-400 transition hover:text-white" aria-label="Fechar inspeção"><X size={20} /></button>
            </div>

            <div className="mt-5">
              {previewLoading ? (
                <div className="flex min-h-72 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/35 text-sm text-zinc-400"><Loader2 size={20} className="animate-spin" /> Abrindo material protegido...</div>
              ) : previewError ? (
                <div className="flex min-h-48 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-5 text-sm text-rose-100"><AlertCircle size={20} /> {previewError}</div>
              ) : previewUrl ? (
                <PreviewMedia url={previewUrl} contentType={previewContentType} requirement={selectedRow.requirement} />
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black text-white">{selectedRow.asset?.originalFilename || 'Material enviado'}</p>
                  <p className="mt-1 text-xs text-zinc-500">{selectedRow.asset?.contentType || previewContentType || 'Tipo não informado'} • enviado em {formatDate(selectedRow.asset?.createdAt)}</p>
                </div>
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${toneClasses(selectedRow.status.tone)}`}>{selectedRow.status.label}</span>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-emerald-100/75">A mídia foi carregada de forma protegida. Nenhum endereço público do arquivo é exibido nesta tela.</p>
            </div>

            {selectedDiagnostic && (
              <div className={`mt-4 rounded-2xl border p-4 ${datasetDiagnosticClasses(selectedDiagnostic.tone)}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] opacity-65">Diagnóstico do conjunto de identidade</p>
                <p className="mt-1 text-sm font-black">{selectedDiagnostic.reasonLabel}</p>
                <p className="mt-2 text-xs leading-relaxed opacity-80">{selectedDiagnostic.reasonMessage}</p>
                <p className="mt-2 text-xs font-black">Próxima ação: {selectedDiagnostic.recommendedAction}</p>
              </div>
            )}

            {selectedRow.classificationRequired && selectedRow.status.label === 'Em análise' && (
              <div className="mt-5 rounded-2xl border border-violet-300/25 bg-violet-300/10 p-4">
                <div className="flex items-start gap-3">
                  <Tags size={20} className="mt-0.5 shrink-0 text-violet-100" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-violet-100">Classifique este arquivo antes da decisão</p>
                    <p className="mt-1 text-xs leading-relaxed text-violet-100/70">O arquivo existe no mapeamento e está visível, mas usa uma categoria antiga ou não identificada.</p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <select value={classificationRequirementId} onChange={(event) => setClassificationRequirementId(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-violet-300/25 bg-black/40 px-3 py-3 text-sm font-bold text-white outline-none focus:border-violet-300/60">
                        <option value="">Selecione a categoria correta</option>
                        {activeRequirements
                          .filter((requirement) => requirement.mediaType === selectedRow.requirement.mediaType)
                          .map((requirement) => <option key={requirement.id} value={requirement.id}>{requirement.title}</option>)}
                      </select>
                      <button type="button" onClick={() => void classifySelectedAsset()} disabled={!classificationRequirementId || reclassifyAssetMutation.isPending} className="rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-violet-950 disabled:cursor-not-allowed disabled:opacity-50">
                        {reclassifyAssetMutation.isPending ? 'Classificando...' : 'Classificar arquivo'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedRow.classificationRequired && selectedRow.status.label === 'Em análise' ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
                Classifique o arquivo acima para liberar Aprovar, Ajustar cópia ou Solicitar novo envio.
              </div>
            ) : selectedRow.status.label !== 'Em análise' ? (
              <div className={`mt-5 rounded-2xl border p-4 text-sm font-bold ${toneClasses(selectedRow.status.tone)}`}>
                Decisão já registrada como {selectedRow.status.label}. A mídia permanece disponível para conferência.
              </div>
            ) : !caseSubmittedForReview ? (
              <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-100">
                A visualização está liberada, mas a decisão permanece bloqueada até a pessoa participante enviar formalmente este ciclo para análise.
              </div>
            ) : !rejectMode ? (
              <div className={`mt-5 grid gap-3 ${selectedIsImage ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <button type="button" onClick={() => void approveSelectedAsset()} disabled={itemDecisionPending || previewLoading || Boolean(previewError)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-4 text-sm font-black text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 size={18} /> Aprovar</button>
                {selectedIsImage && (
                  <button type="button" onClick={() => setImageEditorOpen(true)} disabled={itemDecisionPending || previewLoading || Boolean(previewError) || !previewUrl} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-4 text-sm font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"><Crop size={18} /> Ajustar cópia</button>
                )}
                <button type="button" onClick={() => setRejectMode(true)} disabled={itemDecisionPending} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-500 px-4 py-4 text-sm font-black text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"><XCircle size={18} /> Solicitar novo envio</button>
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4">
                <label className="block text-sm font-black text-rose-100">
                  Orientação para o novo envio
                  <textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} autoFocus placeholder="Ex.: Áudio com ruído. Grave novamente em ambiente silencioso." className="mt-2 w-full resize-none rounded-2xl border border-rose-300/25 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none focus:border-rose-300/60" />
                </label>
                <p className="mt-2 text-xs text-rose-100/70">A orientação será exibida para a pessoa participante no requisito correspondente.</p>
                <div className="mt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => { setRejectMode(false); setRejectionReason('') }} className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-zinc-300">Cancelar</button>
                  <button type="button" onClick={() => void rejectSelectedAsset()} disabled={!rejectionReason.trim() || rejectAssetMutation.isPending} className="rounded-xl bg-rose-500 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50">Enviar solicitação de ajustes</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {imageEditorOpen && selectedRow?.asset && previewUrl && selectedIsImage && (
        <ActorSafeImageEditor
          sourceUrl={previewUrl}
          sourceFilename={selectedRow.asset.originalFilename}
          requirementTitle={selectedRow.requirement.title}
          isSaving={createEditedCopyMutation.isPending}
          onCancel={() => setImageEditorOpen(false)}
          onSave={saveEditedCopy}
        />
      )}
    </section>
  )
}
