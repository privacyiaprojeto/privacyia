import type { CreatorMediaType, CreatorMaterialType } from '@/features/atriz/creator/types'

const STATUS_LABELS: Record<string, string> = {
  not_started: 'Não iniciado',
  not_authorized: 'Pendente',
  not_configured: 'Pendente',
  draft: 'Pendente',
  pending: 'Em análise',
  pending_review: 'Em análise',
  uploaded: 'Enviado',
  registered_dry_run: 'Enviado',
  approved: 'Aprovado',
  authorized: 'Aprovado',
  active: 'Ativo',
  published: 'Publicado',
  available: 'Disponível',
  rejected: 'Requer correção',
  blocked: 'Bloqueado',
  revoked: 'Revogado',
  expired: 'Expirado',
  archived: 'Arquivado',
}

export function creatorStatusLabel(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  return STATUS_LABELS[normalized] || (normalized ? 'Em análise' : 'Pendente')
}

export function creatorStatusTone(value?: string | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (['approved', 'authorized', 'active', 'published', 'available'].includes(normalized)) {
    return 'text-emerald-400 bg-emerald-500/10'
  }
  if (['rejected', 'blocked', 'revoked', 'expired'].includes(normalized)) {
    return 'text-red-400 bg-red-500/10'
  }
  return 'text-amber-400 bg-amber-500/10'
}

export function creatorMediaTypeLabel(value?: CreatorMediaType | null) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'image' || normalized === 'imagem') return 'Imagem'
  if (normalized === 'audio' || normalized === 'live_audio' || normalized === 'audio_live') return 'Áudio'
  if (normalized === 'video' || normalized === 'short_video') return 'Vídeo'
  if (normalized === 'liveaction' || normalized === 'live_action') return 'Live Action'
  return 'Conteúdo de IA'
}

export function creatorMaterialLabel(_value?: CreatorMaterialType | string | null) {
  return 'Material de mapeamento'
}

export function formatCreatorCredits(value?: number | null) {
  const safeValue = Number.isFinite(Number(value)) ? Number(value) : 0
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(safeValue)} créditos`
}

export function formatCreatorDate(value?: string | null, includeTime = false) {
  if (!value) return 'Data não informada'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Data não informada'

  return date.toLocaleDateString('pt-BR', includeTime
    ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' })
}

export function bytesToFriendlySize(value?: number | null) {
  const bytes = Number(value || 0)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function creatorHumanText(value?: string | null, fallback = '') {
  const text = String(value || '').trim()
  if (!text) return fallback

  return text
    .replace(/co[f]re privado/gi, 'área segura de documentos')
    .replace(/co[f]re/gi, 'área de documentos')
    .replace(/RunPod/gi, 'serviço de geração')
    .replace(/Cloudflare\s+R2/gi, 'armazenamento protegido')
    .replace(/\bR2\b/g, 'armazenamento protegido')
    .replace(/\bbucket\b/gi, 'área protegida')
    .replace(/\bassets?\b/gi, 'materiais')
    .replace(/\bpayload\b/gi, 'informações')
    .replace(/\bdry[ -]?run\b/gi, 'simulação segura')
    .replace(/\bLoRA\b/g, 'modelo personalizado')
    .replace(/\bendpoints?\b/gi, 'acesso ao serviço')
    .replace(/\bHTTP\b/gi, 'conexão')
    .replace(/\bAPI\b/g, 'serviço')
    .replace(/\bKYC\b/g, 'verificação de identidade')
    .replace(/\bcompliance\b/gi, 'segurança e autorização')
    .replace(/actor_profile_id/gi, 'seu perfil')
    .replace(/not_started/gi, 'Não iniciado')
    .replace(/pending_review/gi, 'Em análise')
    .replace(/not_authorized/gi, 'Pendente')
}
