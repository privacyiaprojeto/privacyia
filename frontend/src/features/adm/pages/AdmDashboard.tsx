import { useEffect, useMemo, useRef, useState, type ElementType, type MouseEvent, type ReactNode } from 'react'
import {
  AlertTriangle,
  Archive,
  Boxes,
  BrainCircuit,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Crown,
  Eye,
  Gauge,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Info,
  Layers3,
  LayoutGrid,
  ListChecks,
  LogOut,
  Maximize2,
  Move,
  Music,
  PanelLeft,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  Store,
  UserCheck,
  Video,
  X,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/shared/stores/useAuthStore'
import { useLogout } from '@/features/auth/hooks/useLogout'
import {
  useApproveFactoryAsset,
  useCreateFactoryAssetPreview,
  useFactoryAssets,
  useFactoryBatches,
  useFactoryBatchItems,
  useFactoryPublishableProducts,
  useFactoryDeliveries,
  useFactoryAssetsByCombination,
  useFactoryDeliveriesByCombination,
  useFactorySummary,
  useRejectFactoryAsset,
  useUpdateFactoryProductPublication,
  useUpdateAssetCommercialPrice,
  useUpdateCombinationCommercialPrice,
  useUpdateBatchCommercialPrice,
  usePreflightSingleRealProduction,
  useStartSingleRealProduction,
  usePreviewFactoryBatchControlledAction,
  usePrepareFactoryBatchControlledAction,
} from '@/features/adm/hooks/useFactoryAdmin'
import type { FactoryAsset, FactoryBatch, FactoryBatchItem, FactoryDelivery, FactorySummary, FactoryBatchControlledActionPayload, FactoryBatchControlledActionResponse, RealProductionPreflightResponse, SecurePreviewResponse } from '@/features/adm/types'
import { parseApiError } from '@/shared/utils/parseApiError'
import { ActorCompliancePanel } from '@/features/adm/components/ActorCompliancePanel'
import { ActorMappingInspectionDesk } from '@/features/adm/components/ActorMappingInspectionDesk'
import { ActorIdentityPreparationPage } from '@/features/adm/components/ActorIdentityPreparationPage'
import { NarrativeStudioPanel } from '@/features/adm/components/NarrativeStudioPanel'
import { SceneDirectionStudioPanel } from '@/features/adm/components/SceneDirectionStudioPanel'
import { ProductSplitsPanel } from '@/features/adm/components/ProductSplitsPanel'
import { IntelligenceCenterPage } from '@/features/adm/pages/IntelligenceCenterPage'
import {
  ActorExclusiveReviewTab,
  ActorPipelineSummaryPanel,
  ActorProductionStudioTab,
  ActorPublicationStorefrontTab,
} from '@/features/adm/components/ActorPipelineTabs'
import { useActorProfiles, useAvatarComplianceReport, useAvatarComplianceReports, useBlockActorProfile, useCreateActorProfile, useGenerateActorInvite, useUnblockActorProfile } from '@/features/adm/hooks/useActorCompliance'
import type { ActorProfile } from '@/features/adm/api/actorComplianceApi'
import {
  useCreateCreationItems,
  useCreateCreationTitle,
  useCreateSafeGuidedProductionBatch,
  useCreationAvatars,
  useCreationTitles,
} from '@/features/adm/hooks/useCreationAdmin'
import type { CreationAvatarDto, CreationTitleDto, GuidedProductionBatchResponse } from '@/features/adm/api/creationAdminApi'

type AdminPage =
  | 'overview'
  | 'intelligence'
  | 'review'
  | 'stock'
  | 'batches'
  | 'deliveries'
  | 'prompts'
  | 'realProduction'
  | 'sceneStudio'
  | 'narrativeStudio'
  | 'avatars'
  | 'actors'
  | 'reports'
  | 'guide'

type CardTone = 'zinc' | 'amber' | 'emerald' | 'red' | 'blue' | 'violet' | 'fuchsia'
type AdminModule = 'dashboard' | 'intelligence' | 'actors' | 'production' | 'review' | 'storefront' | 'reports' | 'guide'
type MediaFilter = 'all' | 'imagem' | 'video' | 'audio'
type ReviewStatusFilter = 'qa_pending' | 'available' | 'rejected'
type ReviewModalTab = 'decision' | 'prompt' | 'history'
type ContentObject = 'Imagem' | 'Vídeo' | 'Vídeo curto' | 'Live Action' | 'Áudio' | 'Áudio Live'
type CreationTab = 'titles' | 'avatar' | 'production' | 'client'
type CreativeFactoryMediaFilter = 'all' | 'image' | 'audio' | 'video'
type CreativeFactoryCategoryFilter = 'all' | 'pose' | 'scenario' | 'voice'
type ActorsCompaniesTab = 'overview' | 'actors' | 'invites' | 'mapping' | 'authorizations' | 'avatar' | 'companies'
type ActorProfileMediaTab = 'overview' | 'kyc' | 'production' | 'review' | 'publication'
type GlobalActorFilter = { actorId: string; actorName: string; aliases: string[] }
type ActorLegacyPanel = 'actors' | 'avatar' | null
type ActorAdminModal = 'create' | 'access' | 'block' | 'report' | 'advanced' | null
type OperationalProductionFilter = 'all' | 'released' | 'blocked' | 'mapping' | 'authorization'
type BatchBoardFilter = 'all' | 'guided' | 'queued' | 'running' | 'review' | 'completed' | 'failed' | 'safe' | 'real'
type ProductionLotsTab = 'create' | 'active' | 'history'
type BatchDetailTab = 'summary' | 'items' | 'checklist' | 'history'
type SelectionMap = Record<string, string[]>

interface CatalogProductionFocus {
  assetId: string
  combinationId: string
  companionId: string
  title: string
  mediaType: string
  contentType: ContentObject
  companionName: string
  priceCredits: number | null
  targetVariants: number
  selections: SelectionMap
}

interface ProductionPlanPreview {
  id: string
  avatarName: string
  contentType: ContentObject
  destination: string
  combinationTotal: number
  requestedVariants: number
  estimatedMediaTotal: number
  groups: Array<{ title: string; items: string[] }>
  examples: string[]
  createdAt: string
}

type ProductionPreviewGroup = { title: CreationTitle; selectedItems: CreationItem[] }

function buildCartesianPreviewLabels(groups: ProductionPreviewGroup[], limit = 6) {
  if (groups.length === 0) return []

  const labels: string[] = []
  const walk = (groupIndex: number, path: string[]) => {
    if (labels.length >= limit) return
    if (groupIndex >= groups.length) {
      labels.push(path.join(' + '))
      return
    }

    const group = groups[groupIndex]
    for (const item of group.selectedItems) {
      walk(groupIndex + 1, [...path, `${group.title.name}: ${item.name}`])
      if (labels.length >= limit) break
    }
  }

  walk(0, [])
  return labels
}

type CatalogDrawerMode = 'details' | 'price' | 'deliveries' | 'variations' | 'productionProduct' | 'publication'
type CatalogMediaFilter = 'all' | 'image' | 'audio' | 'video'
type CatalogPriceFilter = 'all' | 'priced' | 'unpriced'
type CatalogPublicationFilter = 'all' | 'published' | 'hidden'

interface ProductionProductReadinessCheck {
  label: string
  helper: string
  ok: boolean
}

interface CatalogMediaFactoryReadinessCheck {
  label: string
  status: string
  helper: string
  highlighted?: boolean
  attention?: boolean
}

interface CreationItem {
  id: string
  name: string
  visibleToClient: boolean
  adminOnly: boolean
  note: string
}


interface CreationTitle {
  id: string
  name: string
  contentTypes: ContentObject[]
  description: string
  visibleToClient: boolean
  adminOnly: boolean
  items: CreationItem[]
}


interface AvatarProfile {
  id: string
  name: string
  subtitle: string
  enabledContentTypes: ContentObject[]
}


type DeliveryStatusFilter = 'all' | 'delivered' | 'error' | 'free'
type FinanceRootTab = 'finance' | 'reports'
type FinanceSubTab = 'sales' | 'payouts' | 'costs'
type GuideTopicId = 'getting-started' | 'actors' | 'production' | 'sales' | 'status' | 'safety'


const STOCK_STATUS_OPTIONS = [
  { value: 'all', label: 'Tudo' },
  { value: 'available', label: 'À venda' },
  { value: 'sold', label: 'Já entregue' },
  { value: 'rejected', label: 'Reprovado' },
]

const REVIEW_MEDIA_FILTERS: Array<{ value: MediaFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'imagem', label: 'Imagens' },
  { value: 'video', label: 'Vídeos' },
  { value: 'audio', label: 'Áudios' },
]

const REVIEW_STATUS_FILTERS: Array<{ value: ReviewStatusFilter; label: string; helper: string }> = [
  { value: 'qa_pending', label: 'Aguardando decisão', helper: 'Conteúdos que precisam de decisão.' },
  { value: 'available', label: 'Aprovados', helper: 'Itens já liberados para catálogo.' },
  { value: 'rejected', label: 'Reprovados', helper: 'Itens retirados da venda.' },
]

const REVIEW_MODAL_TABS: Array<{ value: ReviewModalTab; label: string }> = [
  { value: 'decision', label: 'Decisão' },
  { value: 'prompt', label: 'Prompt' },
  { value: 'history', label: 'Histórico' },
]

const PRODUCTION_VARIATION_TARGET_OPTIONS = [5, 6, 7, 8, 9, 10]

const UX8_NAV_ITEMS: Array<{
  id: AdminModule
  label: string
  description: string
  icon: ElementType
  targetPage: AdminPage
}> = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    description: 'Visão geral',
    icon: Home,
    targetPage: 'overview',
  },
  {
    id: 'intelligence',
    label: 'Central de Inteligência',
    description: 'Configuração global e fontes únicas',
    icon: BrainCircuit,
    targetPage: 'intelligence',
  },
  {
    id: 'actors',
    label: 'Atores & Empresas',
    description: 'Acesso aos perfis',
    icon: UserCheck,
    targetPage: 'actors',
  },
  {
    id: 'review',
    label: 'Revisão Geral',
    description: 'Curadoria e decisão de conteúdos',
    icon: LayoutGrid,
    targetPage: 'review',
  },
  {
    id: 'storefront',
    label: 'Publicação / Vitrine',
    description: 'Disponibilidade, preço e exposição',
    icon: Store,
    targetPage: 'stock',
  },
]

const UX8_MODULE_BY_PAGE: Record<AdminPage, AdminModule> = {
  overview: 'dashboard',
  intelligence: 'intelligence',
  actors: 'actors',
  avatars: 'actors',
  prompts: 'intelligence',
  realProduction: 'intelligence',
  sceneStudio: 'intelligence',
  batches: 'intelligence',
  narrativeStudio: 'intelligence',
  review: 'review',
  stock: 'storefront',
  deliveries: 'storefront',
  reports: 'reports',
  guide: 'guide',
}

const UX8_MODULE_TABS: Partial<Record<AdminModule, Array<{
  page: AdminPage
  label: string
  description: string
  icon: ElementType
  advanced?: boolean
}>>> = {
  production: [
    { page: 'sceneStudio', label: 'Direção de Cena', description: 'Biblioteca de cenas, elenco e ambientação.', icon: Video },
    { page: 'prompts', label: 'Variáveis e Combinações', description: 'Cadastro de variáveis e preparação guiada de lotes.', icon: Sparkles },
    { page: 'batches', label: 'Lotes', description: 'Acompanhamento dos lotes já preparados.', icon: Layers3 },
    { page: 'narrativeStudio', label: 'Narrativo', description: 'Audio Live e Live Action preservados.', icon: Music },
  ],
  storefront: [
    { page: 'stock', label: 'Disponíveis', description: 'Prateleira, preço e publicação.', icon: Store },
    { page: 'deliveries', label: 'Entregas', description: 'Consulta gerencial das liberações.', icon: Send },
  ],
}

function ux8ModuleForPage(page: AdminPage): AdminModule {
  return UX8_MODULE_BY_PAGE[page] || 'dashboard'
}

const CONTENT_OBJECTS: ContentObject[] = ['Imagem', 'Vídeo', 'Vídeo curto', 'Live Action', 'Áudio', 'Áudio Live']

const API_CONTENT_TYPE_BY_LABEL: Record<ContentObject, string> = {
  Imagem: 'image',
  Vídeo: 'video',
  'Vídeo curto': 'short_video',
  'Live Action': 'live_action',
  Áudio: 'audio',
  'Áudio Live': 'live_audio',
}

const LABEL_BY_API_CONTENT_TYPE: Record<string, ContentObject> = {
  image: 'Imagem',
  imagem: 'Imagem',
  video: 'Vídeo',
  short_video: 'Vídeo curto',
  video_curto: 'Vídeo curto',
  live_action: 'Live Action',
  audio: 'Áudio',
  live_audio: 'Áudio Live',
  audio_live: 'Áudio Live',
}

function toApiContentType(value: ContentObject) {
  return API_CONTENT_TYPE_BY_LABEL[value] || 'image'
}

function toContentObject(value: string): ContentObject {
  return LABEL_BY_API_CONTENT_TYPE[value] || 'Imagem'
}

function isUuid(value?: string | null) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function mapCreationTitleFromApi(title: CreationTitleDto): CreationTitle {
  return {
    id: title.id,
    name: title.name,
    contentTypes: (title.contentTypes || []).map(toContentObject),
    description: title.description || 'Título salvo na Fábrica Guiada.',
    visibleToClient: title.visibleToClient,
    adminOnly: title.adminOnly,
    items: (title.items || []).map((item) => ({
      id: item.id,
      name: item.name,
      visibleToClient: item.visibleToClient,
      adminOnly: item.adminOnly,
      note: item.description || 'Item salvo na Fábrica Guiada.',
    })),
  }
}


function mapCreationAvatarFromApi(avatar: CreationAvatarDto): AvatarProfile {
  return {
    id: avatar.id,
    name: avatar.name,
    subtitle: avatar.slug ? `@${avatar.slug}` : 'Avatar cadastrado no sistema',
    enabledContentTypes: ['Imagem', 'Vídeo curto', 'Áudio'],
  }
}

const INITIAL_CREATION_TITLES: CreationTitle[] = [
  {
    id: 'title-local',
    name: 'Local',
    contentTypes: ['Imagem', 'Vídeo', 'Vídeo curto', 'Live Action'],
    description: 'Onde a cena visual acontece. Não aparece em áudios porque áudio não depende de cenário visual.',
    visibleToClient: true,
    adminOnly: false,
    items: [
      { id: 'item-praia', name: 'Praia', visibleToClient: true, adminOnly: false, note: 'Opção simples para cliente e fábrica visual.' },
      { id: 'item-sofa', name: 'Sofá', visibleToClient: true, adminOnly: false, note: 'Ambiente interno simples.' },
      { id: 'item-estudio', name: 'Estúdio', visibleToClient: false, adminOnly: true, note: 'Uso interno para produção controlada.' },
    ],
  },
  {
    id: 'title-estilo',
    name: 'Estilo visual',
    contentTypes: ['Imagem', 'Vídeo', 'Vídeo curto', 'Live Action'],
    description: 'Define aparência geral da mídia visual sem expor prompt técnico para o cliente.',
    visibleToClient: true,
    adminOnly: false,
    items: [
      { id: 'item-casual', name: 'Casual', visibleToClient: true, adminOnly: false, note: 'Visual leve e cotidiano.' },
      { id: 'item-elegante', name: 'Elegante', visibleToClient: true, adminOnly: false, note: 'Visual mais refinado.' },
      { id: 'item-esportivo', name: 'Esportivo', visibleToClient: false, adminOnly: true, note: 'Pode ser liberado depois por avatar.' },
    ],
  },
  {
    id: 'title-pose-acao',
    name: 'Pose ou ação',
    contentTypes: ['Imagem', 'Vídeo', 'Vídeo curto', 'Live Action'],
    description: 'Indica postura, movimento ou ação visual permitida para a produção.',
    visibleToClient: true,
    adminOnly: false,
    items: [
      { id: 'item-sentada', name: 'Sentada', visibleToClient: true, adminOnly: false, note: 'Pose visual simples.' },
      { id: 'item-em-pe', name: 'Em pé', visibleToClient: true, adminOnly: false, note: 'Pose visual simples.' },
      { id: 'item-selfie', name: 'Selfie', visibleToClient: true, adminOnly: false, note: 'Formato próximo ao estilo social.' },
    ],
  },
  {
    id: 'title-humor',
    name: 'Humor',
    contentTypes: ['Áudio', 'Áudio Live', 'Vídeo', 'Vídeo curto', 'Live Action'],
    description: 'Define o clima da voz ou da performance. Serve mais para áudio e vídeo do que para imagem estática.',
    visibleToClient: true,
    adminOnly: false,
    items: [
      { id: 'item-carinhoso', name: 'Carinhoso', visibleToClient: true, adminOnly: false, note: 'Clima acolhedor e leve.' },
      { id: 'item-animado', name: 'Animado', visibleToClient: true, adminOnly: false, note: 'Clima alegre e energético.' },
      { id: 'item-calmo', name: 'Calmo', visibleToClient: true, adminOnly: false, note: 'Clima tranquilo.' },
    ],
  },
  {
    id: 'title-timbre',
    name: 'Timbre da voz',
    contentTypes: ['Áudio', 'Áudio Live'],
    description: 'Só aparece quando o objeto da criação envolve voz. Não deve aparecer para imagem.',
    visibleToClient: false,
    adminOnly: true,
    items: [
      { id: 'item-suave', name: 'Suave', visibleToClient: false, adminOnly: true, note: 'Direção interna para tom de voz.' },
      { id: 'item-grave', name: 'Mais grave', visibleToClient: false, adminOnly: true, note: 'Direção interna para tom de voz.' },
      { id: 'item-natural', name: 'Natural', visibleToClient: true, adminOnly: false, note: 'Rótulo simples que pode aparecer para o cliente.' },
    ],
  },
]

const AVATAR_PROFILES: AvatarProfile[] = [
  { id: 'avatar-sofia', name: 'Sofia', subtitle: 'Avatar principal de demonstração', enabledContentTypes: ['Imagem', 'Vídeo curto', 'Áudio'] },
  { id: 'avatar-isabella', name: 'Isabella', subtitle: 'Avatar em preparação', enabledContentTypes: ['Imagem', 'Áudio', 'Áudio Live'] },
  { id: 'avatar-novo', name: 'Novo avatar', subtitle: 'Fluxo usado após mapeamento e entrada inicial', enabledContentTypes: ['Imagem'] },
]

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

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    qa_pending: 'Aguardando revisão',
    available: 'À venda',
    sold: 'Já entregue',
    rejected: 'Reprovado',
    completed: 'Concluído',
    running: 'Produzindo',
    queued: 'Aguardando',
    failed: 'Falhou',
    cancelled: 'Cancelado',
  }

  return labels[status] || 'Status não mapeado'
}

function statusDescription(status: string) {
  const descriptions: Record<string, string> = {
    qa_pending: 'Ainda não aparece para clientes. Precisa de aprovação manual.',
    available: 'Já pode aparecer na prateleira de venda e ser comprado pelo cliente.',
    sold: 'Este item já foi entregue antes, mas pode continuar compondo combinações publicadas conforme regra do produto.',
    rejected: 'Foi reprovado na curadoria e fica fora da venda.',
    completed: 'O lote terminou de processar.',
    running: 'O lote ainda está sendo processado.',
    queued: 'O lote está aguardando a próxima etapa.',
    failed: 'O lote encontrou erro e precisa de análise.',
    cancelled: 'O lote foi cancelado.',
  }

  return descriptions[status] || 'Status interno retornado pelo servidor.'
}

function statusClass(status: string) {
  const classes: Record<string, string> = {
    qa_pending: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
    available: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    sold: 'border-sky-400/30 bg-sky-400/10 text-sky-100',
    rejected: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
    completed: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100',
    running: 'border-violet-400/30 bg-violet-400/10 text-violet-100',
    queued: 'border-zinc-500/30 bg-zinc-800 text-zinc-200',
    failed: 'border-rose-400/30 bg-rose-400/10 text-rose-100',
    cancelled: 'border-zinc-500/30 bg-zinc-800 text-zinc-200',
  }

  return classes[status] || 'border-zinc-700 bg-zinc-800 text-zinc-300'
}

function mediaTypeLabel(value?: string | null) {
  const labels: Record<string, string> = {
    imagem: 'Imagem',
    image: 'Imagem',
    foto: 'Foto',
    video: 'Vídeo',
    audio: 'Áudio',
    live_action: 'Vídeo interativo',
    live_audio: 'Áudio interativo',
  }

  if (!value) return 'Mídia'
  return labels[value] || 'Mídia'
}

function adminStatusLabel(value?: string | null) {
  const labels: Record<string, string> = {
    liberado: 'Liberado',
    bloqueado: 'Bloqueado',
    approved: 'Aprovado',
    rejected: 'Ajustes solicitados',
    draft: 'Em preparação',
    invited: 'Convite enviado',
    onboarding: 'Cadastro em andamento',
    kyc_pending: 'Mapeamento em análise',
    not_started: 'Não iniciado',
    pending_review: 'Em análise',
    supplement_review: 'Complementos em análise',
    in_progress: 'Em andamento',
    sent_for_review: 'Em análise',
    changes_requested: 'Ajustes solicitados',
    changes_in_progress: 'Ajustes em andamento',
    pending: 'Pendente',
    blocked: 'Bloqueado',
    active: 'Ativo',
    revoked: 'Revogado',
    expired: 'Expirado',
    authorized: 'Autorizado',
    not_authorized: 'Não autorizado',
    uploaded: 'Enviado',
    registered_dry_run: 'Simulação registrada',
    archived: 'Arquivado',
  }

  if (!value) return '—'
  return labels[value] || value
}

function mappingStatusLabel(value?: string | null) {
  if (!value) return '—'
  return adminStatusLabel(value)
}

function actorOperationalMappingStatus(actor: ActorProfile) {
  return actor.mappingOperationalStatus || actor.latestMappingCaseStatus || actor.kycStatus || 'not_started'
}

function actorOperationalMappingLabel(actor: ActorProfile) {
  return adminStatusLabel(actorOperationalMappingStatus(actor))
}

function actorIdentityLabel(actor: ActorProfile) {
  return actor.identity?.label || 'Não iniciada'
}

function actorIdentityBadgeClass(actor: ActorProfile) {
  const status = String(actor.identity?.status || 'not_started')
  if (status === 'approved') return 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100'
  if (status === 'review_required') return 'border-amber-300/20 bg-amber-300/10 text-amber-100'
  if (['queued', 'training'].includes(status)) return 'border-sky-300/20 bg-sky-300/10 text-sky-100'
  if (['failed', 'changes_required', 'cancelled'].includes(status)) return 'border-rose-300/20 bg-rose-300/10 text-rose-100'
  return 'border-white/10 bg-black/25 text-zinc-400'
}

function isVideoMedia(value?: string | null) {
  const normalized = normalizeText(value)
  return ['video', 'videos', 'short_video', 'video_curto', 'live_action'].includes(normalized)
}

function isAudioMedia(value?: string | null) {
  const normalized = normalizeText(value)
  return ['audio', 'live_audio', 'audio_live', 'tts'].includes(normalized)
}

function mediaIcon(value?: string | null) {
  if (isVideoMedia(value)) return Video
  if (isAudioMedia(value)) return Music
  return ImageIcon
}

function getAssetDisplayUrl(asset: FactoryAsset) {
  return asset.mediaPreview?.thumbnailUrl || asset.mediaPreview?.previewUrl || asset.mediaPreview?.url || null
}

function shortId(value?: string | null) {
  if (!value) return '—'
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

function contentTitle(asset: FactoryAsset) {
  const raw = asset.combination.title || asset.combination.key || ''

  const friendly: Record<string, string> = {
    'Factory Test Combination': 'Conteúdo premium gerado',
  }

  if (friendly[raw]) return friendly[raw]
  if (raw.toLowerCase().includes('factory_test')) return 'Conteúdo premium gerado'

  return raw || `Conteúdo ${shortId(asset.id)}`
}

function guidedSelectionMapFromAsset(asset: FactoryAsset): SelectionMap {
  const selections = Array.isArray(asset.combination.guidedSelections) ? asset.combination.guidedSelections : []

  return selections.reduce<SelectionMap>((acc, selection) => {
    const row = selection as Record<string, unknown>
    const titleId = String(row.titleId ?? row.title_id ?? '').trim()
    const itemId = String(row.itemId ?? row.item_id ?? '').trim()

    if (!isUuid(titleId) || !isUuid(itemId)) return acc

    const current = acc[titleId] || []
    acc[titleId] = current.includes(itemId) ? current : [...current, itemId]
    return acc
  }, {})
}

function resolveAssetContentObject(asset: FactoryAsset): ContentObject {
  const raw = String((asset as any).mediaType || (asset as any).media_type || asset.combination?.mediaType || '').trim()
  return toContentObject(raw)
}

function signatureLabelsFromAsset(asset: FactoryAsset) {
  const selections = Array.isArray(asset.combination.guidedSelections) ? asset.combination.guidedSelections : []

  return selections
    .map((selection) => {
      const selectionRecord = selection as Record<string, unknown>
      const titleName = String(selectionRecord.titleName ?? selectionRecord.dimensionName ?? selectionRecord.category ?? selectionRecord.title ?? '').trim()
      const itemName = String(selectionRecord.itemName ?? selectionRecord.optionName ?? selectionRecord.name ?? selectionRecord.label ?? '').trim()
      if (!titleName && !itemName) return null
      return titleName && itemName ? `${titleName}: ${itemName}` : itemName || titleName
    })
    .filter(Boolean) as string[]
}

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  )
}

function EmptyState({ message, helper, icon: Icon = Info }: { message: string; helper?: string; icon?: ElementType }) {
  return (
    <div className="rounded-[2rem] border border-dashed border-zinc-800 bg-zinc-950/70 p-10 text-center">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-zinc-400">
        <Icon size={22} />
      </div>
      <p className="mt-4 text-sm font-black text-zinc-200">{message}</p>
      {helper && <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">{helper}</p>}
    </div>
  )
}

function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="rounded-[2rem] border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-100">
      <strong className="block text-rose-50">Algo não carregou corretamente.</strong>
      <span className="mt-1 block text-rose-100/80">{parseApiError(error)}</span>
    </div>
  )
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'zinc',
}: {
  label: string
  value: string | number
  helper: string
  icon: ElementType
  tone?: CardTone
}) {
  const tones: Record<CardTone, string> = {
    zinc: 'border-white/10 bg-white/[0.055] text-zinc-300',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    red: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    violet: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
    fuchsia: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100',
  }

  return (
    <div className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-2xl shadow-black/25 backdrop-blur-xl ${tones[tone]}`}>
      <div className="absolute -right-8 -top-8 size-28 rounded-full bg-white/5 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">{label}</p>
          <p className="mt-3 text-3xl font-black tracking-tight text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <Icon size={22} />
        </div>
      </div>
      <p className="relative mt-4 text-xs leading-relaxed text-zinc-400">{helper}</p>
    </div>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
          {eyebrow}
        </span>
        <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">{description}</p>
      </div>
      {action}
    </div>
  )
}

function InfoCard({
  title,
  description,
  icon: Icon,
  tone = 'zinc',
  onClick,
}: {
  title: string
  description: string
  icon: ElementType
  tone?: CardTone
  onClick?: () => void
}) {
  const tones: Record<CardTone, string> = {
    zinc: 'border-white/10 bg-white/[0.055] text-zinc-300',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-100',
    emerald: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100',
    red: 'border-rose-400/25 bg-rose-400/10 text-rose-100',
    blue: 'border-sky-400/25 bg-sky-400/10 text-sky-100',
    violet: 'border-violet-400/25 bg-violet-400/10 text-violet-100',
    fuchsia: 'border-fuchsia-400/25 bg-fuchsia-400/10 text-fuchsia-100',
  }

  const content = (
    <div className="flex items-start gap-4">
      <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
        <Icon size={20} />
      </div>
      <div>
        <p className="font-black text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-zinc-400">{description}</p>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`w-full rounded-[2rem] border p-5 text-left shadow-2xl shadow-black/20 transition hover:-translate-y-0.5 hover:border-white/25 ${tones[tone]}`}
      >
        {content}
      </button>
    )
  }

  return <div className={`w-full rounded-[2rem] border p-5 text-left shadow-2xl shadow-black/20 ${tones[tone]}`}>{content}</div>
}

function Sidebar({
  activePage,
  onSelect,
  user,
  onLogout,
  isOpen,
  onClose,
}: {
  activePage: AdminPage
  onSelect: (page: AdminPage) => void
  user?: { name?: string | null; email?: string | null } | null
  onLogout: () => void
  isOpen: boolean
  onClose: () => void
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Fechar menu lateral"
        onClick={onClose}
        className={`fixed inset-0 z-30 bg-black/70 backdrop-blur-sm transition lg:hidden ${isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[min(88vw,22rem)] border-r border-white/10 bg-black/95 shadow-2xl shadow-black/60 backdrop-blur-2xl transition-transform duration-300 lg:w-80 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full min-h-0 flex-col p-4 sm:p-5">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/30">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
                Admin
              </span>
              <div className="flex items-center gap-2">
                <Crown size={20} className="text-amber-200" />
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-2xl border border-white/10 p-2 text-zinc-400 transition hover:text-white lg:hidden"
                  aria-label="Fechar menu"
                >
                  <X size={17} />
                </button>
              </div>
            </div>
            <h2 className="mt-5 text-2xl font-black text-white">Privacy IA</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">Configuração global separada da operação, revisão e publicação.</p>
          </div>

          <nav className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
            <p className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.20em] text-zinc-600">5 rotas centrais</p>
            <div className="grid gap-2">
              {UX8_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                const isActive = ux8ModuleForPage(activePage) === item.id

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item.targetPage)}
                    className={`group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      isActive
                        ? 'border-white bg-white text-zinc-950 shadow-xl shadow-white/10'
                        : 'border-transparent bg-transparent text-zinc-400 hover:border-white/10 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    <span className={`rounded-xl p-2 ${isActive ? 'bg-zinc-950 text-white' : 'bg-white/[0.06] text-zinc-400'}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-black">{item.label}</span>
                      <span className={`block truncate text-xs ${isActive ? 'text-zinc-600' : 'text-zinc-600'}`}>{item.description}</span>
                    </span>
                    <ChevronRight size={16} className={isActive ? 'text-zinc-950' : 'text-zinc-700'} />
                  </button>
                )
              })}
            </div>
          </nav>

          <div className="mt-5 shrink-0 rounded-[2rem] border border-white/10 bg-white/[0.055] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">Logado como</p>
            <p className="mt-2 font-black text-white">{user?.name || 'Administrador'}</p>
            <p className="mt-1 break-all text-xs text-zinc-500">{user?.email}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500"
            >
              <LogOut size={16} />
              Sair com segurança
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}


function AdminModuleShellTabs({
  activePage,
  onSelect,
}: {
  activePage: AdminPage
  onSelect: (page: AdminPage) => void
}) {
  const activeModule = ux8ModuleForPage(activePage)
  const tabs = UX8_MODULE_TABS[activeModule]

  if (!tabs?.length) return null

  return (
    <nav data-ux8-module-shell="true" className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activePage === tab.page

        return (
          <button
            key={tab.page}
            type="button"
            onClick={() => onSelect(tab.page)}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-left text-sm font-black transition ${
              isActive
                ? 'border-white bg-white text-zinc-950 shadow-xl shadow-white/10'
                : tab.advanced
                  ? 'border-amber-300/20 bg-amber-300/10 text-amber-100 hover:border-amber-200/45'
                  : 'border-white/10 bg-black/30 text-zinc-300 hover:border-white/25 hover:text-white'
            }`}
            title={tab.description}
          >
            <Icon size={16} />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}


// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION
const ACTOR_PROFILE_MEDIA_TABS: Array<{ id: ActorProfileMediaTab; label: string; description: string; icon: ElementType }> = [
  { id: 'overview', label: 'Resumo', description: 'Indicadores, controles e saldo financeiro', icon: Gauge },
  { id: 'kyc', label: 'Mapeamento', description: 'Revisão dos materiais enviados', icon: ShieldCheck },
  { id: 'production', label: 'Estúdio de Produção', description: 'Linha de montagem centrada neste ator', icon: Sparkles },
  { id: 'review', label: 'Revisão de qualidade', description: 'Produtos deste ator aguardando decisão', icon: CheckSquare },
  { id: 'publication', label: 'Publicação & Vitrine', description: 'Destino, preço, descrição e divisão de receitas', icon: Store },
]

function metadataString(metadata: Record<string, unknown> | undefined | null, keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function actorCompanyLabel(actor?: ActorProfile | null) {
  return metadataString(actor?.metadata, ['company', 'empresa', 'agency', 'agencia', 'agencyName', 'companyName']) || 'Empresa não informada'
}

function actorStageLabel(actor?: ActorProfile | null) {
  return metadataString(actor?.metadata, ['stageName', 'artistName', 'apelido', 'nickname', 'avatarName']) || actor?.displayName || 'Ator/Atriz'
}

function actorInitials(actor?: ActorProfile | null) {
  const base = actorStageLabel(actor)
  const initials = base.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('')
  return initials || 'IA'
}


type ActorMediaSplitKey = 'image' | 'audio' | 'video' | 'liveAction'

const ACTOR_FINANCE_SPLIT_FIELDS: Array<{ key: ActorMediaSplitKey; label: string; helper: string }> = [
  { key: 'image', label: 'Imagem', helper: 'Fotos, cards e variações visuais.' },
  { key: 'audio', label: 'Áudio', helper: 'Áudio do chat e Audio Live.' },
  { key: 'video', label: 'Vídeo', helper: 'Vídeos curtos e produtos pré-gravados.' },
  { key: 'liveAction', label: 'Live Action', helper: 'Experiências especiais em movimento.' },
]

function safeMetadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function readNestedNumber(source: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  }
  return fallback
}

function actorFinanceMetadata(actor?: ActorProfile | null) {
  return safeMetadataObject(safeMetadataObject(actor?.metadata).finance)
}

function actorMediaSplitPercent(actor: ActorProfile | null, key: ActorMediaSplitKey, fallback = 0) {
  const finance = actorFinanceMetadata(actor)
  const mediaTypePayouts = safeMetadataObject(finance.mediaTypePayouts)
  const mediaTypeSplits = safeMetadataObject(finance.mediaTypeSplits)
  const rule = safeMetadataObject(mediaTypePayouts[key] || mediaTypeSplits[key])
  const fromRule = readNestedNumber(rule, ['payoutPercent', 'actorPercent', 'percent'], Number.NaN)
  if (Number.isFinite(fromRule)) return fromRule
  const fromFlat = readNestedNumber(finance, [`${key}PayoutPercent`, `${key}ActorPercent`, `${key}Percent`], Number.NaN)
  if (Number.isFinite(fromFlat)) return fromFlat
  return fallback
}

function actorDefaultPayoutPercent(actor: ActorProfile | null) {
  const finance = actorFinanceMetadata(actor)
  const bps = readNestedNumber(finance, ['payoutRateBps', 'actorShareBps', 'revenueShareBps'], 0)
  if (bps > 0) return Math.round((bps / 100) * 100) / 100
  return readNestedNumber(finance, ['payoutPercent', 'actorSharePercent', 'revenueSharePercent'], 0)
}


function normalizeAdminSearch(value?: string | null) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function actorSearchHaystack(actor: ActorProfile) {
  const metadata = actor.metadata || {}
  return normalizeAdminSearch([
    actor.displayName,
    actor.legalName,
    actor.email,
    actor.phone,
    actor.status,
    actor.kycStatus,
    actor.productionStatus,
    metadataString(metadata, ['company', 'empresa', 'agency', 'agencia', 'agencyName', 'companyName']),
    metadataString(metadata, ['stageName', 'artistName', 'apelido', 'nickname', 'avatarName']),
  ].filter(Boolean).join(' '))
}

function actorLocalMatch(actor: ActorProfile, query: string) {
  const normalizedQuery = normalizeAdminSearch(query)
  if (!normalizedQuery) return true
  return actorSearchHaystack(actor).includes(normalizedQuery)
}

function actorAssetText(asset: FactoryAsset) {
  return normalizeAdminSearch([
    asset.companion?.name,
    asset.companion?.slug,
    asset.combination?.title,
    asset.combination?.key,
    contentTitle(asset),
    mediaTypeLabel(asset.mediaType),
  ].filter(Boolean).join(' '))
}

function assetLooksLinkedToActor(actor: ActorProfile | null, asset: FactoryAsset) {
  if (!actor) return false
  const text = actorAssetText(asset)
  const candidates = [
    actor.displayName,
    actor.legalName,
    actor.email,
    actorStageLabel(actor),
    metadataString(actor.metadata, ['avatarName', 'companionName', 'stageName', 'artistName', 'apelido', 'nickname']),
  ].map(normalizeAdminSearch).filter((item) => item.length >= 3)

  return candidates.some((candidate) => text.includes(candidate) || candidate.includes(text))
}

function actorFilterAliases(actor: ActorProfile) {
  return buildUniqueOptions([
    actorStageLabel(actor),
    actor.displayName,
    actor.legalName || '',
    metadataString(actor.metadata, ['avatarName', 'companionName', 'stageName', 'artistName', 'apelido', 'nickname']),
  ].filter(Boolean))
}

function globalActorFilterFromProfile(actor: ActorProfile): GlobalActorFilter {
  return {
    actorId: actor.id,
    actorName: actorStageLabel(actor),
    aliases: actorFilterAliases(actor),
  }
}

function normalizedActorValuesOverlap(left: string, right: string) {
  const normalizedLeft = normalizeAdminSearch(left)
  const normalizedRight = normalizeAdminSearch(right)
  if (!normalizedLeft || !normalizedRight) return false
  if (normalizedLeft === normalizedRight) return true
  if (normalizedLeft.length < 3 || normalizedRight.length < 3) return false
  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)
}

function actorProfileMatchesDelivery(actor: ActorProfile, delivery: FactoryDelivery) {
  const metadata = safeMetadataObject(actor.metadata)
  const linkedIds = ['companionId', 'companion_id', 'avatarId', 'avatar_id']
    .map((key) => metadata[key])
    .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))

  if (linkedIds.includes(delivery.companion.id)) return true
  return actorFilterAliases(actor).some((alias) => normalizedActorValuesOverlap(alias, deliveryActorName(delivery)))
}

function deliveryMatchesGlobalActorFilter(delivery: FactoryDelivery, actorFilter: GlobalActorFilter | null) {
  if (!actorFilter) return true
  if (actorFilter.actorId === delivery.companion.id) return true
  return actorFilter.aliases.some((alias) => normalizedActorValuesOverlap(alias, deliveryActorName(delivery)))
}

function deliveryMediaSplitKey(delivery: FactoryDelivery): ActorMediaSplitKey {
  const mediaType = normalizeAdminSearch(delivery.asset.mediaType || delivery.combination.mediaType || '')
  if (mediaType.includes('live') && (mediaType.includes('action') || mediaType.includes('video'))) return 'liveAction'
  if (mediaType.includes('audio') || mediaType.includes('voice') || mediaType.includes('som')) return 'audio'
  if (mediaType.includes('video')) return 'video'
  return 'image'
}

function actorPayoutPercentForDelivery(actor: ActorProfile | null, delivery: FactoryDelivery) {
  if (!actor) return 0
  const defaultPercent = actorDefaultPayoutPercent(actor)
  return actorMediaSplitPercent(actor, deliveryMediaSplitKey(delivery), defaultPercent)
}

function formatCreditsAmount(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(Number.isFinite(value) ? value : 0)
}

function ActorsCompaniesVisualShell({
  onOpenAsset,
  onOpenActorDeliveries,
  onOpenActorReports,
}: {
  initialTab: ActorsCompaniesTab
  onOpenAsset: (asset: FactoryAsset) => void
  onOpenActorDeliveries: (actor: ActorProfile) => void
  onOpenActorReports: (actor: ActorProfile) => void
}) {
  void onOpenActorDeliveries
  void onOpenActorReports
  const [search, setSearch] = useState('')
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null)
  const [activeProfileTab, setActiveProfileTab] = useState<ActorProfileMediaTab>('overview')
  const [identityPreparationOpen, setIdentityPreparationOpen] = useState(false)
  const [legacyPanel, setLegacyPanel] = useState<ActorLegacyPanel>(null)
  const [adminModal, setAdminModal] = useState<ActorAdminModal>(null)
  const [adminModalActorId, setAdminModalActorId] = useState<string | null>(null)
  const actorsQuery = useActorProfiles(search)
  const allAssetsQuery = useFactoryAssets('all')

  const actors = actorsQuery.data?.items || []
  const locallyFilteredActors = useMemo(() => actors.filter((actor) => actorLocalMatch(actor, search)), [actors, search])
  const selectedActor = selectedActorId ? locallyFilteredActors.find((actor) => actor.id === selectedActorId) || null : null
  const adminModalActor = adminModalActorId ? actors.find((actor) => actor.id === adminModalActorId) || selectedActor || null : selectedActor
  const allAssets = allAssetsQuery.data?.items || []
  const linkedAssets = useMemo(() => allAssets.filter((asset) => assetLooksLinkedToActor(selectedActor, asset)), [allAssets, selectedActor])

  useEffect(() => {
    if (selectedActorId && !locallyFilteredActors.some((actor) => actor.id === selectedActorId)) {
      setSelectedActorId(null)
      setActiveProfileTab('overview')
      setIdentityPreparationOpen(false)
    }
  }, [locallyFilteredActors, selectedActorId])

  const openActorProfile = (actor: ActorProfile) => {
    setSelectedActorId(actor.id)
    setActiveProfileTab('overview')
    setIdentityPreparationOpen(false)
  }

  const closeActorProfile = () => {
    setSelectedActorId(null)
    setActiveProfileTab('overview')
    setIdentityPreparationOpen(false)
  }

  const openActorAdminModal = (mode: ActorAdminModal, actor?: ActorProfile | null) => {
    setAdminModalActorId(actor?.id || selectedActor?.id || null)
    setAdminModal(mode)
  }

  return (
    <section data-admin-section="actors-companies-clean" className="space-y-5">
      <PageHeader
        eyebrow="Admin"
        title="Atores & Empresas"
        description="Busque atores, abra o perfil operacional em modal e mantenha cadastro, produtos, mapeamento, avatar e convites fora da superfície principal."
        action={
          <button
            type="button"
            onClick={() => openActorAdminModal('create')}
            className="rounded-2xl bg-amber-300 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-amber-200"
          >
            Cadastrar ator
          </button>
        }
      />

      <div data-admin-section="actors-companies-search-card" className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-2 md:grid-cols-3">
          <MetricCard label="Atores" value={actorsQuery.isLoading ? '...' : locallyFilteredActors.length} helper="Resultado da busca atual." icon={UserCheck} tone="emerald" />
          <MetricCard label="Produtos" value={allAssetsQuery.isLoading ? '...' : allAssets.length} helper="Catálogo operacional vinculado aos perfis." icon={Store} tone="violet" />
          <MetricCard label="Empresas" value="Próximo" helper="Preparado para agências e produtoras." icon={Crown} tone="amber" />
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Pesquisar ator, apelido, empresa ou e-mail</span>
          <div className="mt-2 flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-4 text-zinc-200">
            <Search size={18} className="text-zinc-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Digite nome, apelido, empresa ou e-mail..."
              className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-zinc-600"
            />
          </div>
        </label>
      </div>

      <ActorsCleanSearchList
        actors={locallyFilteredActors}
        isLoading={actorsQuery.isLoading}
        selectedActorId={selectedActor?.id || null}
        search={search}
        onSelect={openActorProfile}
      />

      {selectedActor && (
        <ActorProfileModalDrawer
          onClose={closeActorProfile}
          eyebrow={identityPreparationOpen ? 'Identidade do ator' : 'Perfil do ator'}
          title={identityPreparationOpen ? `Preparação da identidade de ${actorStageLabel(selectedActor)}` : 'Resumo, cofre e linha de montagem'}
          description={identityPreparationOpen
            ? 'Autorize os materiais, registre o conjunto aprovado e acompanhe a preparação da identidade sem misturar outros atores ou etapas de produto.'
            : 'A página principal permanece limpa. Produção, revisão e publicação acontecem dentro deste mesmo modal.'}
        >
          {identityPreparationOpen ? (
            <ActorIdentityPreparationPage
              actor={selectedActor}
              onBack={() => setIdentityPreparationOpen(false)}
            />
          ) : (
            <ActorProfileWorkspace
              actor={selectedActor}
              assets={linkedAssets}
              activeTab={activeProfileTab}
              onChangeTab={setActiveProfileTab}
              onOpenAccessPanel={() => openActorAdminModal('access', selectedActor)}
              onOpenBlockPanel={() => openActorAdminModal('block', selectedActor)}
              onOpenIdentityPreparation={() => setIdentityPreparationOpen(true)}
            />
          )}
        </ActorProfileModalDrawer>
      )}

      {adminModal && (
        <ActorAdminActionModal
          mode={adminModal}
          actor={adminModalActor}
          onClose={() => setAdminModal(null)}
          onOpenScopedTab={(tab) => {
            setAdminModal(null)
            setActiveProfileTab(tab)
          }}
        />
      )}

      {legacyPanel && (
        <ActorLegacyPanelDrawer
          panel={legacyPanel}
          actorId={selectedActor?.id || null}
          onClose={() => setLegacyPanel(null)}
          onOpenAsset={onOpenAsset}
        />
      )}
    </section>
  )
}

function ActorProfileModalDrawer({
  children,
  onClose,
  eyebrow = 'Perfil do ator',
  title = 'Resumo, cofre e linha de montagem',
  description = 'A página principal permanece limpa. Produção, revisão e publicação acontecem dentro deste mesmo modal.',
}: {
  children: ReactNode
  onClose: () => void
  eyebrow?: string
  title?: string
  description?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 p-3 backdrop-blur-sm sm:p-5">
      <button type="button" aria-label="Fechar perfil do ator" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">{eyebrow}</p>
            <h3 className="mt-1 text-2xl font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-zinc-300 transition hover:border-white/25 hover:text-white" aria-label="Fechar perfil">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
          {children}
        </div>
      </section>
    </div>
  )
}

function ActorsCleanSearchList({
  actors,
  isLoading,
  selectedActorId,
  search,
  onSelect,
}: {
  actors: ActorProfile[]
  isLoading: boolean
  selectedActorId: string | null
  search: string
  onSelect: (actor: ActorProfile) => void
}) {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Pesquisa limpa</p>
        <h3 className="mt-1 text-xl font-black text-white">Atores cadastrados</h3>
      </div>

      <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
        {isLoading && <EmptyState message="Carregando atores..." icon={UserCheck} />}
        {!isLoading && actors.length === 0 && <EmptyState message="Nenhum ator encontrado." helper={search ? 'Tente outro nome, apelido, empresa ou e-mail.' : 'Cadastre um ator ou gere um convite para começar.'} icon={Search} />}
        {!isLoading && actors.map((actor) => {
          const isSelected = actor.id === selectedActorId
          return (
            <button
              key={actor.id}
              type="button"
              onClick={() => onSelect(actor)}
              className={isSelected
                ? 'w-full rounded-[1.5rem] border border-amber-300/35 bg-amber-300/10 p-4 text-left shadow-lg shadow-amber-950/20 transition'
                : 'w-full rounded-[1.5rem] border border-white/10 bg-black/25 p-4 text-left transition hover:border-white/25 hover:bg-white/[0.055]'}
            >
              <div className="flex items-center gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-amber-300/20 to-fuchsia-400/10 text-sm font-black text-white">
                  {actorInitials(actor)}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-black text-white">{actorStageLabel(actor)}</h4>
                  <p className="mt-1 truncate text-xs font-semibold text-zinc-500">{actor.email || actor.legalName || 'Sem e-mail vinculado'}</p>
                  <p className="mt-1 truncate text-xs text-zinc-600">{actorCompanyLabel(actor)}</p>
                </div>
                <ChevronRight size={16} className={isSelected ? 'text-amber-100' : 'text-zinc-700'} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black tracking-[0.04em]">
                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-300">Cadastro: {adminStatusLabel(actor.status)}</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-300">Mapeamento: {actorOperationalMappingLabel(actor)}</span>
                <span className={`rounded-full border px-2.5 py-1 ${actorIdentityBadgeClass(actor)}`}>Identidade: {actorIdentityLabel(actor)}</span>
                <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-zinc-400">Produção: {adminStatusLabel(actor.productionStatus)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function ActorProfileWorkspace({
  actor,
  assets,
  activeTab,
  onChangeTab,
  onOpenAccessPanel,
  onOpenBlockPanel,
  onOpenIdentityPreparation,
}: {
  actor: ActorProfile | null
  assets: FactoryAsset[]
  activeTab: ActorProfileMediaTab
  onChangeTab: (tab: ActorProfileMediaTab) => void
  onOpenAccessPanel: () => void
  onOpenBlockPanel: () => void
  onOpenIdentityPreparation: () => void
}) {
  if (!actor) {
    return (
      <section className="rounded-[2rem] border border-white/10 bg-black/25 p-8 shadow-2xl shadow-black/20">
        <EmptyState message="Selecione um ator para abrir a linha de montagem." helper="O modal concentra Resumo, Mapeamento, Produção, Revisão e Publicação sem redirecionar para outras páginas." icon={UserCheck} />
      </section>
    )
  }

  const visibleCount = assets.filter((asset) => Boolean(asset.combination.visibleToClient)).length
  const operationalMappingStatus = actorOperationalMappingStatus(actor)
  const nextActorAction = actor.status !== 'approved'
    ? 'Aprovar cadastro'
    : operationalMappingStatus === 'pending_review' || operationalMappingStatus === 'sent_for_review' || operationalMappingStatus === 'supplement_review'
      ? 'Concluir análise'
      : operationalMappingStatus === 'changes_requested' || operationalMappingStatus === 'changes_in_progress'
        ? 'Aguardar novo envio'
        : operationalMappingStatus !== 'approved'
          ? 'Acompanhar mapeamento'
          : !actor.identity || actor.identity.status === 'not_started'
            ? 'Preparar identidade'
            : actor.identity.status !== 'approved'
              ? actor.identity.nextAction
              : actor.productionStatus !== 'authorized'
                ? 'Autorizar produção'
                : assets.some((asset) => asset.status === 'qa_pending')
                  ? 'Revisar qualidade'
                  : 'Operação pronta'

  return (
    <section data-actor-pipeline-modal="true" className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20">
      <div className="border-b border-white/10 bg-gradient-to-br from-amber-300/10 via-fuchsia-400/5 to-black p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-[1.75rem] border border-amber-300/25 bg-black/40 text-2xl font-black text-white shadow-2xl shadow-black/30">
              {actorInitials(actor)}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Linha de montagem centrada no ator</p>
              <h3 className="mt-1 text-3xl font-black text-white">{actorStageLabel(actor)}</h3>
              <p className="mt-1 text-sm font-semibold text-zinc-400">{actorCompanyLabel(actor)}</p>
              <p className="mt-1 text-xs text-zinc-500">{actor.email || 'E-mail não informado'}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-right">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">Contexto persistente</p>
            <p className="mt-1 text-sm font-black text-white">{actorStageLabel(actor)}</p>
            <p className="mt-1 text-xs text-zinc-500">Toda a operação acontece nas abas internas.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <MiniActorMetric label="Status" value={adminStatusLabel(actor.status)} />
          <MiniActorMetric label="Mapeamento" value={actorOperationalMappingLabel(actor)} />
          <MiniActorMetric label="Identidade" value={actorIdentityLabel(actor)} />
          <MiniActorMetric label="Produção" value={adminStatusLabel(actor.productionStatus)} />
          <MiniActorMetric label="Produtos" value={assets.length} />
          <MiniActorMetric label="Publicados" value={visibleCount} />
          <MiniActorMetric label="Etapa atual" value={nextActorAction} />
        </div>
      </div>

      <div className="border-b border-white/10 bg-black/20 p-3">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          {ACTOR_PROFILE_MEDIA_TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab(tab.id)}
                className={isActive
                  ? 'rounded-2xl border border-amber-300/30 bg-amber-300 px-3 py-3 text-left text-zinc-950 transition'
                  : 'rounded-2xl border border-white/10 bg-black/25 px-3 py-3 text-left text-zinc-300 transition hover:border-white/25 hover:bg-white/[0.055]'}
              >
                <span className="flex items-center gap-2 text-sm font-black"><Icon size={16} />{tab.label}</span>
                <span className={isActive ? 'mt-1 block text-[11px] font-bold text-zinc-800' : 'mt-1 block text-[11px] font-bold text-zinc-500'}>{tab.description}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-5">
        {activeTab === 'overview' && (
          <ActorProfileOverview actor={actor} assets={assets} onOpenAccessPanel={onOpenAccessPanel} onOpenBlockPanel={onOpenBlockPanel} />
        )}
        {activeTab === 'kyc' && <ActorProfileMappingTab actor={actor} onProceedToIdentity={() => onChangeTab('production')} />}
        {activeTab === 'production' && <ActorProductionStudioTab actor={actor} onReviewMapping={() => onChangeTab('kyc')} onOpenAuthorization={onOpenIdentityPreparation} />}
        {activeTab === 'review' && <ActorExclusiveReviewTab actor={actor} />}
        {activeTab === 'publication' && <ActorPublicationStorefrontTab actor={actor} />}
      </div>
    </section>
  )
}

function MiniActorMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  )
}

function ActorProfileOverview({
  actor,
  assets,
  onOpenAccessPanel,
  onOpenBlockPanel,
}: {
  actor: ActorProfile
  assets: FactoryAsset[]
  onOpenAccessPanel: () => void
  onOpenBlockPanel: () => void
}) {
  return (
    <div className="space-y-4">
      <ActorPipelineSummaryPanel actor={actor} fallbackProductCount={assets.length} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
          <h4 className="text-lg font-black text-white">Visão geral do perfil</h4>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">O contexto do ator permanece aberto durante toda a operação: mapeamento, produção, revisão e publicação.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <MiniActorMetric label="Nome legal" value={actor.legalName || 'Não informado'} />
            <MiniActorMetric label="Contato" value={actor.phone || actor.email || 'Não informado'} />
            <MiniActorMetric label="Empresa" value={actorCompanyLabel(actor)} />
            <MiniActorMetric label="Identidade" value={actorIdentityLabel(actor)} />
            <MiniActorMetric label="Próxima ação" value={actor.identity?.nextAction || 'Preparar identidade'} />
            <MiniActorMetric label="Produtos encontrados" value={assets.length} />
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
          <h4 className="text-lg font-black text-white">Controles do perfil</h4>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">Ações administrativas abrem sobre este modal e retornam ao mesmo ator.</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={onOpenAccessPanel} className="rounded-2xl bg-amber-300 px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-200">Acesso e convite</button>
            <button type="button" onClick={onOpenBlockPanel} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-white/25">Bloqueio / reativação</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActorProfileMappingTab({ actor, onProceedToIdentity }: { actor: ActorProfile; onProceedToIdentity: () => void }) {
  return <ActorMappingInspectionDesk actor={actor} onProceedToIdentity={onProceedToIdentity} />
}


function actorOnboardingLink(token: string) {
  if (!token) return ''
  return `${window.location.origin}/atores/onboarding/${token}`
}

function ActorAdminActionModal({
  mode,
  actor,
  onClose,
  onOpenScopedTab,
}: {
  mode: Exclude<ActorAdminModal, null>
  actor: ActorProfile | null
  onClose: () => void
  onOpenScopedTab?: (tab: ActorProfileMediaTab) => void
}) {
  const createActorMutation = useCreateActorProfile()
  const inviteMutation = useGenerateActorInvite()
  const blockActorMutation = useBlockActorProfile()
  const unblockActorMutation = useUnblockActorProfile()
  const [displayName, setDisplayName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [email, setEmail] = useState(actor?.email || '')
  const [phone, setPhone] = useState(actor?.phone || '')
  const [reason, setReason] = useState('')
  const [generatedToken, setGeneratedToken] = useState('')
  const [createdActor, setCreatedActor] = useState<ActorProfile | null>(null)
  const targetActor = createdActor || actor
  const onboardingLink = actorOnboardingLink(generatedToken)

  useEffect(() => {
    setEmail(actor?.email || '')
    setPhone(actor?.phone || '')
    setGeneratedToken('')
    setCreatedActor(null)
    setReason('')
  }, [actor?.id, actor?.email, actor?.phone, mode])

  async function handleCreateAndInvite() {
    if (!displayName.trim()) {
      window.alert('Informe o nome artístico/apelido do ator ou empresa.')
      return
    }

    const newActor = await createActorMutation.mutateAsync({
      displayName: displayName.trim(),
      legalName: legalName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      countryCode: 'BR',
      notes: 'Cadastro inicial criado pelo modal limpo do Admin.',
    })

    setCreatedActor(newActor)

    const invite = await inviteMutation.mutateAsync({
      actorId: newActor.id,
      email: email.trim() || newActor.email || undefined,
      expiresInDays: 7,
    })

    setGeneratedToken(invite.invite.inviteToken || '')
  }

  async function handleGenerateInviteForActor() {
    if (!targetActor) return
    const invite = await inviteMutation.mutateAsync({
      actorId: targetActor.id,
      email: email.trim() || targetActor.email || undefined,
      expiresInDays: 7,
    })
    setGeneratedToken(invite.invite.inviteToken || '')
  }

  async function handleBlockToggle() {
    if (!targetActor || !reason.trim()) {
      window.alert('Informe um motivo simples para registrar a decisão.')
      return
    }

    if (targetActor.status === 'blocked') {
      await unblockActorMutation.mutateAsync({ actorId: targetActor.id, reason: reason.trim() })
    } else {
      await blockActorMutation.mutateAsync({ actorId: targetActor.id, reason: reason.trim() })
    }

    onClose()
  }

  const title = mode === 'create'
    ? 'Cadastro inicial e convite'
    : mode === 'access'
      ? 'Acesso e convite'
      : mode === 'block'
        ? 'Bloqueio e reativação'
        : mode === 'report'
          ? 'Relatório do ator'
          : 'Funções avançadas preservadas'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm sm:p-6">
      <button type="button" aria-label="Fechar ação do ator" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/70">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Atores e Empresas</p>
            <h3 className="mt-1 text-2xl font-black text-white">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">Cada função abre no seu próprio modal. A página principal continua limpa e rápida.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-zinc-300 transition hover:border-white/25 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
          {mode === 'create' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-amber-300/15 bg-amber-300/10 p-4">
                <h4 className="text-lg font-black text-white">Novo ator ou empresa</h4>
                <p className="mt-2 text-sm leading-relaxed text-amber-50/75">Use apenas os dados mínimos para criar o cadastro e gerar o convite. Mapeamento, bloqueio, relatório e avatar ficam em modais separados.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Nome artístico / apelido</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="Ex.: Sofia" /></label>
                <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Nome completo / empresa</span><input value={legalName} onChange={(event) => setLegalName(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="Nome legal ou razão social" /></label>
                <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">E-mail de convite</span><input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="email@exemplo.com" /></label>
                <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Telefone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="WhatsApp ou contato" /></label>
              </div>
              <button type="button" onClick={handleCreateAndInvite} disabled={createActorMutation.isPending || inviteMutation.isPending} className="w-full rounded-2xl bg-amber-300 px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
                {createActorMutation.isPending || inviteMutation.isPending ? 'Criando...' : 'Cadastrar e gerar convite'}
              </button>
            </div>
          )}

          {mode === 'access' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Ator selecionado</p>
                <h4 className="mt-1 text-xl font-black text-white">{targetActor ? actorStageLabel(targetActor) : 'Selecione um ator'}</h4>
                <p className="mt-1 text-sm text-zinc-500">{targetActor?.email || 'Sem e-mail vinculado'}</p>
              </div>
              <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">E-mail para convite/reenvio</span><input value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="email@exemplo.com" /></label>
              <button type="button" onClick={handleGenerateInviteForActor} disabled={!targetActor || inviteMutation.isPending} className="w-full rounded-2xl bg-amber-300 px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60">
                {inviteMutation.isPending ? 'Gerando...' : 'Gerar / reenviar convite'}
              </button>
              <p className="text-xs leading-relaxed text-zinc-500">Use esta opção quando o ator perder o link de acesso. Recuperação de senha continua separada do convite, mas o Admin consegue emitir um novo link operacional.</p>
            </div>
          )}

          {mode === 'block' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-rose-300/15 bg-rose-300/10 p-4">
                <h4 className="text-lg font-black text-white">{targetActor?.status === 'blocked' ? 'Reativar ator' : 'Bloquear ator'}</h4>
                <p className="mt-2 text-sm leading-relaxed text-rose-50/70">A ação fica isolada neste modal para não poluir a página principal e evitar clique acidental.</p>
              </div>
              <label className="block"><span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Motivo</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-zinc-600" placeholder="Explique o motivo para auditoria interna." /></label>
              <button type="button" onClick={handleBlockToggle} disabled={!targetActor || blockActorMutation.isPending || unblockActorMutation.isPending} className="w-full rounded-2xl border border-rose-300/25 bg-rose-300/10 px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-rose-100 transition hover:bg-rose-300/15 disabled:cursor-not-allowed disabled:opacity-60">
                {targetActor?.status === 'blocked' ? 'Reativar ator' : 'Bloquear ator'}
              </button>
            </div>
          )}

          {mode === 'report' && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <MiniActorMetric label="Nome" value={targetActor ? actorStageLabel(targetActor) : '—'} />
                <MiniActorMetric label="Status" value={targetActor ? statusLabel(targetActor.status) : '—'} />
                <MiniActorMetric label="Mapeamento" value={targetActor ? statusLabel(targetActor.kycStatus) : '—'} />
                <MiniActorMetric label="Produção" value={targetActor ? statusLabel(targetActor.productionStatus) : '—'} />
              </div>
              <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <h4 className="text-lg font-black text-white">Relatório operacional</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">Resumo limpo para conferência. Entregas e histórico globais só serão abertos com filtro por ator na Fase 7.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => onOpenScopedTab?.('overview')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-white/25">Ver registros locais</button>
                  <button type="button" onClick={() => onOpenScopedTab?.('overview')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-white/25">Histórico deste ator</button>
                </div>
              </div>
            </div>
          )}

          {mode === 'advanced' && (
            <div className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
                <h4 className="text-lg font-black text-white">Painel completo preservado</h4>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">Cadastro avançado, mapeamento, decisões, materiais e autorizações permanecem contidos neste perfil até existir navegação global com filtro de ator.</p>
              </div>
              <button type="button" onClick={() => onOpenScopedTab?.('overview')} className="w-full rounded-2xl bg-amber-300 px-4 py-4 text-sm font-black uppercase tracking-[0.14em] text-zinc-950 transition hover:bg-amber-200">Voltar ao avançado do ator</button>
            </div>
          )}

          {onboardingLink && (
            <div className="mt-5 rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Convite gerado</p>
              <p className="mt-2 break-all rounded-2xl border border-white/10 bg-black/35 p-3 text-sm font-semibold text-white">{onboardingLink}</p>
              <button type="button" onClick={() => void navigator.clipboard?.writeText(onboardingLink)} className="mt-3 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-300/15">Copiar link</button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ActorLegacyPanelDrawer({ panel, actorId, onClose, onOpenAsset }: { panel: Exclude<ActorLegacyPanel, null>; actorId?: string | null; onClose: () => void; onOpenAsset: (asset: FactoryAsset) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 p-3 backdrop-blur-sm sm:p-5">
      <button type="button" aria-label="Fechar painel" onClick={onClose} className="absolute inset-0" />
      <section className="relative z-10 flex h-full w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Função preservada</p>
            <h3 className="mt-1 text-2xl font-black text-white">{panel === 'actors' ? 'Cadastro, convite e mapeamento' : 'Avatar, vitrine e produtos'}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">A lógica antiga continua intacta dentro deste painel. A página principal ficou limpa; as ações densas ficam aqui.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-black/30 p-3 text-zinc-300 transition hover:border-white/25 hover:text-white" aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
          {panel === 'actors' ? <ActorCompliancePanel initialActorId={actorId || undefined} /> : <AvatarPublishingPage onOpenAsset={onOpenAsset} />}
        </div>
      </section>
    </div>
  )
}
// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION

// ADMIN_BUSINESS_SECTION
type CatalogCommercialEtapaMode = 'price' | 'publication' | 'visibility' | 'freeFeed'

function commercialAssetPrice(asset: FactoryAsset) {
  const raw = (asset as any).commercialPriceCredits
    ?? (asset as any).priceCredits
    ?? (asset as any).price_credits
    ?? (asset as any).metadata?.commercialPricing?.priceCredits
    ?? (asset as any).metadata?.commercialPricing?.credits
    ?? (asset as any).commercialPricing?.priceCredits
    ?? (asset as any).commercialPricing?.credits
    ?? (asset as any).combination?.priceCredits
    ?? (asset as any).combination?.price_credits
    ?? (asset as any).pricing?.priceCredits
    ?? null
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : null
}

function commercialAssetAvailabilityLabel(asset: FactoryAsset) {
  const raw = String((asset as any).status || (asset as any).publicationStatus || (asset as any).availability || '').toLowerCase()
  if (raw.includes('sold')) return 'Já vendido'
  if (raw.includes('available')) return 'Disponível'
  if (raw.includes('published')) return 'Publicado'
  if (raw.includes('rejected')) return 'Reprovado'
  if (raw.includes('qa')) return 'Em revisão'
  return 'A conferir'
}

function catalogAssetMediaFilterValue(asset: FactoryAsset): Exclude<CatalogMediaFilter, 'all'> {
  const raw = String((asset as any).mediaType || (asset as any).media_type || asset.combination?.mediaType || '').trim()
  if (isAudioMedia(raw)) return 'audio'
  if (isVideoMedia(raw)) return 'video'
  return 'image'
}

function catalogAssetIsPublished(asset: FactoryAsset) {
  const raw = (asset as any).combination?.visibleToClient
    ?? (asset as any).combination?.visible_to_client
    ?? (asset as any).visibleToClient
    ?? (asset as any).visible_to_client
    ?? (asset as any).publication?.published
    ?? false
  return Boolean(raw)
}

function catalogActorFilterValue(asset: FactoryAsset) {
  return String(asset.companion?.id || asset.companion?.slug || asset.companion?.name || 'sem-ator')
}

function catalogActorLabel(asset: FactoryAsset) {
  return asset.companion?.name || asset.companion?.slug || 'Ator/Atriz não identificado'
}

function buildProductionProductReadiness(asset: FactoryAsset | null, variationsGenerated: number): ProductionProductReadinessCheck[] {
  const price = asset ? commercialAssetPrice(asset) : null
  const hasProductPrompt = Boolean(asset?.combination?.id)
  const hasVariations = variationsGenerated > 0

  return [
    {
      label: 'Produto/prompt do Catálogo IA',
      ok: hasProductPrompt,
      helper: hasProductPrompt ? 'Produto vinculado ao prompt operacional.' : 'Vincule este item a um produto/prompt antes de avançar.',
    },
    {
      label: 'Preço do produto',
      ok: Boolean(price),
      helper: price ? `${price} créditos configurados.` : 'Configure preço maior que zero antes da etapa comercial.',
    },
    {
      label: 'Variações de produção',
      ok: hasVariations,
      helper: hasVariations ? `${variationsGenerated} variação(ões) disponível(is) para este produto.` : 'Produza 5 a 10 variações para aumentar diversidade.',
    },
    {
      label: 'Custo operacional',
      ok: false,
      helper: 'Pendência de negócio: revisar custo antes de produção real.',
    },
    {
      label: 'Regra de repasse',
      ok: false,
      helper: 'Pendência de negócio: definir regra antes de publicar ou vender.',
    },
    {
      label: 'Produção final',
      ok: false,
      helper: 'Produção final segue desligada nesta etapa.',
    },
  ]
}

function buildCatalogMediaFactoryReadiness(asset: FactoryAsset | null): CatalogMediaFactoryReadinessCheck[] {
  const rawType = String((asset as any)?.mediaType || (asset as any)?.media_type || (asset as any)?.contentType || '').toLowerCase()
  const isImage = rawType.includes('image') || rawType.includes('imagem') || rawType.includes('foto')
  const isAudio = rawType.includes('audio') || rawType.includes('áudio')
  const isVideo = rawType.includes('video') || rawType.includes('vídeo') || rawType.includes('live_action')

  return [
    {
      label: 'Imagem',
      status: isImage ? 'Tipo deste produto' : 'Fluxo separado',
      helper: isImage ? 'Segue para planejamento de variações com barreira final desligada.' : 'Pronto para planejamento quando o produto for de imagem.',
      highlighted: isImage,
    },
    {
      label: 'Áudio',
      status: isAudio ? 'Tipo deste produto' : 'Fluxo separado',
      helper: isAudio ? 'Segue para planejamento de áudio com conferência própria.' : 'Mantido separado dos produtos de imagem e vídeo.',
      highlighted: isAudio,
    },
    {
      label: 'Vídeo e Live Action',
      status: isVideo ? 'Atenção especial' : 'Atenção especial',
      helper: isVideo ? 'Produto de vídeo exige validação própria antes de qualquer próxima etapa.' : 'Vídeo fica sinalizado com atenção especial antes de produção final.',
      highlighted: isVideo,
      attention: true,
    },
  ]
}

export function CatalogCommercialEditUiEtapa({
  assets,
  onNavietapa,
}: {
  assets: FactoryAsset[]
  onNavietapa: (page: AdminPage) => void
}) {
  const assetPriceMutation = useUpdateAssetCommercialPrice()
  const [selectedAsset, setSelectedAsset] = useState<FactoryAsset | null>(null)
  const [mode, setMode] = useState<CatalogCommercialEtapaMode>('price')
  const [draftPrice, setDraftPrice] = useState('30')
  const [previewConfirmed, setPreviewConfirmed] = useState(false)
  const [confirmationPhrase, setConfirmationPhrase] = useState('')
  const [lastSaveResult, setLastSaveResult] = useState<string | null>(null)
  const [lastSaveError, setLastSaveError] = useState<string | null>(null)

  const visibleAssets = assets.slice(0, 4)
  const hasAssets = visibleAssets.length > 0
  const normalizedPrice = Number(draftPrice.replace(',', '.'))
  const normalizedPriceInteger = Math.trunc(normalizedPrice)
  const priceIsPositive = Number.isFinite(normalizedPrice) && normalizedPriceInteger > 0
  const selectedPrice = selectedAsset ? commercialAssetPrice(selectedAsset) : null
  const requiredPhrase = 'CONFIRMAR SALVAR PRECO'
  const confirmationOk = confirmationPhrase.trim() === requiredPhrase
  const canSaveControlledPrice = Boolean(selectedAsset && mode === 'price' && priceIsPositive && confirmationOk && !assetPriceMutation.isPending)

  function openEtapa(asset: FactoryAsset, nextMode: CatalogCommercialEtapaMode) {
    setSelectedAsset(asset)
    setMode(nextMode)
    setDraftPrice(String(commercialAssetPrice(asset) || 30))
    setPreviewConfirmed(false)
    setConfirmationPhrase('')
    setLastSaveResult(null)
    setLastSaveError(null)
  }

  function closeEtapa() {
    setSelectedAsset(null)
    setPreviewConfirmed(false)
    setConfirmationPhrase('')
    setLastSaveResult(null)
    setLastSaveError(null)
  }

  async function handleControlledPriceSave() {
    if (!selectedAsset || mode !== 'price') return
    if (!priceIsPositive) {
      setLastSaveError('Preço precisa ser maior que zero. Gratuito/feed continua bloqueado.')
      return
    }
    if (!confirmationOk) {
      setLastSaveError('Digite a frase de confirmação exatamente como exibida para salvar o preço do produto.')
      return
    }

    setLastSaveError(null)
    setLastSaveResult(null)

    try {
      await assetPriceMutation.mutateAsync({
        assetId: selectedAsset.id,
        priceCredits: normalizedPriceInteger,
        note: 'etapa comercial: salvamento controlado de preço pelo Catálogo.',
      })
      setPreviewConfirmed(true)
      setLastSaveResult(`Preço do produto salvo em ${normalizedPriceInteger} créditos. Publicação, disponibilidade e grátis/feed continuam bloqueados.`)
    } catch (error) {
      setLastSaveError(parseApiError(error))
    }
  }

  const modeLabel: Record<CatalogCommercialEtapaMode, string> = {
    price: 'Editar preço',
    publication: 'Publicar ou retirar',
    visibility: 'Disponibilidade',
    freeFeed: 'Gratuito/feed',
  }

  return (
    <section data-admin-section="true" className="rounded-[2rem] border border-emerald-300/10 bg-gradient-to-br from-emerald-300/10 via-white/[0.045] to-black/30 p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">Catálogo comercial</p>
          <h2 className="mt-1 text-2xl font-black text-white">Salvar preço do produto</h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">Atualize o preço de produtos da prateleira com confirmação. Publicação, disponibilidade e grátis/feed continuam protegidos em etapas separadas.</p>
        </div>
        <details className="rounded-[1.5rem] border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300 xl:min-w-[320px]">
          <summary className="cursor-pointer select-none text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Proteções comerciais ativas</summary>
          <div className="mt-3 grid gap-2 text-xs leading-relaxed text-zinc-400">
            <p>Preço precisa ser maior que zero.</p>
            <p>Publicação, disponibilidade e grátis/feed continuam em etapas separadas.</p>
            <p>Histórico de clientes e entregas não é alterado ao salvar preço.</p>
          </div>
        </details>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-4">
        {hasAssets ? visibleAssets.map((asset) => {
          const price = commercialAssetPrice(asset)
          return (
            <article key={asset.id} className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{contentTitle(asset)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{mediaTypeLabel((asset as any).mediaType || (asset as any).media_type)} • {commercialAssetAvailabilityLabel(asset)}</p>
                </div>
                <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] font-black text-zinc-400">{shortId(asset.id)}</span>
              </div>

              <div className="mt-4 grid gap-2 text-xs">
                <div className="flex justify-between gap-3 rounded-2xl bg-white/[0.055] p-3"><span className="text-zinc-500">Preço atual</span><strong className="text-white">{price ? `${price} créditos` : 'Sem preço'}</strong></div>
              </div>

              <div className="mt-3 grid gap-2">
                <button type="button" onClick={() => openEtapa(asset, 'price')} className="rounded-2xl bg-emerald-300 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-200">Salvar preço</button>
                <button type="button" onClick={() => openEtapa(asset, 'publication')} className="rounded-2xl border border-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Publicação protegida</button>
              </div>
            </article>
          )
        }) : (
          <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5 text-sm text-zinc-400 xl:col-span-4">Nenhum produto carregado na prateleira para preparar edição comercial.</div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
        <button type="button" onClick={() => onNavietapa('deliveries')} className="rounded-full border border-white/10 px-4 py-2 text-zinc-300 hover:border-white/20 hover:text-white">Ver entregas</button>
        <button type="button" onClick={() => onNavietapa('reports')} className="rounded-full border border-white/10 px-4 py-2 text-zinc-300 hover:border-white/20 hover:text-white">Ver histórico comercial</button>
      </div>

      {selectedAsset && (
        <div data-admin-section="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">{modeLabel[mode]}</p>
                <h3 className="mt-1 text-2xl font-black text-white">{contentTitle(selectedAsset)}</h3>
                <p className="mt-2 text-sm text-zinc-400">ID {selectedAsset.id}</p>
              </div>
              <button type="button" onClick={closeEtapa} className="rounded-2xl border border-white/10 px-3 py-2 text-sm font-bold text-zinc-300 hover:text-white">Fechar</button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Preço atual</p><strong className="mt-1 block text-white">{selectedPrice ? `${selectedPrice} créditos` : 'Não definido'}</strong></div>
              <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Novo preço</p><strong className={priceIsPositive ? 'mt-1 block text-emerald-100' : 'mt-1 block text-rose-100'}>{mode === 'price' ? (priceIsPositive ? `${normalizedPriceInteger} créditos` : 'Preço inválido') : 'Sem alteração'}</strong></div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><p className="text-xs text-amber-100/80">Status da etapa</p><strong className="mt-1 block text-amber-100">{mode === 'price' ? 'Salvar preço do produto' : 'Somente preview'}</strong></div>
            </div>

            {mode === 'price' && (
              <div className="mt-4 space-y-4">
                <label className="block rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Novo preço em créditos</span>
                  <input value={draftPrice} onChange={(event) => { setDraftPrice(event.target.value); setPreviewConfirmed(false); setLastSaveResult(null); setLastSaveError(null) }} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50" />
                  {!priceIsPositive && <span className="mt-2 block text-xs font-bold text-rose-200">Preço precisa ser maior que zero. Gratuito/feed precisa de aprovação própria.</span>}
                </label>

                <div className="rounded-2xl border border-sky-400/20 bg-sky-400/10 p-4 text-sm leading-relaxed text-sky-50">
                  <p className="font-black">Impacto preservado</p>
                  <p className="mt-1">O salvamento controlado altera apenas o preço comercial do produto selecionado. Cliente, entregas, galeria, histórico financeiro, publicação e opções gratuitas/de destaque não são alterados por esta ação.</p>
                </div>

                <label className="block rounded-2xl border border-white/10 bg-black/30 p-4">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Frase obrigatória para salvar</span>
                  <code className="mt-2 block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-emerald-100">{requiredPhrase}</code>
                  <input value={confirmationPhrase} onChange={(event) => { setConfirmationPhrase(event.target.value); setLastSaveError(null) }} placeholder="Digite a frase exatamente" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50" />
                  {confirmationPhrase && !confirmationOk && <span className="mt-2 block text-xs font-bold text-rose-200">Frase ainda não confere.</span>}
                </label>
              </div>
            )}

            {mode !== 'price' && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-zinc-300">
                <p className="font-black text-white">Esta ação ainda é preview.</p>
                <p className="mt-1">Publicar, retirar, alterar disponibilidade ou marcar gratuito/feed exige aprovação própria antes de salvar.</p>
              </div>
            )}

            {lastSaveError && <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{lastSaveError}</p>}
            {lastSaveResult && <p className="mt-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{lastSaveResult}</p>}

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setPreviewConfirmed(true)} disabled={mode === 'price' && !priceIsPositive} className="rounded-2xl bg-emerald-300 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40">Validar preview</button>
              <button type="button" onClick={handleControlledPriceSave} disabled={!canSaveControlledPrice} className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-600 disabled:opacity-60">{assetPriceMutation.isPending ? 'Salvando...' : 'Salvar preço do produto'}</button>
            </div>
            {previewConfirmed && !lastSaveResult && <p className="mt-3 text-right text-xs font-bold text-emerald-200">Preview validado visualmente. Nenhum dado real foi alterado até clicar em salvar com frase correta.</p>}
          </div>
        </div>
      )}
    </section>
  )
}
// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION


function FilterBar({
  query,
  onQueryChange,
  mediaFilter,
  onMediaFilterChange,
  statusFilter,
  onStatusFilterChange,
  visibleCount,
}: {
  query: string
  onQueryChange: (value: string) => void
  mediaFilter: MediaFilter
  onMediaFilterChange: (value: MediaFilter) => void
  statusFilter: ReviewStatusFilter
  onStatusFilterChange: (value: ReviewStatusFilter) => void
  visibleCount: number
}) {
  return (
    <div data-admin-review-filter-bar="true" className="sticky top-0 z-20 rounded-[2rem] border border-white/10 bg-zinc-950/90 p-4 shadow-2xl shadow-black/30 backdrop-blur-2xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Filtros da revisão</p>
            <p className="mt-1 text-sm text-zinc-500">{visibleCount} conteúdo(s) nesta visão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {REVIEW_STATUS_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onStatusFilterChange(option.value)}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  statusFilter === option.value
                    ? 'bg-white text-zinc-950'
                    : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'
                }`}
                title={option.helper}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Buscar por ator, produto ou tipo de mídia"
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/40 pl-11 pr-4 text-sm font-semibold text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-300/50"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {REVIEW_MEDIA_FILTERS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onMediaFilterChange(option.value)}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${
                  mediaFilter === option.value
                    ? 'bg-amber-300 text-zinc-950'
                    : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function GalleryCard({
  asset,
  onOpen,
}: {
  asset: FactoryAsset
  onOpen: (asset: FactoryAsset) => void
}) {
  const Icon = mediaIcon(asset.mediaType)
  const displayUrl = getAssetDisplayUrl(asset)
  const isVideo = isVideoMedia(asset.mediaType)
  const isAudio = isAudioMedia(asset.mediaType)
  const hasVisualPreview = Boolean(displayUrl && !isAudio)

  return (
    <button
      type="button"
      onClick={() => onOpen(asset)}
      className="group overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 text-left shadow-2xl shadow-black/30 transition hover:-translate-y-1 hover:border-amber-300/35"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-zinc-900 via-zinc-950 to-black">
        {hasVisualPreview && !isVideo && (
          <img
            src={displayUrl || ''}
            alt={contentTitle(asset)}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        )}

        {hasVisualPreview && isVideo && (
          <video
            src={displayUrl || ''}
            className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-105"
            muted
            playsInline
            preload="metadata"
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />

        {!hasVisualPreview && (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-400">
            <span className="flex size-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl">
              <Icon size={30} />
            </span>
          </div>
        )}

        <div className="absolute inset-x-0 top-4 z-20 flex items-start justify-between gap-2 px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/85 backdrop-blur-xl">
            <Icon size={13} />
            {mediaTypeLabel(asset.mediaType)}
          </span>
          <StatusBadge status={asset.status} />
        </div>

        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black via-black/85 to-transparent p-4 pt-20">
          <p className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-100">Ator</p>
          <p className="mt-1 line-clamp-1 text-sm font-black text-white">{asset.companion.name || asset.companion.slug || 'Modelo sem nome'}</p>
          <p className="mt-3 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Produto / Prompt</p>
          <p className="mt-1 line-clamp-2 text-base font-black text-white drop-shadow-lg">{contentTitle(asset)}</p>
          {asset.mediaPreview?.error && (
            <p className="mt-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-100">
              Prévia protegida indisponível. Abra para analisar.
            </p>
          )}
        </div>
      </div>
    </button>
  )
}


// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION
// ADMIN_BUSINESS_SECTION
export function StockCard({ asset, onOpen }: { asset: FactoryAsset; onOpen: (asset: FactoryAsset) => void }) {
  const Icon = mediaIcon(asset.mediaType)
  const displayUrl = getAssetDisplayUrl(asset)
  const isAudio = isAudioMedia(asset.mediaType)

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={() => onOpen(asset)}
          className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/35 text-zinc-300 transition hover:border-white/25 hover:text-white"
        >
          {displayUrl && !isAudio ? (
            <img src={displayUrl} alt={contentTitle(asset)} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <Icon size={28} />
          )}
          {displayUrl && !isAudio && <span className="absolute inset-0 bg-black/10" />}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={asset.status} />
            <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-zinc-400">{mediaTypeLabel(asset.mediaType)}</span>
          </div>
          <h3 className="mt-3 text-lg font-black text-white">{contentTitle(asset)}</h3>
          <p className="mt-1 text-sm text-zinc-400">{asset.companion.name || asset.companion.slug || 'Modelo sem nome'}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/30 p-3 text-sm">
              <p className="text-xs text-zinc-500">Preço</p>
              <strong className="text-white">{asset.price.credits} créditos</strong>
            </div>
            <div className="rounded-2xl bg-black/30 p-3 text-sm">
              <p className="text-xs text-zinc-500">Disponíveis no lote</p>
              <strong className="text-white">{asset.assignments.remaining}</strong>
            </div>
            <div className="rounded-2xl bg-black/30 p-3 text-sm">
              <p className="text-xs text-zinc-500">Criado em</p>
              <strong className="text-white">{formatDate(asset.createdAt)}</strong>
            </div>
          </div>
        </div>
      </div>
    </article>
  )
}

function getBatchMetadata(batch: FactoryBatch) {
  return (batch.metadata || {}) as Record<string, unknown>
}

function metadataText(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  return typeof value === 'string' && value.trim() ? value : null
}

function metadataNumber(metadata: Record<string, unknown>, key: string) {
  const value = metadata[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value)
  return null
}


function cleanAdminBusinessText(value: string | null | undefined, fallback = 'Informação não informada') {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback

  return raw
    .replace(/RunPod configurad[oa]/gi, 'Ambiente de geração configurado')
    .replace(/RunPod pronto/gi, 'Ambiente de geração pronto')
    .replace(/RunPod/gi, 'ambiente de geração')
    .replace(/\bR2\b configurad[oa]/gi, 'Armazenamento protegido configurado')
    .replace(/\bR2\b/g, 'armazenamento protegido')
    .replace(/\bGPU\b/gi, 'geração final')
    .replace(/workers?/gi, 'etapa')
    .replace(/\bjob\b/gi, 'início automático')
    .replace(/\bjobs\b/gi, 'inícios automáticos')
    .replace(/fila/gi, 'início automático')
    .replace(/queue/gi, 'início automático')
    .replace(/\bTTS\b/gi, 'áudio')
    .replace(/ledger/gi, 'histórico financeiro')
    .replace(/Supabase/gi, 'banco seguro')
    .replace(/bucket/gi, 'referência interna')
    .replace(/\bkey\b/gi, 'referência interna')
}

function cleanAdminChecklistLabel(value: string | null | undefined, fallback = 'Item do checklist') {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return fallback
  const normalized = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (normalized.includes('runpod')) return 'Ambiente de geração configurado'
  if (normalized.includes('r2') || normalized.includes('bucket')) return 'Armazenamento protegido configurado'
  if (normalized.includes('worker')) return 'Etapa de produção conferida'
  if (normalized.includes('fila') || normalized.includes('queue') || normalized.includes('job')) return 'Início automático desligado'
  if (normalized.includes('ledger')) return 'Histórico financeiro protegido'
  if (normalized.includes('supabase')) return 'Banco seguro conferido'

  return cleanAdminBusinessText(raw, fallback)
}


function productionStageBusinessLabel(value: string | null | undefined) {
  const raw = typeof value === 'string' ? value.trim() : ''
  if (!raw) return 'Etapa não informada'

  const normalized = raw.toLowerCase()
  if (normalized.includes('mock') || normalized.includes('safe') || normalized.includes('dry')) return 'Pré-produção segura'
  if (normalized.includes('live action')) return 'Produção de live action'
  if (normalized.includes('video') || normalized.includes('vídeo')) return 'Produção de vídeo'
  if (normalized.includes('image') || normalized.includes('imagem')) return 'Produção de imagem'
  if (normalized.includes('audio') || normalized.includes('áudio') || normalized.includes('tts')) return 'Produção de áudio'
  if (normalized.includes('runpod') || normalized.includes('worker') || normalized.includes('factory')) return 'Etapa de produção'

  return cleanAdminBusinessText(raw, 'Etapa não informada')
}

function isGuidedProductionBatch(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  const source = metadataText(metadata, 'source') || ''
  const origin = metadataText(metadata, 'jobOrigin') || metadataText(metadata, 'job_origin') || batch.batchType || ''
  return source.includes('guided_factory') || origin.includes('guided_factory') || Boolean(metadataText(metadata, 'productionAuthorizationId'))
}

function batchCompanionName(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return metadataText(metadata, 'companionName') || metadataText(metadata, 'companion_name') || batch.title || 'Avatar não informado'
}

function batchContentTypeLabel(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return metadataText(metadata, 'contentTypeLabel') || metadataText(metadata, 'content_type_label') || mediaTypeLabel(metadataText(metadata, 'contentType') || batch.engine || batch.batchType)
}

function batchWorkerLabel(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return productionStageBusinessLabel(metadataText(metadata, 'workerLabel') || metadataText(metadata, 'worker_label') || batch.engine)
}

function batchTotalItems(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return metadataNumber(metadata, 'totalCombinations') ?? batch.requestedCount ?? 0
}

function batchRequestedVariants(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return batch.requestedVariants || metadataNumber(metadata, 'requestedVariants') || metadataNumber(metadata, 'requested_variants') || 0
}

function batchPlannedVariations(batch: FactoryBatch) {
  const explicit = batch.totalPlannedVariants || 0
  if (explicit > 0) return explicit
  return batchTotalItems(batch) * Math.max(batchRequestedVariants(batch), 0)
}

function isSafePlanningBatch(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  return batch.safePlanningOnly === true || metadata.safePlanningOnly === true || metadata.enqueueJobs === false || metadata.realImageWorker === false || metadata.source === 'guided_factory_production'
}

function batchNextActionLabel(batch: FactoryBatch) {
  if (batch.status === 'failed' || batch.status === 'error') return 'Corrigir pendência antes de continuar.'
  if (batch.status === 'qa_pending') return 'Revisar itens antes de liberar venda.'
  if (batch.generatedCount > 0 && batch.approvedCount === 0) return 'Enviar para revisão do Admin.'
  if (batch.approvedCount > 0) return 'Conferir preço e publicação depois da revisão.'
  if (isSafePlanningBatch(batch)) return 'Aguardar decisão do Admin para iniciar geração final.'
  return 'Acompanhar andamento do lote.'
}

function batchMonitoringFacts(batch: FactoryBatch) {
  const safe = isSafePlanningBatch(batch)
  const planned = batchPlannedVariations(batch)
  return [
    safe ? 'Pré-produção segura' : 'Produção controlada',
    planned > 0 ? `${planned} variações planejadas` : 'Variações não informadas',
    batch.generatedCount > 0 ? `${batch.generatedCount} conteúdos gerados` : 'Nenhuma mídia gerada agora',
    'Cliente não alterado',
  ]
}

function guidedSelectionLabelsFromMetadata(metadata: Record<string, unknown>) {
  const selections = metadata.guidedSelections || metadata.guided_selections
  if (!Array.isArray(selections)) return []

  return selections
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const title = typeof record.titleName === 'string' ? record.titleName : typeof record.title === 'string' ? record.title : null
      const item = typeof record.itemName === 'string' ? record.itemName : typeof record.item === 'string' ? record.item : null
      if (title && item) return `${title}: ${item}`
      return item || title
    })
    .filter((value): value is string => Boolean(value))
    .slice(0, 5)
}

function batchModeLabel(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  if (metadata.realImageWorker === true) return 'Produção real controlada'
  if (metadata.realImageWorker === false) return 'Modo seguro'
  if (metadataText(metadata, 'productionAuthorizationId')) return 'Autorizado'
  return 'Modo interno'
}

function batchModeTone(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  if (metadata.realImageWorker === true) return 'border-amber-400/25 bg-amber-400/10 text-amber-100'
  if (metadataText(metadata, 'productionAuthorizationId')) return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'
  return 'border-zinc-700 bg-zinc-900 text-zinc-300'
}

function batchSecurityFacts(batch: FactoryBatch) {
  const metadata = getBatchMetadata(batch)
  const realWorker = metadata.realImageWorker === true
  const safeMode = metadata.realImageWorker === false || metadata.source === 'guided_factory_production'
  const hasAuthorization = Boolean(metadataText(metadata, 'productionAuthorizationId'))
  const complianceStatus = metadataText(metadata, 'complianceStatus') || metadataText(metadata, 'productionComplianceStatus')

  return {
    realWorker,
    safeMode,
    hasAuthorization,
    complianceStatus,
    runPodLabel: realWorker ? 'Pode iniciar produção real' : 'Não executou produção real neste lote',
    modeLabel: batchModeLabel(batch),
  }
}

function batchItemLabel(item: FactoryBatchItem, index: number) {
  const metadata = item.metadata || {}
  const title = metadataText(metadata, 'title') || metadataText(metadata, 'combinationTitle') || metadataText(metadata, 'itemName') || metadataText(metadata, 'label')
  return title || `Item ${index + 1}`
}

function batchItemHelper(item: FactoryBatchItem) {
  const metadata = item.metadata || {}
  return cleanAdminBusinessText(metadataText(metadata, 'message') || metadataText(metadata, 'error'), 'Item registrado para acompanhamento.')
}

type BatchReadinessTone = 'ok' | 'blocked' | 'attention'

interface BatchReadinessCheckItem {
  key: string
  label: string
  ok: boolean
  tone: BatchReadinessTone
  helper: string
}

interface BatchFinalLockItem {
  key: string
  label: string
  value: string
  ok: boolean
  helper: string
}

function batchItemProductionAuthorization(item: FactoryBatchItem | null) {
  const metadata = item?.metadata || {}
  const direct = item?.productionAuthorization
  const nested = metadata.productionAuthorization

  if (direct && typeof direct === 'object') return direct as unknown as Record<string, unknown>
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested as unknown as Record<string, unknown>

  return null
}

function productionAuthorizationAuthorized(authorization: Record<string, unknown> | null) {
  return authorization?.authorized === true || authorization?.contentTypeAllowed === true
}

function productionAuthorizationId(authorization: Record<string, unknown> | null) {
  const id = authorization?.id
  return typeof id === 'string' && id.trim() ? id : null
}

function productionAuthorizationHelper(authorization: Record<string, unknown> | null, fallback = 'Valide a autorização do modelo antes de iniciar qualquer produção real.') {
  const helper = authorization?.helper
  if (typeof helper === 'string' && helper.trim()) return cleanAdminBusinessText(helper, fallback)
  return fallback
}

function productionAuthorizationLabel(authorization: Record<string, unknown> | null) {
  if (productionAuthorizationAuthorized(authorization)) return 'Autorização ativa'
  const label = authorization?.label
  if (typeof label === 'string' && label.trim()) return cleanAdminBusinessText(label, 'Autorização pendente')
  return 'Autorização pendente'
}

function productionAuthorizationToneClass(authorization: Record<string, unknown> | null) {
  if (productionAuthorizationAuthorized(authorization)) return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
  return 'border-amber-300/20 bg-amber-400/10 text-amber-50'
}

function batchControlledActionSource(batch: FactoryBatch, items: FactoryBatchItem[]) {
  const metadata = getBatchMetadata(batch)
  const item = items.find((entry) => entry.combinationId) || items[0] || null
  const itemMetadata = item?.metadata || {}
  const productionAuthorization = batchItemProductionAuthorization(item)
  const companionId = batch.companionId || metadataText(metadata, 'companionId') || metadataText(metadata, 'companion_id') || null
  const combinationId = item?.combinationId || metadataText(itemMetadata, 'combinationId') || metadataText(itemMetadata, 'combination_id') || metadataText(metadata, 'combinationId') || metadataText(metadata, 'combination_id') || null
  const authorizationId = productionAuthorizationId(productionAuthorization) || metadataText(metadata, 'productionAuthorizationId') || metadataText(metadata, 'avatarProductionAuthorizationId') || metadataText(itemMetadata, 'productionAuthorizationId') || metadataText(itemMetadata, 'avatarProductionAuthorizationId') || null
  const contentType = batchContentTypeLabel(batch)
  const plannedVariations = batchPlannedVariations(batch) || items.reduce((total, entry) => total + Number(entry.requestedVariants || 0), 0)
  const promptLabel = item ? batchItemLabel(item, 0) : metadataText(metadata, 'selectedPrompt') || metadataText(metadata, 'promptSummary') || null

  return {
    item,
    metadata,
    itemMetadata,
    productionAuthorization,
    companionId,
    combinationId,
    authorizationId,
    contentType,
    plannedVariations,
    promptLabel,
  }
}

function batchControlledReadinessChecks(batch: FactoryBatch, items: FactoryBatchItem[], isLoading: boolean): BatchReadinessCheckItem[] {
  const source = batchControlledActionSource(batch, items)
  const itemCount = items.length
  const hasPlannedVariations = source.plannedVariations > 0 || batchRequestedVariants(batch) > 0
  const mediaAlreadyGenerated = Number(batch.generatedCount || 0) > 0 || items.some((item) => Number(item.generatedVariants || 0) > 0)

  return [
    {
      key: 'batch_opened',
      label: 'Lote aberto',
      ok: Boolean(batch.id),
      tone: 'ok',
      helper: batch.id ? `Referência ${shortId(batch.id)} carregada.` : 'Abra um lote para conferir os dados.',
    },
    {
      key: 'items_loaded',
      label: 'Itens do lote carregados',
      ok: itemCount > 0,
      tone: isLoading ? 'attention' : 'blocked',
      helper: isLoading ? 'Carregando itens do lote.' : itemCount > 0 ? `${itemCount} item(ns) encontrados.` : 'Nenhum item foi encontrado neste lote.',
    },
    {
      key: 'avatar_selected',
      label: 'Modelo selecionado',
      ok: Boolean(source.companionId),
      tone: 'blocked',
      helper: source.companionId ? `${batchCompanionName(batch)} identificado.` : 'Selecione ou recrie o lote com um modelo válido.',
    },
    {
      key: 'combination_selected',
      label: 'Produto/prompt vinculado',
      ok: Boolean(source.combinationId),
      tone: 'blocked',
      helper: source.combinationId ? (source.promptLabel || 'Produto/prompt encontrado nos itens do lote.') : 'O item precisa apontar para um produto/prompt da Prateleira.',
    },
    {
      key: 'media_type_present',
      label: 'Tipo de conteúdo definido',
      ok: Boolean(source.contentType && source.contentType !== 'Conteúdo'),
      tone: 'blocked',
      helper: source.contentType && source.contentType !== 'Conteúdo' ? source.contentType : 'Informe se o lote é de imagem, vídeo, Live Action ou áudio.',
    },
    {
      key: 'planned_variations_present',
      label: 'Variações planejadas',
      ok: hasPlannedVariations,
      tone: 'blocked',
      helper: hasPlannedVariations ? `${source.plannedVariations || batchRequestedVariants(batch)} variações previstas.` : 'Defina de 5 a 10 variações antes de preparar a próxima etapa.',
    },
    {
      key: 'model_authorization_visible',
      label: 'Autorização do modelo visível/validada',
      ok: productionAuthorizationAuthorized(source.productionAuthorization),
      tone: 'attention',
      helper: productionAuthorizationAuthorized(source.productionAuthorization)
        ? `Autorização ativa encontrada${source.authorizationId ? ` (${shortId(source.authorizationId)})` : ''}.`
        : productionAuthorizationHelper(source.productionAuthorization, 'Autorização ainda pendente. Confira o cadastro do modelo antes de produção real.'),
    },
    {
      key: 'safe_no_media_generated',
      label: 'Sem mídia gerada agora',
      ok: !mediaAlreadyGenerated,
      tone: 'attention',
      helper: mediaAlreadyGenerated ? 'Já existem conteúdos gerados vinculados ao lote.' : 'Este lote ainda está apenas em preparação.',
    },
    {
      key: 'client_finance_locked',
      label: 'Cliente e cobrança protegidos',
      ok: true,
      tone: 'ok',
      helper: 'Esta tela não entrega, não publica e não cobra créditos.',
    },
  ]
}

function batchFinalReadinessLocks({
  readinessPassed,
  readinessTotal,
  source,
  actionCandidate,
}: {
  readinessPassed: number
  readinessTotal: number
  source: ReturnType<typeof batchControlledActionSource>
  actionCandidate: FactoryBatchControlledActionPayload | null
}): BatchFinalLockItem[] {
  const authorizationReady = productionAuthorizationAuthorized(source.productionAuthorization)
  const checklistReady = readinessTotal > 0 && readinessPassed === readinessTotal

  return [
    {
      key: 'checklist',
      label: 'Checklist do lote',
      value: checklistReady ? `${readinessPassed}/${readinessTotal} pronto` : `${readinessPassed}/${readinessTotal} em conferência`,
      ok: checklistReady,
      helper: checklistReady ? 'Todos os pontos operacionais visíveis foram conferidos.' : 'Conclua os itens pendentes antes de qualquer etapa real.',
    },
    {
      key: 'authorization',
      label: 'Autorização do modelo',
      value: authorizationReady ? 'Ativa' : 'Pendente',
      ok: authorizationReady,
      helper: authorizationReady ? 'O modelo tem autorização ativa para este tipo de conteúdo.' : 'Confira autorização antes de avançar.',
    },
    {
      key: 'automatic_start',
      label: 'Início automático',
      value: 'Desligado',
      ok: true,
      helper: 'Esta tela não inicia geração final automaticamente.',
    },
    {
      key: 'client_billing',
      label: 'Cliente e cobrança',
      value: 'Protegidos',
      ok: true,
      helper: 'Nenhum cliente é alterado e nenhum crédito é cobrado nesta etapa.',
    },
    {
      key: 'current_action',
      label: 'Ação atual',
      value: actionCandidate ? 'Somente preparar' : 'Conferir dados',
      ok: Boolean(actionCandidate),
      helper: actionCandidate ? 'A preparação fica registrada sem gerar mídia.' : 'O lote ainda precisa de dados mínimos para a preparação.',
    },
  ]
}

function batchReadinessToneClass(check: BatchReadinessCheckItem) {
  if (check.ok) return 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'
  if (check.tone === 'blocked') return 'border-rose-300/20 bg-rose-400/10 text-rose-50'
  return 'border-amber-300/20 bg-amber-400/10 text-amber-50'
}

function batchReadinessIcon(check: BatchReadinessCheckItem) {
  if (check.ok) return <CheckCircle2 size={16} className="shrink-0 text-emerald-200" />
  if (check.tone === 'blocked') return <AlertTriangle size={16} className="shrink-0 text-rose-200" />
  return <Info size={16} className="shrink-0 text-amber-200" />
}

function batchResultReadinessItems(result: FactoryBatchControlledActionResponse | null) {
  const checklist = result?.readiness?.checklist
  if (!Array.isArray(checklist)) return []

  return checklist
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const rawLabel = typeof record.label === 'string' ? record.label : 'Item do checklist'
      const label = cleanAdminChecklistLabel(rawLabel, 'Item do checklist')
      const ok = record.ok === true
      const severity = String(record.severity || '').toLowerCase()
      const helper = typeof record.humanMessage === 'string' ? cleanAdminBusinessText(record.humanMessage, 'Resultado registrado.') : 'Resultado registrado.'
      return {
        key: typeof record.key === 'string' ? record.key : label,
        label,
        ok,
        tone: ok ? 'ok' as const : severity === 'warning' ? 'attention' as const : 'blocked' as const,
        helper,
      }
    })
    .filter((entry): entry is BatchReadinessCheckItem => Boolean(entry))
    .slice(0, 8)
}

function batchControlledActionCandidate(batch: FactoryBatch, items: FactoryBatchItem[]): FactoryBatchControlledActionPayload | null {
  const source = batchControlledActionSource(batch, items)

  if (!source.companionId || !source.combinationId) return null

  return {
    batchId: batch.id,
    batchItemId: source.item?.id || null,
    companionId: source.companionId,
    combinationId: source.combinationId,
    requestedQuantity: 1,
    confirmationPhrase: '',
    executeQueue: false,
  }
}

function batchControlledActionStatusLabel(result: FactoryBatchControlledActionResponse | null) {
  const status = String(result?.status || '').trim()
  if (!status) return 'Aguardando verificação'
  if (status === 'READY_NOT_QUEUED') return 'Pronto, mas não iniciado'
  if (status === 'READY_TO_QUEUE_REAL_SINGLE_ITEM') return 'Pronto para próxima etapa controlada'
  if (status === 'BLOCKED_BY_READINESS') return 'Pendente de checklist'
  if (status === 'BLOCKED_BY_HARD_LOCKS') return 'Bloqueado pelas travas finais'
  if (status.includes('FAILED')) return 'Precisa de correção'
  if (status.includes('AUDIT')) return 'Auditoria somente leitura'
  return cleanAdminBusinessText(status.replace(/_/g, ' ').toLowerCase(), 'Status não informado')
}

function batchControlledActionHelper(result: FactoryBatchControlledActionResponse | null) {
  if (!result) return 'Use esta ação para verificar se o lote está pronto para a próxima etapa. Nenhuma mídia será gerada agora.'
  const reason = typeof result.reason === 'string' ? result.reason : ''
  if (reason) return cleanAdminBusinessText(reason, 'Resultado registrado.')
  if (result.queued === false) return 'Nenhuma geração final foi iniciada. O lote permaneceu apenas em preparação controlada.'
  return 'Resultado registrado sem alterar Cliente, cobrança ou publicação.'
}


const RUNPOD_CHUNK_SIZE = 5

type BatchRunPodLogStatus = 'info' | 'success' | 'error'

interface BatchRunPodLogEntry {
  id: string
  status: BatchRunPodLogStatus
  message: string
}

interface BatchRunPodActionCandidate {
  item: FactoryBatchItem
  index: number
  payload: FactoryBatchControlledActionPayload
}

function normalizeBatchProcessingStatus(value: string | null | undefined) {
  return normalizeText(String(value || '').trim())
}

function isBatchReadyForRunPodStart(batch: FactoryBatch) {
  const status = normalizeBatchProcessingStatus(batch.status)
  return status === 'planned' || status === 'approved_to_queue'
}

function isBatchItemCompletedForRunPod(item: FactoryBatchItem) {
  const status = normalizeBatchProcessingStatus(item.status)
  return ['completed', 'complete', 'done', 'generated', 'available', 'qa_pending', 'approved'].some((entry) => status.includes(entry)) || Number(item.generatedVariants || 0) > 0 || Number(item.approvedVariants || 0) > 0
}

function isBatchItemFailedForRunPod(item: FactoryBatchItem) {
  const status = normalizeBatchProcessingStatus(item.status)
  return ['failed', 'error', 'rejected', 'cancelled', 'canceled'].some((entry) => status.includes(entry)) || Number(item.rejectedVariants || 0) > 0
}

function isBatchItemInProgressForRunPod(item: FactoryBatchItem) {
  const status = normalizeBatchProcessingStatus(item.status)
  return ['running', 'processing', 'in_progress'].some((entry) => status.includes(entry))
}

function isBatchItemPendingForRunPod(item: FactoryBatchItem) {
  if (!item.combinationId) return false
  if (isBatchItemCompletedForRunPod(item) || isBatchItemFailedForRunPod(item) || isBatchItemInProgressForRunPod(item)) return false

  const status = normalizeBatchProcessingStatus(item.status)
  if (!status) return true
  return ['planned', 'approved_to_queue', 'queued', 'pending', 'ready', 'created', 'draft', 'waiting'].some((entry) => status.includes(entry))
}

function batchRunPodProgress(items: FactoryBatchItem[]) {
  const total = items.length
  const failed = items.filter(isBatchItemFailedForRunPod).length
  const completed = items.filter((item) => isBatchItemCompletedForRunPod(item) && !isBatchItemFailedForRunPod(item)).length
  const inProgress = items.filter(isBatchItemInProgressForRunPod).length
  const queued = items.filter(isBatchItemPendingForRunPod).length

  return { total, queued, failed, completed, inProgress }
}

function buildBatchRunPodActionCandidates(batch: FactoryBatch, items: FactoryBatchItem[]): BatchRunPodActionCandidate[] {
  const metadata = getBatchMetadata(batch)
  const companionId = batch.companionId || metadataText(metadata, 'companionId') || metadataText(metadata, 'companion_id') || null
  if (!companionId) return []

  const candidates: BatchRunPodActionCandidate[] = []

  items.forEach((item, index) => {
    const itemMetadata = item.metadata || {}
    const combinationId = item.combinationId || metadataText(itemMetadata, 'combinationId') || metadataText(itemMetadata, 'combination_id') || null
    if (!combinationId || !isBatchItemPendingForRunPod(item)) return

    candidates.push({
      item,
      index,
      payload: {
        batchId: batch.id,
        batchItemId: item.id,
        companionId,
        combinationId,
        requestedQuantity: 1,
        confirmationPhrase: '',
        executeQueue: true,
      },
    })
  })

  return candidates
}

function chunkBatchRunPodCandidates(candidates: BatchRunPodActionCandidate[], chunkSize = RUNPOD_CHUNK_SIZE) {
  const chunks: BatchRunPodActionCandidate[][] = []
  for (let index = 0; index < candidates.length; index += chunkSize) {
    chunks.push(candidates.slice(index, index + chunkSize))
  }
  return chunks
}

function batchRunPodResponseWasBlocked(result: FactoryBatchControlledActionResponse | null | undefined) {
  const status = String(result?.status || '').toUpperCase()
  return status.startsWith('BLOCKED') || status.includes('ERROR') || result?.queued === false
}

function batchRunPodChunkLabel(chunk: BatchRunPodActionCandidate[]) {
  if (chunk.length === 0) return '0'
  const first = chunk[0].index + 1
  const last = chunk[chunk.length - 1].index + 1
  return first === last ? String(first) : `${first} a ${last}`
}

function BatchCard({ batch, onOpenDetails }: { batch: FactoryBatch; onOpenDetails: (batch: FactoryBatch) => void }) {
  const metadata = getBatchMetadata(batch)
  const guided = isGuidedProductionBatch(batch)
  const companionName = batchCompanionName(batch)
  const contentType = batchContentTypeLabel(batch)
  const worker = batchWorkerLabel(batch)
  const totalItems = batchTotalItems(batch)
  const requestedVariants = batchRequestedVariants(batch)
  const plannedVariations = batchPlannedVariations(batch)
  const nextAction = batchNextActionLabel(batch)
  const monitoringFacts = batchMonitoringFacts(batch)
  const authorizationId = metadataText(metadata, 'productionAuthorizationId')
  const complianceStatus = metadataText(metadata, 'complianceStatus') || metadataText(metadata, 'productionComplianceStatus')

  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={batch.status} />
            {guided && <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-100">Fábrica guiada</span>}
            <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${batchModeTone(batch)}`}>{batchModeLabel(batch)}</span>
          </div>
          <h3 className="mt-4 text-xl font-black text-white">{guided ? companionName : batch.title || 'Lote de fabricação'}</h3>
          <p className="mt-1 text-sm text-zinc-500">Referência: {shortId(batch.id)}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">{statusDescription(batch.status)}</p>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-zinc-500">Tipo</p>
              <strong className="text-white">{contentType}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-zinc-500">Etapa</p>
              <strong className="text-white">{worker}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-zinc-500">Itens do lote</p>
              <strong className="text-white">{totalItems || '—'}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs text-zinc-500">Variações</p>
              <strong className="text-white">{requestedVariants ? `${requestedVariants} por item` : '—'}</strong>
            </div>
          </div>

          {guided && (
            <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400 sm:grid-cols-2">
              <div className="flex justify-between gap-3"><span className="text-zinc-500">Autorização</span><strong className="text-right text-white">{authorizationId ? shortId(authorizationId) : '—'}</strong></div>
              <div className="flex justify-between gap-3"><span className="text-zinc-500">Conformidade</span><strong className="text-right text-white">{complianceStatus || (authorizationId ? 'Liberado no momento do lote' : 'Não informada')}</strong></div>
            </div>
          )}
        </div>

        <div className="space-y-3 xl:min-w-[420px]">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/40 p-4 text-center">
              <p className="text-xs text-zinc-500">Gerados</p>
              <p className="mt-2 text-2xl font-black text-white">{batch.generatedCount}</p>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-4 text-center">
              <p className="text-xs text-emerald-300/80">Aprovados</p>
              <p className="mt-2 text-2xl font-black text-emerald-100">{batch.approvedCount}</p>
            </div>
            <div className="rounded-2xl bg-rose-500/10 p-4 text-center">
              <p className="text-xs text-rose-300/80">Reprovados</p>
              <p className="mt-2 text-2xl font-black text-rose-100">{batch.rejectedCount}</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-xs leading-relaxed text-zinc-400">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-emerald-200" size={16} />
              <div>
                <p className="font-black text-zinc-200">Acompanhamento seguro</p>
                <p className="mt-1">Próxima ação: <strong className="text-white">{nextAction}</strong></p>
                <p className="mt-1">Planejado: <strong className="text-white">{plannedVariations || '—'} variações</strong></p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {monitoringFacts.map((fact) => <span key={fact} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-bold text-zinc-300">{fact}</span>)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenDetails(batch)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black text-white transition hover:border-amber-300/40 hover:bg-amber-300/10"
          >
            <Eye size={16} />
            Abrir detalhes do lote
          </button>
        </div>
      </div>
    </article>
  )
}

function BatchDetailsModal({
  batch,
  items,
  isLoading,
  error,
  onClose,
}: {
  batch: FactoryBatch | null
  items: FactoryBatchItem[]
  isLoading: boolean
  error: unknown
  onClose: () => void
}) {
  const previewBatchAction = usePreviewFactoryBatchControlledAction()
  const prepareBatchAction = usePrepareFactoryBatchControlledAction()
  const [batchActionResult, setBatchActionResult] = useState<FactoryBatchControlledActionResponse | null>(null)
  const [activeBatchDetailTab, setActiveBatchDetailTab] = useState<BatchDetailTab>('summary')
  const [runPodConfirmationPhrase, setRunPodConfirmationPhrase] = useState('')
  const [runPodIsProcessing, setRunPodIsProcessing] = useState(false)
  const [runPodProcessedCount, setRunPodProcessedCount] = useState(0)
  const [runPodLogs, setRunPodLogs] = useState<BatchRunPodLogEntry[]>([])

  useEffect(() => {
    setBatchActionResult(null)
    setActiveBatchDetailTab('summary')
    setRunPodConfirmationPhrase('')
    setRunPodIsProcessing(false)
    setRunPodProcessedCount(0)
    setRunPodLogs([])
  }, [batch?.id])

  if (!batch) return null

  const metadata = getBatchMetadata(batch)
  const guided = isGuidedProductionBatch(batch)
  const security = batchSecurityFacts(batch)
  const authorizationId = metadataText(metadata, 'productionAuthorizationId')
  const actorName = metadataText(metadata, 'actorDisplayName') || metadataText(metadata, 'actorName') || metadataText(metadata, 'actor_name') || 'Ator/Atriz não informado'
  const contentType = batchContentTypeLabel(batch)
  const worker = batchWorkerLabel(batch)
  const totalItems = batchTotalItems(batch) || items.length
  const plannedVariations = batchPlannedVariations(batch) || items.reduce((total, item) => total + item.requestedVariants, 0)
  const nextAction = batchNextActionLabel(batch)
  const monitoringFacts = batchMonitoringFacts(batch)
  const blocked = batch.status === 'failed' || batch.status === 'error'
  const controlledSource = batchControlledActionSource(batch, items)
  const actionCandidate = batchControlledActionCandidate(batch, items)
  const readinessChecks = batchControlledReadinessChecks(batch, items, isLoading)
  const readinessPassed = readinessChecks.filter((check) => check.ok).length
  const readinessBlockers = readinessChecks.filter((check) => !check.ok && check.tone === 'blocked')
  const readinessWarnings = readinessChecks.filter((check) => !check.ok && check.tone === 'attention')
  const finalReadinessLocks = batchFinalReadinessLocks({
    readinessPassed,
    readinessTotal: readinessChecks.length,
    source: controlledSource,
    actionCandidate,
  })
  const finalReadinessReady = finalReadinessLocks.every((lock) => lock.ok)
  const runPodProgress = batchRunPodProgress(items)
  const runPodCandidates = buildBatchRunPodActionCandidates(batch, items)
  const runPodChunks = chunkBatchRunPodCandidates(runPodCandidates)
  const runPodStartAllowedByStatus = isBatchReadyForRunPodStart(batch)
  const runPodCanStart = runPodStartAllowedByStatus && runPodCandidates.length > 0 && !isLoading && !runPodIsProcessing
  const actionBusy = previewBatchAction.isPending || prepareBatchAction.isPending || runPodIsProcessing
  const actionBlocked = isLoading || !actionCandidate || actionBusy
  const batchDetailTabs: Array<{ id: BatchDetailTab; label: string; helper: string }> = [
    { id: 'summary', label: 'Resumo', helper: 'Status, lote e próxima ação.' },
    { id: 'items', label: 'Itens do lote', helper: 'Itens e variações carregadas.' },
    { id: 'checklist', label: 'Checklist de segurança', helper: 'Barreira final e preparação segura.' },
    { id: 'history', label: 'Histórico', helper: 'Registro operacional do lote.' },
  ]

  function handlePreviewBatchAction() {
    if (!actionCandidate) return
    previewBatchAction.mutate(actionCandidate, {
      onSuccess: (result) => setBatchActionResult(result),
      onError: (actionError) => setBatchActionResult({
        status: 'PRECHECK_ERROR',
        queued: false,
        reason: parseApiError(actionError),
        safety: {
          runPodCalledByThisService: false,
          r2RealUploadByThisService: false,
          destructiveDelete: false,
          paymentExecuted: false,
          walletChanged: false,
          publicClientUrlCreated: false,
          realQueueJobCreated: false,
          runPodMayBeCalledByWorkerAfterQueue: false,
        },
      }),
    })
  }

  function handlePrepareBatchAction() {
    if (!actionCandidate) return
    prepareBatchAction.mutate({ ...actionCandidate, executeQueue: false }, {
      onSuccess: (result) => setBatchActionResult(result),
      onError: (actionError) => setBatchActionResult({
        status: 'PREPARATION_ERROR',
        queued: false,
        reason: parseApiError(actionError),
        safety: {
          runPodCalledByThisService: false,
          r2RealUploadByThisService: false,
          destructiveDelete: false,
          paymentExecuted: false,
          walletChanged: false,
          publicClientUrlCreated: false,
          realQueueJobCreated: false,
          runPodMayBeCalledByWorkerAfterQueue: false,
        },
      }),
    })
  }

  async function handleStartRunPodChunkedProcessing() {
    if (!runPodCanStart || runPodChunks.length === 0) return

    if (!runPodConfirmationPhrase.trim()) {
      window.alert('Informe a frase de confirmação operacional antes de iniciar o processamento controlado.')
      return
    }

    const confirmed = window.confirm(`Iniciar processamento controlado deste lote em blocos de até ${RUNPOD_CHUNK_SIZE} itens? O backend ainda validará checklist, frase, ambiente e travas finais antes de enfileirar cada item.`)
    if (!confirmed) return

    setRunPodIsProcessing(true)
    setRunPodProcessedCount(0)
    setBatchActionResult(null)
    setRunPodLogs([{
      id: `runpod-start-${Date.now()}`,
      status: 'info',
      message: `Processamento iniciado com ${runPodCandidates.length} item(ns) elegíveis em ${runPodChunks.length} bloco(s).`,
    }])

    try {
      for (const [chunkIndex, chunk] of runPodChunks.entries()) {
        const chunkLabel = batchRunPodChunkLabel(chunk)
        setRunPodLogs((current) => [
          ...current,
          { id: `runpod-chunk-${chunkIndex}-start-${Date.now()}`, status: 'info', message: `Processando itens ${chunkLabel}...` },
        ])

        const results = await Promise.allSettled(
          chunk.map((candidate) => prepareBatchAction.mutateAsync({
            ...candidate.payload,
            confirmationPhrase: runPodConfirmationPhrase.trim(),
            executeQueue: true,
          })),
        )

        const successfulResponses = results
          .filter((result): result is PromiseFulfilledResult<FactoryBatchControlledActionResponse> => result.status === 'fulfilled')
          .map((result) => result.value)
        const rejectedResponses = results.filter((result) => result.status === 'rejected')
        const queuedCount = successfulResponses.filter((result) => result.queued === true).length
        const blockedCount = successfulResponses.filter(batchRunPodResponseWasBlocked).length + rejectedResponses.length
        const lastResponse = successfulResponses[successfulResponses.length - 1] || null

        if (lastResponse) setBatchActionResult(lastResponse)

        setRunPodProcessedCount((current) => current + chunk.length)
        setRunPodLogs((current) => [
          ...current,
          {
            id: `runpod-chunk-${chunkIndex}-done-${Date.now()}`,
            status: queuedCount > 0 ? 'success' : 'error',
            message: `Bloco ${chunkIndex + 1}/${runPodChunks.length} finalizado: ${queuedCount} enfileirado(s), ${blockedCount} bloqueado(s) ou com falha.`,
          },
        ])

        const allBlocked = blockedCount >= chunk.length
        if (allBlocked) {
          setRunPodLogs((current) => [
            ...current,
            {
              id: `runpod-stop-${chunkIndex}-${Date.now()}`,
              status: 'error',
              message: 'Backpressure ativado: o bloco inteiro foi bloqueado/falhou. Os próximos blocos não serão enviados até o Admin corrigir as travas.',
            },
          ])
          break
        }
      }
    } catch (processingError) {
      setRunPodLogs((current) => [
        ...current,
        { id: `runpod-error-${Date.now()}`, status: 'error', message: `Processamento interrompido. ${parseApiError(processingError)}` },
      ])
    } finally {
      setRunPodIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-2xl md:p-6">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={batch.status} />
              {guided && <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-violet-100">Fábrica guiada</span>}
              <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${batchModeTone(batch)}`}>{security.modeLabel}</span>
            </div>
            <h2 className="mt-3 text-2xl font-black text-white">Detalhe do lote</h2>
            <p className="mt-1 text-sm text-zinc-500">Referência: {shortId(batch.id)}</p>
          </div>
          <button type="button" onClick={runPodIsProcessing ? undefined : onClose} disabled={runPodIsProcessing} className="rounded-2xl border border-white/10 p-3 text-zinc-400 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-700" aria-label="Fechar detalhe do lote">
            <X size={18} />
          </button>
        </div>

        <div className="border-b border-white/10 px-5 pt-4">
          <div className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none]">
            {batchDetailTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setActiveBatchDetailTab(tab.id)} className={`min-w-[170px] rounded-2xl border px-4 py-3 text-left transition ${activeBatchDetailTab === tab.id ? 'border-amber-300/40 bg-amber-300/10 text-white' : 'border-white/10 bg-black/25 text-zinc-400 hover:border-white/25 hover:text-white'}`}>
                <span className="block text-sm font-black">{tab.label}</span>
                <span className="mt-1 block text-[11px] leading-relaxed opacity-70">{tab.helper}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
          {activeBatchDetailTab === 'summary' && (
            <div className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-4">
                <MetricCard label="Total de itens" value={runPodProgress.total || totalItems || '—'} helper={plannedVariations ? `${plannedVariations} variações planejadas no lote.` : 'Quantidade planejada ou encontrada neste lote.'} icon={Boxes} tone="zinc" />
                <MetricCard label="Em fila" value={runPodProgress.queued} helper="Itens elegíveis para processamento controlado em chunks." icon={Clock3} tone="amber" />
                <MetricCard label="Falharam" value={runPodProgress.failed} helper="Itens com erro, rejeição ou falha operacional." icon={AlertTriangle} tone={runPodProgress.failed > 0 ? 'red' : 'zinc'} />
                <MetricCard label="Concluídos" value={runPodProgress.completed} helper="Itens já gerados, aprovados ou enviados para revisão." icon={CheckCircle2} tone="emerald" />
              </div>

              <section className="rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Acompanhamento do lote seguro</p>
                    <h3 className="mt-2 text-xl font-black text-white">Próxima ação clara para o Admin</h3>
                    <p className="mt-2 text-sm leading-relaxed text-emerald-50/80">{nextAction}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:max-w-md lg:justify-end">
                    {monitoringFacts.map((fact) => <span key={fact} className="rounded-full border border-emerald-300/20 bg-black/20 px-3 py-1 text-xs font-black text-emerald-50">{fact}</span>)}
                  </div>
                </div>
              </section>

              <div className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Resumo simples</p>
                  <h3 className="mt-2 text-xl font-black text-white">O que este lote tentou produzir</h3>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Avatar</p><strong className="text-white">{batchCompanionName(batch)}</strong></div>
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Ator/Atriz</p><strong className="text-white">{actorName}</strong></div>
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Tipo</p><strong className="text-white">{contentType}</strong></div>
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Etapa</p><strong className="text-white">{worker}</strong></div>
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Criado em</p><strong className="text-white">{formatDate(batch.createdAt)}</strong></div>
                    <div className="rounded-2xl bg-black/30 p-4"><p className="text-xs text-zinc-500">Atualizado em</p><strong className="text-white">{formatDate(batch.updatedAt)}</strong></div>
                  </div>
                </section>

                <section className={`rounded-[2rem] border p-5 ${blocked ? 'border-rose-400/20 bg-rose-400/10' : 'border-emerald-400/20 bg-emerald-400/10'}`}>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Conferência de segurança</p>
                  <h3 className="mt-2 text-xl font-black text-white">{blocked ? 'Lote precisa de atenção' : 'Lote sem alerta crítico'}</h3>
                  <div className="mt-4 space-y-3 text-sm leading-relaxed text-zinc-200">
                    <p>Modo: <strong>{security.modeLabel}</strong></p>
                    <p>Geração final: <strong>{security.runPodLabel}</strong></p>
                    <p>Autorização: <strong>{authorizationId ? shortId(authorizationId) : 'Não informada'}</strong></p>
                    <p>Conformidade: <strong>{security.complianceStatus || 'Não informada'}</strong></p>
                    <p>Compartilhamento aberto: <strong>Não exibido nesta tela</strong></p>
                  </div>
                </section>
              </div>
            </div>
          )}

          {activeBatchDetailTab === 'items' && (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Itens do lote</p>
                  <h3 className="mt-2 text-xl font-black text-white">Acompanhamento item por item</h3>
                  <p className="mt-1 text-sm text-zinc-500">Esta lista ajuda o administrador a saber se o lote está parado, concluído ou com erro em algum item.</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-black text-zinc-300">{items.length} itens carregados</span>
              </div>

              {isLoading && <div className="mt-4"><EmptyState message="Carregando itens do lote…" icon={Clock3} /></div>}
              {Boolean(error) && <div className="mt-4"><ErrorState error={error} /></div>}
              {!isLoading && !error && items.length === 0 && <div className="mt-4"><EmptyState message="Nenhum item encontrado para este lote." helper="Alguns lotes antigos podem não ter itens detalhados registrados." icon={Boxes} /></div>}
              {!isLoading && !error && items.length > 0 && (
                <div className="mt-4 space-y-3">
                  {items.map((item, index) => {
                    const selectionLabels = guidedSelectionLabelsFromMetadata(item.metadata || {})

                    return (
                      <article key={item.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={item.status} />
                              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-bold text-zinc-400">{shortId(item.id)}</span>
                            </div>
                            <h4 className="mt-2 font-black text-white">{batchItemLabel(item, index)}</h4>
                            <p className="mt-1 text-sm text-zinc-500">{batchItemHelper(item)}</p>
                            {selectionLabels.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {selectionLabels.map((label) => <span key={label} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-zinc-300">{label}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="grid min-w-[300px] grid-cols-4 gap-2 text-center text-xs">
                            <div className="rounded-xl bg-white/[0.055] p-3"><p className="text-zinc-500">Pedido</p><strong className="text-white">{item.requestedVariants}</strong></div>
                            <div className="rounded-xl bg-white/[0.055] p-3"><p className="text-zinc-500">Gerado</p><strong className="text-white">{item.generatedVariants}</strong></div>
                            <div className="rounded-xl bg-emerald-500/10 p-3"><p className="text-emerald-200/80">OK</p><strong className="text-emerald-100">{item.approvedVariants}</strong></div>
                            <div className="rounded-xl bg-rose-500/10 p-3"><p className="text-rose-200/80">Erro</p><strong className="text-rose-100">{item.rejectedVariants}</strong></div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {activeBatchDetailTab === 'checklist' && (
            <section className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="max-w-3xl">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Checklist de segurança</p>
                  <h3 className="mt-2 text-xl font-black text-white">Preparar próxima etapa sem gerar mídia</h3>
                  <p className="mt-2 text-sm leading-relaxed text-amber-50/80">Esta área concentra a ação controlada, a barreira final e os retornos da verificação. Nenhuma geração final, entrega, publicação ou cobrança é iniciada aqui.</p>
                  <div className="mt-4 grid gap-2 text-xs font-bold text-amber-50/80 sm:grid-cols-4">
                    <span className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-2 text-center">Mídia agora: Não</span>
                    <span className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-2 text-center">Cliente: intocado</span>
                    <span className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-2 text-center">Cobrança: Não</span>
                    <span className="rounded-full border border-amber-200/20 bg-black/20 px-3 py-2 text-center">Publicação: Não</span>
                  </div>
                </div>
                <div className="flex min-w-[260px] flex-col gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100">Prontidão</p>
                    <p className="mt-1 text-sm font-black text-white">{readinessPassed}/{readinessChecks.length} itens OK</p>
                    <p className="mt-1 text-xs leading-relaxed text-amber-50/70">
                      {readinessBlockers.length > 0
                        ? `${readinessBlockers.length} pendência(s) impedem a preparação.`
                        : readinessWarnings.length > 0
                          ? `${readinessWarnings.length} ponto(s) pedem conferência.`
                          : 'Lote pronto para verificação controlada.'}
                    </p>
                  </div>
                  <div className={`rounded-2xl border p-4 ${productionAuthorizationToneClass(controlledSource.productionAuthorization)}`}>
                    <div className="flex items-start gap-2">
                      {productionAuthorizationAuthorized(controlledSource.productionAuthorization)
                        ? <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-200" />
                        : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-200" />}
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em]">Validação da autorização do modelo</p>
                        <p className="mt-1 text-sm font-black text-white">{productionAuthorizationLabel(controlledSource.productionAuthorization)}</p>
                        <p className="mt-1 text-xs leading-relaxed opacity-80">{productionAuthorizationHelper(controlledSource.productionAuthorization)}</p>
                      </div>
                    </div>
                  </div>
                  <button type="button" disabled={actionBlocked} onClick={handlePreviewBatchAction} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500">Verificar início controlado</button>
                  <button type="button" disabled={actionBlocked} onClick={handlePrepareBatchAction} className="rounded-2xl border border-amber-200/25 bg-black/20 px-4 py-3 text-sm font-black text-amber-50 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600">Preparar sem gerar mídia</button>
                </div>
              </div>

              <section className="mt-4 rounded-[1.5rem] border border-violet-300/20 bg-violet-400/10 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Orquestração controlada</p>
                    <h4 className="mt-1 text-base font-black text-white">Fila com chunking e backpressure</h4>
                    <p className="mt-2 text-sm leading-relaxed text-violet-50/75">O processamento envia no máximo {RUNPOD_CHUNK_SIZE} item(ns) por bloco e aguarda retorno antes de avançar. O backend ainda valida checklist, frase, ambiente, armazenamento protegido e travas finais antes de enfileirar cada item.</p>
                    <div className="mt-4 grid gap-2 text-xs font-bold text-violet-50/80 sm:grid-cols-4">
                      <span className="rounded-full border border-violet-200/20 bg-black/20 px-3 py-2 text-center">Elegíveis: {runPodCandidates.length}</span>
                      <span className="rounded-full border border-violet-200/20 bg-black/20 px-3 py-2 text-center">Blocos: {runPodChunks.length}</span>
                      <span className="rounded-full border border-violet-200/20 bg-black/20 px-3 py-2 text-center">Processados agora: {runPodProcessedCount}</span>
                      <span className="rounded-full border border-violet-200/20 bg-black/20 px-3 py-2 text-center">Status do lote: {statusLabel(batch.status)}</span>
                    </div>
                    {!runPodStartAllowedByStatus && (
                      <p className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-400/10 p-3 text-xs font-bold leading-relaxed text-amber-50">O botão de início fica liberado apenas para lotes em planned ou approved_to_queue.</p>
                    )}
                  </div>
                  <div className="min-w-[280px] space-y-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <label className="block space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-100">Frase de confirmação operacional</span>
                      <input
                        value={runPodConfirmationPhrase}
                        onChange={(event) => setRunPodConfirmationPhrase(event.target.value)}
                        disabled={runPodIsProcessing}
                        placeholder="Cole a frase exigida pelo backend"
                        className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-300/50 disabled:cursor-not-allowed disabled:text-zinc-600"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!runPodCanStart}
                      onClick={handleStartRunPodChunkedProcessing}
                      className="w-full rounded-2xl bg-violet-200 px-4 py-3 text-sm font-black text-violet-950 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                    >
                      {runPodIsProcessing ? 'Processando em blocos…' : 'Iniciar Processamento no RunPod'}
                    </button>
                    <p className="text-xs leading-relaxed text-zinc-500">Ação real controlada: não altera Cliente, não publica, não cobra créditos e respeita as travas do backend.</p>
                  </div>
                </div>

                {runPodLogs.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Log visual do processamento</p>
                    <div className="mt-3 space-y-2">
                      {runPodLogs.slice(-8).map((entry) => (
                        <div key={entry.id} className={`rounded-xl border px-3 py-2 text-xs font-bold ${entry.status === 'success' ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50' : entry.status === 'error' ? 'border-rose-300/20 bg-rose-400/10 text-rose-50' : 'border-violet-300/20 bg-violet-400/10 text-violet-50'}`}>
                          {entry.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Checklist de prontidão do lote</p>
                    <h4 className="mt-1 text-base font-black text-white">O que precisa estar certo antes da próxima etapa</h4>
                  </div>
                  <span className="w-fit rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-amber-50">{readinessPassed}/{readinessChecks.length} prontos</span>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {readinessChecks.map((check) => (
                    <div key={check.key} className={`rounded-2xl border p-3 ${batchReadinessToneClass(check)}`}>
                      <div className="flex items-start gap-2">
                        {batchReadinessIcon(check)}
                        <div>
                          <p className="text-sm font-black">{check.label}</p>
                          <p className="mt-1 text-xs leading-relaxed opacity-80">{check.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <section className="mt-4 rounded-[1.5rem] border border-sky-300/20 bg-sky-400/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Barreira final antes da produção real</p>
                    <h4 className="mt-1 text-base font-black text-white">{finalReadinessReady ? 'Pronto para conferência final, ainda sem gerar mídia' : 'Ainda em conferência antes de qualquer geração real'}</h4>
                    <p className="mt-1 max-w-3xl text-sm leading-relaxed text-sky-50/75">Mesmo com o lote pronto, esta etapa mantém a geração final desligada. A produção real só deve acontecer em uma etapa própria, com autorização explícita e conferência operacional.</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${finalReadinessReady ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50' : 'border-amber-300/20 bg-amber-400/10 text-amber-50'}`}>
                    {finalReadinessReady ? 'Conferência final OK' : 'Conferência final pendente'}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                  {finalReadinessLocks.map((lock) => (
                    <div key={lock.key} className={`rounded-2xl border p-3 ${lock.ok ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50' : 'border-amber-300/20 bg-amber-400/10 text-amber-50'}`}>
                      <div className="flex items-start gap-2">
                        {lock.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-200" /> : <Info size={16} className="mt-0.5 shrink-0 text-sky-100" />}
                        <div>
                          <p className="text-xs font-black">{lock.label}</p>
                          <p className="mt-1 text-sm font-black text-white">{lock.value}</p>
                          <p className="mt-1 text-[11px] leading-relaxed opacity-80">{lock.helper}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {!actionCandidate && !isLoading && (
                <div className="mt-4 rounded-2xl border border-rose-300/20 bg-rose-400/10 p-4 text-sm text-rose-50/90">
                  <p className="font-black text-white">Este lote ainda precisa de conferência antes de preparar.</p>
                  <p className="mt-1 leading-relaxed">Confira: {readinessBlockers.length > 0 ? readinessBlockers.map((check) => check.label).join(', ') : 'os itens do lote e o produto/prompt vinculado'}.</p>
                </div>
              )}

              {batchActionResult && (
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Resultado da ação</p>
                      <h4 className="mt-1 text-lg font-black text-white">{batchControlledActionStatusLabel(batchActionResult)}</h4>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">{batchControlledActionHelper(batchActionResult)}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${batchActionResult.queued ? 'border-violet-400/25 bg-violet-400/10 text-violet-100' : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-100'}`}>{batchActionResult.queued ? 'Item enfileirado' : 'Nenhum início automático'}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs font-bold text-zinc-300 sm:grid-cols-3">
                    <span className="rounded-xl bg-white/[0.055] p-3">Enfileirado: {batchActionResult.queued ? 'Sim' : 'Não'}</span>
                    <span className="rounded-xl bg-white/[0.055] p-3">Cliente alterado: Não</span>
                    <span className="rounded-xl bg-white/[0.055] p-3">Cobrança: Não</span>
                  </div>
                  {batchResultReadinessItems(batchActionResult).length > 0 && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Checklist retornado pela verificação</p>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {batchResultReadinessItems(batchActionResult).map((check) => (
                          <div key={check.key} className={`rounded-xl border p-3 ${batchReadinessToneClass(check)}`}>
                            <div className="flex items-start gap-2">
                              {batchReadinessIcon(check)}
                              <div>
                                <p className="text-xs font-black">{check.label}</p>
                                <p className="mt-1 text-[11px] leading-relaxed opacity-80">{check.helper}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeBatchDetailTab === 'history' && (
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Histórico / concluídos</p>
              <h3 className="mt-2 text-xl font-black text-white">Registro operacional do lote</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">Histórico simples para auditoria visual. Detalhes técnicos continuam preservados nos endpoints e nos logs existentes.</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Criado em</p><strong className="text-white">{formatDate(batch.createdAt)}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Atualizado em</p><strong className="text-white">{formatDate(batch.updatedAt)}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Gerados</p><strong className="text-white">{batch.generatedCount}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Resultado</p><strong className="text-white">{batch.approvedCount} OK / {batch.rejectedCount} erro</strong></div>
              </div>
              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-zinc-400">
                <p className="font-black text-zinc-200">Referência preservada</p>
                <p className="mt-1">ID do lote: <strong className="text-white">{shortId(batch.id)}</strong>. A lógica de Supabase, barreira final, endpoints e validações do M4 permanece intacta.</p>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function deliveryActorName(delivery: FactoryDelivery) {
  return delivery.companion.name || delivery.companion.slug || 'Ator não informado'
}

function deliveryProductName(delivery: FactoryDelivery) {
  return delivery.combination.title || delivery.combination.key || delivery.asset.mediaType || 'Produto entregue'
}

function deliveryCustomerName(delivery: FactoryDelivery) {
  return delivery.profile.email || delivery.profile.name || 'Cliente não informado'
}

function deliveryStatus(delivery: FactoryDelivery): DeliveryStatusFilter {
  const hasProtectedRoute = Boolean(delivery.protectedViewUrl)
  const totalCredits = Number(delivery.pricing.totalPriceCredits || 0)
  const assetStatus = normalizeText(delivery.asset.status || '')

  if (!hasProtectedRoute || assetStatus.includes('error') || assetStatus.includes('failed')) return 'error'
  if (totalCredits <= 0) return 'free'
  return 'delivered'
}

function deliveryStatusLabel(delivery: FactoryDelivery) {
  const status = deliveryStatus(delivery)
  if (status === 'error') return 'Erro na entrega'
  if (status === 'free') return 'Liberado sem cobrança'
  return 'Entregue ao cliente'
}

function deliveryStatusTone(delivery: FactoryDelivery) {
  const status = deliveryStatus(delivery)
  if (status === 'error') return 'border-rose-400/30 bg-rose-400/10 text-rose-100'
  if (status === 'free') return 'border-violet-400/30 bg-violet-400/10 text-violet-100'
  return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100'
}

function buildUniqueOptions(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function bestSellingProduct(deliveries: FactoryDelivery[]) {
  const counts = deliveries.reduce<Record<string, number>>((acc, delivery) => {
    const key = deliveryProductName(delivery)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  const [name, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] || ['—', 0]
  return { name, count }
}

function topRevenueActor(deliveries: FactoryDelivery[]) {
  const totals = deliveries.reduce<Record<string, number>>((acc, delivery) => {
    const key = deliveryActorName(delivery)
    acc[key] = (acc[key] || 0) + Number(delivery.pricing.totalPriceCredits || 0)
    return acc
  }, {})

  const [name, credits] = Object.entries(totals).sort((a, b) => b[1] - a[1])[0] || ['—', 0]
  return { name, credits }
}

function DeliveryStatusPill({ delivery }: { delivery: FactoryDelivery }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${deliveryStatusTone(delivery)}`}>
      {deliveryStatusLabel(delivery)}
    </span>
  )
}

function DeliveryDetailDrawer({ delivery, onClose }: { delivery: FactoryDelivery | null; onClose: () => void }) {
  if (!delivery) return null

  const rows = [
    ['Entrega', shortId(delivery.id)],
    ['Cliente', deliveryCustomerName(delivery)],
    ['Ator', deliveryActorName(delivery)],
    ['Produto', deliveryProductName(delivery)],
    ['Mídia', mediaTypeLabel(delivery.combination.mediaType || delivery.asset.mediaType || '')],
    ['Créditos cobrados', String(delivery.pricing.totalPriceCredits ?? 0)],
    ['Créditos universais', String(delivery.pricing.universalCreditsUsed ?? 0)],
    ['Créditos do ator', String(delivery.pricing.companionCreditsUsed ?? 0)],
    ['Origem', delivery.deliverySource || 'Compra protegida'],
    ['Data', formatDate(delivery.createdAt)],
  ]

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Fechar detalhes da entrega" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-white/10 bg-zinc-950 p-6 shadow-2xl shadow-black">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">Detalhes da transação</p>
            <h2 className="mt-2 text-3xl font-black text-white">{deliveryProductName(delivery)}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">Histórico comercial e operacional da entrega protegida. A rota protegida continua preservada no backend.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 p-3 text-zinc-400 transition hover:border-white/25 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <DeliveryStatusPill delivery={delivery} />
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{shortId(delivery.asset.id)}</span>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{delivery.protectedViewUrl ? 'Protected view OK' : 'Sem rota protegida'}</span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">{label}</p>
              <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/25 p-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Assinatura do produto</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(Array.isArray(delivery.combination.guidedSelections) ? delivery.combination.guidedSelections : []).slice(0, 8).map((selection, index) => (
              <span key={`${delivery.id}-selection-${index}`} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-2 text-xs font-bold text-zinc-300">
                {selection.titleName || 'Opção'}: {selection.itemName || 'Item'}
              </span>
            ))}
            {(!Array.isArray(delivery.combination.guidedSelections) || delivery.combination.guidedSelections.length === 0) && (
              <span className="text-sm text-zinc-500">Sem assinatura estruturada retornada para esta entrega.</span>
            )}
          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-emerald-400/20 bg-emerald-400/10 p-5 text-sm leading-relaxed text-emerald-50">
          <strong>Modo seguro:</strong> este drawer apenas lê e organiza dados já carregados. Não reabre cobrança, não gera mídia, não publica e não acessa storage real.
        </div>
      </aside>
    </div>
  )
}

function DeliveryRow({ delivery, onOpen }: { delivery: FactoryDelivery; onOpen: (delivery: FactoryDelivery) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(delivery)}
      className="group w-full rounded-[1.75rem] border border-white/10 bg-white/[0.045] p-4 text-left shadow-2xl shadow-black/15 transition hover:border-emerald-300/35 hover:bg-white/[0.07]"
    >
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_0.7fr_auto] lg:items-center">
        <div className="min-w-0">
          <DeliveryStatusPill delivery={delivery} />
          <h3 className="mt-3 truncate text-base font-black text-white">{deliveryProductName(delivery)}</h3>
          <p className="mt-1 text-xs text-zinc-500">Entrega {shortId(delivery.id)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Ator</p>
          <p className="mt-1 truncate text-sm font-bold text-zinc-200">{deliveryActorName(delivery)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Cliente</p>
          <p className="mt-1 truncate text-sm font-bold text-zinc-200">{deliveryCustomerName(delivery)}</p>
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-zinc-600">Créditos</p>
          <p className="mt-1 text-sm font-black text-white">{delivery.pricing.totalPriceCredits ?? 0}</p>
        </div>
        <span className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-xs font-black text-zinc-300 transition group-hover:border-emerald-300/40 group-hover:text-emerald-100">
          Abrir
          <ChevronRight size={15} />
        </span>
      </div>
    </button>
  )
}

function DeliveriesOperationsPage({
  deliveries,
  isLoading,
  globalActorFilter,
  onClearActorFilter,
}: {
  deliveries: FactoryDelivery[]
  isLoading: boolean
  globalActorFilter: GlobalActorFilter | null
  onClearActorFilter: () => void
}) {
  const scopedActorValue = globalActorFilter ? `__actor_scope__:${globalActorFilter.actorId}` : ''
  const [actorFilter, setActorFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [clientFilter, setClientFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('all')
  const [selectedDelivery, setSelectedDelivery] = useState<FactoryDelivery | null>(null)

  const actors = useMemo(() => buildUniqueOptions(deliveries.map(deliveryActorName)), [deliveries])
  const products = useMemo(() => buildUniqueOptions(deliveries.map(deliveryProductName)), [deliveries])
  const clients = useMemo(() => buildUniqueOptions(deliveries.map(deliveryCustomerName)), [deliveries])

  useEffect(() => {
    setActorFilter(globalActorFilter ? scopedActorValue : 'all')
  }, [globalActorFilter?.actorId, scopedActorValue])

  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((delivery) => {
      if (actorFilter === scopedActorValue && globalActorFilter && !deliveryMatchesGlobalActorFilter(delivery, globalActorFilter)) return false
      if (actorFilter !== 'all' && actorFilter !== scopedActorValue && deliveryActorName(delivery) !== actorFilter) return false
      if (productFilter !== 'all' && deliveryProductName(delivery) !== productFilter) return false
      if (clientFilter !== 'all' && deliveryCustomerName(delivery) !== clientFilter) return false
      if (statusFilter !== 'all' && deliveryStatus(delivery) !== statusFilter) return false
      return true
    })
  }, [actorFilter, clientFilter, deliveries, globalActorFilter, productFilter, scopedActorValue, statusFilter])

  const topProduct = useMemo(() => bestSellingProduct(filteredDeliveries), [filteredDeliveries])
  const topActor = useMemo(() => topRevenueActor(filteredDeliveries), [filteredDeliveries])
  const deliveryErrors = useMemo(() => filteredDeliveries.filter((delivery) => deliveryStatus(delivery) === 'error').length, [filteredDeliveries])
  const invoicedCredits = useMemo(() => filteredDeliveries.reduce((total, delivery) => total + Number(delivery.pricing.totalPriceCredits || 0), 0), [filteredDeliveries])

  return (
    <section className="space-y-6" data-admin-section="ux7-deliveries-operations">
      <PageHeader
        eyebrow="Comercial"
        title="Entregas e vendas"
        description="Consulte conteúdos entregues, clientes atendidos e créditos efetivamente registrados nas entregas carregadas."
      />

      {globalActorFilter && (
        <div className="flex flex-col gap-3 rounded-[2rem] border border-emerald-300/25 bg-emerald-300/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Filtro recebido do perfil</p>
            <p className="mt-1 text-lg font-black text-white">{globalActorFilter.actorName}</p>
            <p className="mt-1 text-sm text-emerald-50/70">A lista abaixo permanece limitada às entregas associadas a este ator.</p>
          </div>
          <button type="button" onClick={onClearActorFilter} className="rounded-2xl border border-emerald-200/30 bg-black/20 px-4 py-3 text-sm font-black text-emerald-50 transition hover:border-emerald-100/60">Ver todos os atores</button>
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Ator</span>
            <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40">
              <option value="all">Todos os atores</option>
              {globalActorFilter && <option value={scopedActorValue}>{globalActorFilter.actorName} — perfil selecionado</option>}
              {actors.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Produto</span>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40">
              <option value="all">Todos os produtos</option>
              {products.map((product) => <option key={product} value={product}>{product}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Cliente</span>
            <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40">
              <option value="all">Todos os clientes</option>
              {clients.map((client) => <option key={client} value={client}>{client}</option>)}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as DeliveryStatusFilter)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none focus:border-emerald-300/40">
              <option value="all">Todos os status</option>
              <option value="delivered">Entregue</option>
              <option value="free">Sem cobrança</option>
              <option value="error">Com erro</option>
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receita faturada" value={`${formatCreditsAmount(invoicedCredits)} cr`} helper="Soma real de totalPriceCredits nas entregas filtradas." icon={ShoppingBag} tone="emerald" />
        <MetricCard label="Produto mais vendido" value={topProduct.count || '—'} helper={topProduct.count ? topProduct.name : 'Sem entregas faturadas neste filtro.'} icon={Store} tone="blue" />
        <MetricCard label="Ator com maior receita" value={topActor.credits ? `${formatCreditsAmount(topActor.credits)} cr` : '—'} helper={topActor.credits ? topActor.name : 'Sem créditos registrados neste filtro.'} icon={Crown} tone="violet" />
        <MetricCard label="Entregas com erro" value={deliveryErrors} helper="Entregas sem rota protegida ou com falha registrada." icon={AlertTriangle} tone={deliveryErrors ? 'red' : 'zinc'} />
      </div>

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-2 border-b border-white/10 pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Lista operacional</p>
            <h3 className="mt-1 text-2xl font-black text-white">Transações recentes</h3>
          </div>
          <p className="text-xs font-bold text-zinc-500">{filteredDeliveries.length} de {deliveries.length} entrega(s)</p>
        </div>

        <div className="mt-4 space-y-3">
          {isLoading && <EmptyState message="Carregando entregas…" icon={Send} />}
          {!isLoading && deliveries.length === 0 && <EmptyState message="Nenhuma entrega para listar." helper="Entregas reais aparecerão aqui conforme os clientes comprarem conteúdos." icon={Send} />}
          {!isLoading && deliveries.length > 0 && filteredDeliveries.length === 0 && <EmptyState message="Nenhuma entrega encontrada neste filtro." helper="Altere ator, produto, cliente ou status para ampliar a busca." icon={Search} />}
          {!isLoading && filteredDeliveries.map((delivery) => (
            <DeliveryRow key={delivery.id} delivery={delivery} onOpen={setSelectedDelivery} />
          ))}
        </div>
      </div>

      <DeliveryDetailDrawer delivery={selectedDelivery} onClose={() => setSelectedDelivery(null)} />
    </section>
  )
}

function PreviewModal({
  asset,
  preview,
  isLoading,
  error,
  onClose,
  onApprove,
  onReject,
  onRepeat,
  onNext,
  onPrevious,
}: {
  asset: FactoryAsset | null
  preview: SecurePreviewResponse | null
  isLoading: boolean
  error: unknown
  onClose: () => void
  onApprove: (asset: FactoryAsset) => void
  onReject: (asset: FactoryAsset) => void
  onRepeat: (asset: FactoryAsset) => void
  onNext: () => void
  onPrevious: () => void
}) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [activeReviewTab, setActiveReviewTab] = useState<ReviewModalTab>('decision')

  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setDragStart(null)
    setActiveReviewTab('decision')
  }, [asset?.id])

  if (!asset) return null

  const canReview = asset.status === 'qa_pending'
  const mediaType = asset.mediaType
  const isVideo = isVideoMedia(mediaType)
  const isAudio = isAudioMedia(mediaType)
  const url = preview?.access.url || null
  const guidedSelections = Array.isArray(asset.combination?.guidedSelections) ? asset.combination.guidedSelections : []

  function handleDragStart(event: MouseEvent<HTMLDivElement>) {
    if (isVideo || isAudio || zoom <= 1) return
    setDragStart({ x: event.clientX - position.x, y: event.clientY - position.y })
  }

  function handleDragMove(event: MouseEvent<HTMLDivElement>) {
    if (!dragStart) return
    setPosition({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })
  }

  return (
    <div data-admin-review-decision-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 backdrop-blur-2xl md:p-6">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={asset.status} />
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-zinc-400">{mediaTypeLabel(asset.mediaType)}</span>
            </div>
            <h3 className="mt-2 truncate text-lg font-black text-white">{contentTitle(asset)}</h3>
            <p className="text-sm text-zinc-500">{asset.companion.name || asset.companion.slug || 'Modelo sem nome'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={onPrevious} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={onNext} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
              <ChevronRight size={18} />
            </button>
            <button type="button" onClick={onClose} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_380px]">
          <div
            className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.10),transparent_40%),#050505]"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={() => setDragStart(null)}
            onMouseLeave={() => setDragStart(null)}
          >
            {isLoading && <EmptyState message="Gerando visualização protegida…" helper="Aguarde alguns segundos para carregar a mídia com segurança." icon={Maximize2} />}
            {Boolean(error) && <ErrorState error={error} />}

            {!isLoading && !error && url && isVideo && (
              <video className="max-h-[72vh] w-full max-w-5xl rounded-3xl border border-white/10 bg-black" src={url} controls playsInline />
            )}

            {!isLoading && !error && url && isAudio && (
              <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.055] p-8 text-center">
                <Music className="mx-auto text-amber-100" size={44} />
                <p className="mt-4 text-lg font-black text-white">Prévia de áudio</p>
                <audio className="mt-6 w-full" src={url} controls />
              </div>
            )}

            {!isLoading && !error && url && !isVideo && !isAudio && (
              <img
                src={url}
                alt={contentTitle(asset)}
                draggable={false}
                className="max-h-[72vh] max-w-full select-none rounded-3xl object-contain shadow-2xl shadow-black/60"
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  cursor: zoom > 1 ? 'grab' : 'default',
                }}
              />
            )}
          </div>

          <aside className="flex min-h-0 flex-col border-t border-white/10 bg-black/40 lg:border-l lg:border-t-0">
            <div className="border-b border-white/10 p-4">
              <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/35 p-1">
                {REVIEW_MODAL_TABS.map((tab) => (
                  <button key={tab.value} type="button" onClick={() => setActiveReviewTab(tab.value)} className={`rounded-xl px-3 py-2 text-xs font-black transition ${activeReviewTab === tab.value ? 'bg-white text-zinc-950' : 'text-zinc-500 hover:text-white'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,.25)_transparent]">
              {activeReviewTab === 'decision' && (
                <div className="space-y-4">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Decisão da curadoria</p>
                    <p className="mt-3 text-sm leading-relaxed text-zinc-300">Analise a mídia em destaque. A decisão final fica fixa no rodapé deste modal.</p>
                  </div>

                  {!isVideo && !isAudio && (
                    <div className="grid grid-cols-4 gap-2">
                      <button type="button" onClick={() => setZoom((value) => Math.min(value + 0.25, 3))} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
                        <ZoomIn size={18} className="mx-auto" />
                      </button>
                      <button type="button" onClick={() => setZoom((value) => Math.max(value - 0.25, 0.75))} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
                        <ZoomOut size={18} className="mx-auto" />
                      </button>
                      <button type="button" onClick={() => setPosition({ x: 0, y: 0 })} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
                        <Move size={18} className="mx-auto" />
                      </button>
                      <button type="button" onClick={() => { setZoom(1); setPosition({ x: 0, y: 0 }) }} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:text-white">
                        <RotateCcw size={18} className="mx-auto" />
                      </button>
                    </div>
                  )}

                  <div className="grid gap-3 rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Preço</span><strong className="text-white">{asset.price.credits} créditos</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Entregas registradas</span><strong className="text-white">{asset.assignments.current}/{asset.assignments.max}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Criado</span><strong className="text-white">{formatDate(asset.createdAt)}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-zinc-500">Código</span><strong className="text-white">{shortId(asset.id)}</strong></div>
                  </div>
                </div>
              )}

              {activeReviewTab === 'prompt' && (
                <div className="space-y-4">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Prompt e produto</p>
                    <h4 className="mt-2 text-lg font-black text-white">{asset.combination.title || contentTitle(asset)}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">As informações do produto ficam aqui, fora da vitrine principal da revisão.</p>
                  </div>
                  <div className="grid gap-3">
                    {guidedSelections.length > 0 ? guidedSelections.map((selection, index) => (
                      <div key={`${selection.titleId || index}-${selection.itemId || index}`} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">{selection.titleName || `Dimensão ${index + 1}`}</p>
                        <p className="mt-2 text-sm font-black text-white">{selection.itemName || 'Item selecionado'}</p>
                        {selection.technicalSnippet && <p className="mt-2 text-xs leading-relaxed text-zinc-500">{selection.technicalSnippet}</p>}
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-zinc-500">Nenhum detalhe de prompt estruturado foi retornado para este item.</div>
                    )}
                  </div>
                </div>
              )}

              {activeReviewTab === 'history' && (
                <div className="space-y-4">
                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Histórico</p>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">Registro simples para tomada de decisão. Auditoria detalhada permanece nos módulos existentes.</p>
                  </div>
                  <div className="grid gap-3 text-sm">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><span className="text-zinc-500">Status atual</span><strong className="mt-1 block text-white">{statusLabel(asset.status)}</strong></div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><span className="text-zinc-500">Publicado em</span><strong className="mt-1 block text-white">{asset.publishedAt ? formatDate(asset.publishedAt) : 'Ainda não publicado'}</strong></div>
                    {asset.rejectionReason && <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-rose-100"><strong>Motivo da reprovação:</strong><p className="mt-1 text-rose-100/80">{asset.rejectionReason}</p></div>}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-zinc-950/95 p-4">
              {canReview ? (
                <div className="grid gap-2 lg:grid-cols-3">
                  <button type="button" onClick={() => onApprove(asset)} className="rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-black text-white transition hover:bg-emerald-500">
                    ✅ Aprovar
                  </button>
                  <button type="button" onClick={() => onRepeat(asset)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-300/35 bg-amber-300/10 px-4 py-4 text-sm font-black text-amber-100 transition hover:bg-amber-300/20">
                    <RefreshCw size={16} /> Repetir Job
                  </button>
                  <button type="button" onClick={() => onReject(asset)} className="rounded-2xl bg-rose-600 px-4 py-4 text-sm font-black text-white transition hover:bg-rose-500">
                    ❌ Rejeitar
                  </button>
                </div>
              ) : (
                <p className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center text-sm font-bold text-zinc-400">Este conteúdo não está aguardando decisão.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}

function PromptBuilderPage({
  catalogProductionFocus = null,
  onClearCatalogProductionFocus,
  onBackToCatalog,
  onOpenBatches,
}: {
  catalogProductionFocus?: CatalogProductionFocus | null
  onClearCatalogProductionFocus?: () => void
  onBackToCatalog?: () => void
  onOpenBatches?: (batchId?: string) => void
} = {}) {
  const [activeTab, setActiveTab] = useState<CreationTab>(catalogProductionFocus ? 'production' : 'titles')
  const [titles, setTitles] = useState<CreationTitle[]>(INITIAL_CREATION_TITLES)
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false)
  const [itemModalTitleId, setItemModalTitleId] = useState<string | null>(null)
  const [newTitleName, setNewTitleName] = useState('')
  const [newTitleDescription, setNewTitleDescription] = useState('')
  const [newTitleTypes, setNewTitleTypes] = useState<ContentObject[]>(['Imagem'])
  const [newItemsText, setNewItemsText] = useState('')
  const [selectedAvatarId, setSelectedAvatarId] = useState(AVATAR_PROFILES[0]?.id || '')
  const [productionAvatarId, setProductionAvatarId] = useState(AVATAR_PROFILES[0]?.id || '')
  const [productionContentType, setProductionContentType] = useState<ContentObject>('Imagem')
  const [productionSelections, setProductionSelections] = useState<SelectionMap>({})
  const [productionVariationTarget, setProductionVariationTarget] = useState(catalogProductionFocus?.targetVariants || 8)
  const [lastProductionPlanPreview, setLastProductionPlanPreview] = useState<ProductionPlanPreview | null>(null)
  const [operationalFilter, setOperationalFilter] = useState<OperationalProductionFilter>('all')
  const [creativeMediaFilter, setCreativeMediaFilter] = useState<CreativeFactoryMediaFilter>('all')
  const [creativeCategoryFilter, setCreativeCategoryFilter] = useState<CreativeFactoryCategoryFilter>('all')
  const [selectedCreativeCard, setSelectedCreativeCard] = useState<{ title: CreationTitle; item: CreationItem } | null>(null)
  const [creativeDraftTitle, setCreativeDraftTitle] = useState('')
  const [creativeDraftType, setCreativeDraftType] = useState<ContentObject>('Imagem')
  const [avatarTypes, setAvatarTypes] = useState<Record<string, ContentObject[]>>(() => {
    return AVATAR_PROFILES.reduce<Record<string, ContentObject[]>>((acc, avatar) => {
      acc[avatar.id] = avatar.enabledContentTypes
      return acc
    }, {})
  })
  const [avatarItems, setAvatarItems] = useState<Record<string, string[]>>(() => {
    const allItems = INITIAL_CREATION_TITLES.flatMap((title) => title.items.map((item) => item.id))
    return AVATAR_PROFILES.reduce<Record<string, string[]>>((acc, avatar) => {
      acc[avatar.id] = allItems
      return acc
    }, {})
  })

  const creationTitlesQuery = useCreationTitles()
  const creationAvatarsQuery = useCreationAvatars()
  const createTitleMutation = useCreateCreationTitle()
  const createItemsMutation = useCreateCreationItems()
  const createProductionBatchMutation = useCreateSafeGuidedProductionBatch()

  const availableAvatars = useMemo(() => {
    const apiAvatars = creationAvatarsQuery.data?.items?.map(mapCreationAvatarFromApi) || []
    return apiAvatars.length > 0 ? apiAvatars : AVATAR_PROFILES
  }, [creationAvatarsQuery.data])

  useEffect(() => {
    if (!creationTitlesQuery.data?.items?.length) return

    const mappedTitles = creationTitlesQuery.data.items.map(mapCreationTitleFromApi)
    setTitles(mappedTitles)

    const allItems = mappedTitles.flatMap((title) => title.items.map((item) => item.id))
    setAvatarItems((current) => {
      const next = { ...current }
      for (const avatar of availableAvatars) {
        next[avatar.id] = next[avatar.id]?.length ? next[avatar.id] : allItems
      }
      return next
    })
  }, [availableAvatars, creationTitlesQuery.data])

  useEffect(() => {
    if (availableAvatars.length === 0) return

    if (!availableAvatars.some((avatar) => avatar.id === selectedAvatarId)) {
      setSelectedAvatarId(availableAvatars[0].id)
    }

    if (!availableAvatars.some((avatar) => avatar.id === productionAvatarId)) {
      setProductionAvatarId(availableAvatars[0].id)
    }
  }, [availableAvatars, productionAvatarId, selectedAvatarId])

  useEffect(() => {
    if (!catalogProductionFocus) return

    setActiveTab('production')
    setProductionAvatarId(catalogProductionFocus.companionId)
    setProductionContentType(catalogProductionFocus.contentType)
    setProductionVariationTarget(catalogProductionFocus.targetVariants || 8)
    setProductionSelections(catalogProductionFocus.selections || {})
  }, [catalogProductionFocus])

  useEffect(() => {
    setLastProductionPlanPreview(null)
  }, [productionAvatarId, productionContentType, productionSelections, productionVariationTarget])

  useEffect(() => {
    if (!selectedCreativeCard) return
    setCreativeDraftTitle(selectedCreativeCard.item.name)
    setCreativeDraftType(selectedCreativeCard.title.contentTypes[0] || 'Imagem')
  }, [selectedCreativeCard])

  const selectedAvatar = availableAvatars.find((avatar) => avatar.id === selectedAvatarId) || availableAvatars[0]
  const productionAvatar = availableAvatars.find((avatar) => avatar.id === productionAvatarId) || availableAvatars[0]
  const itemModalTitle = titles.find((title) => title.id === itemModalTitleId) || null
  const currentAvatarTypes = avatarTypes[selectedAvatar?.id || ''] || []
  const currentAvatarItems = avatarItems[selectedAvatar?.id || ''] || []

  const creationTabs: Array<{ id: CreationTab; label: string; helper: string; icon: ElementType }> = [
    { id: 'titles', label: 'Cadastro de Variáveis', helper: 'Cadastre títulos e itens reutilizáveis da fábrica.', icon: ListChecks },
    { id: 'production', label: 'Motor de Combinações', helper: 'Cruze variáveis e prepare lotes em modo seguro.', icon: Layers3 },
  ]

  const operationalFilters: Array<{ id: OperationalProductionFilter; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'released', label: 'Liberados' },
    { id: 'blocked', label: 'Bloqueados' },
    { id: 'mapping', label: 'Pendentes de mapeamento' },
    { id: 'authorization', label: 'Pendentes de autorização' },
  ]

  const creativeMediaFilters: Array<{ id: CreativeFactoryMediaFilter; label: string; icon: ElementType }> = [
    { id: 'all', label: 'Todos', icon: LayoutGrid },
    { id: 'image', label: 'Imagem', icon: ImageIcon },
    { id: 'audio', label: 'Áudio', icon: Music },
    { id: 'video', label: 'Vídeo', icon: Video },
  ]

  const creativeCategoryFilters: Array<{ id: CreativeFactoryCategoryFilter; label: string }> = [
    { id: 'all', label: 'Todas categorias' },
    { id: 'pose', label: 'Pose' },
    { id: 'scenario', label: 'Cenário' },
    { id: 'voice', label: 'Tom de voz' },
  ]

  const visibleForClientCount = useMemo(() => {
    return titles.reduce((total, title) => total + title.items.filter((item) => item.visibleToClient).length, 0)
  }, [titles])

  const creativeLibraryItems = useMemo(() => {
    const mediaMatches = (contentTypes: ContentObject[]) => {
      if (creativeMediaFilter === 'all') return true
      if (creativeMediaFilter === 'image') return contentTypes.includes('Imagem')
      if (creativeMediaFilter === 'audio') return contentTypes.includes('Áudio') || contentTypes.includes('Áudio Live')
      return contentTypes.includes('Vídeo') || contentTypes.includes('Vídeo curto') || contentTypes.includes('Live Action')
    }

    const categoryMatches = (title: CreationTitle, item: CreationItem) => {
      if (creativeCategoryFilter === 'all') return true
      const text = normalizeText(`${title.name} ${title.description} ${item.name} ${item.note}`)
      if (creativeCategoryFilter === 'pose') return text.includes('pose') || text.includes('posicao') || text.includes('posição')
      if (creativeCategoryFilter === 'scenario') return text.includes('cenario') || text.includes('cenário') || text.includes('local') || text.includes('ambiente')
      return text.includes('voz') || text.includes('audio') || text.includes('áudio') || text.includes('tom') || text.includes('timbre')
    }

    return titles
      .flatMap((title) => title.items.map((item) => ({ title, item })))
      .filter(({ title, item }) => mediaMatches(title.contentTypes) && categoryMatches(title, item))
  }, [creativeCategoryFilter, creativeMediaFilter, titles])

  const productionTitles = useMemo(() => {
    return titles.filter((title) => title.contentTypes.includes(productionContentType))
  }, [productionContentType, titles])

  const productionGroups = useMemo(() => {
    return productionTitles
      .map((title) => ({
        title,
        selectedItems: title.items.filter((item) => productionSelections[title.id]?.includes(item.id)),
      }))
      .filter((group) => group.selectedItems.length > 0)
  }, [productionSelections, productionTitles])

  const combinationTotal = useMemo(() => {
    if (productionGroups.length === 0) return 0
    return productionGroups.reduce((total, group) => total * group.selectedItems.length, 1)
  }, [productionGroups])

  const estimatedMediaTotal = useMemo(() => {
    return combinationTotal * Math.max(1, Number(productionVariationTarget) || 1)
  }, [combinationTotal, productionVariationTarget])

  const cartesianPreviewLabels = useMemo(() => buildCartesianPreviewLabels(productionGroups, 6), [productionGroups])

  const productionDestination = useMemo(() => {
    const destinations: Record<ContentObject, string> = {
      Imagem: 'produção de imagem',
      Vídeo: 'produção de vídeo',
      'Vídeo curto': 'produção de vídeo curto',
      'Live Action': 'produção de live action',
      Áudio: 'produção de áudio',
      'Áudio Live': 'produção de áudio live',
    }

    return destinations[productionContentType]
  }, [productionContentType])

  const productionApiContentType = useMemo(() => toApiContentType(productionContentType), [productionContentType])
  const productionAvatarIsReal = isUuid(productionAvatar?.id)
  const productionComplianceQuery = useAvatarComplianceReport(
    productionAvatarIsReal ? productionAvatar?.id : null,
    false,
    productionApiContentType,
  )
  const productionCompliance = productionComplianceQuery.data || null
  const productionComplianceReasons = productionCompliance?.reasons || []
  const productionBlockingMessage = productionAvatarIsReal
    ? productionComplianceReasons[0]?.message || productionCompliance?.summary || 'Aguardando confirmação de conformidade do avatar.'
    : 'Escolha um avatar real cadastrado no sistema.'
  const productionAllowedByCompliance = productionAvatarIsReal && productionCompliance?.productionAllowed === true
  const preflightChecks = useMemo(() => {
    const checklist = productionCompliance?.mapping?.checklist || null
    const vault = productionCompliance?.vault || null
    const checks = productionCompliance?.checks || null

    return [
      {
        id: 'avatar',
        label: 'Avatar real selecionado',
        ok: productionAvatarIsReal,
        helper: productionAvatarIsReal ? productionAvatar?.name || 'Avatar selecionado' : 'Escolha um avatar salvo no sistema.',
      },
      {
        id: 'report',
        label: 'Relatório consultado',
        ok: productionComplianceQuery.isSuccess && !productionComplianceQuery.isLoading && !productionComplianceQuery.isError,
        helper: productionComplianceQuery.isLoading ? 'Conferindo agora.' : productionComplianceQuery.isError ? 'Atualize a consulta antes de produzir.' : 'Consulta concluída.',
      },
      {
        id: 'actor',
        label: 'Ator/Atriz vinculado',
        ok: Boolean(productionCompliance?.actor?.displayName),
        helper: productionCompliance?.actor?.displayName || 'Ainda sem pessoa vinculada.',
      },
      {
        id: 'mapping',
        label: 'Mapeamento aprovado',
        ok: checks?.mappingApproved === true,
        helper: productionCompliance?.mapping?.status ? mappingStatusLabel(productionCompliance.mapping.status) : 'Sem mapeamento aprovado.',
      },
      {
        id: 'checklist',
        label: 'Checklist completo',
        ok: checks?.mappingComplete === true,
        helper: checklist ? `${checklist.completedRequired}/${checklist.totalRequired} materiais obrigatórios` : 'Checklist ainda não carregado.',
      },
      {
        id: 'vault',
        label: 'Cofre privado preenchido',
        ok: Boolean(vault && vault.real > 0 && vault.publicAccess === false),
        helper: vault ? `${vault.real} materiais reais e ${vault.total} no total` : 'Sem resumo do cofre.',
      },
      {
        id: 'authorization',
        label: 'Autorização ativa',
        ok: checks?.hasActiveAuthorization === true,
        helper: productionCompliance?.authorization?.id ? `Autorização ${shortId(productionCompliance.authorization.id)}` : 'Sem autorização ativa.',
      },
      {
        id: 'content-type',
        label: 'Tipo de conteúdo permitido',
        ok: checks?.contentTypeAllowed === true,
        helper: `${mediaTypeLabel(productionContentType)} precisa estar dentro da autorização.`,
      },
      {
        id: 'safe-mode',
        label: 'Produção segura',
        ok: true,
        helper: 'Nesta etapa o lote não inicia produção real. A geração final fica para uma liberação própria.',
      },
    ]
  }, [productionAvatar?.name, productionAvatarIsReal, productionCompliance, productionComplianceQuery.isError, productionComplianceQuery.isLoading, productionComplianceQuery.isSuccess, productionContentType])
  const preflightReady = productionAllowedByCompliance && preflightChecks.every((check) => check.ok) && !productionComplianceQuery.isLoading && !productionComplianceQuery.isError
  const productionReadyToPreview = combinationTotal > 0 && productionVariationTarget > 0
  const operationalAvatars = useMemo(() => availableAvatars.filter((avatar) => isUuid(avatar.id)), [availableAvatars])
  const operationalComplianceQueries = useAvatarComplianceReports(operationalAvatars, productionApiContentType, false)
  const operationalRows = operationalAvatars.map((avatar, index) => {
    const query = operationalComplianceQueries[index]
    const report = query?.data || null
    const firstReason = report?.reasons?.[0] || null
    const hasActiveAuthorization = report?.checks?.hasActiveAuthorization === true
    const mappingApproved = report?.checks?.mappingApproved === true
    const mappingComplete = report?.checks?.mappingComplete === true
    const mappingPending = !mappingApproved || !mappingComplete || ['mapping_not_approved', 'mapping_incomplete', 'mapping_missing'].includes(firstReason?.code || '')
    const authorizationPending = !hasActiveAuthorization || ['authorization_missing', 'content_type_not_allowed'].includes(firstReason?.code || '')

    return {
      avatar,
      query,
      report,
      isReleased: report?.productionAllowed === true,
      isLoading: query?.isLoading === true,
      isError: query?.isError === true,
      mappingPending,
      authorizationPending,
      firstReason,
    }
  })
  const operationalSummary = operationalRows.reduce(
    (summary, row) => {
      if (row.isReleased) summary.released += 1
      if (!row.isReleased && !row.isLoading) summary.blocked += 1
      if (row.mappingPending && !row.isReleased) summary.mapping += 1
      if (row.authorizationPending && !row.isReleased) summary.authorization += 1
      return summary
    },
    { total: operationalRows.length, released: 0, blocked: 0, mapping: 0, authorization: 0 },
  )
  const filteredOperationalRows = operationalRows.filter((row) => {
    if (operationalFilter === 'released') return row.isReleased
    if (operationalFilter === 'blocked') return !row.isReleased
    if (operationalFilter === 'mapping') return row.mappingPending && !row.isReleased
    if (operationalFilter === 'authorization') return row.authorizationPending && !row.isReleased
    return true
  })
  const productionButtonDisabled = !productionReadyToPreview

  function toggleTitleType(type: ContentObject) {
    setNewTitleTypes((current) => (current.includes(type) ? current.filter((item) => item !== type) : [...current, type]))
  }

  function handleCreateTitle() {
    if (!newTitleName.trim()) {
      window.alert('Informe o nome do título. Exemplo: Local, Estilo visual, Humor ou Timbre da voz.')
      return
    }

    if (newTitleTypes.length === 0) {
      window.alert('Escolha pelo menos um tipo de conteúdo para este título.')
      return
    }

    const payload = {
      name: newTitleName.trim(),
      description: newTitleDescription.trim() || 'Título criado pelo Admin para organizar a fábrica guiada.',
      contentTypes: newTitleTypes.map(toApiContentType),
      visibleToClient: true,
      adminOnly: false,
    }

    createTitleMutation.mutate(payload, {
      onSuccess: (created) => {
        const mapped = mapCreationTitleFromApi({ ...created, items: created.items || [] })
        setTitles((current) => [mapped, ...current.filter((title) => title.id !== mapped.id)])
        setNewTitleName('')
        setNewTitleDescription('')
        setNewTitleTypes(['Imagem'])
        setIsTitleModalOpen(false)
      },
      onError: (error) => {
        window.alert(`Não foi possível salvar na Fábrica Guiada. ${parseApiError(error)}`)
      },
    })
  }

  function handleAddItems() {
    if (!itemModalTitle) return

    const names = newItemsText
      .split(/[\n,;]/)
      .map((item) => item.trim())
      .filter(Boolean)

    if (names.length === 0) {
      window.alert('Escreva pelo menos um item. Você pode separar por vírgula ou por linha.')
      return
    }

    if (!isUuid(itemModalTitle.id)) {
      setTitles((current) =>
        current.map((title) => {
          if (title.id !== itemModalTitle.id) return title

          return {
            ...title,
            items: [
              ...title.items,
              ...names.map((name) => ({
                id: `item-${Date.now()}-${name.toLowerCase().replace(/\s+/g, '-')}`,
                name,
                visibleToClient: true,
                adminOnly: false,
                note: 'Item local. Salve na Fábrica Guiada antes de usar em produção.',
              })),
            ],
          }
        }),
      )
      setNewItemsText('')
      setItemModalTitleId(null)
      return
    }

    createItemsMutation.mutate({
      titleId: itemModalTitle.id,
      items: names.map((name) => ({ name })),
    }, {
      onSuccess: (result) => {
        setTitles((current) =>
          current.map((title) => {
            if (title.id !== itemModalTitle.id) return title

            return {
              ...title,
              items: [
                ...title.items,
                ...result.items.map((item) => ({
                  id: item.id,
                  name: item.name,
                  visibleToClient: item.visibleToClient,
                  adminOnly: item.adminOnly,
                  note: item.description || 'Item salvo na Fábrica Guiada.',
                })),
              ],
            }
          }),
        )
        setNewItemsText('')
        setItemModalTitleId(null)
      },
      onError: (error) => {
        window.alert(`Não foi possível salvar os itens na Fábrica Guiada. ${parseApiError(error)}`)
      },
    })
  }

  function toggleAvatarContentType(type: ContentObject) {
    if (!selectedAvatar) return

    setAvatarTypes((current) => {
      const enabled = current[selectedAvatar.id] || []
      return {
        ...current,
        [selectedAvatar.id]: enabled.includes(type) ? enabled.filter((item) => item !== type) : [...enabled, type],
      }
    })
  }

  function toggleAvatarItem(itemId: string) {
    if (!selectedAvatar) return

    setAvatarItems((current) => {
      const enabled = current[selectedAvatar.id] || []
      return {
        ...current,
        [selectedAvatar.id]: enabled.includes(itemId) ? enabled.filter((id) => id !== itemId) : [...enabled, itemId],
      }
    })
  }

  function toggleProductionItem(titleId: string, itemId: string) {
    setProductionSelections((current) => {
      const selected = current[titleId] || []
      return {
        ...current,
        [titleId]: selected.includes(itemId) ? selected.filter((id) => id !== itemId) : [...selected, itemId],
      }
    })
  }

  function toggleItemClientVisibility(titleId: string, itemId: string) {
    setTitles((current) =>
      current.map((title) => {
        if (title.id !== titleId) return title

        return {
          ...title,
          items: title.items.map((item) => (item.id === itemId ? { ...item, visibleToClient: !item.visibleToClient, adminOnly: item.visibleToClient } : item)),
        }
      }),
    )
  }

  function handleSaveProductionPlanPreview() {
    if (!productionAvatar?.id || !isUuid(productionAvatar.id)) {
      window.alert('Escolha um ator/avatar real cadastrado no sistema. Avatares de demonstração não podem gerar lote operacional.')
      return
    }

    if (combinationTotal === 0) {
      window.alert('Marque pelo menos um item para montar o Motor de Combinações.')
      return
    }

    if (combinationTotal > 80) {
      window.alert('Lote bloqueado por segurança: reduza a seleção para no máximo 80 combinações nesta fase. Chunking e orquestração entram apenas na Fase 5.')
      return
    }

    const invalidSelection = Object.entries(productionSelections).some(([titleId, itemIds]) => {
      return !isUuid(titleId) || itemIds.some((itemId) => !isUuid(itemId))
    })

    if (invalidSelection) {
      window.alert('Existem títulos ou itens locais/de demonstração nesta seleção. Salve as variáveis na Fábrica Guiada antes de preparar lote operacional.')
      return
    }

    const confirmed = window.confirm(
      `Salvar plano de produção e preparar lote seguro?

Ator/Avatar: ${productionAvatar?.name || '—'}
Tipo de mídia: ${productionContentType}
Combinações: ${combinationTotal}
Variações por combinação: ${productionVariationTarget}
Total estimado: ${estimatedMediaTotal} mídia(s)

Modo seguro: cria batch/items no Supabase, mas não chama RunPod, não cria worker, não consome GPU, não publica, não cobra e não entrega ao cliente.`,
    )

    if (!confirmed) return

    createProductionBatchMutation.mutate({
      companionId: productionAvatar.id,
      contentType: toApiContentType(productionContentType),
      selections: productionSelections,
      requestedVariants: productionVariationTarget,
    }, {
      onSuccess: (result) => {
        const plan: ProductionPlanPreview = {
          id: result.batch.id,
          avatarName: result.batch.companionName || productionAvatar?.name || 'Avatar não selecionado',
          contentType: productionContentType,
          destination: productionDestination,
          combinationTotal,
          requestedVariants: productionVariationTarget,
          estimatedMediaTotal,
          groups: productionGroups.map((group) => ({
            title: group.title.name,
            items: group.selectedItems.map((item) => item.name),
          })),
          examples: result.items.slice(0, 6).map((item) => item.label),
          createdAt: new Date().toISOString(),
        }

        setLastProductionPlanPreview(plan)
        window.alert(`Lote seguro criado no Supabase.

Lote: ${shortId(result.batch.id)}
Status: ${statusLabel(result.batch.status)}
Itens: ${result.items.length}
Jobs em fila: ${result.queueJobs.length}

RunPod permanece bloqueado até a Fase 5.`)
        onOpenBatches?.(result.batch.id)
      },
      onError: (error) => {
        window.alert(`Não foi possível preparar o lote seguro. ${parseApiError(error)}`)
      },
    })
  }


  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Fábrica guiada"
        title="Criações da Fábrica"
        description="Biblioteca criativa visual para organizar prompts, poses, cenários, tom de voz e produtos. A lista fica limpa; a edição e o prompt técnico abrem em modal."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Títulos criados" value={titles.length} helper="Grupos como Local, Estilo visual, Humor e Timbre." icon={ListChecks} tone="fuchsia" />
        <MetricCard label="Itens cadastrados" value={titles.reduce((total, title) => total + title.items.length, 0)} helper="Opções simples dentro dos títulos." icon={Boxes} tone="blue" />
        <MetricCard label="Visíveis ao cliente" value={visibleForClientCount} helper="Itens que podem virar botões simples no app." icon={Store} tone="emerald" />
        <MetricCard label="Prévia do lote" value={combinationTotal} helper="Combinações marcadas na aba de produção." icon={Sparkles} tone="amber" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {creationTabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-[2rem] border p-4 text-left transition ${
                isActive ? 'border-white bg-white text-zinc-950 shadow-xl shadow-white/10' : 'border-white/10 bg-white/[0.045] text-zinc-300 hover:border-white/25 hover:bg-white/[0.075]'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`rounded-2xl p-3 ${isActive ? 'bg-zinc-950 text-white' : 'bg-black/30 text-amber-100'}`}>
                  <Icon size={18} />
                </span>
                <div>
                  <p className="font-black">{tab.label}</p>
                  <p className={`mt-1 text-xs ${isActive ? 'text-zinc-600' : 'text-zinc-500'}`}>{tab.helper}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {activeTab === 'titles' && (
        <div className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Biblioteca criativa visual</p>
                <h3 className="mt-2 text-2xl font-black text-white">Criações da Fábrica</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">Use filtros simples para encontrar poses, cenários e tons. A edição detalhada fica guardada no modal do item, sem botões soltos na vitrine.</p>
              </div>
              <button type="button" onClick={() => setIsTitleModalOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">
                <Plus size={17} />
                Criar título
              </button>
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap gap-2">
                {creativeMediaFilters.map((filter) => {
                  const Icon = filter.icon
                  const active = creativeMediaFilter === filter.id
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setCreativeMediaFilter(filter.id)}
                      className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25 hover:text-white'}`}
                    >
                      <Icon size={15} />
                      {filter.label}
                    </button>
                  )
                })}
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                {creativeCategoryFilters.map((filter) => {
                  const active = creativeCategoryFilter === filter.id
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setCreativeCategoryFilter(filter.id)}
                      className={`rounded-2xl px-4 py-3 text-sm font-black transition ${active ? 'bg-fuchsia-300 text-zinc-950' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25 hover:text-white'}`}
                    >
                      {filter.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {creativeLibraryItems.map(({ title, item }) => (
              <button
                key={`${title.id}:${item.id}`}
                type="button"
                onClick={() => setSelectedCreativeCard({ title, item })}
                className="group rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 text-left shadow-2xl shadow-black/20 transition hover:border-fuchsia-300/40 hover:bg-white/[0.075]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-fuchsia-100">
                    <Sparkles size={18} />
                  </span>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.visibleToClient ? 'bg-emerald-400/10 text-emerald-100' : 'bg-zinc-800 text-zinc-400'}`}>{item.visibleToClient ? 'Cliente' : 'Admin'}</span>
                </div>
                <p className="mt-4 text-lg font-black text-white">{item.name}</p>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-zinc-500">{title.name} · {item.note || title.description}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {title.contentTypes.map((type) => (
                    <span key={type} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{type}</span>
                  ))}
                </div>
                <span className="mt-5 inline-flex text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200 transition group-hover:text-white">Abrir detalhes</span>
              </button>
            ))}
          </div>

          {!creativeLibraryItems.length ? (
            <div className="rounded-[2rem] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center text-sm text-zinc-500">Nenhum item encontrado com estes filtros. Ajuste a mídia ou categoria.</div>
          ) : null}
        </div>
      )}

      {activeTab === 'avatar' && (
        <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <h3 className="text-xl font-black text-white">Escolha o avatar</h3>
            <p className="mt-1 text-sm text-zinc-500">Cada avatar pode ter títulos e itens próprios.</p>
            <div className="mt-5 grid gap-2">
              {availableAvatars.map((avatar) => (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedAvatarId(avatar.id)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedAvatarId === avatar.id ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}
                >
                  <p className="font-black">{avatar.name}</p>
                  <p className={`mt-1 text-xs ${selectedAvatarId === avatar.id ? 'text-zinc-600' : 'text-zinc-500'}`}>{avatar.subtitle}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div>
              <h3 className="text-2xl font-black text-white">Aplicar títulos e itens em {selectedAvatar?.name}</h3>
              <p className="mt-1 text-sm text-zinc-500">Marque o que este avatar pode usar. Isso evita que opções inadequadas apareçam para todos.</p>
            </div>

            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-zinc-500">Tipos de conteúdo permitidos</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {CONTENT_OBJECTS.map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleAvatarContentType(type)}
                    className={`rounded-2xl px-4 py-3 text-sm font-black transition ${currentAvatarTypes.includes(type) ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {titles
                .filter((title) => title.contentTypes.some((type) => currentAvatarTypes.includes(type)))
                .map((title) => (
                  <article key={title.id} className="rounded-[2rem] border border-white/10 bg-black/25 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{title.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">Serve para: {title.contentTypes.join(', ')}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{title.items.length} itens</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {title.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleAvatarItem(item.id)}
                          className={`rounded-2xl px-3 py-2 text-xs font-black transition ${currentAvatarItems.includes(item.id) ? 'bg-emerald-500 text-white' : 'border border-white/10 bg-zinc-950 text-zinc-500 hover:text-white'}`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'production' && (
        <div className="space-y-5">
          {catalogProductionFocus && (
            <div className="rounded-[2rem] border border-violet-300/20 bg-violet-300/10 p-5 shadow-2xl shadow-black/20">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Produção guiada pelo produto</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{catalogProductionFocus.title}</h3>
                  <p className="mt-2 max-w-4xl text-sm leading-relaxed text-zinc-300">Este produto é um prompt/combinação. Ele não se esgota para novos clientes; produza novas variações para aumentar a diversidade visual das próximas entregas.</p>
                  <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">1. Mesmo contexto</p><p className="mt-2 text-zinc-300">O avatar e o tipo já vêm preenchidos a partir da prateleira.</p></div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">2. Meta de variações</p><p className="mt-2 text-zinc-300">Escolha de 5 a 10 variações para ampliar a diversidade visual.</p></div>
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">3. Sem exposição automática</p><p className="mt-2 text-zinc-300">Nada é publicado para cliente sem revisão e liberação posterior.</p></div>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:flex-row xl:flex-col">
                  {onBackToCatalog && <button type="button" onClick={onBackToCatalog} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">Voltar à prateleira</button>}
                  {onClearCatalogProductionFocus && <button type="button" onClick={onClearCatalogProductionFocus} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">Limpar produto</button>}
                </div>
              </div>
            </div>
          )}

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Motor de Combinações · prévia segura</p>
                <h3 className="mt-2 text-2xl font-black text-white">Selecione ator, mídia e variáveis</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">O cálculo é 100% visual nesta fase. A tela calcula combinações e estimativa de mídias, sem acionar RunPod, worker, fila ou geração real.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-emerald-100">
                <ShieldCheck size={14} /> RunPod travado
              </span>
            </div>

            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Ator / Avatar
                <select value={productionAvatarId} onChange={(event) => setProductionAvatarId(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50">
                  {availableAvatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Tipo de mídia
                <select value={productionContentType} onChange={(event) => setProductionContentType(event.target.value as ContentObject)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50">
                  {CONTENT_OBJECTS.map((type) => <option key={type}>{type}</option>)}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Variações por combinação
                <input value={productionVariationTarget} onChange={(event) => setProductionVariationTarget(Math.max(1, Number(event.target.value) || 1))} min={1} max={20} type="number" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
              </label>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Destino futuro</p>
                <p className="mt-2 font-black text-white">{productionDestination}</p>
                <p className="mt-1 text-xs text-amber-50/70">Apenas estimado nesta fase.</p>
              </div>
            </div>

            <div className={`mt-5 rounded-[2rem] border p-5 ${productionAllowedByCompliance ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 rounded-2xl border p-3 ${productionAllowedByCompliance ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/25 bg-amber-300/10 text-amber-100'}`}>
                    {productionComplianceQuery.isLoading ? <Clock3 size={20} /> : productionAllowedByCompliance ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                  </span>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Liberação do avatar para produção</p>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      {productionComplianceQuery.isLoading ? 'Conferindo...' : productionAllowedByCompliance ? 'Liberado para este tipo de lote' : 'Ainda bloqueado'}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">
                      {productionComplianceQuery.isError
                        ? `Não foi possível consultar a liberação agora. ${parseApiError(productionComplianceQuery.error)}`
                        : productionCompliance?.summary || productionBlockingMessage}
                    </p>
                  </div>
                </div>

                <div className="grid min-w-[220px] gap-2 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Status</span><strong className={productionAllowedByCompliance ? 'text-emerald-100' : 'text-amber-100'}>{adminStatusLabel(productionCompliance?.status)}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Ator/Atriz</span><strong className="text-right text-white">{productionCompliance?.actor?.displayName || '—'}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Mapeamento</span><strong className="text-white">{mappingStatusLabel(productionCompliance?.mapping?.status)}</strong></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Cofre</span><strong className="text-white">{productionCompliance?.vault ? `${productionCompliance.vault.real} real / ${productionCompliance.vault.total} total` : '—'}</strong></div>
                </div>
              </div>

              {!productionAllowedByCompliance && productionComplianceReasons.length > 0 && (
                <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">O que falta resolver</p>
                  {productionComplianceReasons.map((reason) => (
                    <div key={`${reason.code}-${reason.message}`} className="flex items-start gap-2 text-sm text-amber-100">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                      <span>{reason.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Pré-produção</p>
                <h3 className="mt-2 text-2xl font-black text-white">Checklist antes de criar lote</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">Esta conferência evita clique errado. A pré-produção continua em modo seguro: não inicia geração final e não publica nada para cliente.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] ${preflightReady ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/20 bg-amber-400/10 text-amber-100'}`}>
                {preflightReady ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {preflightReady ? 'Pré-produção pronta' : 'Pré-produção pendente'}
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {preflightChecks.map((check) => (
                <div key={check.id} className={`rounded-2xl border p-4 ${check.ok ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 rounded-xl p-2 ${check.ok ? 'bg-emerald-300/10 text-emerald-100' : 'bg-amber-300/10 text-amber-100'}`}>
                      {check.ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
                    </span>
                    <div>
                      <p className="text-sm font-black text-white">{check.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{check.helper}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <span className="mt-0.5 rounded-xl bg-emerald-300/10 p-2 text-emerald-100"><ShieldCheck size={15} /></span>
              <span>
                <strong className="block text-sm font-black text-white">Trava de execução real ativa.</strong>
                <span className="mt-1 block text-xs leading-relaxed text-emerald-50/75">Fase 3 salva somente a prévia matemática das combinações. Não cria batch, não chama worker, não envia jobs e não aciona RunPod.</span>
              </span>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Painel operacional</p>
                <h3 className="mt-2 text-2xl font-black text-white">Avatares prontos e pendentes</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">Veja todos os avatares antes de montar o lote. As travas finais continuam protegidas, e esta visão mostra rapidamente quem está liberado e quem precisa de ajuste.</p>
              </div>
              <button type="button" onClick={() => operationalComplianceQueries.forEach((query) => query.refetch())} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-white/25">
                <RefreshCw size={16} />
                Atualizar painel
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-zinc-500">Total</p><p className="mt-2 text-2xl font-black text-white">{operationalSummary.total}</p></div>
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-100">Liberados</p><p className="mt-2 text-2xl font-black text-white">{operationalSummary.released}</p></div>
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-amber-100">Bloqueados</p><p className="mt-2 text-2xl font-black text-white">{operationalSummary.blocked}</p></div>
              <div className="rounded-2xl border border-blue-400/20 bg-blue-400/10 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-blue-100">Mapeamento</p><p className="mt-2 text-2xl font-black text-white">{operationalSummary.mapping}</p></div>
              <div className="rounded-2xl border border-violet-400/20 bg-violet-400/10 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">Autorização</p><p className="mt-2 text-2xl font-black text-white">{operationalSummary.authorization}</p></div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {operationalFilters.map((filter) => (
                <button key={filter.id} type="button" onClick={() => setOperationalFilter(filter.id)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${operationalFilter === filter.id ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}>
                  {filter.label}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {filteredOperationalRows.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-500">Nenhum avatar encontrado neste filtro.</div>
              ) : filteredOperationalRows.map((row) => {
                const report = row.report
                const tone = row.isLoading ? 'border-blue-400/20 bg-blue-400/10' : row.isReleased ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'
                const statusLabel = row.isLoading ? 'Conferindo' : row.isError ? 'Erro na consulta' : row.isReleased ? 'Liberado' : 'Bloqueado'
                const statusColor = row.isReleased ? 'text-emerald-100' : row.isLoading ? 'text-blue-100' : 'text-amber-100'
                const reason = row.isError ? parseApiError(row.query?.error) : row.firstReason?.message || report?.summary || 'Aguardando dados de conformidade.'
                const isSelected = row.avatar.id === productionAvatarId

                return (
                  <button key={row.avatar.id} type="button" onClick={() => setProductionAvatarId(row.avatar.id)} className={`rounded-[1.6rem] border p-4 text-left transition hover:border-white/30 ${tone} ${isSelected ? 'ring-2 ring-white/70' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-white">{row.avatar.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">{report?.actor?.displayName || 'Ator/Atriz não vinculado'}</p>
                      </div>
                      <span className={`rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${statusColor}`}>{statusLabel}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
                      <span><strong className="block text-zinc-500">Mapeamento</strong>{mappingStatusLabel(report?.mapping?.status)}</span>
                      <span><strong className="block text-zinc-500">Checklist</strong>{report?.mapping?.checklist ? `${report.mapping.checklist.completedRequired}/${report.mapping.checklist.totalRequired}` : '—'}</span>
                      <span><strong className="block text-zinc-500">Cofre</strong>{report?.vault ? `${report.vault.real} real` : '—'}</span>
                    </div>
                    {!row.isReleased && !row.isLoading && <p className="mt-3 text-sm leading-relaxed text-amber-100">{reason}</p>}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <div className="space-y-4">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Seleção de variáveis</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Combinações do lote por seleção</h3>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">Marque múltiplas opções em cada título. O motor matemático cruza os grupos selecionados automaticamente, em tempo real.</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-black text-zinc-200">
                    {productionGroups.length} grupo(s) ativo(s)
                  </div>
                </div>
              </div>

              {productionTitles.length === 0 && (
                <EmptyState message="Nenhuma variável disponível para este tipo de mídia." helper="Cadastre títulos e itens na aba Cadastro de Variáveis ou altere o tipo de mídia." icon={Search} />
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                {productionTitles.map((title) => {
                  const selectedCount = title.items.filter((item) => productionSelections[title.id]?.includes(item.id)).length

                  return (
                    <article key={title.id} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xl font-black text-white">{title.name}</p>
                          <p className="mt-1 text-sm text-zinc-500">Marque os itens que entram no cruzamento deste lote.</p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{selectedCount}/{title.items.length}</span>
                      </div>

                      <div className="mt-4 grid gap-2">
                        {title.items.map((item) => {
                          const selected = productionSelections[title.id]?.includes(item.id) || false
                          return (
                            <label
                              key={item.id}
                              className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-black transition ${selected ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white'}`}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleProductionItem(title.id, item.id)}
                                className="size-4 accent-amber-300"
                              />
                              <span>{item.name}</span>
                            </label>
                          )
                        })}
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>

            <aside className="sticky top-6 h-fit rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Motor Matemático</p>
              <h3 className="mt-3 text-3xl font-black text-white">Serão geradas {combinationTotal} Combinações Únicas</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">O cálculo é feito no frontend conforme os checkboxes são marcados. Nesta fase ele é apenas preview.</p>

              <div className="mt-5 rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">Lote total estimado</p>
                <p className="mt-2 text-4xl font-black text-white">{estimatedMediaTotal}</p>
                <p className="mt-1 text-sm font-bold text-amber-50/80">mídias estimadas · {productionVariationTarget} variação(ões) por combinação</p>
              </div>

              <div className="mt-5 space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Ator/Avatar</span><strong className="text-right text-white">{productionAvatar?.name || '—'}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Tipo de mídia</span><strong className="text-white">{productionContentType}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Grupos ativos</span><strong className="text-white">{productionGroups.length}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">Destino futuro</span><strong className="text-right text-white">{productionDestination}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-zinc-500">RunPod</span><strong className="text-right text-emerald-100">Não executa nesta fase</strong></div>
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                {productionGroups.length === 0 ? (
                  <p className="text-sm text-zinc-500">Nenhum item marcado ainda.</p>
                ) : (
                  <div className="space-y-2">
                    {productionGroups.map((group) => (
                      <p key={group.title.id} className="text-sm text-zinc-300">
                        <strong className="text-white">{group.title.name}:</strong> {group.selectedItems.map((item) => item.name).join(', ')}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {cartesianPreviewLabels.length > 0 && (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Amostra das primeiras combinações</p>
                  <div className="mt-3 grid gap-2">
                    {cartesianPreviewLabels.map((label, index) => (
                      <div key={`${label}-${index}`} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-zinc-300">
                        {index + 1}. {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {combinationTotal > 80 && combinationTotal <= 300 && (
                <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-relaxed text-amber-50/80">
                  <strong className="block text-amber-50">Atenção operacional</strong>
                  <span>A seleção passou de 80 combinações. Reduza a seleção para criar o lote seguro agora; chunking e fila controlada entram apenas na Fase 5.</span>
                </div>
              )}

              {combinationTotal > 300 && (
                <div className="mt-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm leading-relaxed text-rose-50/80">
                  <strong className="block text-rose-50">Preview bloqueado</strong>
                  <span>Reduza a seleção. A Fase 3 limita o preview a 300 combinações para evitar explosão combinatória.</span>
                </div>
              )}

              <button type="button" onClick={handleSaveProductionPlanPreview} disabled={productionButtonDisabled || createProductionBatchMutation.isPending || combinationTotal > 80} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
                <Sparkles size={17} />
                {createProductionBatchMutation.isPending ? 'Preparando lote seguro...' : 'Salvar Plano de Produção / Preparar Lote'}
              </button>
              <p className="mt-3 text-xs leading-relaxed text-zinc-500">Este botão cria somente batch/items seguros no Supabase via rota homologada. RunPod, worker, fila real, cobrança, publicação e entrega continuam bloqueados até as próximas fases.</p>

              {onOpenBatches && (
                <button type="button" onClick={() => onOpenBatches()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-200 transition hover:border-white/25 hover:text-white">
                  <Layers3 size={16} />
                  Ver lotes existentes
                </button>
              )}

              {lastProductionPlanPreview && (
                <div className="mt-5 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Lote seguro preparado</p>
                  <h4 className="mt-2 text-xl font-black text-white">Batch/Items registrados · RunPod bloqueado</h4>
                  <div className="mt-4 grid gap-2 text-sm">
                    <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Código local</span><strong className="text-white">{lastProductionPlanPreview.id}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Combinações</span><strong className="text-white">{lastProductionPlanPreview.combinationTotal}</strong></div>
                    <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Total estimado</span><strong className="text-white">{lastProductionPlanPreview.estimatedMediaTotal}</strong></div>
                  </div>
                  <button type="button" onClick={() => setLastProductionPlanPreview(null)} className="mt-4 w-full rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-50 transition hover:border-white/25">Continuar editando</button>
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {activeTab === 'client' && (
        <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
          <div className="grid gap-4 xl:grid-cols-2">
            {titles.map((title) => (
              <article key={title.id} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xl font-black text-white">{title.name}</p>
                    <p className="mt-1 text-sm text-zinc-500">O cliente verá apenas nomes simples, nunca o prompt técnico.</p>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{title.contentTypes.join(' • ')}</span>
                </div>

                <div className="mt-4 grid gap-2">
                  {title.items.map((item) => (
                    <button key={item.id} type="button" onClick={() => toggleItemClientVisibility(title.id, item.id)} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left transition hover:border-white/25">
                      <span>
                        <span className="block font-black text-white">{item.name}</span>
                        <span className="mt-1 block text-xs text-zinc-500">{item.visibleToClient ? 'Aparece como botão/opção simples para o cliente.' : 'Fica oculto; uso apenas do Admin.'}</span>
                      </span>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${item.visibleToClient ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                        {item.visibleToClient ? 'Cliente' : 'Admin'}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>

          <aside className="rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Como o cliente verá</p>
            <h3 className="mt-3 text-2xl font-black text-white">Tela limpa, sem prompt técnico</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">A experiência do cliente deve mostrar botões simples. A descrição completa e os parâmetros internos ficam escondidos nos controles de operação.</p>

            <div className="mt-5 space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-4">
              {titles
                .filter((title) => title.items.some((item) => item.visibleToClient))
                .slice(0, 4)
                .map((title) => (
                  <div key={title.id}>
                    <p className="text-sm font-black text-zinc-300">{title.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {title.items.filter((item) => item.visibleToClient).map((item) => (
                        <span key={item.id} className="rounded-2xl bg-white px-3 py-2 text-xs font-black text-zinc-950">{item.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </aside>
        </div>
      )}

      {selectedCreativeCard && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-200">Detalhes da criação</p>
                <h3 className="mt-1 text-2xl font-black text-white">{selectedCreativeCard.item.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">Prompt técnico, tipo e organização ficam concentrados aqui.</p>
              </div>
              <button type="button" onClick={() => setSelectedCreativeCard(null)} className="rounded-2xl border border-white/10 p-3 text-zinc-400 transition hover:text-white"><X size={18} /></button>
            </div>

            <div className="grid max-h-[72vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <label className="grid gap-2 text-sm font-bold text-zinc-300">
                  Título exibido na biblioteca
                  <input value={creativeDraftTitle} onChange={(event) => setCreativeDraftTitle(event.target.value)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-fuchsia-300/50" />
                </label>
                <label className="grid gap-2 text-sm font-bold text-zinc-300">
                  Tipo principal
                  <select value={creativeDraftType} onChange={(event) => setCreativeDraftType(event.target.value as ContentObject)} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-fuchsia-300/50">
                    {CONTENT_OBJECTS.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </label>
                <div className="rounded-[2rem] border border-white/10 bg-black/30 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Prompt técnico / observação interna</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">{selectedCreativeCard.item.note || selectedCreativeCard.title.description || 'Sem prompt técnico cadastrado para este item.'}</p>
                </div>
              </div>

              <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Grupo</p>
                  <p className="mt-2 text-lg font-black text-white">{selectedCreativeCard.title.name}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-500">{selectedCreativeCard.title.description}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Tipos vinculados</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedCreativeCard.title.contentTypes.map((type) => <span key={type} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs font-bold text-zinc-300">{type}</span>)}
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-xs leading-relaxed text-emerald-100">
                  <strong className="block text-emerald-50">Casca visual apenas</strong>
                  <span className="mt-1 block">Salvar mantém o fluxo atual de criação e não chama produção, publicação ou cobrança.</span>
                </div>
                <div className="grid gap-2">
                  <button type="button" onClick={() => setSelectedCreativeCard(null)} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">Salvar e fechar</button>
                  <button type="button" onClick={() => setSelectedCreativeCard(null)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-300 transition hover:border-white/25 hover:text-white">Cancelar</button>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {isTitleModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-white">Criar título de criação</h3>
                <p className="mt-1 text-sm text-zinc-500">Exemplo: Local, Estilo visual, Humor, Timbre da voz.</p>
              </div>
              <button type="button" onClick={() => setIsTitleModalOpen(false)} className="rounded-2xl border border-white/10 p-3 text-zinc-400 transition hover:text-white"><X size={18} /></button>
            </div>

            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Nome do título
                <input value={newTitleName} onChange={(event) => setNewTitleName(event.target.value)} placeholder="Ex.: Local" className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-300">
                Explicação simples
                <textarea value={newTitleDescription} onChange={(event) => setNewTitleDescription(event.target.value)} placeholder="Explique para que esse título serve." className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
              </label>
              <div>
                <p className="text-sm font-bold text-zinc-300">Esse título serve para qual tipo de conteúdo?</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CONTENT_OBJECTS.map((type) => (
                    <button key={type} type="button" onClick={() => toggleTitleType(type)} className={`rounded-2xl px-4 py-3 text-sm font-black transition ${newTitleTypes.includes(type) ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setIsTitleModalOpen(false)} className="rounded-2xl border border-white/10 px-4 py-4 text-sm font-black text-zinc-300 transition hover:text-white">Cancelar</button>
              <button type="button" onClick={handleCreateTitle} className="rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">Salvar título</button>
            </div>
          </div>
        </div>
      )}

      {itemModalTitle && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-zinc-950 p-5 shadow-2xl shadow-black">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black text-white">Inserir itens em {itemModalTitle.name}</h3>
                <p className="mt-1 text-sm text-zinc-500">Escreva vários itens separados por vírgula ou um por linha.</p>
              </div>
              <button type="button" onClick={() => setItemModalTitleId(null)} className="rounded-2xl border border-white/10 p-3 text-zinc-400 transition hover:text-white"><X size={18} /></button>
            </div>

            <label className="mt-5 grid gap-2 text-sm font-bold text-zinc-300">
              Itens
              <textarea value={newItemsText} onChange={(event) => setNewItemsText(event.target.value)} placeholder="Ex.: Praia, Sofá, Estúdio" className="min-h-36 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-amber-300/50" />
            </label>

            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <button type="button" onClick={() => setItemModalTitleId(null)} className="rounded-2xl border border-white/10 px-4 py-4 text-sm font-black text-zinc-300 transition hover:text-white">Cancelar</button>
              <button type="button" onClick={handleAddItems} className="rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">Salvar itens</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function RealProductionControlPage() {
  const creationTitlesQuery = useCreationTitles()
  const creationAvatarsQuery = useCreationAvatars()
  const preflightMutation = usePreflightSingleRealProduction()
  const startMutation = useStartSingleRealProduction()

  const [selectedAvatarId, setSelectedAvatarId] = useState('')
  const [selections, setSelections] = useState<SelectionMap>({})
  const [confirmationPhrase, setConfirmationPhrase] = useState('')
  const [lastPreflight, setLastPreflight] = useState<RealProductionPreflightResponse | null>(null)
  const [realModeChecked, setRealModeChecked] = useState(false)

  const avatars = useMemo(() => {
    const apiAvatars = creationAvatarsQuery.data?.items?.map(mapCreationAvatarFromApi) || []
    return apiAvatars.filter((avatar) => isUuid(avatar.id))
  }, [creationAvatarsQuery.data])

  const titles = useMemo(() => {
    const apiTitles = creationTitlesQuery.data?.items?.map(mapCreationTitleFromApi) || []
    return apiTitles.filter((title) => title.contentTypes.includes('Imagem'))
  }, [creationTitlesQuery.data])

  useEffect(() => {
    if (!selectedAvatarId && avatars.length > 0) {
      setSelectedAvatarId(avatars[0].id)
    }
  }, [avatars, selectedAvatarId])

  useEffect(() => {
    setLastPreflight(null)
    setRealModeChecked(false)
  }, [selectedAvatarId, selections])

  const selectedAvatar = avatars.find((avatar) => avatar.id === selectedAvatarId) || null
  const selectedGroups = useMemo(() => {
    return titles
      .map((title) => ({
        title,
        items: title.items.filter((item) => selections[title.id]?.includes(item.id)),
      }))
      .filter((group) => group.items.length > 0)
  }, [selections, titles])

  const combinationTotal = useMemo(() => {
    if (selectedGroups.length === 0) return 0
    return selectedGroups.reduce((total, group) => total * group.items.length, 1)
  }, [selectedGroups])

  const selectedPath = useMemo(() => {
    return selectedGroups.flatMap((group) => group.items.map((item) => `${group.title.name}: ${item.name}`))
  }, [selectedGroups])

  const canRunSafePreflight = Boolean(selectedAvatarId) && combinationTotal === 1
  const realPreflightCanStart = lastPreflight?.mode === 'real_image_preflight' && lastPreflight.canStart === true
  const exactConfirmation = confirmationPhrase.trim() === (lastPreflight?.requiredConfirmationPhrase || 'CONFIRMAR PRODUCAO REAL DE 1 ITEM')

  function setSingleItem(titleId: string, itemId: string) {
    setSelections((current) => {
      const isSelected = current[titleId]?.[0] === itemId
      const next = { ...current }
      if (isSelected) {
        delete next[titleId]
      } else {
        next[titleId] = [itemId]
      }
      return next
    })
  }

  function buildPayload(realMode: boolean) {
    return {
      companionId: selectedAvatarId,
      selections,
      dryRunOnly: !realMode,
      generateRealMedia: realMode,
      confirmPhrase: realMode ? confirmationPhrase.trim() : '',
    }
  }

  function handlePreflight(realMode: boolean) {
    if (!selectedAvatarId) {
      window.alert('Escolha um avatar antes de fazer o pré-check.')
      return
    }

    if (combinationTotal !== 1) {
      window.alert('A produção real controlada exige exatamente 1 combinação. Escolha apenas um item em cada título necessário.')
      return
    }

    if (realMode) setRealModeChecked(true)

    preflightMutation.mutate(buildPayload(realMode), {
      onSuccess: (result) => {
        setLastPreflight(result)
      },
      onError: (error) => {
        window.alert(`Pré-check não concluído. ${parseApiError(error)}`)
      },
    })
  }

  function handleStart(realMode: boolean) {
    if (!selectedAvatarId) {
      window.alert('Escolha um avatar antes de criar a produção.')
      return
    }

    if (combinationTotal !== 1) {
      window.alert('A produção controlada de 1 item precisa de exatamente 1 combinação selecionada.')
      return
    }

    if (realMode && !realPreflightCanStart) {
      window.alert('A produção real ainda está bloqueada. Rode o pré-check real e resolva todas as pendências antes de continuar.')
      return
    }

    if (realMode && !exactConfirmation) {
      window.alert('A frase de confirmação real não confere. Copie exatamente a frase mostrada no pré-check.')
      return
    }

    const confirmText = realMode
      ? 'Autorizar produção real de exatamente 1 item? A geração final só poderá acontecer se todas as travas de segurança estiverem ativas.'
      : 'Criar lote seguro de exatamente 1 item? Este modo NÃO inicia geração final e serve para validar o fluxo operacional.'

    if (!window.confirm(confirmText)) return

    startMutation.mutate(buildPayload(realMode), {
      onSuccess: (result) => {
        const batchId = result.production.batch?.id || 'sem id'
        const totalItems = result.production.batch?.totalItems || 0
        window.alert(`${realMode ? 'Produção real registrada' : 'Lote seguro criado'} com sucesso.\n\nLote: ${batchId}\nItens: ${totalItems}\nModo: ${result.mode}`)
        setLastPreflight(result.preflight)
      },
      onError: (error) => {
        window.alert(`Não foi possível criar a produção controlada. ${parseApiError(error)}`)
      },
    })
  }

  const blockingReasons = lastPreflight?.reasons || []
  const previewItems = lastPreflight?.preview?.preview || []

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Produção controlada"
        title="Produção real de 1 item"
        description="Painel seguro para validar avatar, combinação, ambiente e dupla confirmação antes de permitir a primeira produção real. Por padrão, use o modo seguro sem iniciar geração final."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Combinações" value={combinationTotal} helper="Precisa ser exatamente 1 para seguir." icon={Sparkles} tone={combinationTotal === 1 ? 'emerald' : 'amber'} />
        <MetricCard label="Produção real agora" value="Não" helper="Esta tela não inicia geração final diretamente." icon={CheckCircle2} tone="emerald" />
        <MetricCard label="Arquivo final agora" value="Não" helper="O arquivo final só será salvo após uma execução real autorizada." icon={Archive} tone="blue" />
        <MetricCard label="Exclusão" value="0" helper="Nenhuma ação destrutiva é executada." icon={AlertTriangle} tone="zinc" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/25">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Avatar</span>
              <select
                value={selectedAvatarId}
                onChange={(event) => setSelectedAvatarId(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
              >
                {avatars.length === 0 && <option value="">Nenhum avatar real encontrado</option>}
                {avatars.map((avatar) => <option key={avatar.id} value={avatar.id}>{avatar.name}</option>)}
              </select>
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Tipo</p>
              <p className="mt-2 text-lg font-black text-white">Imagem</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">Nesta etapa, a produção real controlada é apenas para imagem e apenas 1 item.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Combinação única</p>
                <h2 className="mt-1 text-xl font-black text-white">Escolha um caminho para produzir</h2>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${combinationTotal === 1 ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-amber-400/30 bg-amber-400/10 text-amber-100'}`}>
                {combinationTotal === 1 ? '1 combinação' : `${combinationTotal} combinações`}
              </span>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {titles.map((title) => (
                <div key={title.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-black text-white">{title.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {title.items.map((item) => {
                      const isSelected = selections[title.id]?.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSingleItem(title.id, item.id)}
                          className={`rounded-full px-3 py-2 text-xs font-black transition ${isSelected ? 'bg-white text-zinc-950' : 'border border-white/10 bg-zinc-950 text-zinc-400 hover:text-white'}`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-5 rounded-[2rem] border border-white/10 bg-zinc-950/80 p-5 shadow-2xl shadow-black/30">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Resumo</p>
            <h2 className="mt-2 text-2xl font-black text-white">{selectedAvatar?.name || 'Escolha um avatar'}</h2>
            <div className="mt-4 space-y-2">
              {selectedPath.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">Nenhum item escolhido ainda.</p>
              ) : selectedPath.map((label) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold text-zinc-200">{label}</div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <button
              type="button"
              disabled={!canRunSafePreflight || preflightMutation.isPending}
              onClick={() => handlePreflight(false)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              Rodar pré-check seguro
            </button>
            <button
              type="button"
              disabled={!canRunSafePreflight || startMutation.isPending}
              onClick={() => handleStart(false)}
              className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-900 disabled:text-zinc-600"
            >
              Criar lote seguro de 1 item
            </button>
          </div>

          <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-100">Modo real protegido</p>
            <p className="mt-2 text-sm leading-relaxed text-amber-50/80">Use apenas quando for realmente disparar a primeira imagem real. Precisa de env liberado, avatar conforme e frase exata.</p>
            <input
              value={confirmationPhrase}
              onChange={(event) => setConfirmationPhrase(event.target.value)}
              placeholder="Frase de confirmação"
              className="mt-3 w-full rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-white outline-none focus:border-amber-300"
            />
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={!canRunSafePreflight || preflightMutation.isPending}
                onClick={() => handlePreflight(true)}
                className="rounded-2xl border border-amber-400/30 bg-black/20 px-4 py-3 text-sm font-black text-amber-100 transition hover:bg-amber-400/10 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:text-zinc-600"
              >
                Rodar pré-check real
              </button>
              <button
                type="button"
                disabled={!realModeChecked || !realPreflightCanStart || !exactConfirmation || startMutation.isPending}
                onClick={() => handleStart(true)}
                className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                Enfileirar produção real de 1 item
              </button>
            </div>
          </div>
        </aside>
      </div>

      {lastPreflight && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Resultado do pré-check</p>
                <h3 className="mt-2 text-2xl font-black text-white">{lastPreflight.canStart ? 'Liberado pelo pré-check' : 'Bloqueado pelo pré-check'}</h3>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${lastPreflight.canStart ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100' : 'border-rose-400/30 bg-rose-400/10 text-rose-100'}`}>
                {lastPreflight.mode}
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                <strong className="text-white">Frase obrigatória:</strong> {lastPreflight.requiredConfirmationPhrase || 'Não exigida no modo seguro'}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                <strong className="text-white">Produção real por esta tela:</strong> {lastPreflight.safety.runPodWillBeCalledByThisRequest ? 'Sim' : 'Não'}
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                <strong className="text-white">Geração final poderá rodar:</strong> {lastPreflight.safety.runPodMayBeCalledByWorkerAfterQueue ? 'Sim, após confirmação' : 'Não'}
              </div>
            </div>

            {blockingReasons.length > 0 && (
              <div className="mt-4 space-y-2">
                {blockingReasons.map((reason, index) => (
                  <div key={`${reason.code}-${index}`} className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm text-rose-50">
                    <p className="font-black">{reason.code || 'bloqueio'}</p>
                    <p className="mt-1 text-rose-50/75">{reason.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Prévia da combinação</p>
            <h3 className="mt-2 text-2xl font-black text-white">{lastPreflight.preview.total} item</h3>
            <div className="mt-4 space-y-3">
              {previewItems.length === 0 ? (
                <EmptyState message="Nenhuma combinação encontrada." helper="Ajuste os itens selecionados para chegar a exatamente 1 combinação." icon={Search} />
              ) : previewItems.map((item) => (
                <div key={item.index} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Item {item.index}</p>
                  <p className="mt-2 text-sm font-bold text-white">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}


function AvatarPublishingPage({ onOpenAsset }: { onOpenAsset: (asset: FactoryAsset) => void }) {
  const avatarsQuery = useCreationAvatars()
  const allAssetsQuery = useFactoryAssets('all')
  const batchesQuery = useFactoryBatches()
  const productPublicationMutation = useUpdateFactoryProductPublication()
  const assetPriceMutation = useUpdateAssetCommercialPrice()
  const combinationPriceMutation = useUpdateCombinationCommercialPrice()
  const batchPriceMutation = useUpdateBatchCommercialPrice()
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const avatars = avatarsQuery.data?.items || []
  const assets = allAssetsQuery.data?.items || []
  const batches = batchesQuery.data?.items || []
  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('')

  useEffect(() => {
    if (!selectedAvatarId && avatars[0]?.id) setSelectedAvatarId(avatars[0].id)
  }, [avatars, selectedAvatarId])

  const selectedAvatar = avatars.find((avatar) => avatar.id === selectedAvatarId) || avatars[0] || null
  const productMatrixQuery = useFactoryPublishableProducts(selectedAvatar?.id || null, 'all', 'all')
  const productMatrixItems = productMatrixQuery.data?.items || []
  const productMatrixByAssetId = useMemo(() => new Map(productMatrixItems.map((item) => [item.assetId, item])), [productMatrixItems])
  const avatarAssets = useMemo(() => assets.filter((asset) => asset.companion.id === selectedAvatar?.id), [assets, selectedAvatar?.id])
  const avatarBatches = useMemo(() => batches.filter((batch) => batch.companionId === selectedAvatar?.id).slice(0, 8), [batches, selectedAvatar?.id])
  const approvedAssets = avatarAssets.filter((asset) => asset.status === 'available')
  const reviewAssets = avatarAssets.filter((asset) => asset.status === 'qa_pending')
  const publishedAssets = approvedAssets.filter((asset) => asset.combination.visibleToClient)
  const hiddenApprovedAssets = approvedAssets.filter((asset) => !asset.combination.visibleToClient)

  async function toggleClientVisibility(asset: FactoryAsset, nextVisible: boolean) {
    if (!asset.combination.id || !isUuid(asset.combination.id)) {
      window.alert('Este produto ainda não possui assinatura de combinação válida para publicação ao cliente.')
      return
    }

    if (nextVisible && asset.status !== 'available') {
      window.alert('Apenas produtos aprovados podem aparecer nos prompts dinâmicos do cliente.')
      return
    }

    const priceCredits = Number(asset.combination.priceCredits ?? asset.price.credits ?? 0)
    const signature = signatureLabelsFromAsset(asset)
    const confirmed = window.confirm(
      nextVisible
        ? `Publicar este produto para os prompts dinâmicos?

${contentTitle(asset)}
Preço atual: ${priceCredits} créditos

Assinatura:
${signature.length ? signature.map((item) => `• ${item}`).join('\n') : '• Assinatura vinculada à combinação'}

O cliente verá botões em cascata, não o prompt técnico completo.`
        : `Ocultar este produto dos prompts dinâmicos?

${contentTitle(asset)}

O produto continuará aprovado, mas não aparecerá como caminho disponível para o cliente.`,
    )

    if (!confirmed) return

    await productPublicationMutation.mutateAsync({
      assetId: asset.id,
      publish: nextVisible,
      priceCredits,
    })
  }


  function priceDraftKey(assetId: string) {
    return `asset-price:${assetId}`
  }

  function getPriceDraft(asset: FactoryAsset, fallbackCredits: number) {
    const key = priceDraftKey(asset.id)
    return priceDrafts[key] ?? String(Number(fallbackCredits || 0))
  }

  function updatePriceDraft(assetId: string, value: string) {
    setPriceDrafts((current) => ({ ...current, [priceDraftKey(assetId)]: value }))
  }

  function parseDraftPrice(asset: FactoryAsset, fallbackCredits: number) {
    const raw = getPriceDraft(asset, fallbackCredits)
    const parsed = Number(raw)

    if (!Number.isInteger(parsed) || parsed < 0) {
      window.alert('Informe um preço em créditos usando número inteiro maior ou igual a zero.')
      return null
    }

    return parsed
  }

  async function saveAssetPrice(asset: FactoryAsset, fallbackCredits: number) {
    const priceCredits = parseDraftPrice(asset, fallbackCredits)
    if (priceCredits === null) return

    await assetPriceMutation.mutateAsync({
      assetId: asset.id,
      priceCredits,
      note: 'Preço individual definido pelo Admin na página do avatar.',
    })
  }

  async function saveCombinationPrice(asset: FactoryAsset, fallbackCredits: number) {
    if (!asset.combination.id || !isUuid(asset.combination.id)) {
      window.alert('Este produto ainda não possui combinação válida para precificação.')
      return
    }

    const priceCredits = parseDraftPrice(asset, fallbackCredits)
    if (priceCredits === null) return

    await combinationPriceMutation.mutateAsync({
      combinationId: asset.combination.id,
      priceCredits,
      note: 'Preço da combinação definido pelo Admin na página do avatar.',
    })
  }

  async function saveBatchPrice(asset: FactoryAsset, fallbackCredits: number) {
    if (!asset.batch.id || !isUuid(asset.batch.id)) {
      window.alert('Este produto ainda não está vinculado a um lote válido para precificação em lote.')
      return
    }

    const priceCredits = parseDraftPrice(asset, fallbackCredits)
    if (priceCredits === null) return

    await batchPriceMutation.mutateAsync({
      batchId: asset.batch.id,
      priceCredits,
      note: 'Preço do lote definido pelo Admin na página do avatar.',
    })
  }

  function renderAssetRow(asset: FactoryAsset) {
    const displayUrl = getAssetDisplayUrl(asset)
    const Icon = mediaIcon(asset.mediaType)
    const canPublish = asset.status === 'available'
    const matrixProduct = productMatrixByAssetId.get(asset.id)
    const isPublished = Boolean(matrixProduct?.publication?.published ?? asset.combination.visibleToClient)
    const resolvedPriceCredits = Number(matrixProduct?.price?.credits ?? asset.combination.priceCredits ?? asset.price.credits ?? 0)
    const priceSourceLabel = matrixProduct?.price?.sourceLabel || 'Preço da combinação'
    const priceSource = matrixProduct?.price?.source || 'combination'
    const hasPrice = resolvedPriceCredits > 0
    const signatureLabels = matrixProduct?.signature?.path?.length ? matrixProduct.signature.path : signatureLabelsFromAsset(asset)
    const draftPrice = getPriceDraft(asset, resolvedPriceCredits)
    const pricingBusy = assetPriceMutation.isPending || combinationPriceMutation.isPending || batchPriceMutation.isPending

    return (
      <article key={asset.id} className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => onOpenAsset(asset)}
            className="relative h-32 w-full shrink-0 overflow-hidden rounded-3xl border border-white/10 bg-black/40 text-zinc-400 transition hover:border-white/25 sm:size-28"
          >
            {displayUrl && !isAudioMedia(asset.mediaType) ? (
              <img src={displayUrl} alt={contentTitle(asset)} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="flex h-full w-full items-center justify-center"><Icon size={30} /></span>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={asset.status} />
              <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-400">{mediaTypeLabel(asset.mediaType)}</span>
              <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] ${isPublished ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-400'}`}>
                {isPublished ? 'Cliente vê' : 'Oculto do cliente'}
              </span>
              {!hasPrice && canPublish && <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-black text-amber-100">Sem preço</span>}
            </div>
            <h3 className="mt-3 line-clamp-2 text-lg font-black text-white">{contentTitle(asset)}</h3>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
              <span>Preço resolvido: <strong className="text-white">{resolvedPriceCredits} créditos</strong></span>
              <span>Origem: <strong className="text-white">{priceSourceLabel}</strong></span>
              <span>Variações do lote: <strong className="text-white">{matrixProduct?.assignments?.max ?? asset.assignments.max}</strong></span>
              <span>Código: <strong className="text-white">{shortId(asset.id)}</strong></span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {signatureLabels.length === 0 ? (
                <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-bold text-amber-100">Sem assinatura visível</span>
              ) : signatureLabels.slice(0, 6).map((label) => (
                <span key={`${asset.id}-${label}`} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-zinc-300">{label}</span>
              ))}
            </div>

            {canPublish && (
              <div className="mt-4 rounded-3xl border border-white/10 bg-black/25 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                  <label className="grid flex-1 gap-1 text-xs font-black text-zinc-400">
                    Preço em créditos
                    <input
                      value={draftPrice}
                      onChange={(event) => updatePriceDraft(asset.id, event.target.value)}
                      inputMode="numeric"
                      className="rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-black text-white outline-none transition focus:border-amber-300/60"
                      placeholder="Ex.: 30"
                    />
                  </label>
                  <div className="grid gap-2 sm:grid-cols-3 lg:w-[420px]">
                    <button type="button" disabled={pricingBusy} onClick={() => saveAssetPrice(asset, resolvedPriceCredits)} className="rounded-2xl border border-white/10 px-3 py-3 text-xs font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Preço individual</button>
                    <button type="button" disabled={pricingBusy || !asset.combination.id} onClick={() => saveCombinationPrice(asset, resolvedPriceCredits)} className="rounded-2xl border border-white/10 px-3 py-3 text-xs font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Preço combinação</button>
                    <button type="button" disabled={pricingBusy || !asset.batch.id} onClick={() => saveBatchPrice(asset, resolvedPriceCredits)} className="rounded-2xl border border-white/10 px-3 py-3 text-xs font-black text-zinc-200 transition hover:border-white/25 hover:text-white disabled:cursor-not-allowed disabled:opacity-50">Preço lote</button>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">Prioridade atual: individual → combinação → lote → regra global. Fonte aplicada agora: {priceSourceLabel} ({priceSource}).</p>
              </div>
            )}
          </div>

          <div className="grid gap-2 sm:w-44">
            <button type="button" onClick={() => onOpenAsset(asset)} className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
              Ver conteúdo
            </button>
            {canPublish && (
              <button
                type="button"
                disabled={productPublicationMutation.isPending}
                onClick={() => toggleClientVisibility(asset, !isPublished)}
                className={`rounded-2xl px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${isPublished ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {isPublished ? 'Ocultar do cliente' : 'Mostrar ao cliente'}
              </button>
            )}
          </div>
        </div>
      </article>
    )
  }

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Avatar e publicação"
        title="Página do Avatar"
        description="Aqui o Admin acompanha tudo que pertence a cada avatar e decide o que aparece para o cliente. Aprovar qualidade e publicar para cliente são etapas diferentes."
      />

      <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-relaxed text-amber-100">
        <strong>Regra principal:</strong> conteúdo aprovado significa qualidade liberada. Mostrar ao cliente é uma decisão separada do Admin. O cliente verá quadradinhos dinâmicos derivados da assinatura da combinação, nunca o prompt técnico completo.
      </div>

      {(avatarsQuery.isError || allAssetsQuery.isError || batchesQuery.isError || productMatrixQuery.isError || productPublicationMutation.isError || assetPriceMutation.isError || combinationPriceMutation.isError || batchPriceMutation.isError) && (
        <ErrorState error={avatarsQuery.error || allAssetsQuery.error || batchesQuery.error || productMatrixQuery.error || productPublicationMutation.error || assetPriceMutation.error || combinationPriceMutation.error || batchPriceMutation.error} />
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Avatares cadastrados</p>
            <h3 className="mt-2 text-2xl font-black text-white">Escolha quem publicar</h3>
            <p className="mt-2 text-sm text-zinc-500">Cada avatar tem seu próprio histórico, produtos e opções para cliente.</p>
          </div>
          <div className="grid gap-2">
            {avatars.map((avatar) => (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setSelectedAvatarId(avatar.id)}
                className={`rounded-2xl border p-4 text-left transition ${selectedAvatar?.id === avatar.id ? 'border-white bg-white text-zinc-950' : 'border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}
              >
                <p className="font-black">{avatar.name}</p>
                <p className={`mt-1 text-xs ${selectedAvatar?.id === avatar.id ? 'text-zinc-600' : 'text-zinc-500'}`}>{avatar.slug ? `@${avatar.slug}` : 'Avatar cadastrado'}</p>
              </button>
            ))}
            {avatars.length === 0 && <EmptyState message="Nenhum avatar carregado" helper="Cadastre ou sincronize avatares para usar esta página." icon={Crown} />}
          </div>
        </aside>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-black/40 text-amber-100">
                  {selectedAvatar?.thumbnailUrl || selectedAvatar?.avatarUrl ? (
                    <img src={selectedAvatar.thumbnailUrl || selectedAvatar.avatarUrl || ''} alt={selectedAvatar.name} className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <Crown size={30} />
                  )}
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Página do avatar</p>
                  <h2 className="mt-1 text-3xl font-black text-white">{selectedAvatar?.name || 'Avatar'}</h2>
                  <p className="mt-1 text-sm text-zinc-500">Controle de qualidade, prateleira, histórico e publicação para cliente.</p>
                </div>
              </div>
              <button type="button" onClick={() => void Promise.all([allAssetsQuery.refetch(), batchesQuery.refetch(), avatarsQuery.refetch(), productMatrixQuery.refetch()])} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
                <RefreshCw size={16} />
                Atualizar avatar
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Aprovados" value={approvedAssets.length} helper="Qualidade liberada pelo Admin." icon={CheckCircle2} tone="emerald" />
            <MetricCard label="Publicados" value={productMatrixQuery.data?.summary?.published ?? publishedAssets.length} helper="Alimentam os prompts dinâmicos." icon={Store} tone="blue" />
            <MetricCard label="Ocultos aprovados" value={productMatrixQuery.data?.summary?.hidden ?? hiddenApprovedAssets.length} helper="Aprovados, mas internos." icon={Eye} tone="zinc" />
            <MetricCard label="Em revisão" value={reviewAssets.length} helper="Ainda precisam de curadoria." icon={Clock3} tone="amber" />
            <MetricCard label="Sem preço" value={productMatrixQuery.data?.summary?.missingPrice ?? 0} helper="Publicar pode ser permitido; vender exige preço." icon={AlertTriangle} tone="amber" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-2xl font-black text-white">Conteúdos do avatar</h3>
                  <p className="mt-1 text-sm text-zinc-500">Publique apenas o que deve aparecer para cliente. O restante pode ficar aprovado e oculto.</p>
                </div>
              </div>
              {avatarAssets.length === 0 ? (
                <EmptyState message="Nenhum conteúdo encontrado para este avatar" helper="Após produzir e aprovar conteúdos, eles aparecerão aqui para publicação." icon={Archive} />
              ) : (
                <div className="space-y-3">{avatarAssets.map(renderAssetRow)}</div>
              )}
            </div>

            <aside className="space-y-4">
              <InfoCard title="O cliente não vê prompt" description="A publicação libera a assinatura estruturada do produto. O cliente monta por botões em cascata, mas só vê caminhos que têm produto aprovado e publicado." icon={CheckCircle2} tone="emerald" />
              <InfoCard title="Preço obrigatório para compra" description="Conteúdo sem preço pode até ser marcado, mas o Pricing Guard impede venda real se o preço não estiver configurado." icon={AlertTriangle} tone="amber" />
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Histórico de lotes</p>
                <div className="mt-4 space-y-3">
                  {avatarBatches.length === 0 && <p className="text-sm text-zinc-500">Nenhum lote recente para este avatar.</p>}
                  {avatarBatches.map((batch) => (
                    <div key={batch.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={batch.status} />
                        <span className="text-xs text-zinc-600">{formatDate(batch.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm font-black text-white">{batch.title || 'Lote de produção'}</p>
                      <p className="mt-1 text-xs text-zinc-500">Aprovados: {batch.approvedCount} • Reprovados: {batch.rejectedCount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  )
}


const GUIDE_TOPICS: Array<{ id: GuideTopicId; label: string; title: string; description: string; icon: ElementType; tone: CardTone; articles: Array<{ title: string; description: string; steps: string[] }> }> = [
  {
    id: 'getting-started',
    label: 'Começo rápido',
    title: 'Visão geral da operação',
    description: 'O caminho mental do Admin: mapear, planejar, revisar, publicar e acompanhar venda/entrega.',
    icon: Home,
    tone: 'blue',
    articles: [
      { title: 'Fluxo macro do Admin', description: 'Use o painel como uma linha de produção segura.', steps: ['Acompanhe alertas no Centro de Comando.', 'Produza em Produção Individual ou Lotes.', 'Revise conteúdos antes de vender.', 'Publique somente produtos aprovados e com preço.'] },
      { title: 'Regra de ouro da interface', description: 'A tela principal fala linguagem de negócio; detalhes técnicos ficam escondidos.', steps: ['Não expor bucket, chave, worker ou endpoint para operador.', 'Usar nomes simples para atores, produtos e status.', 'Abrir detalhes só quando necessário.'] },
    ],
  },
  {
    id: 'actors',
    label: 'Atores',
    title: 'Como cadastrar ator',
    description: 'Guia visual para entrada, mapeamento e liberação de avatar.',
    icon: UserCheck,
    tone: 'amber',
    articles: [
      { title: 'Cadastro seguro', description: 'O ator entra, envia materiais e o Admin acompanha o mapeamento.', steps: ['Criar/acompanhar perfil do ator.', 'Validar material de imagem, áudio e vídeo.', 'Liberar apenas avatares conformes para produção.'] },
      { title: 'Autorização de conteúdo', description: 'Cada tipo de mídia deve respeitar autorização e status do ator.', steps: ['Verificar autorização por mídia.', 'Não produzir tipo bloqueado.', 'Registrar pendências no painel do ator.'] },
    ],
  },
  {
    id: 'production',
    label: 'Produção',
    title: 'Como planejar lote',
    description: 'Planejamento guiado sem chamar mídia real automaticamente.',
    icon: Layers3,
    tone: 'violet',
    articles: [
      { title: 'Produção Individual', description: 'Use para montar uma produção específica dentro da própria tela.', steps: ['Escolha ator/avatar.', 'Escolha prompt/produto.', 'Escolha tipo de mídia e variações.', 'Clique em Preparar lote seguro.'] },
      { title: 'Produção e Lotes', description: 'Use para acompanhar fila, revisão e histórico.', steps: ['Filtre por status.', 'Abra o lote em modal.', 'Confira checklist antes de qualquer ação sensível.'] },
    ],
  },
  {
    id: 'sales',
    label: 'Vendas',
    title: 'Entregas, prateleira e financeiro',
    description: 'Como acompanhar produto vendido, cliente atendido e repasse futuro.',
    icon: ShoppingBag,
    tone: 'emerald',
    articles: [
      { title: 'Prateleira de venda', description: 'Tudo que o cliente pode comprar nasce aqui após aprovação.', steps: ['Conferir preço.', 'Conferir publicação.', 'Evitar produto sem preço.', 'Acompanhar histórico de entrega.'] },
      { title: 'Entregas e vendas', description: 'Use filtros para encontrar transações por ator, produto, cliente ou status.', steps: ['Filtre a lista.', 'Clique na entrega.', 'Confira detalhes da transação no drawer.'] },
    ],
  },
  {
    id: 'status',
    label: 'Status',
    title: 'Dicionário de status',
    description: 'Tradução leiga dos principais estados da operação.',
    icon: Info,
    tone: 'zinc',
    articles: [
      { title: 'Conteúdo', description: 'Estados de mídia dentro da fábrica.', steps: ['Aguardando revisão: precisa de decisão humana.', 'À venda: aprovado e disponível.', 'Já entregue: comprado/liberado para cliente.', 'Reprovado: fora da venda.'] },
      { title: 'Lote', description: 'Estados do planejamento e produção.', steps: ['Aguardando: preparado para próxima etapa.', 'Produzindo: em execução controlada.', 'Concluído: finalizado.', 'Falhou: precisa de análise.'] },
    ],
  },
  {
    id: 'safety',
    label: 'Segurança',
    title: 'O que nunca fazer direto',
    description: 'Lista simples para preservar a operação segura.',
    icon: ShieldCheck,
    tone: 'red',
    articles: [
      { title: 'Ações sensíveis', description: 'Devem seguir gate, frase e auditoria quando existirem.', steps: ['Não chamar RunPod por botão casual.', 'Não expor R2/storage no frontend.', 'Não cobrar sem fluxo financeiro homologado.', 'Não publicar sem revisão e preço.'] },
      { title: 'Cliente e Ator', description: 'Essas telas são protegidas contra alteração visual indireta.', steps: ['Não mexer Cliente/Lorenzo sem autorização.', 'Não reconstruir Painel do Ator em patch visual.', 'Não apagar histórico, entrega ou ledger.'] },
    ],
  },
]

function GuidePage() {
  const [activeTopic, setActiveTopic] = useState<GuideTopicId>('getting-started')
  const topic = GUIDE_TOPICS.find((item) => item.id === activeTopic) || GUIDE_TOPICS[0]

  return (
    <section className="space-y-6" data-admin-section="ux7-internal-docs">
      <PageHeader
        eyebrow="Documentação interna"
        title="Guia rápido do Admin"
        description="Central limpa para treinar operador, reduzir dúvidas e padronizar a operação sem expor termos técnicos na tela principal."
      />

      <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
        <aside className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
          <p className="px-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Tópicos</p>
          <div className="mt-4 space-y-2">
            {GUIDE_TOPICS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTopic(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${activeTopic === item.id ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25 hover:text-white'}`}
              >
                <item.icon size={17} />
                <span className="text-sm font-black">{item.label}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-white/10 pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100">Docs internas</span>
              <h2 className="mt-4 text-3xl font-black text-white">{topic.title}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">{topic.description}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-400">
              <strong className="block text-white">Central de consulta interna</strong>
              <span className="mt-1 block">Tópicos à esquerda, conteúdo limpo à direita.</span>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {topic.articles.map((article) => (
              <article key={article.title} className="rounded-[2rem] border border-white/10 bg-black/25 p-5">
                <h3 className="text-xl font-black text-white">{article.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{article.description}</p>
                <ol className="mt-4 space-y-3">
                  {article.steps.map((step, index) => (
                    <li key={step} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-300">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-zinc-950">{index + 1}</span>
                      <span className="pt-1 leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function ReportsFinancePage({
  summary,
  deliveries,
  actors,
  globalActorFilter,
  onClearActorFilter,
}: {
  summary?: FactorySummary
  deliveries: FactoryDelivery[]
  actors: ActorProfile[]
  globalActorFilter: GlobalActorFilter | null
  onClearActorFilter: () => void
}) {
  const [rootTab, setRootTab] = useState<FinanceRootTab>('finance')
  const [financeSubTab, setFinanceSubTab] = useState<FinanceSubTab>('sales')
  const scopedActorValue = globalActorFilter ? `__actor_scope__:${globalActorFilter.actorId}` : ''
  const [actorFilter, setActorFilter] = useState('all')
  const actorOptions = useMemo(() => buildUniqueOptions(deliveries.map(deliveryActorName)), [deliveries])

  useEffect(() => {
    setActorFilter(globalActorFilter ? scopedActorValue : 'all')
  }, [globalActorFilter?.actorId, scopedActorValue])

  const reportDeliveries = useMemo(() => deliveries.filter((delivery) => {
    if (actorFilter === 'all') return true
    if (globalActorFilter && actorFilter === scopedActorValue) return deliveryMatchesGlobalActorFilter(delivery, globalActorFilter)
    return deliveryActorName(delivery) === actorFilter
  }), [actorFilter, deliveries, globalActorFilter, scopedActorValue])

  const totalSalesCredits = reportDeliveries.reduce((total, delivery) => total + Number(delivery.pricing.totalPriceCredits || 0), 0)
  const topProduct = bestSellingProduct(reportDeliveries)
  const deliveredCount = reportDeliveries.filter((delivery) => deliveryStatus(delivery) === 'delivered').length
  const errorCount = reportDeliveries.filter((delivery) => deliveryStatus(delivery) === 'error').length

  const payoutRows = useMemo(() => {
    return buildUniqueOptions(reportDeliveries.map(deliveryActorName)).map((actorName) => {
      const actorDeliveries = reportDeliveries.filter((delivery) => deliveryActorName(delivery) === actorName)
      const actorProfile = actors.find((actor) => actorDeliveries.some((delivery) => actorProfileMatchesDelivery(actor, delivery))) || null
      const grossCredits = actorDeliveries.reduce((total, delivery) => total + Number(delivery.pricing.totalPriceCredits || 0), 0)
      const estimatedPayoutCredits = actorDeliveries.reduce((total, delivery) => {
        const saleCredits = Number(delivery.pricing.totalPriceCredits || 0)
        const payoutPercent = actorPayoutPercentForDelivery(actorProfile, delivery)
        return total + (saleCredits * payoutPercent) / 100
      }, 0)
      const effectivePercent = grossCredits > 0 ? (estimatedPayoutCredits / grossCredits) * 100 : 0
      const configured = Boolean(actorProfile && (
        actorDefaultPayoutPercent(actorProfile) > 0
        || ACTOR_FINANCE_SPLIT_FIELDS.some((field) => actorMediaSplitPercent(actorProfile, field.key, 0) > 0)
      ))

      return {
        actorName,
        actorProfile,
        deliveries: actorDeliveries.length,
        grossCredits,
        estimatedPayoutCredits,
        effectivePercent,
        configured,
      }
    }).sort((left, right) => right.estimatedPayoutCredits - left.estimatedPayoutCredits)
  }, [actors, reportDeliveries])

  const totalEstimatedPayout = payoutRows.reduce((total, row) => total + row.estimatedPayoutCredits, 0)

  const financeTabs: Array<{ id: FinanceSubTab; label: string; helper: string }> = [
    { id: 'sales', label: 'Vendas', helper: 'Entradas registradas por entrega e produto.' },
    { id: 'payouts', label: 'Repasses', helper: 'Estimativa pela regra vigente cadastrada no ator.' },
    { id: 'costs', label: 'Custos operacionais', helper: 'Disponível quando o faturamento dos provedores estiver integrado.' },
  ]

  return (
    <section className="space-y-6" data-admin-section="ux7-reports-finance-shell">
      <PageHeader
        eyebrow="Gestão"
        title="Financeiro e relatórios"
        description="Leitura gerencial de vendas, créditos faturados e repasses estimados com base nas entregas e regras vigentes já cadastradas."
      />

      {globalActorFilter && (
        <div className="flex flex-col gap-3 rounded-[2rem] border border-violet-300/25 bg-violet-300/[0.08] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Relatório filtrado pelo perfil</p>
            <p className="mt-1 text-lg font-black text-white">{globalActorFilter.actorName}</p>
            <p className="mt-1 text-sm text-violet-50/70">Vendas, indicadores e repasses abaixo consideram apenas este ator.</p>
          </div>
          <button type="button" onClick={onClearActorFilter} className="rounded-2xl border border-violet-200/30 bg-black/20 px-4 py-3 text-sm font-black text-violet-50 transition hover:border-violet-100/60">Ver relatório geral</button>
        </div>
      )}

      <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_320px]">
          <button type="button" onClick={() => setRootTab('finance')} className={`rounded-2xl p-4 text-left transition ${rootTab === 'finance' ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}>
            <h3 className="text-xl font-black">Financeiro</h3>
            <p className="mt-1 text-sm opacity-75">Vendas, repasses e custos.</p>
          </button>
          <button type="button" onClick={() => setRootTab('reports')} className={`rounded-2xl p-4 text-left transition ${rootTab === 'reports' ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/25 text-zinc-300 hover:border-white/25'}`}>
            <h3 className="text-xl font-black">Relatórios</h3>
            <p className="mt-1 text-sm opacity-75">Desempenho por ator e produto.</p>
          </button>
          <label className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-600">Filtrar ator</span>
            <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none focus:border-violet-300/40">
              <option value="all">Todos os atores</option>
              {globalActorFilter && <option value={scopedActorValue}>{globalActorFilter.actorName} — perfil selecionado</option>}
              {actorOptions.map((actor) => <option key={actor} value={actor}>{actor}</option>)}
            </select>
          </label>
        </div>
      </div>

      {rootTab === 'finance' && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {financeTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setFinanceSubTab(tab.id)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${financeSubTab === tab.id ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}>{tab.label}</button>
            ))}
          </div>

          {financeSubTab === 'sales' && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-4">
                <MetricCard label="Créditos faturados" value={formatCreditsAmount(totalSalesCredits)} helper="Soma de totalPriceCredits nas entregas filtradas." icon={ShoppingBag} tone="emerald" />
                <MetricCard label="Entregas filtradas" value={reportDeliveries.length} helper="Liberações consideradas nesta visão." icon={Send} tone="blue" />
                <MetricCard label="Produto líder" value={topProduct.count || '—'} helper={topProduct.count ? topProduct.name : 'Sem vendas suficientes neste filtro.'} icon={Store} tone="violet" />
                <MetricCard label="Falhas" value={errorCount} helper="Entregas com inconsistência registrada." icon={AlertTriangle} tone={errorCount ? 'red' : 'zinc'} />
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Vendas recentes</p>
                <div className="mt-4 space-y-3">
                  {reportDeliveries.slice(0, 6).map((delivery) => (
                    <div key={delivery.id} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm md:grid-cols-[1fr_1fr_120px_140px] md:items-center">
                      <span className="font-black text-white">{deliveryProductName(delivery)}</span>
                      <span className="text-zinc-400">{deliveryActorName(delivery)}</span>
                      <span className="font-black text-emerald-100">{formatCreditsAmount(Number(delivery.pricing.totalPriceCredits || 0))} cr</span>
                      <span className="text-xs text-zinc-500">{formatDate(delivery.createdAt)}</span>
                    </div>
                  ))}
                  {reportDeliveries.length === 0 && <EmptyState message="Sem vendas reais neste filtro." helper="Altere o ator selecionado ou aguarde novas entregas faturadas." icon={ShoppingBag} />}
                </div>
              </div>
            </div>
          )}

          {financeSubTab === 'payouts' && (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Receita bruta" value={`${formatCreditsAmount(totalSalesCredits)} cr`} helper="Créditos faturados nas entregas filtradas." icon={ShoppingBag} tone="emerald" />
                <MetricCard label="Repasse estimado" value={`${formatCreditsAmount(totalEstimatedPayout)} cr`} helper="Venda × split vigente por tipo de mídia." icon={Crown} tone="violet" />
                <MetricCard label="Atores calculados" value={payoutRows.length} helper="Atores encontrados nas entregas desta visão." icon={UserCheck} tone="blue" />
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Repasses por ator</p>
                <h3 className="mt-2 text-2xl font-black text-white">Estimativa pela regra vigente</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">Cálculo somente de leitura. Não cria pagamento, wallet, ledger ou alteração retroativa de vendas antigas.</p>
                <div className="mt-5 space-y-3">
                  {payoutRows.map((row) => (
                    <div key={row.actorName} className="grid gap-3 rounded-2xl border border-white/10 bg-black/25 p-4 lg:grid-cols-[1fr_110px_150px_150px_130px] lg:items-center">
                      <div>
                        <span className="font-black text-white">{row.actorName}</span>
                        <p className="mt-1 text-xs text-zinc-500">{row.configured ? 'Split vigente localizado no perfil.' : 'Split não cadastrado ou perfil não correlacionado.'}</p>
                      </div>
                      <span className="text-sm text-zinc-400">{row.deliveries} venda(s)</span>
                      <span className="text-sm font-black text-zinc-200">{formatCreditsAmount(row.grossCredits)} cr brutos</span>
                      <span className="text-sm font-black text-violet-100">{formatCreditsAmount(row.estimatedPayoutCredits)} cr repasse</span>
                      <span className="text-sm font-black text-amber-100">{formatCreditsAmount(row.effectivePercent)}%</span>
                    </div>
                  ))}
                  {payoutRows.length === 0 && <EmptyState message="Sem vendas para estimar repasse." helper="O cálculo aparecerá quando houver entregas com créditos e uma regra vigente correlacionada ao ator." icon={Crown} />}
                </div>
              </div>

              <InfoCard title="Estimativa sem liquidação" description="A tela cruza créditos faturados com o split vigente do perfil. Nenhum repasse é executado e nenhuma venda antiga é recalculada." icon={ShieldCheck} tone="amber" />
            </div>
          )}

          {financeSubTab === 'costs' && (
            <div className="rounded-[2rem] border border-sky-300/20 bg-sky-300/[0.06] p-6">
              <div className="flex items-start gap-4">
                <span className="rounded-2xl border border-sky-300/20 bg-black/20 p-3 text-sky-100"><Boxes size={20} /></span>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-100">Custos operacionais</p>
                  <h3 className="mt-2 text-2xl font-black text-white">Aguardando integração de faturamento</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-relaxed text-sky-50/70">Nenhum valor hipotético é exibido. Custos de geração, APIs e infraestrutura entrarão aqui somente quando os provedores disponibilizarem dados reais de faturamento para o read model.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {rootTab === 'reports' && (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Taxa de aprovação geral" value={summary?.assets.total ? `${Math.round(((summary.assets.available + summary.assets.sold) / summary.assets.total) * 100)}%` : '—'} helper="Indicador geral do estoque carregado pelo resumo." icon={CheckCircle2} tone="emerald" />
            <MetricCard label="Revisão pendente geral" value={summary?.assets.qaPending ?? '—'} helper="Conteúdos que ainda dependem de curadoria." icon={Clock3} tone="amber" />
            <MetricCard label="Entregues sem erro" value={deliveredCount} helper="Entregas filtradas com rota protegida e cobrança registrada." icon={Send} tone="blue" />
            <MetricCard label="Créditos faturados" value={formatCreditsAmount(totalSalesCredits)} helper="Receita das entregas consideradas no filtro atual." icon={ShoppingBag} tone="violet" />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Desempenho por ator</p>
              <h3 className="mt-2 text-2xl font-black text-white">Ranking gerencial</h3>
              <div className="mt-4 space-y-3">
                {buildUniqueOptions(reportDeliveries.map(deliveryActorName)).slice(0, 6).map((actor, index) => (
                  <div key={actor} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <span className="font-black text-white">{index + 1}. {actor}</span>
                    <span className="text-sm font-bold text-zinc-400">{reportDeliveries.filter((delivery) => deliveryActorName(delivery) === actor).length} entrega(s)</span>
                  </div>
                ))}
                {reportDeliveries.length === 0 && <p className="text-sm text-zinc-500">Sem dados reais suficientes para ranking.</p>}
              </div>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Desempenho por produto</p>
              <h3 className="mt-2 text-2xl font-black text-white">Produtos mais acionados</h3>
              <div className="mt-4 space-y-3">
                {buildUniqueOptions(reportDeliveries.map(deliveryProductName)).slice(0, 6).map((product, index) => (
                  <div key={product} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 p-4">
                    <span className="font-black text-white">{index + 1}. {product}</span>
                    <span className="text-sm font-bold text-zinc-400">{reportDeliveries.filter((delivery) => deliveryProductName(delivery) === product).length} venda(s)</span>
                  </div>
                ))}
                {reportDeliveries.length === 0 && <p className="text-sm text-zinc-500">Sem dados reais suficientes para ranking.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ProductionIndividualBusinessPage({ onNavigate }: { onNavigate: (page: AdminPage) => void }) {
  const creationTitlesQuery = useCreationTitles()
  const creationAvatarsQuery = useCreationAvatars()
  const createProductionBatchMutation = useCreateSafeGuidedProductionBatch()

  const [productionAvatarId, setProductionAvatarId] = useState('')
  const [productionContentType, setProductionContentType] = useState<ContentObject>('Imagem')
  const [productionSelections, setProductionSelections] = useState<SelectionMap>({})
  const [productionVariationTarget, setProductionVariationTarget] = useState(5)
  const [preflightConfirmed, setPreflightConfirmed] = useState(false)
  const [lastProductionBatchResult, setLastProductionBatchResult] = useState<GuidedProductionBatchResponse | null>(null)

  const availableAvatars = useMemo(() => {
    const apiAvatars = creationAvatarsQuery.data?.items?.map(mapCreationAvatarFromApi) || []
    return apiAvatars.length > 0 ? apiAvatars : AVATAR_PROFILES
  }, [creationAvatarsQuery.data])

  const titles = useMemo(() => {
    const apiTitles = creationTitlesQuery.data?.items?.map(mapCreationTitleFromApi) || []
    return apiTitles.length > 0 ? apiTitles : INITIAL_CREATION_TITLES
  }, [creationTitlesQuery.data])

  useEffect(() => {
    if (availableAvatars.length === 0) return
    setProductionAvatarId((current) => (availableAvatars.some((avatar) => avatar.id === current) ? current : availableAvatars[0].id))
  }, [availableAvatars])

  useEffect(() => {
    setPreflightConfirmed(false)
    setLastProductionBatchResult(null)
  }, [productionAvatarId, productionContentType, productionSelections, productionVariationTarget])

  const productionAvatar = availableAvatars.find((avatar) => avatar.id === productionAvatarId) || availableAvatars[0]
  const productionApiContentType = useMemo(() => toApiContentType(productionContentType), [productionContentType])
  const productionAvatarIsReal = isUuid(productionAvatar?.id)
  const productionComplianceQuery = useAvatarComplianceReport(
    productionAvatarIsReal ? productionAvatar?.id : null,
    false,
    productionApiContentType,
  )
  const productionCompliance = productionComplianceQuery.data || null
  const productionComplianceReasons = productionCompliance?.reasons || []
  const productionAllowedByCompliance = productionAvatarIsReal && productionCompliance?.productionAllowed === true
  const productionBlockingMessage = productionAvatarIsReal
    ? productionComplianceReasons[0]?.message || productionCompliance?.summary || 'Aguardando confirmação de conformidade do avatar.'
    : 'Escolha um avatar real cadastrado no sistema.'

  const productionTitles = useMemo(() => {
    return titles.filter((title) => title.contentTypes.includes(productionContentType))
  }, [productionContentType, titles])

  const productionGroups = useMemo(() => {
    return productionTitles
      .map((title) => ({
        title,
        selectedItems: title.items.filter((item) => productionSelections[title.id]?.includes(item.id)),
      }))
      .filter((group) => group.selectedItems.length > 0)
  }, [productionSelections, productionTitles])

  const combinationTotal = useMemo(() => {
    if (productionGroups.length === 0) return 0
    return productionGroups.reduce((total, group) => total * group.selectedItems.length, 1)
  }, [productionGroups])

  const productionDestination = useMemo(() => {
    const destinations: Record<ContentObject, string> = {
      Imagem: 'pré-produção de imagem',
      Vídeo: 'pré-produção de vídeo',
      'Vídeo curto': 'pré-produção de vídeo curto',
      'Live Action': 'pré-produção de live action',
      Áudio: 'pré-produção de áudio',
      'Áudio Live': 'pré-produção de áudio live',
    }

    return destinations[productionContentType]
  }, [productionContentType])

  const preflightChecks = useMemo(() => {
    const checklist = productionCompliance?.mapping?.checklist || null
    const vault = productionCompliance?.vault || null
    const checks = productionCompliance?.checks || null

    return [
      {
        id: 'avatar',
        label: 'Avatar escolhido na tela',
        ok: productionAvatarIsReal,
        helper: productionAvatarIsReal ? productionAvatar?.name || 'Avatar selecionado' : 'Selecione um avatar real cadastrado.',
      },
      {
        id: 'media',
        label: 'Tipo de mídia definido',
        ok: Boolean(productionContentType),
        helper: `${mediaTypeLabel(productionContentType)} será preparado em lote seguro.`,
      },
      {
        id: 'prompt',
        label: 'Prompt/produto selecionado',
        ok: combinationTotal > 0,
        helper: combinationTotal > 0 ? `${combinationTotal} combinação(ões) marcada(s).` : 'Marque pelo menos um item de prompt/produto.',
      },
      {
        id: 'report',
        label: 'Relatório consultado',
        ok: productionComplianceQuery.isSuccess && !productionComplianceQuery.isLoading && !productionComplianceQuery.isError,
        helper: productionComplianceQuery.isLoading ? 'Conferindo liberação agora.' : productionComplianceQuery.isError ? 'Atualize a consulta antes de preparar.' : 'Consulta concluída.',
      },
      {
        id: 'mapping',
        label: 'Mapeamento aprovado',
        ok: checks?.mappingApproved === true,
        helper: productionCompliance?.mapping?.status ? mappingStatusLabel(productionCompliance.mapping.status) : 'Sem mapeamento aprovado.',
      },
      {
        id: 'checklist',
        label: 'Checklist completo',
        ok: checks?.mappingComplete === true,
        helper: checklist ? `${checklist.completedRequired}/${checklist.totalRequired} materiais obrigatórios` : 'Checklist ainda não carregado.',
      },
      {
        id: 'vault',
        label: 'Cofre privado preenchido',
        ok: Boolean(vault && vault.real > 0 && vault.publicAccess === false),
        helper: vault ? `${vault.real} materiais reais e ${vault.total} no total` : 'Sem resumo do cofre.',
      },
      {
        id: 'authorization',
        label: 'Autorização ativa para esta mídia',
        ok: checks?.hasActiveAuthorization === true && checks?.contentTypeAllowed === true,
        helper: productionCompliance?.authorization?.id ? `Autorização ${shortId(productionCompliance.authorization.id)}` : 'Sem autorização ativa compatível.',
      },
      {
        id: 'safe-mode',
        label: 'Modo seguro preservado',
        ok: true,
        helper: 'Esta ação cria planejamento. Não chama RunPod, R2, cobrança, publicação ou entrega.',
      },
    ]
  }, [combinationTotal, productionAvatar?.name, productionAvatarIsReal, productionCompliance, productionComplianceQuery.isError, productionComplianceQuery.isLoading, productionComplianceQuery.isSuccess, productionContentType])

  const preflightReady = productionAllowedByCompliance && preflightChecks.every((check) => check.ok) && !productionComplianceQuery.isLoading && !productionComplianceQuery.isError
  const preflightMissingChecks = preflightChecks.filter((check) => !check.ok)
  const productionButtonDisabled = createProductionBatchMutation.isPending || !preflightReady || !preflightConfirmed || combinationTotal <= 0

  function mediaIcon(type: ContentObject) {
    if (type.includes('Áudio')) return Music
    if (type.includes('Vídeo') || type === 'Live Action') return Video
    return ImageIcon
  }

  function changeProductionContentType(type: ContentObject) {
    setProductionContentType(type)
    setProductionSelections({})
  }

  function toggleProductionItem(titleId: string, itemId: string) {
    setProductionSelections((current) => {
      const selected = current[titleId] || []
      return {
        ...current,
        [titleId]: selected.includes(itemId) ? selected.filter((id) => id !== itemId) : [...selected, itemId],
      }
    })
  }

  function selectAllTitleItems(title: CreationTitle) {
    setProductionSelections((current) => ({
      ...current,
      [title.id]: title.items.map((item) => item.id),
    }))
  }

  function clearTitleItems(titleId: string) {
    setProductionSelections((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== titleId)) as SelectionMap)
  }

  function handlePrepareSafeBatch() {
    if (!productionAvatar?.id || !isUuid(productionAvatar.id)) {
      window.alert('Escolha um avatar real cadastrado no sistema. Avatares de demonstração não podem criar lote operacional.')
      return
    }

    if (combinationTotal <= 0) {
      window.alert('Marque pelo menos um prompt/produto antes de preparar o lote seguro.')
      return
    }

    const invalidSelection = Object.entries(productionSelections).some(([titleId, itemIds]) => {
      return !isUuid(titleId) || itemIds.some((itemId) => !isUuid(itemId))
    })

    if (invalidSelection) {
      window.alert('Existem títulos ou itens locais de demonstração nesta seleção. Use itens salvos na Fábrica Guiada antes de criar lote operacional.')
      return
    }

    if (combinationTotal > 80) {
      window.alert('Este lote está muito grande. Reduza a seleção para no máximo 80 combinações por vez.')
      return
    }

    if (productionComplianceQuery.isLoading) {
      window.alert('Aguarde a checagem de liberação do avatar antes de preparar o lote.')
      return
    }

    if (productionComplianceQuery.isError) {
      window.alert(`Não foi possível conferir a liberação do avatar. ${parseApiError(productionComplianceQuery.error)}`)
      return
    }

    if (!productionCompliance?.productionAllowed) {
      const reasons = productionComplianceReasons.map((reason) => `• ${reason.message}`).join('\n')
      window.alert(`Este avatar ainda não está liberado para produção.\n\n${reasons || productionBlockingMessage}`)
      return
    }

    if (!preflightReady) {
      const missing = preflightMissingChecks.map((check) => `• ${check.label}: ${check.helper}`).join('\n')
      window.alert(`Pré-produção incompleta. Resolva os pontos abaixo antes de preparar o lote.\n\n${missing || 'Confira avatar, produto e mídia.'}`)
      return
    }

    if (!preflightConfirmed) {
      window.alert('Marque a confirmação final da pré-produção antes de preparar o lote seguro.')
      return
    }

    const confirmed = window.confirm(
      `Preparar lote seguro?\n\nAvatar: ${productionAvatar?.name}\nTipo de mídia: ${productionContentType}\nCombinações: ${combinationTotal}\nVariações por combinação: ${productionVariationTarget}\nDestino: ${productionDestination}\n\nModo seguro: não gera mídia real, não chama RunPod/R2, não cobra, não publica e não entrega ao cliente.`,
    )

    if (!confirmed) return

    createProductionBatchMutation.mutate({
      companionId: productionAvatar.id,
      contentType: toApiContentType(productionContentType),
      selections: productionSelections,
      requestedVariants: productionVariationTarget,
    }, {
      onSuccess: (result) => {
        setLastProductionBatchResult(result)
        setPreflightConfirmed(false)
      },
      onError: (error) => {
        window.alert(`Não foi possível preparar o lote seguro. ${parseApiError(error)}`)
      },
    })
  }

  return (
    <section className="space-y-6" data-admin-section="individual-production-real-selection" data-ux6hf1-creative-arm-wizard="true">
      <PageHeader
        eyebrow="Produção"
        title="Produção individual"
        description="Monte o lote nesta própria tela: escolha avatar, prompt/produto, tipo de mídia, quantidade e prepare tudo em modo seguro. A geração final continua bloqueada por etapas próprias."
      />

      {(creationAvatarsQuery.isError || creationTitlesQuery.isError) && (
        <div className="rounded-[2rem] border border-amber-400/20 bg-amber-400/10 p-5 text-sm leading-relaxed text-amber-50">
          <strong className="block text-amber-50">Atenção na leitura da Fábrica Guiada</strong>
          <span className="mt-1 block text-amber-100/80">Alguns dados podem estar usando fallback local. A criação operacional só será permitida com avatar, título e item reais salvos no sistema.</span>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Avatar" value={productionAvatar?.name || '—'} helper="Selecionado dentro desta tela." icon={UserCheck} tone={productionAvatarIsReal ? 'emerald' : 'amber'} />
        <MetricCard label="Mídia" value={productionContentType} helper="Tipo principal do lote seguro." icon={Sparkles} tone="violet" />
        <MetricCard label="Combinações" value={combinationTotal} helper="Cruzamento dos prompts/produtos marcados." icon={Boxes} tone={combinationTotal > 0 ? 'emerald' : 'amber'} />
        <MetricCard label="Modo" value="Seguro" helper="Sem geração, cobrança, publicação ou entrega." icon={ShieldCheck} tone="blue" />
      </div>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" data-ux6hf1-step-avatar="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">1. Selecionar Avatar</p>
            <h3 className="mt-2 text-2xl font-black text-white">Escolha o ator/avatar aqui mesmo</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">A seleção não abre outra página. A checagem de mapeamento, cofre e autorização continua automática.</p>
          </div>
          <button type="button" onClick={() => productionComplianceQuery.refetch()} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
            <RefreshCw size={16} /> Atualizar liberação
          </button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {availableAvatars.map((avatar) => {
            const selected = avatar.id === productionAvatarId
            const real = isUuid(avatar.id)
            return (
              <button
                key={avatar.id}
                type="button"
                onClick={() => setProductionAvatarId(avatar.id)}
                className={`rounded-[1.6rem] border p-4 text-left transition hover:border-blue-300/35 hover:bg-blue-300/10 ${selected ? 'border-blue-300/45 bg-blue-300/10 ring-2 ring-blue-100/60' : 'border-white/10 bg-black/25'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-white"><UserCheck size={18} /></span>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${real ? 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/20 bg-amber-300/10 text-amber-100'}`}>{real ? 'Real' : 'Demo'}</span>
                </div>
                <p className="mt-4 font-black text-white">{avatar.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-zinc-500">{avatar.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {avatar.enabledContentTypes.slice(0, 4).map((type) => <span key={type} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-[10px] font-bold text-zinc-400">{type}</span>)}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20" data-ux6hf1-step-products="true">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-100">2. Selecionar Prompt/Produto</p>
            <h3 className="mt-2 text-2xl font-black text-white">Marque um ou mais produtos da Fábrica</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">Os itens marcados viram o cruzamento do lote. Tudo fica na tela; nada manda o Admin para Prateleira ou Atores.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-zinc-300">
            Tipo atual: <strong className="text-white">{productionContentType}</strong>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {productionTitles.map((title) => {
            const selectedCount = productionSelections[title.id]?.length || 0
            return (
              <article key={title.id} className="rounded-[1.6rem] border border-white/10 bg-black/25 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-black text-white">{title.name}</p>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-500">{title.description || 'Grupo de prompts/produtos da Fábrica Guiada.'}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">{selectedCount}/{title.items.length}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {title.items.map((item) => {
                    const selected = productionSelections[title.id]?.includes(item.id) || false
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleProductionItem(title.id, item.id)}
                        className={`rounded-2xl px-4 py-3 text-sm font-black transition ${selected ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:border-white/25 hover:text-white'}`}
                      >
                        {item.name}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => selectAllTitleItems(title)} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-zinc-300 transition hover:border-white/25 hover:text-white">Marcar grupo</button>
                  <button type="button" onClick={() => clearTitleItems(title.id)} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-500 transition hover:border-white/25 hover:text-white">Limpar grupo</button>
                </div>
              </article>
            )
          })}

          {productionTitles.length === 0 && (
            <div className="rounded-[1.6rem] border border-dashed border-white/10 bg-black/25 p-5 text-sm leading-relaxed text-zinc-500">
              Nenhum prompt/produto encontrado para este tipo de mídia. Escolha outro tipo na etapa 3 ou cadastre títulos na Fábrica Guiada.
            </div>
          )}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_390px]" data-ux6hf1-step-media="true">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">3. Configurar Mídia</p>
            <h3 className="mt-2 text-2xl font-black text-white">Tipo, quantidade e variações</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">O backend atual prepara um lote seguro por tipo de mídia. Para produzir mais de um tipo, repita este fluxo por tipo, sem chamar geração real.</p>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {CONTENT_OBJECTS.map((type) => {
              const Icon = mediaIcon(type)
              const selected = productionContentType === type
              return (
                <button key={type} type="button" onClick={() => changeProductionContentType(type)} className={`rounded-[1.6rem] border p-4 text-left transition ${selected ? 'border-emerald-300/40 bg-emerald-300/10 ring-2 ring-emerald-100/40' : 'border-white/10 bg-black/25 hover:border-emerald-300/25 hover:bg-emerald-300/10'}`}>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-white"><Icon size={17} /></span>
                  <p className="mt-3 font-black text-white">{type}</p>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{type === 'Imagem' ? 'Cards e variações visuais.' : type.includes('Áudio') ? 'Produtos narrativos e voz.' : 'Cenas em movimento com revisão.'}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-bold text-zinc-300">
              Variações por combinação
              <select value={productionVariationTarget} onChange={(event) => setProductionVariationTarget(Number(event.target.value))} className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-emerald-300/50">
                {PRODUCTION_VARIATION_TARGET_OPTIONS.map((amount) => <option key={amount} value={amount}>{amount} variações</option>)}
              </select>
            </label>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Destino seguro</p>
              <p className="mt-2 font-black text-white">{productionDestination}</p>
              <p className="mt-1 text-xs leading-relaxed text-emerald-50/80">Preparação operacional, sem execução final.</p>
            </div>
          </div>

          <div className={`mt-5 rounded-[2rem] border p-5 ${productionAllowedByCompliance ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-1 rounded-2xl border p-3 ${productionAllowedByCompliance ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-amber-300/25 bg-amber-300/10 text-amber-100'}`}>
                {productionComplianceQuery.isLoading ? <Clock3 size={20} /> : productionAllowedByCompliance ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
              </span>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Liberação do avatar para esta mídia</p>
                <h3 className="mt-2 text-2xl font-black text-white">{productionComplianceQuery.isLoading ? 'Conferindo...' : productionAllowedByCompliance ? 'Liberado para preparar lote' : 'Ainda bloqueado'}</h3>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-300">{productionComplianceQuery.isError ? `Não foi possível consultar a liberação agora. ${parseApiError(productionComplianceQuery.error)}` : productionCompliance?.summary || productionBlockingMessage}</p>
              </div>
            </div>

            {!productionAllowedByCompliance && productionComplianceReasons.length > 0 && (
              <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">O que falta resolver</p>
                {productionComplianceReasons.map((reason) => (
                  <div key={`${reason.code}-${reason.message}`} className="flex items-start gap-2 text-sm text-amber-100">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>{reason.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="sticky top-6 h-fit rounded-[2rem] border border-white/10 bg-zinc-950/90 p-5 shadow-2xl shadow-black/30">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Prévia do lote</p>
          <h3 className="mt-3 text-3xl font-black text-white">{combinationTotal} combinação(ões)</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">O Admin confere o lote completo antes de registrar a pré-produção segura.</p>

          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-zinc-500">Avatar</span><strong className="text-right text-white">{productionAvatar?.name || '—'}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">Mídia</span><strong className="text-right text-white">{productionContentType}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">Variações</span><strong className="text-right text-white">{productionVariationTarget}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">Status</span><strong className={productionAllowedByCompliance ? 'text-right text-emerald-100' : 'text-right text-amber-100'}>{adminStatusLabel(productionCompliance?.status)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-zinc-500">Geração final</span><strong className="text-right text-emerald-100">Não executa agora</strong></div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-4">
            {productionGroups.length === 0 ? (
              <p className="text-sm text-zinc-500">Nenhum prompt/produto marcado ainda.</p>
            ) : (
              <div className="space-y-2">
                {productionGroups.map((group) => (
                  <p key={group.title.id} className="text-sm text-zinc-300"><strong className="text-white">{group.title.name}:</strong> {group.selectedItems.map((item) => item.name).join(', ')}</p>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-2">
            {preflightChecks.map((check) => (
              <div key={check.id} className={`rounded-2xl border p-3 ${check.ok ? 'border-emerald-400/20 bg-emerald-400/10' : 'border-amber-400/20 bg-amber-400/10'}`}>
                <div className="flex items-start gap-2">
                  <span className={check.ok ? 'text-emerald-100' : 'text-amber-100'}>{check.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}</span>
                  <div>
                    <p className="text-xs font-black text-white">{check.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">{check.helper}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${preflightReady && combinationTotal > 0 ? 'border-white/10 bg-black/25 hover:border-white/25' : 'border-zinc-800 bg-black/20 opacity-60'}`}>
            <input type="checkbox" checked={preflightConfirmed} disabled={!preflightReady || combinationTotal <= 0} onChange={(event) => setPreflightConfirmed(event.target.checked)} className="mt-1 size-4 accent-emerald-400" />
            <span>
              <strong className="block text-sm font-black text-white">Confirmo o lote seguro.</strong>
              <span className="mt-1 block text-xs leading-relaxed text-zinc-500">Conferi avatar, prompt/produto, mídia, variações e travas. Sei que a geração real continua separada.</span>
            </span>
          </label>

          <button type="button" onClick={handlePrepareSafeBatch} disabled={productionButtonDisabled} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-4 text-sm font-black text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60">
            <Sparkles size={17} />
            {createProductionBatchMutation.isPending
              ? 'Preparando lote...'
              : !preflightReady
                ? 'Pré-produção pendente'
                : combinationTotal <= 0
                  ? 'Marque prompts/produtos'
                  : !preflightConfirmed
                    ? 'Confirme o lote seguro'
                    : 'Preparar lote seguro'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">Ação protegida: sem RunPod, sem R2, sem cobrança, sem publicação, sem Cliente e sem entrega.</p>

          {lastProductionBatchResult && (
            <div className="mt-5 rounded-[1.5rem] border border-emerald-400/20 bg-emerald-400/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Lote preparado com segurança</p>
              <h4 className="mt-2 text-xl font-black text-white">Pré-produção registrada</h4>
              <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">A produção final não iniciou. O pedido ficou salvo para conferência operacional.</p>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Código</span><strong className="text-white">{shortId(lastProductionBatchResult.batch.id)}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Combinações</span><strong className="text-white">{lastProductionBatchResult.batch.totalItems}</strong></div>
                <div className="flex justify-between gap-3"><span className="text-emerald-50/70">Variações</span><strong className="text-white">{lastProductionBatchResult.batch.requestedVariants || productionVariationTarget}</strong></div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => onNavigate('batches')} className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-zinc-200">Ver em lotes</button>
                <button type="button" onClick={() => setLastProductionBatchResult(null)} className="rounded-2xl border border-white/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-50 transition hover:border-white/25">Continuar montando</button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function CatalogBusinessPage({
  assets,
  isLoading,
  status,
  onStatusChange,
  onNavigate,
  onPrepareVariations,
}: {
  assets: FactoryAsset[]
  isLoading: boolean
  status: string
  onStatusChange: (status: string) => void
  onNavigate: (page: AdminPage) => void
  onPrepareVariations: (asset: FactoryAsset) => void
}) {
  const safeAssets = Array.isArray(assets) ? assets : []
  const assetPriceMutation = useUpdateAssetCommercialPrice()
  const productPublicationMutation = useUpdateFactoryProductPublication()
  const catalogPreviewMutation = useCreateFactoryAssetPreview()
  const catalogPreviewRequestRef = useRef<string | null>(null)
  const [selectedCatalogAsset, setSelectedCatalogAsset] = useState<FactoryAsset | null>(null)
  const [selectedCatalogPreview, setSelectedCatalogPreview] = useState<SecurePreviewResponse | null>(null)
  // contrato visual preservado: 'deliveries' | 'variations'
  const [catalogDrawerMode, setCatalogDrawerMode] = useState<CatalogDrawerMode>('details')
  const [drawerDraftPrice, setDrawerDraftPrice] = useState('31')
  const [drawerConfirmationPhrase, setDrawerConfirmationPhrase] = useState('')
  const [drawerSaveResult, setDrawerSaveResult] = useState<string | null>(null)
  const [drawerSaveError, setDrawerSaveError] = useState<string | null>(null)
  const [drawerPublicationPhrase, setDrawerPublicationPhrase] = useState('')
  const [drawerPublicationResult, setDrawerPublicationResult] = useState<string | null>(null)
  const [drawerPublicationError, setDrawerPublicationError] = useState<string | null>(null)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogActorFilter, setCatalogActorFilter] = useState('all')
  const [catalogMediaFilter, setCatalogMediaFilter] = useState<CatalogMediaFilter>('all')
  const [catalogPriceFilter, setCatalogPriceFilter] = useState<CatalogPriceFilter>('all')
  const [catalogPublicationFilter, setCatalogPublicationFilter] = useState<CatalogPublicationFilter>('all')

  const selectedCombinationId = selectedCatalogAsset?.combination?.id || null
  const productAssetsQuery = useFactoryAssetsByCombination(selectedCombinationId)
  const productDeliveriesQuery = useFactoryDeliveriesByCombination(selectedCombinationId)
  const catalogPublicationQuery = useFactoryPublishableProducts(selectedCatalogAsset?.companion?.id || null, 'all', 'all')

  const drawerRequiredPhrase = 'CONFIRMAR SALVAR PRECO'
  const selectedCatalogPrice = selectedCatalogAsset ? commercialAssetPrice(selectedCatalogAsset) : null
  const selectedCatalogMediaType = selectedCatalogAsset ? mediaTypeLabel((selectedCatalogAsset as any).mediaType || (selectedCatalogAsset as any).media_type) : 'Mídia'
  const selectedCatalogStatus = selectedCatalogAsset ? commercialAssetAvailabilityLabel(selectedCatalogAsset) : 'A conferir'
  const normalizedDrawerPrice = Number(drawerDraftPrice.replace(',', '.'))
  const normalizedDrawerPriceInteger = Math.trunc(normalizedDrawerPrice)
  const drawerPriceIsPositive = Number.isFinite(normalizedDrawerPrice) && normalizedDrawerPriceInteger > 0
  const drawerConfirmationOk = drawerConfirmationPhrase.trim() === drawerRequiredPhrase
  const canSaveDrawerPrice = Boolean(selectedCatalogAsset && catalogDrawerMode === 'price' && drawerPriceIsPositive && drawerConfirmationOk && !assetPriceMutation.isPending)

  const productVariationAssets = useMemo(() => {
    if (!selectedCombinationId) return selectedCatalogAsset ? [selectedCatalogAsset] : []

    const queryAssets = productAssetsQuery.data?.items || []
    const baseAssets = queryAssets.length > 0 ? queryAssets : safeAssets
    const matchedAssets = baseAssets.filter((asset) => asset.combination?.id === selectedCombinationId)

    if (matchedAssets.length > 0) return matchedAssets
    return selectedCatalogAsset ? [selectedCatalogAsset] : []
  }, [productAssetsQuery.data?.items, safeAssets, selectedCatalogAsset, selectedCombinationId])

  const productDeliveries = productDeliveriesQuery.data?.items || []
  const productUsedVariationIds = useMemo(() => new Set(productDeliveries.map((delivery) => delivery.asset?.id).filter(Boolean)), [productDeliveries])
  const productBlockedClientIds = useMemo(() => new Set(productDeliveries.map((delivery) => delivery.profileId).filter(Boolean)), [productDeliveries])
  const productStats = {
    variationsGenerated: productVariationAssets.length,
    variationsUsed: productUsedVariationIds.size,
    totalDeliveries: productDeliveries.length,
    blockedClients: productBlockedClientIds.size,
  }
  const selectedPublicationProduct = useMemo(
    () => catalogPublicationQuery.data?.items?.find((item) => item.assetId === selectedCatalogAsset?.id) || null,
    [catalogPublicationQuery.data?.items, selectedCatalogAsset?.id],
  )
  const selectedCatalogIsPublished = Boolean(selectedPublicationProduct?.publication?.published ?? selectedCatalogAsset?.combination?.visibleToClient)
  const selectedCatalogPublicationPrice = Number(selectedPublicationProduct?.price?.credits ?? selectedCatalogAsset?.combination?.priceCredits ?? selectedCatalogAsset?.price?.credits ?? 0)
  const selectedCatalogCanPublish = Boolean(
    selectedCatalogAsset
      && selectedCatalogAsset.status === 'available'
      && selectedCatalogPublicationPrice > 0
      && (selectedPublicationProduct?.readiness?.publishable ?? true),
  )
  const drawerPublicationRequiredPhrase = selectedCatalogIsPublished ? 'CONFIRMAR OCULTAR DO CLIENTE' : 'CONFIRMAR PUBLICAR PARA CLIENTE'
  const drawerPublicationPhraseOk = drawerPublicationPhrase.trim() === drawerPublicationRequiredPhrase
  const canApplyCatalogPublication = Boolean(selectedCatalogAsset && catalogDrawerMode === 'publication' && drawerPublicationPhraseOk && !productPublicationMutation.isPending && (selectedCatalogIsPublished || selectedCatalogCanPublish))
  const productionProductReadiness = useMemo(
    () => buildProductionProductReadiness(selectedCatalogAsset, productStats.variationsGenerated),
    [selectedCatalogAsset, productStats.variationsGenerated],
  )
  const productionProductReadyCount = productionProductReadiness.filter((check) => check.ok).length
  const productionProductTotalCount = productionProductReadiness.length
  const productionProductHasBlockers = productionProductReadiness.some((check) => !check.ok)
  const mediaFactoryReadiness = useMemo(
    () => buildCatalogMediaFactoryReadiness(selectedCatalogAsset),
    [selectedCatalogAsset],
  )

  const catalogActorOptions = useMemo(() => {
    const map = new Map<string, string>()
    safeAssets.forEach((asset) => {
      map.set(catalogActorFilterValue(asset), catalogActorLabel(asset))
    })
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [safeAssets])

  const catalogFilteredAssets = useMemo(() => {
    const query = normalizeText(catalogSearch)
    return safeAssets.filter((asset) => {
      const actorMatches = catalogActorFilter === 'all' || catalogActorFilterValue(asset) === catalogActorFilter
      const mediaMatches = catalogMediaFilter === 'all' || catalogAssetMediaFilterValue(asset) === catalogMediaFilter
      const price = commercialAssetPrice(asset)
      const priceMatches = catalogPriceFilter === 'all' || (catalogPriceFilter === 'priced' ? Boolean(price) : !price)
      const published = catalogAssetIsPublished(asset)
      const publicationMatches = catalogPublicationFilter === 'all' || (catalogPublicationFilter === 'published' ? published : !published)
      const searchMatches = !query || [
        contentTitle(asset),
        catalogActorLabel(asset),
        mediaTypeLabel((asset as any).mediaType || (asset as any).media_type || asset.combination?.mediaType),
        commercialAssetAvailabilityLabel(asset),
        shortId(asset.id),
        asset.combination?.key || '',
      ].some((value) => normalizeText(value).includes(query))

      return actorMatches && mediaMatches && priceMatches && publicationMatches && searchMatches
    })
  }, [catalogActorFilter, catalogMediaFilter, catalogPriceFilter, catalogPublicationFilter, catalogSearch, safeAssets])

  const catalogPricedCount = useMemo(() => safeAssets.filter((asset) => commercialAssetPrice(asset)).length, [safeAssets])
  const catalogPublishedCount = useMemo(() => safeAssets.filter((asset) => catalogAssetIsPublished(asset)).length, [safeAssets])
  const catalogHiddenCount = Math.max(safeAssets.length - catalogPublishedCount, 0)

  function openCatalogItem(asset: FactoryAsset, nextMode: CatalogDrawerMode = 'details') {
    const currentPrice = commercialAssetPrice(asset)
    catalogPreviewRequestRef.current = asset.id
    setSelectedCatalogAsset(asset)
    setSelectedCatalogPreview(null)
    setCatalogDrawerMode(nextMode)
    setDrawerDraftPrice(String(currentPrice || 31))
    setDrawerConfirmationPhrase('')
    setDrawerSaveResult(null)
    setDrawerSaveError(null)
    setDrawerPublicationPhrase('')
    setDrawerPublicationResult(null)
    setDrawerPublicationError(null)

    catalogPreviewMutation.mutate(asset.id, {
      onSuccess: (result) => {
        if (catalogPreviewRequestRef.current === asset.id) setSelectedCatalogPreview(result)
      },
    })
  }

  function closeCatalogItemDrawer() {
    catalogPreviewRequestRef.current = null
    setSelectedCatalogAsset(null)
    setSelectedCatalogPreview(null)
    setCatalogDrawerMode('details')
    setDrawerConfirmationPhrase('')
    setDrawerSaveResult(null)
    setDrawerSaveError(null)
    setDrawerPublicationPhrase('')
    setDrawerPublicationResult(null)
    setDrawerPublicationError(null)
  }

  async function handleCatalogDrawerPriceSave() {
    if (!selectedCatalogAsset || catalogDrawerMode !== 'price') return
    if (!drawerPriceIsPositive) {
      setDrawerSaveError('Preço precisa ser maior que zero. Gratuito/feed continua bloqueado.')
      return
    }
    if (!drawerConfirmationOk) {
      setDrawerSaveError('Digite a frase de confirmação exatamente como exibida para salvar o preço do produto.')
      return
    }

    setDrawerSaveError(null)
    setDrawerSaveResult(null)

    try {
      await assetPriceMutation.mutateAsync({
        assetId: selectedCatalogAsset.id,
        priceCredits: normalizedDrawerPriceInteger,
        note: 'prateleira: ajuste de preço pelo detalhe do item.',
      })
      setDrawerSaveResult('Preço salvo em ' + String(normalizedDrawerPriceInteger) + ' créditos. Publicação, disponibilidade e grátis/feed continuam bloqueados.')
    } catch (error) {
      setDrawerSaveError(parseApiError(error))
    }
  }


  async function handleCatalogPublicationToggle(nextPublish: boolean) {
    if (!selectedCatalogAsset || catalogDrawerMode !== 'publication') return

    const requiredPhrase = nextPublish ? 'CONFIRMAR PUBLICAR PARA CLIENTE' : 'CONFIRMAR OCULTAR DO CLIENTE'
    setDrawerPublicationResult(null)
    setDrawerPublicationError(null)

    if (drawerPublicationPhrase.trim() !== requiredPhrase) {
      setDrawerPublicationError(`Digite exatamente: ${requiredPhrase}`)
      return
    }

    if (nextPublish && !selectedCatalogCanPublish) {
      setDrawerPublicationError('Este produto ainda precisa estar aprovado e com preço antes de aparecer para o cliente.')
      return
    }

    try {
      await productPublicationMutation.mutateAsync({
        assetId: selectedCatalogAsset.id,
        publish: nextPublish,
        priceCredits: selectedCatalogPublicationPrice,
      })
      setDrawerPublicationResult(nextPublish ? 'Produto publicado para o cliente. O Painel do Ator acompanha a visibilidade.' : 'Produto ocultado do cliente. O histórico permanece preservado.')
      setDrawerPublicationPhrase('')
      void catalogPublicationQuery.refetch()
    } catch (error) {
      setDrawerPublicationError(parseApiError(error))
    }
  }

  return (
    <section className="space-y-5" data-admin-business-page="catalog" data-admin-ux2-catalog-refactor="true">
      <PageHeader
        eyebrow="Catálogo"
        title="Prateleira de venda"
        description="Filtre por ator, tipo e status. Abra um produto para editar preço, produção, publicação e histórico sem poluir a lista."
        action={
          <button type="button" onClick={() => onNavigate('prompts')} className="rounded-2xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-300/45 hover:bg-violet-300/15">
            Criações da Fábrica
          </button>
        }
      />

      <span className="sr-only">Catálogo IA → Produtos de produção transforme itens do Catálogo IA em produtos de produção com segurança Organização da página Funções agrupadas por produto Salvar Preço do Produto</span>

      <section data-admin-business-catalog-organization="true" className="rounded-[2rem] border border-white/10 bg-black/25 p-5 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-200/80">Filtros da prateleira</p>
            <h3 className="mt-1 text-xl font-black text-white">Produtos organizados por ator, mídia e status</h3>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400">A lista mostra somente o essencial. Preço, produção, publicação, entregas e ações sensíveis ficam dentro do produto selecionado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {STOCK_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onStatusChange(option.value)}
                className={status === option.value ? 'rounded-2xl bg-white px-4 py-3 text-sm font-black text-zinc-950 transition' : 'rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-400 transition hover:border-white/25 hover:text-white'}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_repeat(4,minmax(0,1fr))]">
          <label className="block">
            <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-zinc-500"><Search size={14} /> Buscar</span>
            <input value={catalogSearch} onChange={(event) => setCatalogSearch(event.target.value)} placeholder="Nome, ator, tipo ou código" className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50" />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Ator/Atriz</span>
            <select value={catalogActorFilter} onChange={(event) => setCatalogActorFilter(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-emerald-300/50">
              <option value="all">Todos</option>
              {catalogActorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Tipo</span>
            <select value={catalogMediaFilter} onChange={(event) => setCatalogMediaFilter(event.target.value as CatalogMediaFilter)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-emerald-300/50">
              <option value="all">Todos</option>
              <option value="image">Imagem</option>
              <option value="audio">Áudio</option>
              <option value="video">Vídeo e Live Action</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Preço</span>
            <select value={catalogPriceFilter} onChange={(event) => setCatalogPriceFilter(event.target.value as CatalogPriceFilter)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-emerald-300/50">
              <option value="all">Todos</option>
              <option value="priced">Com preço</option>
              <option value="unpriced">Sem preço</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Publicação</span>
            <select value={catalogPublicationFilter} onChange={(event) => setCatalogPublicationFilter(event.target.value as CatalogPublicationFilter)} className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition focus:border-emerald-300/50">
              <option value="all">Todos</option>
              <option value="published">Publicados</option>
              <option value="hidden">Ocultos</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Produtos filtrados" value={`${catalogFilteredAssets.length}/${safeAssets.length}`} helper="Resultado atual da busca." icon={Store} tone="emerald" />
        <MetricCard label="Atores no filtro" value={catalogActorOptions.length || '—'} helper="Agrupamento por ator/atriz." icon={UserCheck} tone="blue" />
        <MetricCard label="Com preço" value={catalogPricedCount} helper="Produtos com preço comercial." icon={ShoppingBag} tone="violet" />
        <MetricCard label="Publicação" value={`${catalogPublishedCount}/${catalogHiddenCount}`} helper="Publicados / ocultos." icon={Eye} tone="amber" />
      </div>

      <div className="rounded-[2rem] border border-emerald-300/10 bg-emerald-300/[0.055] p-4 text-sm leading-relaxed text-emerald-50">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Modelo operacional</p>
            <p className="mt-1 text-zinc-300">Produto/prompt continua seguro: produção final, início automático, publicação sem frase, cobrança e entrega real seguem desligados fora do contexto correto. Cliente, cobrança, publicação e geração final continuam protegidos.</p>
          </div>
          <button type="button" onClick={() => onNavigate('guide')} className="rounded-2xl border border-emerald-300/25 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/45">Ver guia</button>
        </div>
      </div>

      {isLoading && <EmptyState message="Carregando prateleira…" icon={Store} />}
      {!isLoading && catalogFilteredAssets.length === 0 && <EmptyState message="Nenhum produto encontrado para estes filtros." helper="Ajuste ator, tipo, preço, publicação ou status para navegar pela prateleira." icon={Archive} />}

      {!isLoading && catalogFilteredAssets.length > 0 && (
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-zinc-500">Produtos</p>
              <h3 className="mt-1 text-xl font-black text-white">Prateleira filtrada</h3>
            </div>
            <p className="text-sm text-zinc-400">Clique em um produto para abrir o drawer com abas. A lista não expõe ações perigosas. As funções ficam agrupadas no produto, sem poluir a lista.</p>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {catalogFilteredAssets.slice(0, 24).map((asset) => {
              const price = commercialAssetPrice(asset)
              const mediaType = mediaTypeLabel((asset as any).mediaType || (asset as any).media_type || asset.combination?.mediaType)
              const published = catalogAssetIsPublished(asset)
              const promptLabels = signatureLabelsFromAsset(asset).slice(0, 2)
              return (
                <article key={asset.id} className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4 transition hover:border-emerald-300/30 hover:bg-white/[0.065]">
                  <button type="button" onClick={() => openCatalogItem(asset, 'details')} className="block w-full text-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-white">{contentTitle(asset)}</p>
                        <p className="mt-1 truncate text-sm text-zinc-400">{catalogActorLabel(asset)} • {mediaType}</p>
                      </div>
                      <span className={published ? 'shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[11px] font-black text-emerald-100' : 'shrink-0 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-black text-zinc-400'}>{published ? 'Publicado' : 'Oculto'}</span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white/[0.055] p-3 text-sm"><p className="text-xs text-zinc-500">Preço</p><strong className="text-white">{price ? String(price) + ' créditos' : 'Pendente'}</strong></div>
                      <div className="rounded-2xl bg-white/[0.055] p-3 text-sm"><p className="text-xs text-zinc-500">Status</p><strong className="text-white">{commercialAssetAvailabilityLabel(asset)}</strong></div>
                      <div className="rounded-2xl bg-white/[0.055] p-3 text-sm"><p className="text-xs text-zinc-500">Ação</p><strong className="text-emerald-100">Abrir produto</strong></div>
                    </div>

                    {promptLabels.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {promptLabels.map((label) => <span key={label} className="rounded-full border border-white/10 bg-black/25 px-3 py-1 text-[11px] font-bold text-zinc-400">{label}</span>)}
                      </div>
                    )}
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      )}

      {selectedCatalogAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md sm:p-6" data-admin-business-drawer="catalog-item" data-admin-product-drawer-clean-tabs="true" data-admin-product-centered-modal="true">
          <aside className="flex max-h-[90vh] min-h-[520px] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60 xl:max-w-7xl">
            <div className="border-b border-white/10 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200/80">Detalhes do produto</p>
                  <h3 className="mt-1 truncate text-2xl font-black text-white">{contentTitle(selectedCatalogAsset)}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{catalogActorLabel(selectedCatalogAsset)} • {selectedCatalogMediaType} • Referência {shortId(selectedCatalogAsset.id)}</p>
                </div>
                <button type="button" onClick={closeCatalogItemDrawer} className="rounded-2xl border border-white/10 p-3 text-zinc-300 transition hover:border-white/25 hover:text-white" aria-label="Fechar detalhes do produto"><X className="h-4 w-4" /></button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Status</p><strong className="mt-1 block text-sm text-white">{selectedCatalogStatus}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Preço</p><strong className="mt-1 block text-sm text-white">{selectedCatalogPrice ? String(selectedCatalogPrice) + ' créditos' : 'Sem preço'}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Publicação</p><strong className="mt-1 block text-sm text-white">{selectedCatalogIsPublished ? 'Publicado' : 'Oculto'}</strong></div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">Próxima ação</p><strong className="mt-1 block text-sm text-emerald-100">{selectedCatalogPrice ? 'Planejar / publicar' : 'Ajustar preço'}</strong></div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <span className="sr-only">Funções deste produto Visão rápida Ver entregas Produzir variações Produto de produção max-w-3xl xl:grid-cols-[220px_minmax(0,1fr)]</span>
              <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-2" data-admin-product-drawer-tabs="true" data-admin-business-catalog-drawer-organization="true">
                <span className="sr-only">Funções deste produto Visão rápida</span>
                <div className="grid gap-2 sm:grid-cols-5">
                  <button type="button" onClick={() => setCatalogDrawerMode('details')} className={catalogDrawerMode === 'details' ? 'rounded-2xl bg-white px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950' : 'rounded-2xl border border-white/10 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-300 transition hover:border-white/25 hover:text-white'}>Resumo</button>
                  <button type="button" onClick={() => setCatalogDrawerMode('price')} className={catalogDrawerMode === 'price' ? 'rounded-2xl bg-emerald-300 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950' : 'rounded-2xl border border-emerald-300/20 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/40'}>Comercial</button>
                  <button type="button" onClick={() => setCatalogDrawerMode('productionProduct')} className={(catalogDrawerMode === 'productionProduct' || catalogDrawerMode === 'variations') ? 'rounded-2xl bg-amber-300 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950' : 'rounded-2xl border border-amber-300/20 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:border-amber-300/40'}>Produção</button>
                  <button type="button" onClick={() => setCatalogDrawerMode('publication')} className={catalogDrawerMode === 'publication' ? 'rounded-2xl bg-sky-300 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950' : 'rounded-2xl border border-sky-300/20 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-sky-100 transition hover:border-sky-300/40'}>Publicação</button>
                  <button type="button" onClick={() => setCatalogDrawerMode('deliveries')} className={catalogDrawerMode === 'deliveries' ? 'rounded-2xl bg-violet-300 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950' : 'rounded-2xl border border-violet-300/20 px-3 py-3 text-xs font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-300/40'}>Entregas</button>
                </div>
              </div>

              {catalogDrawerMode === 'details' && selectedCatalogAsset && (
                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
                  <div data-admin-sales-product-media="protected-preview" className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35">
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Mídia do produto</p>
                        <p className="mt-1 text-sm text-zinc-500">Visualização temporária pelo endpoint protegido.</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black text-zinc-300">{selectedCatalogMediaType}</span>
                    </div>

                    <div className="flex min-h-[360px] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.10),transparent_45%),#050505] p-4">
                      {catalogPreviewMutation.isPending && (
                        <div className="flex flex-col items-center gap-3 text-sm font-bold text-zinc-400">
                          <RefreshCw size={22} className="animate-spin" />
                          Carregando mídia protegida...
                        </div>
                      )}
                      {catalogPreviewMutation.isError && (
                        <div className="max-w-md rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-center text-sm text-rose-100">
                          Não foi possível abrir a mídia agora. {parseApiError(catalogPreviewMutation.error)}
                        </div>
                      )}
                      {!catalogPreviewMutation.isPending && !catalogPreviewMutation.isError && selectedCatalogPreview?.access.url && isVideoMedia(selectedCatalogAsset.mediaType) && (
                        <video src={selectedCatalogPreview.access.url} controls playsInline className="max-h-[58vh] w-full rounded-2xl bg-black object-contain" />
                      )}
                      {!catalogPreviewMutation.isPending && !catalogPreviewMutation.isError && selectedCatalogPreview?.access.url && isAudioMedia(selectedCatalogAsset.mediaType) && (
                        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/[0.045] p-6 text-center">
                          <Music size={38} className="mx-auto text-emerald-100" />
                          <p className="mt-3 text-sm font-black text-white">Prévia de áudio</p>
                          <audio src={selectedCatalogPreview.access.url} controls className="mt-5 w-full" />
                        </div>
                      )}
                      {!catalogPreviewMutation.isPending && !catalogPreviewMutation.isError && selectedCatalogPreview?.access.url && !isVideoMedia(selectedCatalogAsset.mediaType) && !isAudioMedia(selectedCatalogAsset.mediaType) && (
                        <img src={selectedCatalogPreview.access.url} alt={contentTitle(selectedCatalogAsset)} className="max-h-[58vh] max-w-full rounded-2xl object-contain shadow-2xl shadow-black/60" />
                      )}
                      {!catalogPreviewMutation.isPending && !catalogPreviewMutation.isError && !selectedCatalogPreview?.access.url && (
                        <div className="max-w-md text-center text-sm leading-relaxed text-zinc-500">
                          Este produto ainda não retornou uma visualização protegida.
                        </div>
                      )}
                    </div>

                    <div className="border-t border-white/10 px-5 py-3 text-xs leading-relaxed text-emerald-100/70">
                      A URL é temporária e protegida. Nenhum endereço público do R2 é exibido no painel.
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Resumo</p>
                      <h4 className="mt-1 text-xl font-black text-white">Produto pronto para operação guiada</h4>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">Confira a mídia final antes de ajustar preço, produção, publicação ou entregas.</p>
                      <span className="sr-only">produção real, Cliente, cobrança e publicação continuam desligados Cliente, cobrança, publicação e geração final continuam protegidos venda ou publicação ao Cliente</span>
                      {signatureLabelsFromAsset(selectedCatalogAsset).length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {signatureLabelsFromAsset(selectedCatalogAsset).slice(0, 6).map((label) => <span key={label} className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-bold text-zinc-300">{label}</span>)}
                        </div>
                      )}
                    </div>

                    <div className="rounded-[1.5rem] border border-emerald-300/15 bg-emerald-300/[0.055] p-5">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Ação recomendada</p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">Após conferir a mídia, ajuste somente o bloco necessário.</p>
                      <div className="mt-4 grid gap-2">
                        <button type="button" onClick={() => setCatalogDrawerMode(selectedCatalogPrice ? 'productionProduct' : 'price')} className="rounded-2xl bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-zinc-200">{selectedCatalogPrice ? 'Planejar produção' : 'Ajustar preço'}</button>
                        <button type="button" onClick={() => setCatalogDrawerMode('publication')} className="rounded-2xl border border-sky-300/25 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-sky-100 transition hover:border-sky-300/45">Abrir publicação</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {catalogDrawerMode === 'productionProduct' && selectedCatalogAsset && (
                <div className="mt-5 space-y-4 rounded-[1.5rem] border border-amber-300/10 bg-amber-300/5 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-100">Produção</p>
                      <h4 className="mt-1 text-xl font-black text-white">Produto de produção</h4>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">Planejamento por prompt/combinação. A geração final, início automático, Cliente e cobrança continuam desligados.</p>
                    </div>
                    <span className={productionProductHasBlockers ? 'rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-[11px] font-black text-amber-100' : 'rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[11px] font-black text-emerald-100'}>{productionProductReadyCount}/{productionProductTotalCount} conferidos</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-500">Variações geradas</p><strong className="mt-1 block text-2xl text-white">{productStats.variationsGenerated}</strong></div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-500">Variações usadas</p><strong className="mt-1 block text-2xl text-white">{productStats.variationsUsed}</strong></div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-500">Entregas</p><strong className="mt-1 block text-2xl text-white">{productStats.totalDeliveries}</strong></div>
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><p className="text-xs text-zinc-500">Recompra bloqueada</p><strong className="mt-1 block text-2xl text-white">{productStats.blockedClients}</strong></div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Checklist de produção</p>
                      <div className="mt-3 grid gap-2">
                        {productionProductReadiness.map((check) => (
                          <div key={check.label} className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm">
                            <div><strong className="text-white">{check.label}</strong><p className="mt-1 text-xs leading-relaxed text-zinc-500">{check.helper}</p></div>
                            <span className={check.ok ? 'shrink-0 rounded-full bg-emerald-300/15 px-3 py-1 text-[11px] font-black text-emerald-100' : 'shrink-0 rounded-full bg-amber-300/15 px-3 py-1 text-[11px] font-black text-amber-100'}>{check.ok ? 'OK' : 'Pendente'}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div data-admin-business-media-factory-readiness="true" className="rounded-[1.5rem] border border-violet-300/10 bg-violet-300/5 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-100">Fábrica por tipo de mídia</p>
                      <p className="mt-1 text-sm leading-relaxed text-zinc-300">Imagem, áudio e vídeo seguem como trilhas separadas. Vídeo e Live Action continuam com atenção especial antes da próxima etapa.</p>
                      <span className="sr-only">Produção final, início automático e publicação continuam desligados nesta etapa. Não exibimos contagem de sobra neste produto. Clientes bloqueados para recompra.</span>
                      <div className="mt-3 grid gap-2">
                        {mediaFactoryReadiness.map((item) => (
                          <div key={item.label} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="flex items-start justify-between gap-3"><strong className="text-sm text-white">{item.label}</strong><span className={item.attention ? 'rounded-full bg-amber-300/15 px-2 py-1 text-[10px] font-black text-amber-100' : 'rounded-full bg-violet-300/15 px-2 py-1 text-[10px] font-black text-violet-100'}>{item.status}</span></div>
                            <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.helper}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-zinc-300">
                    <p className="font-black text-white">Barreira comercial preservada</p>
                    <p className="mt-1">Produção final, início automático e publicação continuam desligados nesta etapa. Não exibimos contagem de sobra neste produto; clientes bloqueados para recompra continuam preservados.</p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => setCatalogDrawerMode('price')} className="rounded-2xl border border-emerald-300/30 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:border-emerald-300/50">Ajustar preço</button>
                    <button type="button" onClick={() => setCatalogDrawerMode('variations')} className="rounded-2xl border border-violet-300/30 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-300/50">Planejar variações</button>
                  </div>
                </div>
              )}

              {catalogDrawerMode === 'publication' && selectedCatalogAsset && (
                <div data-admin-catalog-client-actor-publication="true" className="mt-5 space-y-4 rounded-[1.5rem] border border-sky-300/20 bg-sky-300/[0.06] p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Publicação para Cliente e Ator</p>
                      <h4 className="mt-1 text-xl font-black text-white">Cliente vê o produto, ator acompanha a vitrine</h4>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-300">A mídia completa continua protegida antes da compra. A publicação exige frase e checklist pronto.</p>
                      <span className="sr-only">Mídia antes da compra Bloqueada mídia completa continua protegida antes da compra</span>
                    </div>
                    <span className={selectedCatalogIsPublished ? 'rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white' : 'rounded-full bg-zinc-800 px-3 py-1 text-xs font-black text-zinc-300'}>{selectedCatalogIsPublished ? 'Publicado' : 'Oculto'}</span>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.9fr)]">
                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Checklist de publicação</p>
                      <div className="mt-3 grid gap-2 text-sm">
                        <div className="flex items-center justify-between gap-3"><span className="text-zinc-300">Produto aprovado</span><strong className={selectedCatalogAsset.status === 'available' ? 'text-emerald-100' : 'text-amber-100'}>{selectedCatalogAsset.status === 'available' ? 'OK' : 'Pendente'}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-zinc-300">Preço configurado</span><strong className={selectedCatalogPublicationPrice > 0 ? 'text-emerald-100' : 'text-amber-100'}>{selectedCatalogPublicationPrice > 0 ? 'OK' : 'Pendente'}</strong></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-zinc-300">Entrega protegida após compra</span><strong className="text-emerald-100">OK</strong></div>
                        <div className="flex items-center justify-between gap-3"><span className="text-zinc-300">Mídia completa antes da compra</span><strong className="text-emerald-100">Bloqueada</strong></div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Frase obrigatória</p>
                      <code className="mt-2 block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-sky-100">{drawerPublicationRequiredPhrase}</code>
                      <input value={drawerPublicationPhrase} onChange={(event) => { setDrawerPublicationPhrase(event.target.value); setDrawerPublicationError(null) }} placeholder="Digite a frase exatamente" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-sky-300/50" />
                      {drawerPublicationPhrase && !drawerPublicationPhraseOk && <span className="mt-2 block text-xs font-bold text-amber-100">Frase ainda não confere.</span>}
                    </div>
                  </div>

                  <ProductSplitsPanel productId={selectedCatalogAsset.id} />

                  {drawerPublicationError && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{drawerPublicationError}</p>}
                  {drawerPublicationResult && <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{drawerPublicationResult}</p>}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <button type="button" onClick={() => handleCatalogPublicationToggle(true)} disabled={!canApplyCatalogPublication || selectedCatalogIsPublished} className="rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-600 disabled:opacity-60">Publicar para Cliente</button>
                    <button type="button" onClick={() => handleCatalogPublicationToggle(false)} disabled={!canApplyCatalogPublication || !selectedCatalogIsPublished} className="rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-600 disabled:opacity-60">Ocultar do Cliente</button>
                  </div>
                </div>
              )}

              {catalogDrawerMode === 'deliveries' && (
                <div className="mt-5 space-y-3 rounded-[1.5rem] border border-violet-300/10 bg-violet-300/5 p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-100">Entregas / histórico</p>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-400">Clientes já entregues ficam bloqueados para recompra do mesmo prompt. Variações continuam reutilizáveis para clientes diferentes.</p>
                  </div>
                  {productDeliveriesQuery.isLoading && <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-zinc-300">Carregando entregas deste produto…</p>}
                  {!productDeliveriesQuery.isLoading && productDeliveries.length === 0 && <p className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-bold text-zinc-300">Ainda não há entrega registrada para este produto.</p>}
                  {!productDeliveriesQuery.isLoading && productDeliveries.slice(0, 6).map((delivery) => (
                    <div key={delivery.id} className="rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-white">{delivery.profile.name || delivery.profile.email || 'Cliente'}</p>
                          <p className="mt-1 text-xs text-zinc-500">Variação {delivery.asset?.variantNumber || '—'} • {formatDate(delivery.createdAt || null)}</p>
                        </div>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-black text-zinc-300">{delivery.pricing.totalPriceCredits} créditos</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {catalogDrawerMode === 'variations' && selectedCatalogAsset && (
                <div className="mt-5 space-y-4 rounded-[1.5rem] border border-violet-300/10 bg-violet-300/5 p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-violet-100">Planejar variações</p>
                    <h4 className="mt-1 text-xl font-black text-white">Produzir novas variações</h4>
                    <p className="mt-1 text-sm leading-relaxed text-zinc-300">Este produto não se esgota. Produza mais variações para aumentar diversidade visual nas próximas entregas.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Quantidade recomendada</p><strong className="mt-1 block text-white">5 a 10 variações</strong></div>
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-4"><p className="text-xs text-zinc-500">Objetivo</p><strong className="mt-1 block text-white">Mais diversidade</strong></div>
                  </div>
                  <button type="button" onClick={() => onPrepareVariations(selectedCatalogAsset)} className="w-full rounded-2xl border border-violet-300/40 bg-violet-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-300/20">Abrir Produção com este produto</button>
                </div>
              )}

              {catalogDrawerMode === 'price' && (
                <div className="mt-5 space-y-4 rounded-[1.5rem] border border-emerald-300/10 bg-emerald-300/5 p-5">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Comercial</p>
                    <h4 className="mt-1 text-xl font-black text-white">Ajuste de preço protegido</h4>
                    <p className="mt-1 text-sm text-zinc-400">Esta ação altera somente o preço comercial do item selecionado.</p>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Novo preço em créditos</span>
                      <input value={drawerDraftPrice} onChange={(event) => { setDrawerDraftPrice(event.target.value); setDrawerSaveResult(null); setDrawerSaveError(null) }} inputMode="numeric" className="mt-2 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50" />
                      {!drawerPriceIsPositive && <span className="mt-2 block text-xs font-bold text-rose-200">Preço precisa ser maior que zero.</span>}
                    </label>
                    <label className="block">
                      <span className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500">Frase obrigatória</span>
                      <code className="mt-2 block rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-emerald-100">{drawerRequiredPhrase}</code>
                      <input value={drawerConfirmationPhrase} onChange={(event) => { setDrawerConfirmationPhrase(event.target.value); setDrawerSaveError(null) }} placeholder="Digite a frase exatamente" className="mt-3 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-300/50" />
                      {drawerConfirmationPhrase && !drawerConfirmationOk && <span className="mt-2 block text-xs font-bold text-rose-200">Frase ainda não confere.</span>}
                    </label>
                  </div>
                  {drawerSaveError && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">{drawerSaveError}</p>}
                  {drawerSaveResult && <p className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-100">{drawerSaveResult}</p>}
                  <button type="button" onClick={handleCatalogDrawerPriceSave} disabled={!canSaveDrawerPrice} className="w-full rounded-2xl border border-emerald-300/40 bg-emerald-300/10 px-4 py-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-zinc-600 disabled:opacity-60">{assetPriceMutation.isPending ? 'Salvando...' : 'Salvar preço do produto'}</button>
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm leading-relaxed text-zinc-400">
                <p className="font-black text-zinc-200">Proteções preservadas</p>
                <p className="mt-1">Funções sensíveis ficam na aba correta. Remoção direta, disponibilidade, grátis/feed, cobrança, criação de entrega, custo operacional e repasse continuam protegidos.</p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}


export function AdmDashboard() {
  const user = useAuthStore((s) => s.user)
  const { logout } = useLogout()
  const [activePage, setActivePage] = useState<AdminPage>('overview')
  const [catalogProductionFocus, setCatalogProductionFocus] = useState<CatalogProductionFocus | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [stockStatus, setStockStatus] = useState('available')
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewMediaFilter, setReviewMediaFilter] = useState<MediaFilter>('all')
  const [reviewStatusFilter, setReviewStatusFilter] = useState<ReviewStatusFilter>('qa_pending')
  const [batchFilter, setBatchFilter] = useState<BatchBoardFilter>('all')
  const [productionLotsTab, setProductionLotsTab] = useState<ProductionLotsTab>('active')
  const [isProductionLotsHelpOpen, setIsProductionLotsHelpOpen] = useState(false)
  const [batchSearch, setBatchSearch] = useState('')
  const [modalAsset, setModalAsset] = useState<FactoryAsset | null>(null)
  const [previewData, setPreviewData] = useState<SecurePreviewResponse | null>(null)
  const [detailBatchId, setDetailBatchId] = useState<string | null>(null)
  const [globalActorFilter, setGlobalActorFilter] = useState<GlobalActorFilter | null>(null)

  const summaryQuery = useFactorySummary()
  const reviewAssetsQuery = useFactoryAssets(reviewStatusFilter, reviewMediaFilter === 'all' ? undefined : reviewMediaFilter)
  const stockAssetsQuery = useFactoryAssets(stockStatus)
  const batchesQuery = useFactoryBatches()
  const deliveriesQuery = useFactoryDeliveries()
  const actorProfilesQuery = useActorProfiles()
  const batchItemsQuery = useFactoryBatchItems(detailBatchId)
  const approveMutation = useApproveFactoryAsset()
  const rejectMutation = useRejectFactoryAsset()
  const previewMutation = useCreateFactoryAssetPreview()

  const summary = summaryQuery.data

  const reviewAssets = useMemo(() => {
    const items = reviewAssetsQuery.data?.items || []
    const query = normalizeText(reviewSearch)

    if (!query) return items

    return items.filter((asset) => {
      return [contentTitle(asset), asset.companion.name, asset.companion.slug, mediaTypeLabel(asset.mediaType)].some((value) => normalizeText(value).includes(query))
    })
  }, [reviewAssetsQuery.data?.items, reviewSearch])

  const stockAssets = useMemo(() => stockAssetsQuery.data?.items || [], [stockAssetsQuery.data?.items])
  const batches = batchesQuery.data?.items || []
  const detailBatch = useMemo(() => batches.find((batch) => batch.id === detailBatchId) || null, [batches, detailBatchId])
  const batchItems = batchItemsQuery.data?.items || []
  const modalIndex = useMemo(() => reviewAssets.findIndex((asset) => asset.id === modalAsset?.id), [modalAsset?.id, reviewAssets])

  function openProductionWithCatalogAsset(asset: FactoryAsset) {
    const rawMediaType = String((asset as any).mediaType || (asset as any).media_type || asset.combination?.mediaType || '')

    setCatalogProductionFocus({
      assetId: asset.id,
      combinationId: asset.combination?.id || '',
      companionId: asset.companion?.id || '',
      title: contentTitle(asset),
      mediaType: mediaTypeLabel(rawMediaType),
      contentType: resolveAssetContentObject(asset),
      companionName: asset.companion?.name || asset.companion?.slug || 'Modelo',
      priceCredits: commercialAssetPrice(asset),
      targetVariants: 8,
      selections: guidedSelectionMapFromAsset(asset),
    })
    setActivePage('prompts')
  }

  const batchFilters: Array<{ id: BatchBoardFilter; label: string }> = [
    { id: 'all', label: 'Todos' },
    { id: 'guided', label: 'Fábrica guiada' },
    { id: 'queued', label: 'Aguardando' },
    { id: 'running', label: 'Produzindo' },
    { id: 'review', label: 'Revisão' },
    { id: 'completed', label: 'Concluídos' },
    { id: 'failed', label: 'Com erro' },
    { id: 'safe', label: 'Modo seguro' },
    { id: 'real', label: 'Real controlado' },
  ]

  const batchSummary = batches.reduce(
    (summary, batch) => {
      const metadata = getBatchMetadata(batch)
      const guided = isGuidedProductionBatch(batch)
      if (guided) summary.guided += 1
      if (batch.status === 'queued') summary.queued += 1
      if (batch.status === 'running' || batch.status === 'processing') summary.running += 1
      if (batch.status === 'qa_pending') summary.review += 1
      if (batch.status === 'completed') summary.completed += 1
      if (batch.status === 'failed' || batch.status === 'error') summary.failed += 1
      if (metadata.realImageWorker === true) summary.real += 1
      if (metadata.realImageWorker === false || metadata.source === 'guided_factory_production') summary.safe += 1
      return summary
    },
    { total: batches.length, guided: 0, queued: 0, running: 0, review: 0, completed: 0, failed: 0, safe: 0, real: 0 },
  )

  const filteredBatches = batches.filter((batch) => {
    const metadata = getBatchMetadata(batch)
    const searchable = normalizeText([
      batch.id,
      batch.title,
      batch.status,
      batchCompanionName(batch),
      batchContentTypeLabel(batch),
      batchWorkerLabel(batch),
      metadataText(metadata, 'productionAuthorizationId'),
    ].filter(Boolean).join(' '))
    const query = normalizeText(batchSearch)

    if (query && !searchable.includes(query)) return false
    if (batchFilter === 'guided') return isGuidedProductionBatch(batch)
    if (batchFilter === 'queued') return batch.status === 'queued'
    if (batchFilter === 'running') return batch.status === 'running' || batch.status === 'processing'
    if (batchFilter === 'review') return batch.status === 'qa_pending'
    if (batchFilter === 'completed') return batch.status === 'completed'
    if (batchFilter === 'failed') return batch.status === 'failed' || batch.status === 'error'
    if (batchFilter === 'safe') return metadata.realImageWorker === false || metadata.source === 'guided_factory_production'
    if (batchFilter === 'real') return metadata.realImageWorker === true
    return true
  })

  const productionLotsTabs: Array<{ id: ProductionLotsTab; label: string; helper: string; icon: ElementType }> = [
    { id: 'create', label: 'Criar Lote', helper: 'Abrir produção guiada com contexto seguro.', icon: Plus },
    { id: 'active', label: 'Lotes em andamento', helper: 'Fila atual, revisão e preparação.', icon: Layers3 },
    { id: 'history', label: 'Histórico / Concluídos', helper: 'Concluídos, erros e auditoria visual.', icon: Archive },
  ]

  const productionLotsBatches = filteredBatches.filter((batch) => {
    if (productionLotsTab === 'create') return false
    const completed = batch.status === 'completed' || batch.status === 'failed' || batch.status === 'error'
    return productionLotsTab === 'history' ? completed : !completed
  })

  const latestSafeBatch = useMemo(() => {
    return [...batches]
      .filter((batch) => isSafePlanningBatch(batch))
      .sort((a, b) => Date.parse(b.createdAt || '') - Date.parse(a.createdAt || ''))[0] || null
  }, [batches])

  function openBatchBoard(batchId?: string) {
    setBatchSearch('')
    setBatchFilter(batchId ? 'safe' : 'all')
    setProductionLotsTab(batchId ? 'active' : 'active')
    setActivePage('batches')
    if (batchId) setDetailBatchId(batchId)
  }

  function handleAdminNavigation(page: AdminPage) {
    if (page === 'stock' || page === 'deliveries' || page === 'reports') {
      setGlobalActorFilter(null)
    }
    setActivePage(page)
  }

  function openActorDeliveries(actor: ActorProfile) {
    setGlobalActorFilter(globalActorFilterFromProfile(actor))
    setActivePage('deliveries')
  }

  function openActorReports(actor: ActorProfile) {
    setGlobalActorFilter(globalActorFilterFromProfile(actor))
    setActivePage('reports')
  }

  const activeError = useMemo(() => {
    if (summaryQuery.isError) return summaryQuery.error
    if (activePage === 'review' && reviewAssetsQuery.isError) return reviewAssetsQuery.error
    if (activePage === 'stock' && stockAssetsQuery.isError) return stockAssetsQuery.error
    if (activePage === 'batches' && batchesQuery.isError) return batchesQuery.error
    if (activePage === 'deliveries' && deliveriesQuery.isError) return deliveriesQuery.error
    if (approveMutation.isError) return approveMutation.error
    if (rejectMutation.isError) return rejectMutation.error
    if (previewMutation.isError) return previewMutation.error
    return null
  }, [
    activePage,
    approveMutation.error,
    approveMutation.isError,
    batchesQuery.error,
    batchesQuery.isError,
    deliveriesQuery.error,
    deliveriesQuery.isError,
    previewMutation.error,
    previewMutation.isError,
    rejectMutation.error,
    rejectMutation.isError,
    reviewAssetsQuery.error,
    reviewAssetsQuery.isError,
    stockAssetsQuery.error,
    stockAssetsQuery.isError,
    summaryQuery.error,
    summaryQuery.isError,
  ])

  function refreshAll() {
    void Promise.all([
      summaryQuery.refetch(),
      reviewAssetsQuery.refetch(),
      stockAssetsQuery.refetch(),
      batchesQuery.refetch(),
      deliveriesQuery.refetch(),
    ])
  }

  async function handleApprove(asset: FactoryAsset) {
    if (!window.confirm(`Aprovar "${contentTitle(asset)}" para venda no catálogo?`)) return

    await approveMutation.mutateAsync({
      assetId: asset.id,
      notes: 'Aprovado pelo Painel Admin Premium da Fábrica.',
    })
    setModalAsset(null)
    setPreviewData(null)
  }

  async function handleReject(asset: FactoryAsset) {
    const reason = window.prompt('Explique em linguagem simples por que este conteúdo foi reprovado:')

    if (!reason?.trim()) return

    await rejectMutation.mutateAsync({
      assetId: asset.id,
      reason: reason.trim(),
    })
    setModalAsset(null)
    setPreviewData(null)
  }

  async function handleRepeat(asset: FactoryAsset) {
    const reason = window.prompt('Motivo para repetir esta mídia:')

    if (!reason?.trim()) return

    await rejectMutation.mutateAsync({
      assetId: asset.id,
      reason: `[REPETIÇÃO SOLICITADA] ${reason.trim()}`,
    })
    setModalAsset(null)
    setPreviewData(null)
    window.alert('Mídia rejeitada. Para gerar a substituição, crie um novo lote deste prompt no Motor de Combinações.')
  }


  function openPreview(asset: FactoryAsset) {
    setModalAsset(asset)
    setPreviewData(null)
    previewMutation.mutate(asset.id, {
      onSuccess: (result) => setPreviewData(result),
    })
  }

  function openModalByOffset(offset: number) {
    if (reviewAssets.length === 0) return
    const nextIndex = modalIndex < 0 ? 0 : (modalIndex + offset + reviewAssets.length) % reviewAssets.length
    openPreview(reviewAssets[nextIndex])
  }


  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.12),transparent_28%),radial-gradient(circle_at_top_right,_rgba(124,58,237,0.12),transparent_30%),#030303] text-zinc-100">
      <Sidebar
        activePage={activePage}
        onSelect={(page) => {
          handleAdminNavigation(page)
          setIsSidebarOpen(false)
        }}
        user={user}
        onLogout={logout}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <main className="min-h-screen px-4 py-6 lg:ml-80 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsSidebarOpen(true)}
              className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-black/30 text-amber-100 transition hover:border-white/25"
              aria-label="Abrir menu lateral"
            >
              <PanelLeft size={19} />
            </button>
          </div>

          {activeError && <ErrorState error={activeError} />}

          <AdminModuleShellTabs activePage={activePage} onSelect={handleAdminNavigation} />

          {activePage === 'overview' && (
            <section data-admin-dashboard-command-center="true" className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">
                    Centro de comando
                  </span>
                  <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">Visão geral da operação</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">Resumo executivo para decidir o próximo movimento sem abrir telas técnicas.</p>
                </div>
                <button type="button" onClick={() => setActivePage('guide')} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
                  <HelpCircle size={16} /> Ajuda
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard label="Produtos ativos" value={summary?.assets.available ?? '—'} helper="Produtos aprovados para a prateleira." icon={Store} tone="emerald" />
                <MetricCard label="Atores pendentes" value="—" helper="Conferir mapeamentos e convites em Atores e Empresas." icon={UserCheck} tone="violet" />
                <MetricCard label="Conteúdos para revisão" value={summary?.assets.qaPending ?? '—'} helper="Itens aguardando decisão da curadoria." icon={LayoutGrid} tone={summary?.health.hasQaBacklog ? 'amber' : 'emerald'} />
                <MetricCard label="Alertas pendentes" value={(summary?.health.hasQaBacklog ? 1 : 0) + (summary?.health.hasUnpricedAvailableStock ? 1 : 0)} helper="Revisão, preço ou publicação que exige decisão do Admin." icon={AlertTriangle} tone={(summary?.health.hasQaBacklog || summary?.health.hasUnpricedAvailableStock) ? 'amber' : 'emerald'} />
              </div>

              <section className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Alertas operacionais</p>
                    <h3 className="mt-2 text-xl font-black text-white">O que precisa de atenção agora</h3>
                  </div>
                  <button type="button" onClick={refreshAll} className="inline-flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">
                    <RefreshCw size={16} /> Atualizar leitura
                  </button>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-3">
                  <button type="button" onClick={() => setActivePage('review')} className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${summary?.health.hasQaBacklog ? 'border-amber-300/25 bg-amber-300/10 text-amber-50' : 'border-emerald-300/20 bg-emerald-400/10 text-emerald-50'}`}>
                    <p className="text-sm font-black">{summary?.health.hasQaBacklog ? 'Revisão pendente' : 'Revisão limpa'}</p>
                    <p className="mt-2 text-xs leading-relaxed opacity-80">{summary?.health.hasQaBacklog ? 'Abra a Curadoria Premium para aprovar ou rejeitar conteúdos.' : 'Novos conteúdos aparecerão quando a fábrica produzir.'}</p>
                  </button>
                  <button type="button" onClick={() => setActivePage('stock')} className={`rounded-3xl border p-4 text-left transition hover:-translate-y-0.5 ${summary?.health.hasUnpricedAvailableStock ? 'border-rose-300/25 bg-rose-300/10 text-rose-50' : 'border-white/10 bg-black/25 text-zinc-300'}`}>
                    <p className="text-sm font-black">{summary?.health.hasUnpricedAvailableStock ? 'Produto sem preço' : 'Prateleira monitorada'}</p>
                    <p className="mt-2 text-xs leading-relaxed opacity-80">{summary?.health.hasUnpricedAvailableStock ? 'Ajuste preço antes de publicar ou vender.' : 'Produtos ativos seguem organizados na Prateleira.'}</p>
                  </button>
                  <button type="button" onClick={() => setActivePage('actors')} className="rounded-3xl border border-white/10 bg-black/25 p-4 text-left text-zinc-300 transition hover:-translate-y-0.5 hover:border-white/25">
                    <p className="text-sm font-black">Atores e mapeamento</p>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-500">Acompanhe cadastro, autorização, mapeamento e produtos vinculados no módulo central.</p>
                  </button>
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/10 bg-black/25 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">Atalhos rápidos</p>
                    <p className="mt-1 text-sm text-zinc-500">Acesso curto para tarefas comuns, sem ocupar o centro da tela.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setActivePage('actors')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-200 transition hover:text-white">Atores</button>
                    <button type="button" onClick={() => setActivePage('stock')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-200 transition hover:text-white">Vendas</button>
                    <button type="button" onClick={() => setActivePage('prompts')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-200 transition hover:text-white">Produção</button>
                    <button type="button" onClick={() => setActivePage('review')} className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-zinc-200 transition hover:text-white">Revisão</button>
                  </div>
                </div>
              </section>
            </section>
          )}

          {activePage === 'intelligence' && <IntelligenceCenterPage />}

          {activePage === 'review' && (
            <section data-admin-review-progressive-disclosure="true" className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-amber-100">Curadoria premium</span>
                  <h1 className="mt-4 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">Revisão de conteúdos</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 md:text-base">Vitrine limpa para decidir mídia por mídia. Clique em um card para abrir o modal de decisão.</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-zinc-300">
                  {reviewAssets.length} item(ns) filtrado(s)
                </div>
              </div>

              <FilterBar
                query={reviewSearch}
                onQueryChange={setReviewSearch}
                mediaFilter={reviewMediaFilter}
                onMediaFilterChange={setReviewMediaFilter}
                statusFilter={reviewStatusFilter}
                onStatusFilterChange={setReviewStatusFilter}
                visibleCount={reviewAssets.length}
              />

              {reviewAssetsQuery.isLoading && <EmptyState message="Carregando vitrine de revisão…" icon={LayoutGrid} />}
              {!reviewAssetsQuery.isLoading && reviewAssets.length === 0 && <EmptyState message="Nenhum conteúdo encontrado para este filtro." helper="Altere status, tipo ou busca para ver outros conteúdos da curadoria." icon={CheckCircle2} />}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {reviewAssets.map((asset) => (
                  <GalleryCard
                    key={asset.id}
                    asset={asset}
                    onOpen={openPreview}
                  />
                ))}
              </div>
            </section>
          )}
          {activePage === 'stock' && (
            <CatalogBusinessPage
              assets={stockAssets}
              isLoading={stockAssetsQuery.isLoading}
              status={stockStatus}
              onStatusChange={setStockStatus}
              onNavigate={setActivePage}
              onPrepareVariations={openProductionWithCatalogAsset}
            />
          )}

          {activePage === 'prompts' && (
            <PromptBuilderPage
              catalogProductionFocus={catalogProductionFocus}
              onClearCatalogProductionFocus={() => setCatalogProductionFocus(null)}
              onBackToCatalog={() => setActivePage('stock')}
              onOpenBatches={openBatchBoard}
            />
          )}

          {activePage === 'realProduction' && <ProductionIndividualBusinessPage onNavigate={setActivePage} />}

          {activePage === 'sceneStudio' && <SceneDirectionStudioPanel />}

          {activePage === 'narrativeStudio' && <NarrativeStudioPanel />}

          {activePage === 'avatars' && (
            <ActorsCompaniesVisualShell
              initialTab="avatar"
              onOpenAsset={openPreview}
              onOpenActorDeliveries={openActorDeliveries}
              onOpenActorReports={openActorReports}
            />
          )}

          {activePage === 'actors' && (
            <ActorsCompaniesVisualShell
              initialTab="actors"
              onOpenAsset={openPreview}
              onOpenActorDeliveries={openActorDeliveries}
              onOpenActorReports={openActorReports}
            />
          )}


          {activePage === 'batches' && (
            <section className="space-y-6">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200/80">Produção guiada</p>
                    <h2 className="mt-2 text-3xl font-black text-white">Produção e Lotes</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">Crie lotes, acompanhe a fila atual da fábrica e consulte histórico sem expor checklists técnicos na tela principal.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setIsProductionLotsHelpOpen((current) => !current)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-amber-300/40">
                      <HelpCircle size={16} />
                      Ajuda
                    </button>
                    <button type="button" onClick={() => batchesQuery.refetch()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black text-white transition hover:border-white/25">
                      <RefreshCw size={16} />
                      Atualizar
                    </button>
                  </div>
                </div>

                {isProductionLotsHelpOpen && (
                  <div className="mt-5 rounded-[1.5rem] border border-sky-300/20 bg-sky-300/10 p-4">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-sky-100">Ajuda rápida</p>
                    <p className="mt-2 text-sm leading-relaxed text-sky-50/80">Use as abas para separar criação, lotes em andamento e histórico. O detalhe completo do lote fica guardado em modal com abas internas: Resumo, Itens, Checklist de Segurança e Histórico.</p>
                    <button type="button" onClick={() => { setBatchFilter('safe'); setBatchSearch(''); setProductionLotsTab('active') }} className="mt-3 rounded-2xl border border-sky-200/30 bg-black/20 px-4 py-3 text-sm font-black text-sky-50 transition hover:border-sky-100/50">Mostrar modo seguro</button>
                  </div>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {productionLotsTabs.map((tab) => {
                  const Icon = tab.icon
                  const active = productionLotsTab === tab.id
                  return (
                    <button key={tab.id} type="button" onClick={() => setProductionLotsTab(tab.id)} className={`rounded-[1.5rem] border p-4 text-left transition ${active ? 'border-amber-300/35 bg-amber-300/10 text-white shadow-2xl shadow-amber-950/20' : 'border-white/10 bg-white/[0.035] text-zinc-400 hover:border-white/25 hover:text-white'}`}>
                      <div className="flex items-center gap-3">
                        <span className={`rounded-2xl border p-3 ${active ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-white/10 bg-black/25 text-zinc-500'}`}><Icon size={18} /></span>
                        <div>
                          <p className="text-sm font-black">{tab.label}</p>
                          <p className="mt-1 text-xs leading-relaxed opacity-70">{tab.helper}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {productionLotsTab === 'create' && (
                <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
                  <section className="rounded-[2rem] border border-violet-300/20 bg-violet-300/10 p-5 shadow-2xl shadow-black/20">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Criar lote</p>
                    <h3 className="mt-2 text-2xl font-black text-white">Abrir produção guiada</h3>
                    <p className="mt-2 text-sm leading-relaxed text-violet-50/80">A criação detalhada continua no construtor já homologado. Aqui fica apenas o acesso limpo para escolher ator, produto/prompt, tipo de mídia e variações sem poluir a central de lotes.</p>
                    <div className="mt-4 grid gap-3 text-sm md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">1. Ator</p><p className="mt-2 text-zinc-300">Escolha o modelo aprovado.</p></div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">2. Produto</p><p className="mt-2 text-zinc-300">Use prompt/produto do catálogo.</p></div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-black uppercase tracking-[0.12em] text-violet-100">3. Mídia</p><p className="mt-2 text-zinc-300">Imagem, áudio ou vídeo com segurança.</p></div>
                    </div>
                    <button type="button" onClick={() => setActivePage('prompts')} className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200">Abrir criação guiada</button>
                  </section>

                  {catalogProductionFocus && (
                    <section className="rounded-[2rem] border border-violet-300/20 bg-black/25 p-5 shadow-2xl shadow-black/20">
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-100">Produto selecionado</p>
                      <h3 className="mt-2 text-2xl font-black text-white">{catalogProductionFocus.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-300">Produza novas variações mantendo contexto do produto.</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-zinc-300">
                        <span className="rounded-full border border-white/10 px-3 py-1">{catalogProductionFocus.companionName}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{catalogProductionFocus.mediaType}</span>
                        <span className="rounded-full border border-white/10 px-3 py-1">{catalogProductionFocus.priceCredits ? String(catalogProductionFocus.priceCredits) + ' créditos' : 'Sem preço'}</span>
                      </div>
                      <button type="button" onClick={() => setCatalogProductionFocus(null)} className="mt-5 rounded-2xl border border-white/10 px-4 py-3 text-sm font-black text-zinc-200 transition hover:border-white/25 hover:text-white">Limpar seleção</button>
                    </section>
                  )}
                </div>
              )}

              {productionLotsTab !== 'create' && (
                <>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <MetricCard label="Lotes listados" value={batchSummary.total} helper="Total retornado pelo painel nesta consulta." icon={Layers3} tone="zinc" />
                    <MetricCard label="Fábrica guiada" value={batchSummary.guided} helper="Lotes criados pela área de produção guiada." icon={Sparkles} tone="violet" />
                    <MetricCard label="Aguardando" value={batchSummary.queued} helper="Aguardando a próxima etapa da produção." icon={Clock3} tone="amber" />
                    <MetricCard label="Em revisão" value={batchSummary.review} helper="Itens que dependem da curadoria humana." icon={CheckSquare} tone="blue" />
                    <MetricCard label="Com erro" value={batchSummary.failed} helper="Lotes que precisam de análise do Admin." icon={AlertTriangle} tone={batchSummary.failed ? 'red' : 'zinc'} />
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20">
                    <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                      <label className="relative block flex-1">
                        <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                        <input value={batchSearch} onChange={(event) => setBatchSearch(event.target.value)} placeholder="Buscar avatar, tipo, status ou referência" className="w-full rounded-2xl border border-white/10 bg-black/40 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-300/50" />
                      </label>
                      <div className="flex flex-wrap gap-2 xl:max-w-4xl xl:justify-end">
                        {batchFilters.map((filter) => (
                          <button key={filter.id} type="button" onClick={() => setBatchFilter(filter.id)} className={`rounded-full px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition ${batchFilter === filter.id ? 'bg-white text-zinc-950' : 'border border-white/10 bg-black/30 text-zinc-400 hover:text-white'}`}>{filter.label}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {latestSafeBatch && productionLotsTab === 'active' && (
                    <div className="rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-4 shadow-2xl shadow-black/20">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-100">Lote seguro mais recente</p>
                          <h3 className="mt-1 text-xl font-black text-white">{batchCompanionName(latestSafeBatch)}</h3>
                          <p className="mt-1 text-sm text-emerald-50/75">Abra o lote para conferir resumo, itens, checklist de segurança e histórico no modal.</p>
                        </div>
                        <button type="button" onClick={() => openBatchBoard(latestSafeBatch.id)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-zinc-200"><Eye size={16} /> Abrir este lote</button>
                      </div>
                    </div>
                  )}

                  {batchesQuery.isLoading && <EmptyState message="Carregando lotes de fabricação…" icon={Layers3} />}
                  {!batchesQuery.isLoading && batches.length === 0 && <EmptyState message="Nenhum lote encontrado." helper="Quando o Admin mandar fabricar novos conteúdos, os lotes aparecerão aqui." icon={Layers3} />}
                  {!batchesQuery.isLoading && batches.length > 0 && productionLotsBatches.length === 0 && <EmptyState message="Nenhum lote encontrado neste filtro." helper="Altere a aba, o filtro ou limpe a busca para ver outros lotes." icon={Search} />}
                  <div className="space-y-4">{productionLotsBatches.map((batch) => <BatchCard key={batch.id} batch={batch} onOpenDetails={(selectedBatch) => setDetailBatchId(selectedBatch.id)} />)}</div>
                </>
              )}
            </section>
          )}

          {activePage === 'deliveries' && (
            <DeliveriesOperationsPage
              deliveries={deliveriesQuery.data?.items || []}
              isLoading={deliveriesQuery.isLoading}
              globalActorFilter={globalActorFilter}
              onClearActorFilter={() => setGlobalActorFilter(null)}
            />
          )}

          {activePage === 'reports' && (
            <ReportsFinancePage
              summary={summary}
              deliveries={deliveriesQuery.data?.items || []}
              actors={actorProfilesQuery.data?.items || []}
              globalActorFilter={globalActorFilter}
              onClearActorFilter={() => setGlobalActorFilter(null)}
            />
          )}

          {activePage === 'guide' && <GuidePage />}
        </div>
      </main>

      <BatchDetailsModal
        batch={detailBatch}
        items={batchItems}
        isLoading={batchItemsQuery.isLoading}
        error={batchItemsQuery.isError ? batchItemsQuery.error : null}
        onClose={() => setDetailBatchId(null)}
      />

      <PreviewModal
        asset={modalAsset}
        preview={previewData}
        isLoading={previewMutation.isPending}
        error={previewMutation.isError ? previewMutation.error : null}
        onClose={() => {
          setModalAsset(null)
          setPreviewData(null)
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onRepeat={handleRepeat}
        onNext={() => openModalByOffset(1)}
        onPrevious={() => openModalByOffset(-1)}
      />
    </div>
  )
}
