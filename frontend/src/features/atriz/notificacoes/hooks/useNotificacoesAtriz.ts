import { useMemo } from 'react'
import { useCreatorOverview } from '@/features/atriz/creator/hooks/useCreatorDashboard'
import { creatorHumanText } from '@/features/atriz/creator/utils'
import type { NotificacaoAtriz } from '@/features/atriz/notificacoes/types'

export function useNotificacoesAtriz() {
  const query = useCreatorOverview()
  const data = useMemo<NotificacaoAtriz[] | undefined>(() => {
    const overview = query.data
    if (!overview) return undefined

    const fallbackDate = overview.security.mappingCase?.updatedAt || overview.security.mappingCase?.submittedAt || overview.actor.updatedAt || new Date().toISOString()
    const pendencies = overview.security.pendencies.map((pendency) => ({
      id: `pendency-${pendency.code}`,
      tipo: 'plataforma' as const,
      titulo: pendency.title,
      descricao: creatorHumanText(pendency.description, 'Há uma etapa do seu cadastro que precisa de atenção.'),
      lida: false,
      criadaEm: fallbackDate,
    }))

    const sales = overview.recentSales.map((sale) => ({
      id: `sale-${sale.id}`,
      tipo: 'pagamento_recebido' as const,
      titulo: 'Nova venda registrada',
      descricao: `${sale.productTitle}: ${sale.netPayoutCredits} créditos estimados para você.`,
      lida: false,
      criadaEm: sale.createdAt || fallbackDate,
    }))

    return [...pendencies, ...sales].sort((left, right) => new Date(right.criadaEm).getTime() - new Date(left.criadaEm).getTime())
  }, [query.data])

  return { ...query, data }
}
