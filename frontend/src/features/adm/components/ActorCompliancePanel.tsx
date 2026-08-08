import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FileCheck2,
  Download,
  Eye,
  Lock,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { useCreationAvatars } from '@/features/adm/hooks/useCreationAdmin'
import {
  useActorKycCases,
  useActorProfiles,
  useApproveKycCase,
  useAuthorizeAvatarProduction,
  useAvatarComplianceReport,
  useAvatarProductionAuthorizations,
  useBlockActorProfile,
  useCreateActorKycCase,
  useCreateActorProfile,
  useGenerateActorInvite,
  useKycCase,
  useKycCaseMappingChecklist,
  useRegisterKycAsset,
  useRejectKycCase,
  useRevokeAvatarProductionAuthorization,
  useUnblockActorProfile,
} from '@/features/adm/hooks/useActorCompliance'
import { fetchKycAssetPrivateBlob, type ActorProfile, type AvatarProductionAuthorization, type KycAsset, type KycCase } from '@/features/adm/api/actorComplianceApi'
import { parseApiError } from '@/shared/utils/parseApiError'
import { useMappingRequirements } from '@/features/adm/hooks/useMappingRequirements'

const MAX_MAPPING_FILE_BYTES = 25 * 1024 * 1024

const CONTENT_TYPES = [
  { value: 'image', label: 'Imagem' },
  { value: 'video', label: 'Vídeo' },
  { value: 'short_video', label: 'Vídeo curto' },
  { value: 'live_action', label: 'Live Action' },
  { value: 'audio', label: 'Áudio' },
  { value: 'live_audio', label: 'Áudio Live' },
]

function statusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    invited: 'Convidado',
    onboarding: 'Cadastro iniciado',
    kyc_pending: 'Mapeamento em análise',
    approved: 'Mapeamento aprovado',
    rejected: 'Ajustes solicitados',
    blocked: 'Bloqueado',
    not_started: 'Não iniciado',
    pending_review: 'Aguardando análise',
    not_authorized: 'Sem autorização',
    authorized: 'Autorizado',
    active: 'Ativa',
    revoked: 'Revogada',
    expired: 'Vencida',
  }

  return labels[value || ''] || value || '—'
}

function statusClass(value?: string | null) {
  if (['approved', 'active', 'authorized'].includes(String(value))) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
  if (['pending_review', 'kyc_pending', 'invited', 'onboarding', 'draft', 'not_started'].includes(String(value))) return 'border-amber-400/25 bg-amber-400/10 text-amber-100'
  if (['blocked', 'rejected', 'revoked', 'expired', 'not_authorized'].includes(String(value))) return 'border-rose-400/25 bg-rose-400/10 text-rose-100'
  return 'border-white/10 bg-white/[0.055] text-zinc-300'
}

function formatDate(value?: string | null) {
  if (!value) return '—'

  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function shortId(value?: string | null) {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo selecionado.'))
    reader.readAsDataURL(file)
  })
}

function StatusPill({ value }: { value?: string | null }) {
  return <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusClass(value)}`}>{statusLabel(value)}</span>
}

function SectionCard({ children }: { children: ReactNode }) {
  return <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">{children}</div>
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">
      <strong className="block text-rose-50">Não foi possível concluir a ação.</strong>
      <span className="mt-1 block text-rose-100/80">{parseApiError(error)}</span>
    </div>
  )
}

function actorCanBeAuthorized(actor: ActorProfile | null, kycCase: KycCase | null) {
  return Boolean(actor && actor.status !== 'blocked' && actor.kycStatus === 'approved' && kycCase?.status === 'approved')
}


function asPlainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function getActorSubmission(kycCase: KycCase | null): Record<string, unknown> {
  const metadata = asPlainRecord(kycCase?.metadata)
  return asPlainRecord(metadata.actorSubmission)
}

function mappingReviewState(kycCase: KycCase | null) {
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

function actorMappingSentForReview(kycCase: KycCase | null) {
  const metadata = asPlainRecord(kycCase?.metadata)
  const actorSubmission = getActorSubmission(kycCase)

  if (['changes_requested', 'changes_in_progress'].includes(mappingReviewState(kycCase))) return false
  return Boolean(
    metadata.actorSubmittedForReview === true
    || actorSubmission.status === 'sent_for_admin_review'
    || actorSubmission.sentForReviewAt,
  )
}

function actorSubmissionDate(kycCase: KycCase | null) {
  const actorSubmission = getActorSubmission(kycCase)
  return typeof actorSubmission.sentForReviewAt === 'string' ? actorSubmission.sentForReviewAt : null
}

function adminDecisionStatus(kycCase: KycCase | null, mappingComplete: boolean) {
  if (!kycCase) {
    return {
      label: 'Selecione um mapeamento',
      description: 'Escolha um mapeamento para conferir os materiais e tomar a decisão do Admin.',
      tone: 'neutral',
    }
  }

  if (kycCase.status === 'approved') {
    return {
      label: 'Mapeamento aprovado',
      description: 'Este mapeamento já foi aprovado. A autorização de produção continua sendo uma etapa separada.',
      tone: 'success',
    }
  }

  const reviewState = mappingReviewState(kycCase)
  if (reviewState === 'changes_requested' || reviewState === 'changes_in_progress') {
    return {
      label: reviewState === 'changes_in_progress' ? 'Ajustes em andamento' : 'Ajustes solicitados',
      description: kycCase.rejectionReason || 'A pessoa participante pode corrigir somente os itens indicados. Todo o histórico anterior permanece salvo.',
      tone: 'danger',
    }
  }

  if (!actorMappingSentForReview(kycCase)) {
    return {
      label: 'Aguardando envio da pessoa participante',
      description: 'O Admin só deve decidir depois que a pessoa participante enviar formalmente o mapeamento para análise.',
      tone: 'warning',
    }
  }

  if (!mappingComplete) {
    return {
      label: 'Materiais obrigatórios pendentes',
      description: 'O envio foi recebido, mas ainda faltam materiais obrigatórios. Revise antes de aprovar.',
      tone: 'warning',
    }
  }

  return {
    label: 'Pronto para decisão do Admin',
    description: 'Envio recebido e checklist completo. Você pode aprovar o mapeamento ou solicitar ajustes sem apagar o progresso.',
    tone: 'success',
  }
}

function adminDecisionToneClass(tone: string) {
  if (tone === 'success') return 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
  if (tone === 'danger') return 'border-rose-400/20 bg-rose-400/10 text-rose-100'
  if (tone === 'warning') return 'border-amber-400/20 bg-amber-400/10 text-amber-100'
  return 'border-white/10 bg-black/25 text-zinc-300'
}

function canApproveMapping(kycCase: KycCase | null, mappingComplete: boolean) {
  return Boolean(kycCase && kycCase.status === 'pending_review' && mappingComplete && actorMappingSentForReview(kycCase))
}

function canRejectMapping(kycCase: KycCase | null) {
  return Boolean(kycCase && kycCase.status === 'pending_review' && actorMappingSentForReview(kycCase))
}

export function ActorCompliancePanel({ initialActorId }: { initialActorId?: string }) {
  const [search, setSearch] = useState('')
  const [selectedActorId, setSelectedActorId] = useState('')
  const [selectedKycCaseId, setSelectedKycCaseId] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [inviteToken, setInviteToken] = useState('')
  const [newActorName, setNewActorName] = useState('')
  const [newActorEmail, setNewActorEmail] = useState('')
  const [newActorPhone, setNewActorPhone] = useState('')
  const [kycNote, setKycNote] = useState('')
  const [authorizationNote, setAuthorizationNote] = useState('Autorização conferida pelo Admin.')
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(['image'])
  const [mappingRequirementId, setMappingRequirementId] = useState('')
  const [kycFile, setKycFile] = useState<File | null>(null)
  const [assetActionId, setAssetActionId] = useState<string | null>(null)

  const actorsQuery = useActorProfiles(search)
  const mappingRequirementsQuery = useMappingRequirements(false)
  const avatarsQuery = useCreationAvatars()
  const selectedActorKycCasesQuery = useActorKycCases(selectedActorId)
  const selectedKycCaseQuery = useKycCase(selectedKycCaseId)
  const selectedKycChecklistQuery = useKycCaseMappingChecklist(selectedKycCaseId)
  const avatarAuthorizationsQuery = useAvatarProductionAuthorizations(selectedAvatarId)
  const avatarComplianceReportQuery = useAvatarComplianceReport(selectedAvatarId, false)
  const createActorMutation = useCreateActorProfile()
  const blockActorMutation = useBlockActorProfile()
  const unblockActorMutation = useUnblockActorProfile()
  const inviteMutation = useGenerateActorInvite()
  const createKycCaseMutation = useCreateActorKycCase()
  const registerKycAssetMutation = useRegisterKycAsset()
  const approveKycMutation = useApproveKycCase()
  const rejectKycMutation = useRejectKycCase()
  const authorizeMutation = useAuthorizeAvatarProduction()
  const revokeAuthorizationMutation = useRevokeAvatarProductionAuthorization()

  const actors = actorsQuery.data?.items || []
  const mappingRequirements = mappingRequirementsQuery.data?.items || []
  const selectedMappingRequirement = mappingRequirements.find((item) => item.id === mappingRequirementId) || mappingRequirements[0] || null
  const avatars = avatarsQuery.data?.items || []
  const kycCases = selectedActorKycCasesQuery.data?.items || []
  const selectedActor = actors.find((actor) => actor.id === selectedActorId) || actors[0] || null
  const selectedKycCase = selectedKycCaseQuery.data || kycCases.find((item) => item.id === selectedKycCaseId) || kycCases[0] || null
  const selectedAvatar = avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null
  const authorizations = avatarAuthorizationsQuery.data?.items || []
  const activeAuthorization = authorizations.find((item) => item.status === 'active') || null
  const avatarComplianceReport = avatarComplianceReportQuery.data || null
  const mappingChecklist = selectedKycChecklistQuery.data || selectedKycCaseQuery.data?.mappingChecklist || selectedKycCase?.mappingChecklist || null
  const mappingComplete = Boolean(mappingChecklist?.isComplete)
  const safeToAuthorize = actorCanBeAuthorized(selectedActor, selectedKycCase) && Boolean(selectedAvatar?.id) && mappingComplete
  const adminDecision = adminDecisionStatus(selectedKycCase, mappingComplete)
  const mappingSentForReview = actorMappingSentForReview(selectedKycCase)
  const mappingSentAt = actorSubmissionDate(selectedKycCase)
  const approveMappingAllowed = canApproveMapping(selectedKycCase, mappingComplete)
  const rejectMappingAllowed = canRejectMapping(selectedKycCase)
  const onboardingLink = inviteToken
    ? `${window.location.origin}/atores/onboarding/${inviteToken}`
    : ''

  const activeError = useMemo(() => {
    if (actorsQuery.isError) return actorsQuery.error
    if (avatarsQuery.isError) return avatarsQuery.error
    if (selectedActorKycCasesQuery.isError) return selectedActorKycCasesQuery.error
    if (selectedKycCaseQuery.isError) return selectedKycCaseQuery.error
    if (selectedKycChecklistQuery.isError) return selectedKycChecklistQuery.error
    if (avatarAuthorizationsQuery.isError) return avatarAuthorizationsQuery.error
    if (avatarComplianceReportQuery.isError) return avatarComplianceReportQuery.error
    if (createActorMutation.isError) return createActorMutation.error
    if (blockActorMutation.isError) return blockActorMutation.error
    if (unblockActorMutation.isError) return unblockActorMutation.error
    if (inviteMutation.isError) return inviteMutation.error
    if (createKycCaseMutation.isError) return createKycCaseMutation.error
    if (registerKycAssetMutation.isError) return registerKycAssetMutation.error
    if (approveKycMutation.isError) return approveKycMutation.error
    if (rejectKycMutation.isError) return rejectKycMutation.error
    if (authorizeMutation.isError) return authorizeMutation.error
    if (revokeAuthorizationMutation.isError) return revokeAuthorizationMutation.error
    return null
  }, [
    actorsQuery.error,
    actorsQuery.isError,
    approveKycMutation.error,
    approveKycMutation.isError,
    authorizeMutation.error,
    authorizeMutation.isError,
    avatarAuthorizationsQuery.error,
    avatarAuthorizationsQuery.isError,
    avatarComplianceReportQuery.error,
    avatarComplianceReportQuery.isError,
    avatarsQuery.error,
    avatarsQuery.isError,
    blockActorMutation.error,
    blockActorMutation.isError,
    createActorMutation.error,
    createActorMutation.isError,
    createKycCaseMutation.error,
    createKycCaseMutation.isError,
    inviteMutation.error,
    inviteMutation.isError,
    registerKycAssetMutation.error,
    registerKycAssetMutation.isError,
    rejectKycMutation.error,
    rejectKycMutation.isError,
    revokeAuthorizationMutation.error,
    revokeAuthorizationMutation.isError,
    selectedActorKycCasesQuery.error,
    selectedActorKycCasesQuery.isError,
    selectedKycCaseQuery.error,
    selectedKycCaseQuery.isError,
    selectedKycChecklistQuery.error,
    selectedKycChecklistQuery.isError,
    unblockActorMutation.error,
    unblockActorMutation.isError,
  ])

  useEffect(() => {
    if (mappingRequirements[0]?.id && !mappingRequirements.some((item) => item.id === mappingRequirementId)) {
      setMappingRequirementId(mappingRequirements[0].id)
    }
  }, [mappingRequirementId, mappingRequirements])

  useEffect(() => {
    if (initialActorId && actors.some((actor) => actor.id === initialActorId) && selectedActorId !== initialActorId) {
      setSelectedActorId(initialActorId)
      setSelectedKycCaseId('')
      return
    }
    if (!selectedActorId && actors[0]?.id) setSelectedActorId(actors[0].id)
  }, [actors, initialActorId, selectedActorId])

  useEffect(() => {
    if (!selectedAvatarId && avatars[0]?.id) setSelectedAvatarId(avatars[0].id)
  }, [avatars, selectedAvatarId])

  useEffect(() => {
    if (kycCases[0]?.id && !kycCases.some((item) => item.id === selectedKycCaseId)) {
      setSelectedKycCaseId(kycCases[0].id)
    }

    if (kycCases.length === 0 && selectedKycCaseId) setSelectedKycCaseId('')
  }, [kycCases, selectedKycCaseId])

  function refreshAll() {
    void Promise.all([
      actorsQuery.refetch(),
      avatarsQuery.refetch(),
      selectedActorKycCasesQuery.refetch(),
      selectedKycCaseQuery.refetch(),
      selectedKycChecklistQuery.refetch(),
      avatarAuthorizationsQuery.refetch(),
      avatarComplianceReportQuery.refetch(),
    ])
  }

  function resetActorForm() {
    setNewActorName('')
    setNewActorEmail('')
    setNewActorPhone('')
  }

  function handleCreateActor() {
    if (!newActorName.trim()) {
      window.alert('Informe o nome do pessoa participante.')
      return
    }

    createActorMutation.mutate({
      displayName: newActorName.trim(),
      email: newActorEmail.trim() || undefined,
      phone: newActorPhone.trim() || undefined,
      countryCode: 'BR',
      notes: 'Cadastro criado pelo Painel Admin.',
    }, {
      onSuccess: (actor) => {
        resetActorForm()
        setSelectedActorId(actor.id)
      },
    })
  }

  function handleGenerateInvite() {
    if (!selectedActor) return

    inviteMutation.mutate({
      actorId: selectedActor.id,
      email: selectedActor.email || undefined,
      expiresInDays: 7,
    }, {
      onSuccess: (result) => {
        setInviteToken(result.invite.inviteToken || '')
        window.alert('Convite gerado. Copie o token exibido no painel agora, pois ele não será mostrado novamente.')
      },
    })
  }

  function handleBlockActor() {
    if (!selectedActor) return
    const reason = window.prompt('Explique de forma simples por que este pessoa participante será bloqueado:')
    if (!reason?.trim()) return

    blockActorMutation.mutate({ actorId: selectedActor.id, reason: reason.trim() })
  }

  function handleUnblockActor() {
    if (!selectedActor) return
    const reason = window.prompt('Explique de forma simples por que este pessoa participante será reativado:')
    if (!reason?.trim()) return

    unblockActorMutation.mutate({ actorId: selectedActor.id, reason: reason.trim() })
  }

  function handleCreateKycCase() {
    if (!selectedActor) return

    createKycCaseMutation.mutate({
      actorId: selectedActor.id,
      payload: {
        caseType: 'avatar_mapping',
        notes: kycNote.trim() || 'Mapeamento aberto pelo Painel Admin.',
      },
    }, {
      onSuccess: (kycCase) => {
        setSelectedKycCaseId(kycCase.id)
        setKycNote('')
      },
    })
  }

  function handleRegisterDryRunAsset() {
    if (!selectedKycCase || !selectedMappingRequirement) return

    registerKycAssetMutation.mutate({
      kycCaseId: selectedKycCase.id,
      payload: {
        mappingRequirementId: selectedMappingRequirement.id,
        contentType: 'image/jpeg',
        originalFilename: 'mapeamento-teste-seguro.jpg',
        byteSize: 0,
        dryRunOnly: true,
        metadata: {
          source: 'admin_panel_5_9C_dry_run',
          privateVaultExpected: true,
        },
      },
    }, {
      onSuccess: (result) => {
        window.alert(result.message)
      },
    })
  }

  async function handleRegisterRealAsset() {
    if (!selectedKycCase || !selectedMappingRequirement) return

    if (!kycFile) {
      window.alert('Selecione um material de mapeamento para guardar no cofre privado.')
      return
    }

    if (kycFile.size > MAX_MAPPING_FILE_BYTES) {
      window.alert('Use material de até 25 MB para mapeamento.')
      return
    }

    const confirmed = window.confirm('Guardar este material real no cofre privado de mapeamento? Nenhuma URL pública será gerada.')
    if (!confirmed) return

    try {
      const base64 = await readFileAsDataUrl(kycFile)

      registerKycAssetMutation.mutate({
        kycCaseId: selectedKycCase.id,
        payload: {
          mappingRequirementId: selectedMappingRequirement.id,
          base64,
          contentType: kycFile.type || 'application/octet-stream',
          originalFilename: kycFile.name,
          byteSize: kycFile.size,
          dryRunOnly: false,
          metadata: {
            source: 'admin_panel_5_9C_actor_mapping_upload',
            privateVaultExpected: true,
          },
        },
      }, {
        onSuccess: (result) => {
          setKycFile(null)
          window.alert(result.message)
        },
      })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Não foi possível preparar o material de mapeamento.')
    }
  }


  async function handleViewPrivateAsset(asset: KycAsset) {
    if (!asset.id) return

    if (asset.status === 'registered_dry_run') {
      window.alert('Este material é apenas simulação e não possui arquivo real para abrir.')
      return
    }

    try {
      setAssetActionId(asset.id)
      const result = await fetchKycAssetPrivateBlob(asset.id, false)
      const blobUrl = window.URL.createObjectURL(result.blob)
      const opened = window.open(blobUrl, '_blank', 'noopener,noreferrer')

      if (!opened) {
        const link = document.createElement('a')
        link.href = blobUrl
        link.target = '_blank'
        link.rel = 'noopener noreferrer'
        link.click()
      }

      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      window.alert(parseApiError(error))
    } finally {
      setAssetActionId(null)
    }
  }

  async function handleDownloadPrivateAsset(asset: KycAsset) {
    if (!asset.id) return

    if (asset.status === 'registered_dry_run') {
      window.alert('Este material é apenas simulação e não possui arquivo real para baixar.')
      return
    }

    try {
      setAssetActionId(asset.id)
      const result = await fetchKycAssetPrivateBlob(asset.id, true)
      const blobUrl = window.URL.createObjectURL(result.blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = result.filename || asset.originalFilename || 'material-mapeamento'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000)
    } catch (error) {
      window.alert(parseApiError(error))
    } finally {
      setAssetActionId(null)
    }
  }

  function handleApproveKyc() {
    if (!selectedKycCase) return

    if (!mappingSentForReview) {
      window.alert('Aguarde a pessoa participante enviar o mapeamento para análise antes de aprovar.')
      return
    }

    if (!mappingComplete) {
      window.alert('Mapeamento incompleto. Complete os materiais obrigatórios antes de aprovar.')
      return
    }

    if (!window.confirm('Aprovar este mapeamento? Depois disso, o avatar ainda precisará de autorização de produção.')) return

    approveKycMutation.mutate({
      kycCaseId: selectedKycCase.id,
      note: 'Mapeamento aprovado pelo Painel Admin.',
    })
  }

  function handleRejectKyc() {
    if (!selectedKycCase) return

    if (!mappingSentForReview) {
      window.alert('Aguarde a pessoa participante enviar o mapeamento para análise antes de solicitar ajustes.')
      return
    }

    const reason = window.prompt('Descreva quais ajustes precisam ser feitos. As aprovações e os arquivos já enviados serão preservados:')
    if (!reason?.trim()) return

    rejectKycMutation.mutate({ kycCaseId: selectedKycCase.id, reason: reason.trim() })
  }

  function toggleContentType(value: string) {
    setSelectedContentTypes((current) => (current.includes(value) ? current.filter((item) => item !== value) : [...current, value]))
  }

  function handleAuthorizeAvatar() {
    if (!selectedActor || !selectedKycCase || !selectedAvatar) return

    if (!safeToAuthorize) {
      window.alert('Para autorizar produção, a pessoa participante precisa estar com o mapeamento aprovado, completo e não pode estar bloqueada.')
      return
    }

    if (selectedContentTypes.length === 0) {
      window.alert('Escolha pelo menos um tipo de conteúdo autorizado.')
      return
    }

    const confirmed = window.confirm(
      `Autorizar produção deste avatar?\n\nPessoa participante: ${selectedActor.displayName}\nAvatar: ${selectedAvatar.name}\nTipos autorizados: ${selectedContentTypes.map((type) => CONTENT_TYPES.find((item) => item.value === type)?.label || type).join(', ')}\n\nEssa autorização libera lotes reais para este avatar.`,
    )

    if (!confirmed) return

    authorizeMutation.mutate({
      avatarId: selectedAvatar.id,
      payload: {
        actorProfileId: selectedActor.id,
        kycCaseId: selectedKycCase.id,
        authorizedForContentTypes: selectedContentTypes,
        note: authorizationNote.trim() || 'Autorização conferida pelo Admin.',
        financeSnapshot: { source: 'admin_panel_5_9B', configured: false },
        termsSnapshot: { source: 'admin_panel_5_9B', confirmedByAdmin: true },
      },
    })
  }

  function handleRevokeAuthorization(item: AvatarProductionAuthorization) {
    const reason = window.prompt('Explique de forma simples por que esta autorização será revogada:')
    if (!reason?.trim()) return

    revokeAuthorizationMutation.mutate({ authorizationId: item.id, reason: reason.trim() })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
            Atores, Mapeamento e autorização
          </span>
          <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">Pessoas autorizadas</h1>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">
            Cadastre a pessoa participante, acompanhe o mapeamento do avatar e só libere produção real quando existir autorização ativa. Esta tela não altera a experiência do cliente.
          </p>
        </div>
        <button type="button" onClick={refreshAll} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-zinc-100 transition hover:border-white/25">
          <RefreshCw size={16} />
          Atualizar
        </button>
      </div>

      <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-relaxed text-amber-100">
        <strong>Regra de segurança:</strong> Mapeamento aprovado sozinho não libera produção. Para lote real, o avatar precisa de autorização ativa. Materiais de mapeamento ficam em cofre privado e esta tela não mostra URL pública.
      </div>

      {activeError && <ErrorBox error={activeError} />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Cadastrados</p>
              <p className="mt-2 text-3xl font-black text-white">{actors.length}</p>
            </div>
            <UserCheck className="text-amber-100" size={24} />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Inclui ativos, pendentes e bloqueados.</p>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Mapeamento aprovado</p>
              <p className="mt-2 text-3xl font-black text-white">{actors.filter((actor) => actor.kycStatus === 'approved').length}</p>
            </div>
            <FileCheck2 className="text-emerald-100" size={24} />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Pessoas com conferência aprovada.</p>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Bloqueados</p>
              <p className="mt-2 text-3xl font-black text-white">{actors.filter((actor) => actor.status === 'blocked').length}</p>
            </div>
            <Lock className="text-rose-100" size={24} />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Bloqueio revoga autorizações ativas.</p>
        </SectionCard>
        <SectionCard>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">Autorização do avatar</p>
              <p className="mt-2 text-3xl font-black text-white">{activeAuthorization ? 'Ativa' : '—'}</p>
            </div>
            <ShieldCheck className="text-blue-100" size={24} />
          </div>
          <p className="mt-3 text-xs text-zinc-500">Referente ao avatar selecionado.</p>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <aside className="space-y-5">
          <SectionCard>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-white">Cadastrar participante</h2>
                <p className="mt-1 text-sm text-zinc-500">Dados mínimos para iniciar convite e mapeamento.</p>
              </div>
              <UserPlus className="text-amber-100" size={22} />
            </div>
            <div className="mt-4 grid gap-3">
              <input value={newActorName} onChange={(event) => setNewActorName(event.target.value)} placeholder="Nome artístico" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" />
              <input value={newActorEmail} onChange={(event) => setNewActorEmail(event.target.value)} placeholder="E-mail" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" />
              <input value={newActorPhone} onChange={(event) => setNewActorPhone(event.target.value)} placeholder="Telefone" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" />
              <button type="button" onClick={handleCreateActor} disabled={createActorMutation.isPending} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
                {createActorMutation.isPending ? 'Salvando...' : 'Cadastrar'}
              </button>
            </div>
          </SectionCard>

          <SectionCard>
            <h2 className="text-2xl font-black text-white">Lista</h2>
            <p className="mt-1 text-sm text-zinc-500">Escolha uma pessoa para ver mapeamento e autorização.</p>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" className="mt-4 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" />
            <div className="mt-4 grid max-h-[34rem] gap-2 overflow-y-auto pr-1">
              {actorsQuery.isLoading && <p className="text-sm text-zinc-500">Carregando participantes...</p>}
              {!actorsQuery.isLoading && actors.length === 0 && <p className="text-sm text-zinc-500">Nenhum cadastro encontrado.</p>}
              {actors.map((actor) => (
                <button
                  key={actor.id}
                  type="button"
                  onClick={() => {
                    setSelectedActorId(actor.id)
                    setInviteToken('')
                  }}
                  className={`rounded-2xl border p-4 text-left transition ${selectedActor?.id === actor.id ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}
                >
                  <p className="font-black">{actor.displayName}</p>
                  <p className={`mt-1 text-xs ${selectedActor?.id === actor.id ? 'text-zinc-600' : 'text-zinc-500'}`}>{actor.email || 'Sem e-mail'}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill value={actor.status} />
                    <StatusPill value={actor.kycStatus} />
                  </div>
                </button>
              ))}
            </div>
          </SectionCard>
        </aside>

        <div className="space-y-5">
          <SectionCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Pessoa selecionada</p>
                <h2 className="mt-2 text-3xl font-black text-white">{selectedActor?.displayName || 'Selecione uma pessoa'}</h2>
                <p className="mt-1 text-sm text-zinc-500">{selectedActor?.email || 'Sem e-mail cadastrado'} {selectedActor?.phone ? `• ${selectedActor.phone}` : ''}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <StatusPill value={selectedActor?.status} />
                  <StatusPill value={selectedActor?.kycStatus} />
                  <StatusPill value={selectedActor?.productionStatus} />
                </div>
              </div>
              {selectedActor && (
                <div className="grid gap-2 sm:min-w-60">
                  <button type="button" onClick={handleGenerateInvite} disabled={inviteMutation.isPending || selectedActor.status === 'blocked'} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                    <MailPlus size={16} />
                    Gerar convite
                  </button>
                  {selectedActor.status === 'blocked' ? (
                    <button type="button" onClick={handleUnblockActor} disabled={unblockActorMutation.isPending} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                      Reativar cadastro
                    </button>
                  ) : (
                    <button type="button" onClick={handleBlockActor} disabled={blockActorMutation.isPending} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                      Bloquear
                    </button>
                  )}
                </div>
              )}
            </div>
            {inviteToken && (
              <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
                <strong>Link público do convite:</strong>
                <code className="mt-2 block break-all rounded-xl bg-black/35 p-3 text-amber-50">{onboardingLink}</code>
                <p className="mt-2 text-xs text-amber-100/80">Copie agora. Por segurança, o backend não mostra esse token novamente. A pessoa participante usa esse link para aceitar o convite e enviar os materiais do mapeamento.</p>
              </div>
            )}
          </SectionCard>

          <div className="grid gap-5 xl:grid-cols-2">
            <SectionCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white">Mapeamento do avatar</h2>
                  <p className="mt-1 text-sm text-zinc-500">Materiais de referência para a IA reproduzir o avatar com compatibilidade e autorização.</p>
                </div>
                <FileCheck2 className="text-emerald-100" size={22} />
              </div>

              <div className="mt-4 grid gap-3">
                <textarea value={kycNote} onChange={(event) => setKycNote(event.target.value)} placeholder="Observação simples do mapeamento" className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-amber-300/50" />
                <button type="button" onClick={handleCreateKycCase} disabled={!selectedActor || createKycCaseMutation.isPending || selectedActor.status === 'blocked'} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
                  Abrir mapeamento
                </button>
              </div>

              <div className="mt-5 grid gap-2">
                {selectedActorKycCasesQuery.isLoading && <p className="text-sm text-zinc-500">Carregando mapeamentos...</p>}
                {!selectedActorKycCasesQuery.isLoading && kycCases.length === 0 && <p className="text-sm text-zinc-500">Nenhum mapeamento criado para esta pessoa.</p>}
                {kycCases.map((kycCase) => (
                  <button key={kycCase.id} type="button" onClick={() => setSelectedKycCaseId(kycCase.id)} className={`rounded-2xl border p-4 text-left transition ${selectedKycCase?.id === kycCase.id ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <strong>Mapeamento {shortId(kycCase.id)}</strong>
                      <StatusPill value={kycCase.status} />
                    </div>
                    <p className={`mt-2 text-xs ${selectedKycCase?.id === kycCase.id ? 'text-zinc-600' : 'text-zinc-500'}`}>Criado em {formatDate(kycCase.createdAt)}</p>
                  </button>
                ))}
              </div>
            </SectionCard>

            <SectionCard>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-white">Materiais e decisão</h2>
                  <p className="mt-1 text-sm text-zinc-500">Fotos, vídeos curtos, áudios e termos ficam apenas no cofre privado. Nenhuma URL pública.</p>
                </div>
                <ShieldCheck className="text-blue-100" size={22} />
              </div>

              {!selectedKycCase ? (
                <p className="mt-4 text-sm text-zinc-500">Selecione ou abra um mapeamento.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill value={selectedKycCase.status} />
                      <span className="text-xs text-zinc-500">{shortId(selectedKycCase.id)}</span>
                    </div>
                    <p className="mt-3 text-sm text-zinc-400">{selectedKycCase.notes || 'Sem observação.'}</p>
                    {selectedKycCase.rejectionReason && <p className="mt-3 text-sm text-rose-100">Motivo: {selectedKycCase.rejectionReason}</p>}
                  </div>

                  <div className={`rounded-2xl border p-4 ${mappingComplete ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className={`text-sm font-black ${mappingComplete ? 'text-emerald-100' : 'text-amber-100'}`}>
                          {mappingComplete ? 'Mapeamento completo' : 'Mapeamento incompleto'}
                        </p>
                        <p className={`mt-1 text-xs leading-relaxed ${mappingComplete ? 'text-emerald-100/75' : 'text-amber-100/75'}`}>
                          {mappingChecklist?.summary || 'Carregando checklist de mapeamento...'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${mappingComplete ? 'bg-emerald-400/15 text-emerald-50' : 'bg-amber-400/15 text-amber-50'}`}>
                        {mappingChecklist ? `${mappingChecklist.completedRequired}/${mappingChecklist.totalRequired}` : '—'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      {(mappingChecklist?.groups || []).map((group) => (
                        <div key={group.key} className={`rounded-2xl border px-3 py-2 text-xs ${group.present ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-white/10 bg-black/20 text-zinc-400'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <strong>{group.label}</strong>
                            <span>{group.present ? 'OK' : 'Falta'}</span>
                          </div>
                          {group.dryRunAssets > 0 && !group.present && <p className="mt-1 text-amber-100/80">Simulação não conta como material real.</p>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start gap-3">
                      <Upload className="mt-1 text-amber-100" size={18} />
                      <div>
                        <p className="text-sm font-black text-white">Guardar material real no cofre privado</p>
                        <p className="mt-1 text-xs leading-relaxed text-zinc-500">Foto, vídeo curto, áudio ou PDF até 25 MB. O painel salva bucket/key e nunca mostra URL pública.</p>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <label className="grid gap-2 text-sm font-bold text-zinc-300">
                        Tipo de material
                        <select value={selectedMappingRequirement?.id || ''} onChange={(event) => setMappingRequirementId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50">
                          {mappingRequirements.length === 0 && <option value="">Nenhum requisito ativo cadastrado</option>}
                          {mappingRequirements.map((requirement) => (
                            <option key={requirement.id} value={requirement.id}>
                              {requirement.title} · {requirement.mediaType === 'image' ? 'Imagem' : requirement.mediaType === 'audio' ? 'Áudio' : 'Vídeo'}
                            </option>
                          ))}
                        </select>
                      </label>

                      {selectedMappingRequirement && (
                        <div className="rounded-2xl border border-sky-300/20 bg-sky-300/10 p-4">
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-100/70">Orientação de envio</p>
                          <p className="mt-2 text-sm leading-relaxed text-sky-50">{selectedMappingRequirement.guidance || selectedMappingRequirement.description}</p>
                        </div>
                      )}

                      <label className="grid gap-2 text-sm font-bold text-zinc-300">
                        Material
                        <input type="file" accept={selectedMappingRequirement?.accept || ''} onChange={(event) => setKycFile(event.target.files?.[0] || null)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-zinc-200 outline-none file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-black file:text-zinc-950 focus:border-amber-300/50" />
                      </label>

                      {kycFile && (
                        <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs text-emerald-100">
                          Selecionado: {kycFile.name} • {(kycFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}

                      <button type="button" onClick={() => void handleRegisterRealAsset()} disabled={registerKycAssetMutation.isPending || !kycFile || !selectedMappingRequirement} className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                        Guardar material real no cofre privado
                      </button>
                    </div>
                  </div>

                  <button type="button" onClick={handleRegisterDryRunAsset} disabled={registerKycAssetMutation.isPending || !selectedMappingRequirement} className="w-full rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                    Registrar simulação segura sem enviar arquivo
                  </button>

                  <div className="grid gap-2">
                    {(selectedKycCaseQuery.data?.assets || []).length === 0 && <p className="text-sm text-zinc-500">Nenhum material listado no mapeamento aberto.</p>}
                    {(selectedKycCaseQuery.data?.assets || []).map((asset) => (
                      <div key={asset.id} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <strong className="text-white">{asset.originalFilename || asset.assetType}</strong>
                          <StatusPill value={asset.status} />
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">{asset.contentType || 'Tipo não informado'} • {asset.byteSize ? `${(asset.byteSize / 1024 / 1024).toFixed(2)} MB` : 'Tamanho não informado'}</p>
                        <p className="mt-1 text-xs text-emerald-100">Arquivo guardado no cofre privado. Abertura passa pelo backend protegido, sem URL pública.</p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <button type="button" onClick={() => void handleViewPrivateAsset(asset)} disabled={asset.status === 'registered_dry_run' || assetActionId === asset.id} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                            <Eye size={14} />
                            Abrir seguro
                          </button>
                          <button type="button" onClick={() => void handleDownloadPrivateAsset(asset)} disabled={asset.status === 'registered_dry_run' || assetActionId === asset.id} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-3 py-2 text-xs font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">
                            <Download size={14} />
                            Baixar seguro
                          </button>
                        </div>
                        {asset.status === 'registered_dry_run' && <p className="mt-2 text-xs text-amber-100">Simulação: não existe arquivo real para abrir.</p>}
                      </div>
                    ))}
                  </div>

                  <div className={`rounded-2xl border p-4 ${adminDecisionToneClass(adminDecision.tone)}`}>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">Decisão do Admin</p>
                    <p className="mt-2 text-sm font-black">{adminDecision.label}</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-80">{adminDecision.description}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                        <strong className="block">Envio do ator</strong>
                        <span className="opacity-75">{mappingSentForReview ? `Recebido${mappingSentAt ? ` em ${formatDate(mappingSentAt)}` : ''}` : 'Pendente'}</span>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                        <strong className="block">Checklist</strong>
                        <span className="opacity-75">{mappingChecklist ? `${mappingChecklist.completedRequired}/${mappingChecklist.totalRequired}` : '—'}</span>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs">
                        <strong className="block">Após aprovação</strong>
                        <span className="opacity-75">Autorização segue separada</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={handleApproveKyc} disabled={approveKycMutation.isPending || !approveMappingAllowed} className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50">
                      Aprovar mapeamento
                    </button>
                    <button type="button" onClick={handleRejectKyc} disabled={rejectKycMutation.isPending || !rejectMappingAllowed} className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                      Solicitar ajustes
                    </button>
                  </div>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Relatório de conformidade do avatar</p>
                <h2 className="mt-2 text-2xl font-black text-white">{selectedAvatar?.name || 'Avatar selecionado'}</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Visão simples para saber se o avatar está liberado para produção real ou qual pendência precisa ser resolvida.
                </p>
              </div>
              <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${avatarComplianceReport?.productionAllowed ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/25 bg-amber-400/10 text-amber-100'}`}>
                {avatarComplianceReportQuery.isLoading ? 'Verificando...' : avatarComplianceReport?.productionAllowed ? 'Liberado' : 'Bloqueado'}
              </div>
            </div>

            {avatarComplianceReport ? (
              <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_360px]">
                <div className={`rounded-2xl border p-4 ${avatarComplianceReport.productionAllowed ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                  <p className={`text-sm font-black ${avatarComplianceReport.productionAllowed ? 'text-emerald-100' : 'text-amber-100'}`}>
                    {avatarComplianceReport.summary}
                  </p>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Pessoa participante</p>
                      <p className="mt-1 text-sm font-black text-white">{avatarComplianceReport.actor?.displayName || 'Não vinculado'}</p>
                      <p className="mt-1 text-xs text-zinc-500">{statusLabel(avatarComplianceReport.actor?.status)} • {statusLabel(avatarComplianceReport.actor?.mappingStatus)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Mapeamento</p>
                      <p className="mt-1 text-sm font-black text-white">{statusLabel(avatarComplianceReport.mapping?.status)}</p>
                      <p className="mt-1 text-xs text-zinc-500">
                        Checklist: {avatarComplianceReport.mapping?.checklist ? `${avatarComplianceReport.mapping.checklist.completedRequired}/${avatarComplianceReport.mapping.checklist.totalRequired}` : '—'}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Cofre privado</p>
                      <p className="mt-1 text-sm font-black text-white">{avatarComplianceReport.vault.real} reais • {avatarComplianceReport.vault.dryRun} simulações</p>
                      <p className="mt-1 text-xs text-zinc-500">R2 checado: {avatarComplianceReport.vault.r2Checked > 0 ? `${avatarComplianceReport.vault.r2ObjectExists}/${avatarComplianceReport.vault.r2Checked}` : 'não'}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Autorização</p>
                      <p className="mt-1 text-sm font-black text-white">{statusLabel(avatarComplianceReport.authorization?.status)}</p>
                      <p className="mt-1 text-xs text-zinc-500">Tipos: {avatarComplianceReport.authorization?.authorizedForContentTypes?.join(', ') || '—'}</p>
                    </div>
                  </div>
                </div>

                <aside className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Pendências</p>
                  {avatarComplianceReport.reasons.length === 0 ? (
                    <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-100">
                      Tudo certo para produção real, respeitando os tipos autorizados.
                    </div>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {avatarComplianceReport.reasons.map((reason) => (
                        <div key={reason.code} className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-3 text-sm text-amber-100">
                          {reason.message}
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={() => void avatarComplianceReportQuery.refetch()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
                    <RefreshCw size={15} />
                    Atualizar relatório
                  </button>
                </aside>
              </div>
            ) : (
              <p className="mt-4 text-sm text-zinc-500">Selecione um avatar para carregar o relatório.</p>
            )}
          </SectionCard>

          <SectionCard>
            <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-black text-white">Autorização de produção</h2>
                    <p className="mt-1 text-sm text-zinc-500">Libera lote real somente para avatar com autorização ativa.</p>
                  </div>
                  <ShieldCheck className="text-emerald-100" size={22} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-zinc-300">
                    Avatar
                    <select value={selectedAvatar?.id || ''} onChange={(event) => setSelectedAvatarId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50">
                      {avatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name}</option>)}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-300">
                    Observação da autorização
                    <input value={authorizationNote} onChange={(event) => setAuthorizationNote(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
                  </label>
                </div>

                <div className="mt-5">
                  <p className="text-sm font-bold text-zinc-300">Tipos de conteúdo autorizados</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CONTENT_TYPES.map((item) => (
                      <button key={item.value} type="button" onClick={() => toggleContentType(item.value)} className={`rounded-2xl px-4 py-3 text-sm font-black transition ${selectedContentTypes.includes(item.value) ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!safeToAuthorize && (
                  <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-100">
                    <AlertTriangle size={18} className="mb-2" />
                    Para autorizar, selecione uma pessoa com Mapeamento aprovado, completo e um avatar. Pessoas bloqueadas não podem produzir.
                  </div>
                )}

                <button type="button" onClick={handleAuthorizeAvatar} disabled={!safeToAuthorize || authorizeMutation.isPending} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50">
                  <CheckCircle2 size={17} />
                  Autorizar produção deste avatar
                </button>
              </div>

              <aside className="space-y-3 rounded-[2rem] border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Autorizações do avatar</p>
                <h3 className="text-2xl font-black text-white">{selectedAvatar?.name || 'Avatar'}</h3>
                {avatarAuthorizationsQuery.isLoading && <p className="text-sm text-zinc-500">Carregando autorizações...</p>}
                {!avatarAuthorizationsQuery.isLoading && authorizations.length === 0 && <p className="text-sm text-zinc-500">Nenhuma autorização registrada para este avatar.</p>}
                {authorizations.map((authorization) => (
                  <div key={authorization.id} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <StatusPill value={authorization.status} />
                      <span className="text-xs text-zinc-600">{shortId(authorization.id)}</span>
                    </div>
                    <p className="mt-3 text-zinc-400">{authorization.note || 'Sem observação.'}</p>
                    <p className="mt-2 text-xs text-zinc-500">Tipos: {authorization.authorizedForContentTypes.join(', ') || '—'}</p>
                    <p className="mt-1 text-xs text-zinc-500">Criado em {formatDate(authorization.createdAt)}</p>
                    {authorization.status === 'active' && (
                      <button type="button" onClick={() => handleRevokeAuthorization(authorization)} disabled={revokeAuthorizationMutation.isPending} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">
                        <X size={15} />
                        Revogar autorização
                      </button>
                    )}
                  </div>
                ))}
              </aside>
            </div>
          </SectionCard>

          <SectionCard>
            <div className="flex items-start gap-4">
              <Clock3 className="mt-1 text-amber-100" size={22} />
              <div>
                <h2 className="text-xl font-black text-white">O que esta tela ainda não faz</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                  Ainda não mostra link de arquivo privado, não cria pagamento de pessoa participante e não altera a tela Cliente. O envio real de mapeamento já guarda o material no cofre privado e mantém apenas bucket/key no painel.
                </p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </section>
  )
}
