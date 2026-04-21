import type { Notificacao } from '@/features/cliente/notificacoes/types'

export function getNotificationDestination(n: Notificacao): string {
  switch (n.categoria) {
    case 'novo_conteudo':
    case 'nova_publicacao':
      return n.payload?.atrizSlug
        ? `/cliente/atriz/${n.payload.atrizSlug}`
        : '/cliente/feed'
    case 'geracao_concluida':
      return '/cliente/galeria'
    case 'creditos_baixos':
      return '/cliente/carteira'
    case 'aviso_geral':
    default:
      return '/cliente/feed'
  }
}

export function tempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'agora'
  if (diffMin < 60) return `${diffMin}min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d`
}
